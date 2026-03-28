# Agent Mesh Mission Control

Real-time dashboard for multi-agent AI systems — built for the **Claude Code + Hermes + OpenClaw** stack. One command to run. No cloud. No API keys.

![Dashboard](https://img.shields.io/badge/React_19-Vite-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-WebSockets-green) ![MLX](https://img.shields.io/badge/MLX-Qwen3.5_35B-green) ![License](https://img.shields.io/badge/license-MIT-purple)

![Mission Control Dashboard](assets/dashboard-full.png)

---

## What it shows

Most local AI setups are invisible — agents running in terminals, logs scattered, no idea what's happening across the mesh. This fixes that.

- **KPI strip** — live Agents Online, MLX server status, system RAM, AMP queue depth, CPU — always visible at the top
- **Agent status** — every agent (Atlas, Hermes, iriseye) with current state, pulsing dot, color-coded
- **Service pills** — OpenViking, MLX, MemMCP, OpenClaw, Ollama — up/down at a glance
- **Mesh graph** — animated canvas topology: hexagonal agent nodes, radial service nodes, animated pulse dots on active edges
- **AMP events feed** — live routing log from Hermes + iriseye bridges (route=mlx, route=hermes, reply sent)
- **AMP inbox** — messages in/out of AI Maestro
- **MLX tab** — arc gauge showing MLX RAM pressure, model stats, PID, inference engine
- **Memory monitor** — OpenViking recall activity
- **Cron/schedule** — Hermes scheduled tasks with progress bars
- **Mesh insights** — cross-agent pattern analysis
- **Activity feed** — unified event stream

---

## Design

Premium dark-mode terminal aesthetic. No scroll, no hidden panels.

- **Full-bleed layout** — header → KPI strip → body, zero overflow
- **Vertical tab rail** — right sidebar with single-click tabs: MLX / Memory / Schedule / Insights / Activity
- **Square mesh graph viewport** — `Math.min(W, H) × 0.92` ensures the graph never stretches regardless of window shape
- **Unified color palette** — `#08080f` background, cyan/purple/green/yellow/red accent system consistent across every component
- **No duplicates** — CPU and RAM in KPI strip only; MLX tab focuses on inference-specific metrics

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

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Connecting your agents

The backend polls your local services and broadcasts state over WebSocket. Push events directly from any agent via the REST API.

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

## License

MIT
