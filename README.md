# Agent Mesh Mission Control

Real-time dashboard for multi-agent AI systems — built for the **Claude Code + Hermes + OpenClaw** stack. One command to run. No cloud. No API keys.

![Dashboard](https://img.shields.io/badge/React_19-Vite-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-WebSockets-green) ![MLX](https://img.shields.io/badge/MLX-Qwen3.5_35B-green) ![License](https://img.shields.io/badge/license-MIT-purple)

![Mission Control Dashboard](assets/dashboard-full.png)

---

## What it shows

Most local AI setups are invisible. Agents run in separate terminals, routing decisions disappear into logs, memory health is hard to interpret, and operator state gets scattered across tools. This dashboard pulls that into one live surface.

- **Permanent agent dock** — Lead, Hermes, and IrisEye stay pinned with status, model, presence, runtime, and current task
- **Cinematic mesh sphere** — animated agent/service topology with active-node motion, routing emphasis, and memory-aware link states
- **Ops strip + alerts** — live service health, memory mode, route target, and highest-priority operator alert at a glance
- **Operator utility block** — cron, audit, queue, and memory alert counts without leaving the main view
- **System panel** — CPU, RAM, MLX, and local-use telemetry in the canvas HUD
- **Bottom telemetry rail** — quick system totals for memory, MLX load, CPU load, disk, and mesh availability
- **Memory route intelligence** — backend memory summary, cause ranking, and routing impact surfaced directly in the dashboard
- **Clickable summaries** — operator chips and service indicators focus the matching service or agent in the mesh

---

## Design

Premium dark-mode terminal aesthetic with a mesh-first operator layout. No cloud dependency, no tab hunting, no fake glassmorphism.

- **Mesh-first composition** — the sphere is the product center, not a decorative background
- **Permanent operator dock** — agent state stays visible instead of hiding behind modal panels or tabs
- **Responsive HUD clearance** — the sphere respects the top operator stack and side dock instead of overlapping them
- **Unified accent language** — warm gold, cyan, violet, amber, and red are used consistently for identity and state
- **State-aware motion** — node glow, reticles, and memory-path coloring respond to live routing and degradation causes

---

## Quick Start

```bash
git clone https://github.com/iriseye931-ai/mission-control-dashboard
cd mission-control-dashboard
docker-compose up --build
```

- Dashboard: http://localhost:3000
- Backend API: http://localhost:8000
- WebSocket: `ws://localhost:8000/ws`

No config required — the backend polls your local services and shows live status immediately.

---

## Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Mesh Doctor:**
```bash
cd backend
./venv/bin/python mesh_doctor.py
```
Runs a local-first operational check over Mission Control, Hermes, AI Maestro, cron freshness, routing policy, and stale agents.

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Connecting your agents

The backend polls your local services and broadcasts state over WebSocket. Push events directly from any agent via the REST API.

### Codex + Claude Inbox

Mission Control now includes a shared local inbox so two terminals can coordinate through one file-backed channel:

- shared inbox file:
  `~/.mesh/agent_inbox.jsonl`
- terminal CLI:
  [`backend/agent_inbox.py`](/Users/iris/Projects/mission-control-dashboard/backend/agent_inbox.py)
- convenience wrappers:
  [`backend/codex-listen.sh`](/Users/iris/Projects/mission-control-dashboard/backend/codex-listen.sh)
  [`backend/claude-listen.sh`](/Users/iris/Projects/mission-control-dashboard/backend/claude-listen.sh)
  [`backend/codex-read.sh`](/Users/iris/Projects/mission-control-dashboard/backend/codex-read.sh)
  [`backend/claude-read.sh`](/Users/iris/Projects/mission-control-dashboard/backend/claude-read.sh)
  [`backend/codex-send.sh`](/Users/iris/Projects/mission-control-dashboard/backend/codex-send.sh)
  [`backend/claude-send.sh`](/Users/iris/Projects/mission-control-dashboard/backend/claude-send.sh)

From the `backend/` directory:

```bash
./codex-listen.sh
./claude-listen.sh

./codex-read.sh
./claude-read.sh

./codex-send.sh --summary "Need a realism pass" --details "Own MeshGraph.tsx"
./claude-send.sh --summary "Sphere pass complete" --files "frontend/src/components/MeshGraph.tsx"
```

Recommended split:

- Claude owns `frontend/src/components/MeshGraph.tsx`
- Codex owns integration, HUD/layout, backend/tooling, and final verification
- both agents send bounded handoffs through the inbox instead of copying text manually

**From Python (any agent):**
```python
import httpx

httpx.post("http://localhost:8000/api/event", json={
    "event_type": "progress_update",
    "source": "my-agent",
    "data": {"agent_id": "my-agent", "progress": 72, "task": "processing data"}
})
```

**Via WebSocket (browser / any client):**
```javascript
const ws = new WebSocket("ws://localhost:8000/ws");
ws.onmessage = (e) => console.log(JSON.parse(e.data)); // full mesh state on every update
```

**Event types:**
| Event | Payload | Use for |
|-------|---------|---------|
| `thought` | `{agent_id, content}` | Agent reasoning steps |
| `tool_call` | `{agent_id, tool, args}` | Tool invocations |
| `tool_result` | `{agent_id, tool, result}` | Tool outputs |
| `progress_update` | `{agent_id, progress, task}` | Task progress 0–100 |
| `output_chunk` | `{agent_id, content}` | Streamed output |
| `task_assigned` | `{agent_id, task}` | New task assignment |
| `system_metric` | `{metric, value}` | System-wide metrics |

**REST API:**
```
GET  /api/health        — health check
GET  /api/agents        — active agents + status
GET  /api/system        — CPU, RAM, MLX RAM, PID
GET  /api/logs          — recent log buffer
GET  /api/cron          — Hermes scheduled jobs
GET  /api/memories      — recent memory recalls
GET  /api/amp/messages  — AMP messages from AI Maestro
GET  /api/amp/events    — live routing events from bridge logs
POST /api/amp/send      — send AMP message to any agent
```

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, uvicorn, WebSockets, Pydantic |
| Inference | MLX (Qwen3.5 35B-A3B 4-bit, Apple Silicon) |
| Deploy | Docker Compose (one command) |

---

## Built for local AI meshes

This dashboard was built alongside the [iriseye](https://github.com/iriseye931-ai/iriseye) local AI mesh, and works with any similar setup:

| Role | Examples |
|------|---------|
| Lead agent | Claude Code (Atlas), any CLI agent |
| Task runner | Hermes, any cron-capable agent |
| File/web agent | OpenClaw / iriseye, browser-use |
| Memory store | OpenViking, mem0 |
| Local LLM | MLX (Apple Silicon), Ollama, llama.cpp |

The backend auto-detects running processes and polls local service endpoints — no instrumentation required to get a working dashboard.

Want the full mesh setup? → [iriseye repo](https://github.com/iriseye931-ai/iriseye)

---

## Routing policy

Mission Control now treats the mesh as `local-first, premium-by-exception`.

- `Hermes` is the default workhorse for routine execution.
- `iriseye` handles interactive file and web tasks.
- `Atlas` is the lead premium role, served by Codex or Claude Code.
- `claude` is the premium backup when available.

Current enforced routing:

```text
routine      -> hermes
specialized  -> iriseye
premium      -> atlas (fallback: claude)
```

Premium capacity should be reserved for planning, ambiguous debugging, tricky refactors, and final review.

---

## Hermes local profiles

Hermes is modeled as one local runner with multiple profiles, not as a pile of always-hot models.

- `workhorse`
  `Qwen3.5-35B-A3B-4bit`
  Default local execution profile.

- `sidecar`
  `Qwen2.5-7B-Instruct-4bit`
  Cheap auxiliary profile for summaries, routing, compression, and lightweight helper work.

- `code-specialist`
  `Qwen2.5-Coder-32B-Instruct-4bit`
  Planned on-demand profile for code-heavy implementation and local review.

- `reasoning-specialist`
  `DeepSeek-R1-Distill-Qwen-32B-4bit`
  Planned on-demand profile for harder local reasoning and second-pass debugging/review.

The design goal is simple:

- keep the always-on memory footprint small enough for a 48 GB Apple Silicon machine
- let Hermes handle most task volume locally
- only load heavier specialist profiles when a task actually justifies it
- avoid burning premium capacity on routine work

---

## License

MIT
