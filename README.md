# Agent Mesh Mission Control

Real-time dashboard for multi-agent AI systems — built for the **Claude Code + Hermes + OpenClaw** stack. One command to run. No cloud. No API keys.

![Dashboard](https://img.shields.io/badge/React_19-Vite-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-WebSockets-green) ![License](https://img.shields.io/badge/license-MIT-purple)

![Mission Control Dashboard](assets/dashboard-full.png)

---

## What it shows

Most local AI setups are invisible — agents running in terminals, logs scattered, no idea what's happening across the mesh. This fixes that.

- **Agent status** — live view of every agent (Claude Code / Atlas, Hermes, OpenClaw / iriseye) with current task, state, and uptime
- **Live log feed** — streaming output from all agents in one place
- **Memory monitor** — watch OpenViking memory stores and recall activity in real time
- **Cron progress** — Hermes scheduled tasks with progress bars
- **System metrics** — token usage, events/sec, active connections
- **Mesh graph** — visual topology of which agents are connected

---

## Quick Start

```bash
git clone https://github.com/iriseye931-ai/mission-control-dashboard
cd mission-control-dashboard
docker-compose up --build
```

- Dashboard: http://localhost:3000
- Backend API: http://localhost:8000
- WebSocket: `ws://localhost:8000/ws/{client_id}`

No config required — runs with a built-in demo agent simulator so you can see it working immediately.

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

The backend exposes a WebSocket event bus. Agents push events and the dashboard renders them live.

**From Python (Hermes, OpenClaw, any agent):**
```python
from backend.event_bus import event_bus
from backend.models import AgentEvent, EventType

await event_bus.publish(AgentEvent(
    event_type=EventType.PROGRESS_UPDATE,
    source="hermes",
    data={"agent_id": "hermes", "progress": 72, "task": "indexing GraphRAG"}
))
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
GET /api/health    — health check
GET /api/agents    — active agents + status
GET /api/metrics   — system metrics
GET /api/logs      — recent log buffer
GET /api/mission   — mission progress
```

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, uvicorn, WebSockets, Pydantic |
| Deploy | Docker Compose (one command) |

---

## Part of the iriseye mesh

This dashboard is built to work with the [iriseye](https://github.com/iriseye931-ai/iriseye) local AI mesh:

- **Atlas** (Claude Code) — lead agent, code + decisions
- **Hermes** — long-running tasks, cron automation
- **iriseye** (OpenClaw) — file ops, web research, background tasks
- **OpenViking** — shared persistent memory store

Set up the full mesh: [iriseye repo](https://github.com/iriseye931-ai/iriseye)

---

## License

MIT
