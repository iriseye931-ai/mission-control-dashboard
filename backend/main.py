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
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Config / constants
# ---------------------------------------------------------------------------

OPENVIKING_URL = os.getenv("OPENVIKING_URL", "http://127.0.0.1:1933")
OPENVIKING_HEALTH = f"{OPENVIKING_URL}/health"
OPENVIKING_KEY = os.getenv("OPENVIKING_KEY", "")

MEMORY_MCP_URL = os.getenv("MEMORY_MCP_URL", "http://127.0.0.1:2033/mcp")
OPENCLAW_MCP_URL = os.getenv("OPENCLAW_MCP_URL", "http://127.0.0.1:2034/mcp")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODELS_URL = f"{OLLAMA_URL}/v1/models"

MEMORY_MONITOR_LOG = Path.home() / ".mlx" / "logs" / "memory-monitor.log"
MLX_ERROR_LOG = Path.home() / ".mlx" / "logs" / "mlx-server.error.log"
AMP_AGENTS_DIR = Path.home() / ".agent-messaging" / "agents"
HERMES_SESSIONS_DIR = Path.home() / ".hermes" / "sessions"

MLX_SERVER_URL = os.getenv("MLX_SERVER_URL", "http://127.0.0.1:8081")
MLX_MODELS_URL = f"{MLX_SERVER_URL}/v1/models"

CRON_JOBS_PATH = Path.home() / ".hermes" / "cron" / "jobs.json"
HERMES_ENV_PATH = Path.home() / ".hermes" / ".env"
HERMES_SESSIONS_PATH = Path.home() / ".hermes" / "sessions"

HTTP_TIMEOUT = 3.0
POLL_INTERVAL = 10  # seconds

MCP_PING = {"jsonrpc": "2.0", "id": 0, "method": "ping"}
MCP_HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}

MESH_OPERATOR = os.getenv("MESH_OPERATOR", "the operator")

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
}

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
        r = await client.get(
            OPENVIKING_HEALTH,
            headers={"Authorization": f"Bearer {OPENVIKING_KEY}"},
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
                services, agents, memories = await asyncio.gather(
                    _fetch_service_health(client),
                    _fetch_agents(),
                    _fetch_memories(client),
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
                _state["last_updated"] = _now_iso()

                await _broadcast_status()
            except Exception as exc:
                print(f"[poll] error: {exc}")

            await asyncio.sleep(POLL_INTERVAL)


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
# Startup / shutdown
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def _startup():
    asyncio.create_task(_poll_loop())
    asyncio.create_task(_openviking_watchdog())
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


@app.get("/api/hermes")
async def api_hermes():
    status = await asyncio.get_event_loop().run_in_executor(None, _fetch_hermes_status)
    return status


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


@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    claude_bin = shutil.which("claude")
    if not claude_bin:
        return {"error": "claude CLI not found in PATH"}

    mesh_status = json.dumps(
        {
            "services": {k: v.get("status") for k, v in _state["services"].items()},
            "agents": [{"name": a["name"], "status": a["status"]} for a in _state["agents"]],
            "last_updated": _state["last_updated"],
        },
        indent=2,
    )

    system = ATLAS_SYSTEM_PROMPT.format(mesh_status=mesh_status)

    # Build a plain-text prompt: system context + conversation history + new message
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
