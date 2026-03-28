"""
Mission Control Dashboard — FastAPI Backend
Real-time backend for local AI mesh monitoring.
Port: 8000
"""

import asyncio
import json
import os
import shutil
import subprocess
import re
import psutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, AsyncGenerator

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Config / constants
# ---------------------------------------------------------------------------

OPENVIKING_URL = os.getenv("OPENVIKING_URL", "http://127.0.0.1:1933")
OPENVIKING_HEALTH = f"{OPENVIKING_URL}/health"
OPENVIKING_KEY = os.getenv("OPENVIKING_KEY", "")
OPENVIKING_ACCOUNT = os.getenv("OPENVIKING_ACCOUNT", "teamirs")
OPENVIKING_USER = os.getenv("OPENVIKING_USER", "iris")
RAG_INBOX = Path.home() / "Documents" / "rag" / "inbox"

MEMORY_MCP_URL = os.getenv("MEMORY_MCP_URL", "http://127.0.0.1:2033/mcp")
OPENCLAW_MCP_URL = os.getenv("OPENCLAW_MCP_URL", "http://127.0.0.1:2034/mcp")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODELS_URL = f"{OLLAMA_URL}/v1/models"

MEMORY_MONITOR_LOG = Path.home() / ".mlx" / "logs" / "memory-monitor.log"
MLX_ERROR_LOG = Path.home() / ".mlx" / "logs" / "mlx-server.error.log"
AMP_AGENTS_DIR = Path.home() / ".agent-messaging" / "agents"
HERMES_SESSIONS_DIR = Path.home() / ".hermes" / "sessions"

MLX_SERVER_URL = os.getenv("MLX_SERVER_URL", "http://127.0.0.1:8081")
WHISPER_STT_URL = os.getenv("WHISPER_STT_URL", "http://127.0.0.1:8082")
WHISPER_HEALTH = f"{WHISPER_STT_URL}/health"
MLX_MODELS_URL = f"{MLX_SERVER_URL}/v1/models"

CRON_JOBS_PATH = Path.home() / ".hermes" / "cron" / "jobs.json"
HERMES_ENV_PATH = Path.home() / ".hermes" / ".env"
HERMES_SESSIONS_PATH = Path.home() / ".hermes" / "sessions"

HTTP_TIMEOUT = 3.0
POLL_INTERVAL = 10  # seconds

GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"
TRENDING_CACHE_TTL = 6 * 3600  # 6 hours

MCP_PING = {"jsonrpc": "2.0", "id": 0, "method": "ping"}
MCP_HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}

MESH_OPERATOR = os.getenv("MESH_OPERATOR", "Punch")

ATLAS_SYSTEM_PROMPT = """You are Atlas — the lead AI agent in a local AI mesh. You are accessed via the Mission Control Dashboard. Be direct, concise, technical.

Current mesh status:
{mesh_status}"""

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Mission Control Dashboard API",
    description="Real-time backend for local AI mesh monitoring",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Shared state — updated by background tasks, read by endpoints/WS
# ---------------------------------------------------------------------------

_insights: list[dict] = []  # last 20 from mesh-subconscious
_brief_cache: dict[str, Any] = {"text": "", "generated_at": None}  # morning brief

_state: dict[str, Any] = {
    "services": {},
    "agents": [],
    "cron_jobs": [],
    "memories": [],
    "llm_models": [],
    "llm_active": None,   # which LLM backend is serving: "mlx" | None
    "memory_monitor_log": [],  # last N lines from memory monitor log
    "logs": {"mlx": [], "memory": []},
    "amp_messages": [],
    "hermes_status": {},
    "voice_active": False,
    "last_updated": None,
    "system": {},
    "trending_repos": [],
}

_trending_cache_time: float = 0.0

_ws_clients: set[WebSocket] = set()
_ws_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seconds_until(iso_str: str | None) -> int | None:
    """Return seconds from now until the given ISO timestamp, or None."""
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        delta = dt - datetime.now(timezone.utc)
        return max(0, int(delta.total_seconds()))
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Data fetchers
# ---------------------------------------------------------------------------

async def _fetch_service_health(client: httpx.AsyncClient) -> dict[str, Any]:
    services: dict[str, Any] = {}

    # OpenViking
    try:
        headers = {"Authorization": f"Bearer {OPENVIKING_KEY}"} if OPENVIKING_KEY else {}
        r = await client.get(
            OPENVIKING_HEALTH,
            headers=headers,
            timeout=HTTP_TIMEOUT,
        )
        body = r.json()
        services["openviking"] = {
            "name": "OpenViking",
            "url": OPENVIKING_HEALTH,
            "status": "up" if body.get("healthy") else "degraded",
            "detail": body,
        }
    except Exception as exc:
        services["openviking"] = {"name": "OpenViking", "status": "down", "error": str(exc)}

    # Memory MCP
    try:
        r = await client.post(MEMORY_MCP_URL, json=MCP_PING, headers=MCP_HEADERS, timeout=HTTP_TIMEOUT)
        body = r.json()
        services["memory_mcp"] = {
            "name": "Memory MCP",
            "url": MEMORY_MCP_URL,
            "status": "up" if "result" in body else "degraded",
            "detail": body,
        }
    except Exception as exc:
        services["memory_mcp"] = {"name": "Memory MCP", "status": "down", "error": str(exc)}

    # OpenClaw MCP
    try:
        r = await client.post(OPENCLAW_MCP_URL, json=MCP_PING, headers=MCP_HEADERS, timeout=HTTP_TIMEOUT)
        body = r.json()
        services["openclaw_mcp"] = {
            "name": "OpenClaw MCP",
            "url": OPENCLAW_MCP_URL,
            "status": "up" if "result" in body else "degraded",
            "detail": body,
        }
    except Exception as exc:
        services["openclaw_mcp"] = {"name": "OpenClaw MCP", "status": "down", "error": str(exc)}

    # Ollama (embeddings)
    try:
        r = await client.get(OLLAMA_MODELS_URL, timeout=HTTP_TIMEOUT)
        body = r.json()
        model_ids = [m["id"] for m in body.get("data", [])]
        services["ollama"] = {
            "name": "Ollama",
            "url": OLLAMA_MODELS_URL,
            "status": "up",
            "models": model_ids,
        }
    except Exception as exc:
        services["ollama"] = {"name": "Ollama", "status": "down", "error": str(exc)}

    # MLX server (Qwen3.5-35B-A3B)
    mlx_up = False
    try:
        r = await client.get(MLX_MODELS_URL, timeout=HTTP_TIMEOUT)
        body = r.json()
        mlx_models = [m["id"] for m in body.get("data", [])]
        # prefer local path models (start with '/') over community hub models
        local = [m for m in mlx_models if m.startswith('/')]
        active_model = local[0] if local else (mlx_models[0] if mlx_models else "unknown")
        services["mlx_server"] = {
            "name": "MLX Server",
            "url": MLX_MODELS_URL,
            "status": "up",
            "models": mlx_models,
            "active_model": active_model,
        }
        mlx_up = True
    except Exception:
        services["mlx_server"] = {"name": "MLX Server", "status": "down"}

    # Track which LLM backend is active
    _state["llm_active"] = "mlx" if mlx_up else None

    # Whisper STT server
    try:
        r = await client.get(WHISPER_HEALTH, timeout=HTTP_TIMEOUT)
        body = r.json()
        services["whisper_stt"] = {
            "name": "Whisper STT",
            "url": WHISPER_HEALTH,
            "status": "up" if body.get("status") == "ok" else "degraded",
            "model": body.get("model", "unknown"),
            "loaded": body.get("loaded", False),
        }
    except Exception as exc:
        services["whisper_stt"] = {"name": "Whisper STT", "status": "down", "error": str(exc)}

    # AI Maestro (AMP routing hub)
    try:
        r = await client.get(f"{AI_MAESTRO_URL}/health", timeout=HTTP_TIMEOUT)
        body = r.json()
        services["aimaestro"] = {
            "name": "AI Maestro",
            "url": AI_MAESTRO_URL,
            "status": "up" if body.get("status") in ("ok", "healthy") else "degraded",
            "detail": body,
        }
    except Exception as exc:
        services["aimaestro"] = {"name": "AI Maestro", "status": "down", "error": str(exc)}

    return services


# Core mesh agents — always shown, status detected from live processes/services
MESH_AGENTS = [
    {
        "id": "atlas",
        "name": "atlas",
        "label": "Atlas",
        "role": "Lead Agent",
        "model": "claude-sonnet-4-6",
        "color": "#06b6d4",
        "detect": None,  # always online — we are Atlas
    },
    {
        "id": "hermes",
        "name": "hermes",
        "label": "Hermes",
        "role": "Task Runner",
        "model": "local LLM",
        "color": "#a855f7",
        "detect": "hermes",  # pgrep pattern
    },
    {
        "id": "iriseye",
        "name": "iriseye",
        "label": "iriseye",
        "role": "OpenClaw Agent",
        "model": "local LLM",
        "color": "#10b981",
        "detect": "openclaw-gateway",
    },
]


def _is_process_running(pattern: str) -> bool:
    try:
        result = subprocess.run(
            ["pgrep", "-f", pattern],
            capture_output=True, text=True,
        )
        return result.returncode == 0
    except Exception:
        return False


async def _fetch_agents() -> list[dict[str, Any]]:
    """Build mesh agent list from live process detection."""
    agents = []
    for defn in MESH_AGENTS:
        key = defn["name"]

        if key == "atlas":
            status = "online"
            task = "Lead agent — Mission Control"
        elif defn["detect"] and await asyncio.get_event_loop().run_in_executor(
            None, _is_process_running, defn["detect"]
        ):
            status = "online"
            task = None
        else:
            status = "offline"
            task = None

        agents.append({
            "id": defn["id"],
            "name": defn["name"],
            "label": defn["label"],
            "role": defn["role"],
            "model": defn["model"],
            "color": defn["color"],
            "status": status,
            "task": task,
            "host": os.getenv("MESH_HOST", "localhost"),
            "address": None,
            "last_active": None,
        })

    return agents


def _detect_voice_active() -> bool:
    """Check if atlas-voice is currently running."""
    try:
        result = subprocess.run(
            ["pgrep", "-f", "atlas-voice"],
            capture_output=True, text=True
        )
        return result.returncode == 0
    except Exception:
        return False


def _schedule_interval_seconds(schedule: dict | str | None) -> int | None:
    """Extract interval in seconds from a Hermes schedule object."""
    if not isinstance(schedule, dict):
        return None
    kind = schedule.get("kind")
    if kind == "interval":
        minutes = schedule.get("minutes")
        if minutes:
            return int(minutes) * 60
    elif kind == "cron":
        # Parse common cron patterns to get interval
        expr = schedule.get("expr", "")
        parts = expr.split()
        if len(parts) == 5:
            minute, hour = parts[0], parts[1]
            if hour == "*" and minute.isdigit():
                return int(minute) * 60  # every N minutes
            elif minute == "0" and hour.isdigit():
                return int(hour) * 3600  # daily at hour
            elif minute == "0" and hour == "2":
                return 24 * 3600  # 2am daily
    return None


def _read_cron_jobs() -> list[dict[str, Any]]:
    """Read and parse ~/.hermes/cron/jobs.json."""
    if not CRON_JOBS_PATH.exists():
        return []
    try:
        raw = json.loads(CRON_JOBS_PATH.read_text())
        jobs_raw = raw.get("jobs", raw) if isinstance(raw, dict) else raw
        jobs = []
        for j in jobs_raw:
            next_run = j.get("next_run_at")
            schedule = j.get("schedule", {})
            interval_seconds = _schedule_interval_seconds(schedule)
            # Build schedule display
            sched_display = (
                j.get("schedule_display")
                or (schedule.get("display") if isinstance(schedule, dict) else None)
                or (schedule.get("expr") if isinstance(schedule, dict) else None)
            )
            # Prompt snippet (first 80 chars, strip newlines)
            raw_prompt = j.get("prompt", "")
            prompt_snippet = re.sub(r'\s+', ' ', raw_prompt).strip()[:80] if raw_prompt else None

            jobs.append(
                {
                    "id": j.get("id"),
                    "name": j.get("name"),
                    "schedule_display": sched_display,
                    "interval_seconds": interval_seconds,
                    "last_run_at": j.get("last_run_at"),
                    "next_run_at": next_run,
                    "next_run_in_seconds": _seconds_until(next_run),
                    "last_status": j.get("last_status"),
                    "enabled": j.get("enabled", True),
                    "state": j.get("state"),
                    "prompt_snippet": prompt_snippet,
                }
            )
        return jobs
    except Exception:
        return []


def _fetch_system_metrics() -> dict[str, Any]:
    """Collect CPU, RAM, and MLX model memory usage."""
    total_ram = psutil.virtual_memory().total
    used_ram = psutil.virtual_memory().used
    ram_pct = psutil.virtual_memory().percent

    cpu_pct = psutil.cpu_percent(interval=None)

    # MLX process memory
    mlx_ram_bytes = 0
    mlx_pid = None
    for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'memory_info']):
        try:
            cmdline = ' '.join(proc.info['cmdline'] or [])
            if 'mlx_lm' in cmdline or 'mlx-server' in cmdline:
                mlx_ram_bytes = proc.info['memory_info'].rss
                mlx_pid = proc.info['pid']
                break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    mlx_ram_pct = round((mlx_ram_bytes / total_ram) * 100, 1) if total_ram else 0

    return {
        "cpu_pct": round(cpu_pct, 1),
        "ram_pct": round(ram_pct, 1),
        "ram_used_gb": round(used_ram / 1e9, 1),
        "ram_total_gb": round(total_ram / 1e9, 1),
        "mlx_ram_pct": mlx_ram_pct,
        "mlx_ram_gb": round(mlx_ram_bytes / 1e9, 1),
        "mlx_pid": mlx_pid,
        "local_pct": round(mlx_ram_pct, 1),  # % of RAM used by local LLM
    }


async def _fetch_memories(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Fetch recent memories from Memory MCP."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "memory_recall",
            "arguments": {
                "query": "recent session activity",
                "limit": 5,
                "score_threshold": 0.01,
            },
        },
    }
    try:
        r = await client.post(MEMORY_MCP_URL, json=payload, headers=MCP_HEADERS, timeout=HTTP_TIMEOUT)
        body = r.json()
        result = body.get("result", {})
        # result may be a list or dict with content
        content = result if isinstance(result, list) else result.get("content", [])
        memories = []
        for item in content:
            if isinstance(item, dict):
                memories.append(
                    {
                        "text": item.get("text", item.get("content", str(item))),
                        "score": item.get("score"),
                        "id": item.get("id"),
                    }
                )
            elif isinstance(item, str):
                memories.append({"text": item})
        return memories
    except Exception:
        return []


def _fetch_logs(n: int = 60) -> dict[str, list[str]]:
    """Return last N lines from MLX error log and memory monitor log."""
    def tail(path: Path, count: int) -> list[str]:
        try:
            if not path.exists():
                return []
            lines = path.read_text(errors="replace").splitlines()
            return lines[-count:] if len(lines) > count else lines
        except Exception:
            return []
    return {
        "mlx": tail(MLX_ERROR_LOG, n),
        "memory": tail(MEMORY_MONITOR_LOG, 30),
    }


def _fetch_amp_messages() -> list[dict]:
    """Read recent AMP messages for atlas (inbox + sent)."""
    messages = []
    try:
        atlas_dir = AMP_AGENTS_DIR / "atlas" / "messages"
        for folder in ("inbox", "sent"):
            folder_path = atlas_dir / folder
            if not folder_path.exists():
                continue
            for subdir in folder_path.iterdir():
                if not subdir.is_dir():
                    continue
                for msg_file in sorted(subdir.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)[:5]:
                    try:
                        data = json.loads(msg_file.read_text())
                        messages.append({
                            "id": data.get("id", msg_file.stem),
                            "direction": folder,
                            "from": data.get("from", data.get("sender", "?")),
                            "to": data.get("to", data.get("recipient", "?")),
                            "subject": data.get("subject", ""),
                            "body": (data.get("body", data.get("message", data.get("content", ""))) or "")[:300],
                            "timestamp": data.get("timestamp", data.get("sent_at", "")),
                            "type": data.get("type", "notification"),
                        })
                    except Exception:
                        continue
    except Exception:
        pass
    messages.sort(key=lambda m: m.get("timestamp", ""), reverse=True)
    return messages[:20]


def _fetch_hermes_status() -> dict:
    """Get latest Hermes session info."""
    try:
        sessions = sorted(
            [f for f in HERMES_SESSIONS_DIR.glob("session_*.json") if "request_dump" not in f.name],
            key=lambda f: f.stat().st_mtime,
            reverse=True,
        )
        if not sessions:
            return {"status": "no sessions"}
        latest = json.loads(sessions[0].read_text())
        return {
            "session_id": sessions[0].stem,
            "model": latest.get("model", latest.get("default", "?")),
            "status": latest.get("status", "unknown"),
            "task": latest.get("task", latest.get("taskDescription")),
            "created_at": latest.get("created_at", ""),
            "modified": sessions[0].stat().st_mtime,
        }
    except Exception:
        return {"status": "unavailable"}


def _fetch_memory_monitor_log(n: int = 50) -> list[str]:
    """Return last N lines from the memory monitor log."""
    try:
        if not MEMORY_MONITOR_LOG.exists():
            return []
        lines = MEMORY_MONITOR_LOG.read_text().splitlines()
        return lines[-n:] if len(lines) > n else lines
    except Exception:
        return []


async def _fetch_trending_repos(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Fetch top 5 trending GitHub repos (new repos last 7 days by stars). Cached 6h."""
    import time
    global _trending_cache_time

    if time.monotonic() - _trending_cache_time < TRENDING_CACHE_TTL:
        return _state["trending_repos"]  # return cached

    try:
        since = (datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) - timedelta(days=7)).strftime("%Y-%m-%d")

        r = await client.get(
            GITHUB_SEARCH_URL,
            params={
                "q": f"created:>{since}",
                "sort": "stars",
                "order": "desc",
                "per_page": 5,
            },
            headers={"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
            timeout=10.0,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
        repos = []
        for item in items:
            repos.append({
                "id": item.get("id"),
                "name": item.get("full_name"),
                "description": (item.get("description") or "")[:120],
                "stars": item.get("stargazers_count", 0),
                "language": item.get("language"),
                "url": item.get("html_url"),
                "created_at": item.get("created_at"),
                "topics": item.get("topics", [])[:4],
            })
        _trending_cache_time = time.monotonic()
        return repos
    except Exception as exc:
        print(f"[trending] fetch error: {exc}")
        return _state.get("trending_repos", [])  # keep stale data on error


# ---------------------------------------------------------------------------
# OpenViking watchdog
# ---------------------------------------------------------------------------

OPENVIKING_PLIST = Path.home() / "Library/LaunchAgents/local.openviking-server.plist"
OV_LOCK_PATH = Path.home() / ".openviking/data/vectordb/context/store/LOCK"
OV_PID_PATH  = Path.home() / ".openviking/data/.openviking.pid"
OV_WATCHDOG_INTERVAL = 30   # seconds between health checks
OV_RESTART_COOLDOWN  = 60   # seconds to wait after a restart before checking again

_ov_last_restart: float = 0.0


def _ov_restart_sync() -> str:
    """Blocking restart — runs in executor. Returns a log message."""
    import time
    global _ov_last_restart

    # Kill any zombie processes holding the lock
    subprocess.run(["pkill", "-f", "create_app"], capture_output=True)
    time.sleep(1)

    # Remove stale lock files
    for path in (OV_LOCK_PATH, OV_PID_PATH):
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass

    # Restart via launchctl
    subprocess.run(
        ["launchctl", "unload", str(OPENVIKING_PLIST)],
        capture_output=True,
    )
    time.sleep(1)
    subprocess.run(
        ["launchctl", "load", str(OPENVIKING_PLIST)],
        capture_output=True,
    )

    _ov_last_restart = time.monotonic()
    return "[watchdog] OpenViking restarted via launchctl"


async def _openviking_watchdog():
    """Polls OpenViking health every 30s and restarts if down."""
    import time
    await asyncio.sleep(15)  # give it time to come up on first boot

    async with httpx.AsyncClient() as client:
        while True:
            try:
                # Skip check if we just restarted — give it time to boot
                if time.monotonic() - _ov_last_restart < OV_RESTART_COOLDOWN:
                    await asyncio.sleep(OV_WATCHDOG_INTERVAL)
                    continue

                r = await client.get(
                    OPENVIKING_HEALTH,
                    headers={"Authorization": f"Bearer {OPENVIKING_KEY}"},
                    timeout=5.0,
                )
                if not r.json().get("healthy"):
                    raise ValueError("unhealthy")

            except Exception as exc:
                print(f"[watchdog] OpenViking down ({exc}), restarting…")
                msg = await asyncio.get_event_loop().run_in_executor(None, _ov_restart_sync)
                print(msg)

            await asyncio.sleep(OV_WATCHDOG_INTERVAL)


# ---------------------------------------------------------------------------
# Background polling task
# ---------------------------------------------------------------------------

async def _poll_loop():
    async with httpx.AsyncClient() as client:
        while True:
            try:
                services, agents, memories, trending_repos = await asyncio.gather(
                    _fetch_service_health(client),
                    _fetch_agents(),
                    _fetch_memories(client),
                    _fetch_trending_repos(client),
                )
                cron_jobs = _read_cron_jobs()
                voice_active = await asyncio.get_event_loop().run_in_executor(
                    None, _detect_voice_active
                )

                system, logs, amp_messages, hermes_status, memory_monitor_log = await asyncio.gather(
                    asyncio.get_event_loop().run_in_executor(None, _fetch_system_metrics),
                    asyncio.get_event_loop().run_in_executor(None, _fetch_logs),
                    asyncio.get_event_loop().run_in_executor(None, _fetch_amp_messages),
                    asyncio.get_event_loop().run_in_executor(None, _fetch_hermes_status),
                    asyncio.get_event_loop().run_in_executor(None, _fetch_memory_monitor_log),
                )
                _state["services"] = services
                _state["agents"] = agents
                _state["cron_jobs"] = cron_jobs
                _state["memories"] = memories
                _state["voice_active"] = voice_active
                _state["system"] = system
                _state["logs"] = logs
                _state["amp_messages"] = amp_messages
                _state["hermes_status"] = hermes_status
                _state["memory_monitor_log"] = memory_monitor_log
                _state["trending_repos"] = trending_repos
                _state["last_updated"] = _now_iso()

                await _broadcast_status()
            except Exception as exc:
                print(f"[poll] error: {exc}")

            await asyncio.sleep(POLL_INTERVAL)


async def _broadcast_insight(insight: dict):
    data = json.dumps({"type": "insight", "insight": insight})
    async with _ws_lock:
        dead: set[WebSocket] = set()
        for ws in _ws_clients:
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)
        _ws_clients.difference_update(dead)


async def _broadcast_status():
    payload = {
        "type": "status_update",
        "timestamp": _now_iso(),
        "services": _state["services"],
        "agents": _state["agents"],
        "cron_jobs": _state["cron_jobs"],
        "memories": _state["memories"],
        "llm_active": _state["llm_active"],
        "voice_active": _state["voice_active"],
        "system": _state["system"],
        "memory_monitor_log": _state["memory_monitor_log"],
        "logs": _state["logs"],
        "amp_messages": _state["amp_messages"],
        "hermes_status": _state["hermes_status"],
        "trending_repos": _state["trending_repos"],
    }
    data = json.dumps(payload)
    async with _ws_lock:
        dead: set[WebSocket] = set()
        for ws in _ws_clients:
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)
        _ws_clients.difference_update(dead)


# ---------------------------------------------------------------------------
# MLX chat helpers
# ---------------------------------------------------------------------------

PROJECTS_DIR = Path.home() / "Projects"
BRIEF_REFRESH_HOURS = 6  # regenerate brief if older than this


def _mlx_model_id() -> str:
    """Return the first available model ID from the MLX server, fallback string."""
    try:
        resp = httpx.get(MLX_MODELS_URL, timeout=2.0)
        data = resp.json()
        models = data.get("data", [])
        if models:
            return models[0]["id"]
    except Exception:
        pass
    return "local"


async def _mlx_chat_stream(
    messages: list[dict],
    max_tokens: int = 2048,
) -> AsyncGenerator[str, None]:
    """
    Stream chat completions from MLX server using OpenAI-compatible SSE.
    Yields SSE-formatted strings: 'data: {...}\n\n'
    """
    model = _mlx_model_id()
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }
    url = f"{MLX_SERVER_URL}/v1/chat/completions"

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", url, json=payload) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                yield f"data: {json.dumps({'error': f'MLX error {resp.status_code}: {body.decode()}'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if raw == "[DONE]":
                    yield "data: [DONE]\n\n"
                    return
                try:
                    chunk = json.loads(raw)
                    delta = chunk["choices"][0]["delta"]
                    token = delta.get("content", "")
                    if token:
                        yield f"data: {json.dumps({'token': token})}\n\n"
                except Exception:
                    continue


async def _mlx_chat_complete(messages: list[dict], max_tokens: int = 1024) -> str:
    """Non-streaming completion from MLX. Returns full response text."""
    model = _mlx_model_id()
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }
    url = f"{MLX_SERVER_URL}/v1/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        return f"[MLX unavailable: {exc}]"


def _git_log_since(repo: Path, hours: int = 24) -> list[str]:
    """Return one-line git log entries from a repo since N hours ago."""
    try:
        result = subprocess.run(
            ["git", "log", f"--since={hours} hours ago", "--oneline", "--no-merges"],
            cwd=repo,
            capture_output=True,
            text=True,
            timeout=5,
        )
        lines = result.stdout.strip().splitlines()
        return lines[:10]  # cap at 10 per repo
    except Exception:
        return []


def _collect_git_activity(hours: int = 24) -> dict[str, list[str]]:
    """Scan ~/Projects for git repos with recent activity."""
    activity: dict[str, list[str]] = {}
    if not PROJECTS_DIR.exists():
        return activity
    for repo in PROJECTS_DIR.iterdir():
        if (repo / ".git").exists():
            commits = _git_log_since(repo, hours)
            if commits:
                activity[repo.name] = commits
    return activity


async def _build_brief_context() -> str:
    """Assemble context for the morning brief."""
    lines: list[str] = []

    # Git activity
    activity = _collect_git_activity(24)
    if activity:
        lines.append("## Recent Git Activity (last 24h)")
        for repo, commits in activity.items():
            lines.append(f"\n**{repo}**")
            for c in commits:
                lines.append(f"  - {c}")
    else:
        lines.append("## Git Activity\nNo commits in the last 24 hours.")

    # Agent + service state
    agents = _state.get("agents", [])
    services = _state.get("services", {})
    if agents or services:
        lines.append("\n## Mesh State")
        for a in agents:
            status = a.get("status", "unknown")
            lines.append(f"  - {a.get('name', '?')}: {status}")
        for svc, info in services.items():
            st = info.get("status", "?") if isinstance(info, dict) else str(info)
            lines.append(f"  - {svc}: {st}")

    # Recent memories
    memories = _state.get("memories", [])
    if memories:
        lines.append("\n## Recent Memory Activity")
        for m in memories[:5]:
            content = m.get("content", m.get("text", str(m)))[:120]
            lines.append(f"  - {content}")

    # Pending items from subconscious
    pending_path = Path.home() / ".claude" / "subconscious" / "pending_items.md"
    if pending_path.exists():
        pending_text = pending_path.read_text().strip()
        if pending_text:
            lines.append("\n## Pending Items")
            # Extract only In Progress + Backlog sections, skip Completed
            in_section = False
            for line in pending_text.split("\n"):
                if line.startswith("## Completed") or line.startswith("## Deferred"):
                    in_section = False
                elif line.startswith("##"):
                    in_section = "completed" not in line.lower() and "deferred" not in line.lower()
                elif in_section and line.strip():
                    lines.append(f"  {line}")

    # System snapshot
    system = _state.get("system", {})
    if system:
        cpu = system.get("cpu_percent", "?")
        ram = system.get("memory_percent", "?")
        lines.append(f"\n## System\n  CPU: {cpu}%  RAM: {ram}%")

    return "\n".join(lines)


async def _generate_brief(force: bool = False) -> str:
    """Generate or return cached morning brief."""
    global _brief_cache

    now = datetime.now(timezone.utc)
    age_ok = False
    if _brief_cache["generated_at"]:
        age = (now - _brief_cache["generated_at"]).total_seconds() / 3600
        age_ok = age < BRIEF_REFRESH_HOURS

    if not force and age_ok and _brief_cache["text"]:
        return _brief_cache["text"]

    # Wait a bit for state to populate on startup
    if not _state.get("last_updated"):
        return "Mesh state loading — try again in a moment."

    context = await _build_brief_context()
    messages = [
        {
            "role": "system",
            "content": (
                "You are Atlas, lead AI agent. Generate a concise morning brief for Punch "
                "(the operator). Cover: what changed overnight, what needs attention, "
                "what's healthy. Be direct and specific. Max 200 words. No fluff."
            ),
        },
        {"role": "user", "content": f"Current mesh snapshot:\n\n{context}\n\nGenerate the brief."},
    ]

    text = await _mlx_chat_complete(messages, max_tokens=400)
    _brief_cache = {"text": text, "generated_at": now}
    return text


async def _generate_brief_on_startup():
    """Wait for first poll to complete, then generate brief."""
    # Wait until state is populated (up to 60s)
    for _ in range(12):
        await asyncio.sleep(5)
        if _state.get("last_updated"):
            break
    await _generate_brief()


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def _startup():
    asyncio.create_task(_poll_loop())
    asyncio.create_task(_openviking_watchdog())
    asyncio.create_task(_generate_brief_on_startup())
    print(f"[startup] Mission Control backend on :8000 — polling every {POLL_INTERVAL}s, watchdog active")


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def api_health():
    return {
        "services": _state["services"],
        "last_updated": _state["last_updated"],
    }


@app.get("/api/agents")
async def api_agents():
    return {"agents": _state["agents"]}


@app.get("/api/cron")
async def api_cron():
    # Recompute next_run_in_seconds on every request so countdown stays fresh
    jobs = []
    for j in _state["cron_jobs"]:
        job = dict(j)
        job["next_run_in_seconds"] = _seconds_until(job.get("next_run_at"))
        jobs.append(job)
    return {"jobs": jobs}


@app.get("/api/memories")
async def api_memories():
    return {"memories": _state["memories"]}


@app.get("/api/system")
async def api_system():
    metrics = await asyncio.get_event_loop().run_in_executor(None, _fetch_system_metrics)
    return metrics


@app.get("/api/memory-monitor-log")
async def api_memory_monitor_log(lines: int = 50):
    log = await asyncio.get_event_loop().run_in_executor(None, lambda: _fetch_memory_monitor_log(lines))
    return {"lines": log, "path": str(MEMORY_MONITOR_LOG)}


@app.get("/api/logs")
async def api_logs(n: int = 60):
    logs = await asyncio.get_event_loop().run_in_executor(None, lambda: _fetch_logs(n))
    return logs


@app.get("/api/amp")
async def api_amp():
    messages = await asyncio.get_event_loop().run_in_executor(None, _fetch_amp_messages)
    return {"messages": messages}


AI_MAESTRO_URL = os.getenv("AI_MAESTRO_URL", "http://localhost:23000")
_ANSI_RE = re.compile(r'\x1b\[[0-9;]*m')


async def _fetch_maestro_messages() -> list[dict[str, Any]]:
    """Fetch latest 20 messages for claude/atlas from AI Maestro API."""
    url = f"{AI_MAESTRO_URL}/api/agents/claude/messages"
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        return [{"error": str(exc)}]

    raw = data if isinstance(data, list) else data.get("messages", data.get("data", []))
    messages = []
    for item in raw[:20]:
        if not isinstance(item, dict):
            continue
        body = item.get("body", item.get("message", item.get("content", ""))) or ""
        body = _ANSI_RE.sub("", str(body))
        preview = body[:120]
        messages.append({
            "id": item.get("id", item.get("message_id", "")),
            "from": item.get("from", item.get("sender", item.get("from_agent", "?"))),
            "subject": item.get("subject", item.get("type", "")),
            "timestamp": item.get("timestamp", item.get("sent_at", item.get("created_at", ""))),
            "status": item.get("status", item.get("read", "unread") if isinstance(item.get("read"), str) else ("read" if item.get("read") else "unread")),
            "preview": preview,
        })
    return messages


@app.get("/api/amp/messages")
async def api_amp_messages():
    """Fetch latest 20 AMP messages for atlas/claude from AI Maestro."""
    messages = await _fetch_maestro_messages()
    return {"messages": messages}


class AmpSendRequest(BaseModel):
    recipient: str
    subject: str
    message: str
    type: str = "notification"


@app.post("/api/amp/send")
async def api_amp_send(req: AmpSendRequest):
    """Send an AMP message via amp-send CLI."""
    amp_bin = "/Users/iris/.local/bin/amp-send"
    env = {**os.environ, "PATH": f"/Users/iris/.local/bin:{os.environ.get('PATH', '')}"}
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: subprocess.run(
                [amp_bin, req.recipient, req.subject, req.message, "--type", req.type],
                capture_output=True,
                text=True,
                timeout=15,
                env=env,
            ),
        )
        if result.returncode != 0:
            err = result.stderr.strip() or f"exit {result.returncode}"
            return {"ok": False, "error": err}
        return {"ok": True, "output": result.stdout.strip()}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


_BRIDGE_LOGS = [
    Path.home() / ".agent-messaging/agents/hermes/bridge.log",
    Path.home() / ".agent-messaging/agents/iriseye/bridge.log",
]
_BRIDGE_EVENT_RE = re.compile(
    r'\[(?P<ts>[^\]]+)\] \[(?P<id>[^\]]+)\] (?P<msg>.+)'
)


def _fetch_amp_events() -> list[dict]:
    events: list[dict] = []
    for log_path in _BRIDGE_LOGS:
        agent = log_path.parts[-3]
        try:
            lines = log_path.read_text().splitlines()[-60:]
        except Exception:
            continue
        for line in lines:
            m = _BRIDGE_EVENT_RE.match(line)
            if not m:
                continue
            msg = m.group("msg")
            if "responded via" in msg or "reply sent" in msg or "route=" in msg:
                events.append({
                    "agent": agent,
                    "ts": m.group("ts"),
                    "id": m.group("id"),
                    "msg": msg,
                })
    events.sort(key=lambda e: e["ts"], reverse=True)
    return events[:30]


@app.get("/api/amp/events")
async def api_amp_events():
    events = await asyncio.get_event_loop().run_in_executor(None, _fetch_amp_events)
    return {"events": events}


@app.get("/api/hermes")
async def api_hermes():
    status = await asyncio.get_event_loop().run_in_executor(None, _fetch_hermes_status)
    return status


@app.get("/api/trending")
async def api_trending():
    return {"repos": _state["trending_repos"], "cached": _trending_cache_time > 0}


class InsightPayload(BaseModel):
    timestamp: str
    severity: str
    summary: str
    insights: list = []
    actions: list = []


@app.post("/api/insights")
async def api_insights_post(payload: InsightPayload):
    global _insights
    record = payload.model_dump()
    _insights = ([record] + _insights)[:20]
    # Broadcast to all WS clients immediately
    await _broadcast_insight(record)
    return {"ok": True}


@app.get("/api/insights")
async def api_insights_get():
    return {"insights": _insights}


@app.get("/api/status")
async def api_status():
    jobs = []
    for j in _state["cron_jobs"]:
        job = dict(j)
        job["next_run_in_seconds"] = _seconds_until(job.get("next_run_at"))
        jobs.append(job)
    return {
        "timestamp": _now_iso(),
        "last_updated": _state["last_updated"],
        "services": _state["services"],
        "agents": _state["agents"],
        "cron_jobs": jobs,
        "memories": _state["memories"],
        "llm_models": _state["llm_models"],
    }


# ---------------------------------------------------------------------------
# Chat endpoint — shells out to `claude -p` (requires claude CLI in PATH)
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


def _build_atlas_messages(req: "ChatRequest") -> list[dict]:
    """Build OpenAI-format messages for Atlas chat."""
    mesh_status = json.dumps(
        {
            "services": {k: v.get("status") for k, v in _state["services"].items()},
            "agents": [{"name": a["name"], "status": a["status"]} for a in _state["agents"]],
            "last_updated": _state["last_updated"],
        },
        indent=2,
    )
    system_content = ATLAS_SYSTEM_PROMPT.format(mesh_status=mesh_status)
    messages: list[dict] = [{"role": "system", "content": system_content}]
    for m in req.history:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": req.message})
    return messages


@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    """Non-streaming chat via MLX (falls back to Claude CLI if MLX is down)."""
    # Try MLX first
    if _state.get("llm_active") == "mlx":
        messages = _build_atlas_messages(req)
        text = await _mlx_chat_complete(messages)
        if not text.startswith("[MLX unavailable"):
            return {"response": text}

    # Fallback: Claude CLI
    claude_bin = shutil.which("claude")
    if not claude_bin:
        return {"error": "MLX unavailable and claude CLI not found in PATH"}

    mesh_status = json.dumps(
        {
            "services": {k: v.get("status") for k, v in _state["services"].items()},
            "agents": [{"name": a["name"], "status": a["status"]} for a in _state["agents"]],
            "last_updated": _state["last_updated"],
        },
        indent=2,
    )
    system = ATLAS_SYSTEM_PROMPT.format(mesh_status=mesh_status)
    parts = [system, ""]
    for m in req.history:
        prefix = MESH_OPERATOR if m.role == "user" else "Atlas"
        parts.append(f"{prefix}: {m.content}")
    parts.append(f"{MESH_OPERATOR}: {req.message}")
    parts.append("Atlas:")
    prompt = "\n".join(parts)

    try:
        result = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subprocess.run(
                    [claude_bin, "-p", prompt],
                    capture_output=True,
                    text=True,
                    timeout=60,
                ),
            ),
            timeout=65,
        )
        if result.returncode != 0:
            err = result.stderr.strip() or "non-zero exit"
            return {"error": f"claude CLI error: {err}"}
        text = result.stdout.strip()
        return {"response": text or "No response generated"}
    except asyncio.TimeoutError:
        return {"error": "Atlas timed out"}
    except Exception as exc:
        return {"error": f"Chat failed: {exc}"}


@app.post("/api/chat/stream")
async def api_chat_stream(req: ChatRequest):
    """
    Streaming Atlas chat via MLX server (SSE).
    Falls back to non-streaming Claude CLI if MLX is down.

    SSE events:
      data: {"token": "..."}\n\n   — incremental token
      data: [DONE]\n\n             — stream complete
      data: {"error": "..."}\n\n   — error
    """
    if _state.get("llm_active") != "mlx":
        # MLX not up — run non-streaming and emit as single chunk
        async def _fallback_stream():
            result = await api_chat(req)
            text = result.get("response") or result.get("error", "No response")
            yield f"data: {json.dumps({'token': text})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(_fallback_stream(), media_type="text/event-stream")

    messages = _build_atlas_messages(req)

    return StreamingResponse(
        _mlx_chat_stream(messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/brief")
async def api_brief(refresh: bool = False):
    """
    Return the morning brief. Pass ?refresh=true to force regeneration.
    The brief is auto-generated at startup and cached for BRIEF_REFRESH_HOURS.
    """
    text = await _generate_brief(force=refresh)
    return {
        "brief": text,
        "generated_at": _brief_cache["generated_at"].isoformat() if _brief_cache["generated_at"] else None,
    }


@app.post("/api/stt")
async def api_stt(file: UploadFile = File(...)):
    """
    Proxy audio to the local Whisper STT server at :8082.
    Accepts any audio format the browser sends (webm, wav, etc).
    Returns OpenAI-compatible {"text": "..."}.
    """
    audio_bytes = await file.read()
    filename = file.filename or "audio.webm"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{WHISPER_STT_URL}/v1/audio/transcriptions",
                files={"file": (filename, audio_bytes, file.content_type or "audio/webm")},
                data={"model": "whisper-1"},
            )
            if resp.status_code != 200:
                return {"error": f"Whisper STT error {resp.status_code}", "text": ""}
            return resp.json()
    except Exception as exc:
        return {"error": f"STT unavailable: {exc}", "text": ""}


# ---------------------------------------------------------------------------
# RAG — Document search via OpenViking
# ---------------------------------------------------------------------------

def _ov_headers() -> dict:
    h = {"X-OpenViking-Account": OPENVIKING_ACCOUNT, "X-OpenViking-User": OPENVIKING_USER}
    if OPENVIKING_KEY:
        h["Authorization"] = f"Bearer {OPENVIKING_KEY}"
    return h


class RAGSearchRequest(BaseModel):
    query: str
    limit: int = 8


class RAGIngestRequest(BaseModel):
    path: str | None = None


@app.post("/api/rag/search")
async def api_rag_search(req: RAGSearchRequest):
    """Semantic search across documents in OpenViking RAG inbox."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{OPENVIKING_URL}/api/v1/search/search",
                headers=_ov_headers(),
                json={"query": req.query, "limit": req.limit},
            )
            if resp.status_code != 200:
                return {"error": f"Search error {resp.status_code}", "results": []}
            data = resp.json()
            result = data.get("result", {})
            # Combine memories and resources, prefer resources for doc search
            items = result.get("resources", []) + result.get("memories", [])
            results = [
                {
                    "uri": r.get("uri", ""),
                    "score": round(r.get("score", 0), 4),
                    "abstract": r.get("abstract", ""),
                    "context_type": r.get("context_type", ""),
                }
                for r in items[:req.limit]
            ]
            return {"results": results}
    except Exception as exc:
        return {"error": str(exc), "results": []}


@app.post("/api/rag/ingest")
async def api_rag_ingest(req: RAGIngestRequest):
    """
    Scan inbox and upload any files not yet in OpenViking.
    Uses temp_upload → resources/parent flow which correctly indexes content.
    If req.path is set, ingest only that file; otherwise scan the whole inbox.
    """
    RAG_INBOX.mkdir(parents=True, exist_ok=True)

    if req.path:
        files_to_ingest = [Path(req.path)]
    else:
        files_to_ingest = [f for f in RAG_INBOX.iterdir() if f.is_file()]

    if not files_to_ingest:
        return {"ok": True, "ingested": 0, "message": "Inbox is empty"}

    ingested = 0
    errors = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for fpath in files_to_ingest:
            try:
                # Step 1: temp upload
                with open(fpath, "rb") as fh:
                    up = await client.post(
                        f"{OPENVIKING_URL}/api/v1/resources/temp_upload",
                        headers=_ov_headers(),
                        files={"file": (fpath.name, fh, "application/octet-stream")},
                    )
                if up.status_code != 200:
                    errors.append(f"{fpath.name}: upload failed {up.status_code}")
                    continue
                temp_path = up.json().get("result", {}).get("temp_path")
                if not temp_path:
                    errors.append(f"{fpath.name}: no temp_path")
                    continue

                # Step 2: register under rag-inbox parent
                add = await client.post(
                    f"{OPENVIKING_URL}/api/v1/resources",
                    headers=_ov_headers(),
                    json={
                        "temp_path": temp_path,
                        "parent": "viking://resources/rag-inbox",
                        "reason": f"RAG inbox: {fpath.name}",
                    },
                )
                if add.status_code == 200:
                    ingested += 1
                else:
                    errors.append(f"{fpath.name}: register failed {add.status_code}")
            except Exception as exc:
                errors.append(f"{fpath.name}: {exc}")

    return {"ok": True, "ingested": ingested, "errors": errors}


@app.get("/api/rag/status")
async def api_rag_status():
    """Returns count of files in inbox and whether OpenViking is reachable."""
    RAG_INBOX.mkdir(parents=True, exist_ok=True)
    files = list(RAG_INBOX.iterdir())
    inbox_count = len([f for f in files if f.is_file()])
    return {
        "inbox_path": str(RAG_INBOX),
        "inbox_count": inbox_count,
        "inbox_files": [f.name for f in files if f.is_file()][:20],
    }


@app.post("/api/rag/upload")
async def api_rag_upload(file: UploadFile = File(...)):
    """Upload a file directly into the RAG inbox."""
    RAG_INBOX.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or "upload").name
    dest = RAG_INBOX / safe_name
    content = await file.read()
    dest.write_bytes(content)
    return {"filename": safe_name, "size": len(content)}


# ---------------------------------------------------------------------------
# TTS
# ---------------------------------------------------------------------------

class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"


@app.post("/api/tts")
async def api_tts(req: TTSRequest):
    """Convert text to speech using edge-tts and return mp3 audio."""
    import edge_tts

    text = req.text.strip()
    if not text:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="text is empty")

    communicate = edge_tts.Communicate(text, req.voice)

    async def audio_stream():
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    return StreamingResponse(audio_stream(), media_type="audio/mpeg")


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    async with _ws_lock:
        _ws_clients.add(ws)

    # Send current state immediately on connect
    payload = {
        "type": "status_update",
        "timestamp": _now_iso(),
        "services": _state["services"],
        "agents": _state["agents"],
        "cron_jobs": _state["cron_jobs"],
        "memories": _state["memories"],
        "llm_active": _state["llm_active"],
        "voice_active": _state["voice_active"],
        "trending_repos": _state["trending_repos"],
        "insights": _insights,
    }
    try:
        await ws.send_text(json.dumps(payload))
    except Exception:
        pass

    try:
        while True:
            # Keep alive — client messages are ignored but connection is maintained
            await ws.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        async with _ws_lock:
            _ws_clients.discard(ws)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
