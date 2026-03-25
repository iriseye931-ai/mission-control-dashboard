# Agent Mesh Mission Control

Real-time dashboard for multi-agent AI systems — built for the **Claude Code + Hermes + OpenClaw** stack. One command to run. No cloud. No API keys.

![Dashboard](https://img.shields.io/badge/React_19-Vite-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-WebSockets-green) ![License](https://img.shields.io/badge/license-MIT-purple)

![Mission Control Dashboard](assets/dashboard-full.png)

---

## What it shows

Most local AI setups are invisible — agents running in terminals, logs scattered, no idea what's happening across the mesh. This fixes that.

- **Agent status** — live view of every agent (Claude Code, Hermes, OpenClaw, or any custom agent) with current task, state, and uptime
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

The backend polls your local services and broadcasts state over WebSocket. You can also push events directly from any agent via the REST API.

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
GET  /api/health    — health check
GET  /api/agents    — active agents + status
GET  /api/system    — CPU, RAM, LLM memory usage
GET  /api/logs      — recent log buffer
GET  /api/cron      — Hermes scheduled jobs
GET  /api/memories  — recent memory recalls
GET  /api/amp       — AMP agent messages
```

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, uvicorn, WebSockets, Pydantic |
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

The backend auto-detects running processes and polls local service endpoints — no instrumentation required to get a working dashboard.

Want the full mesh setup? → [iriseye repo](https://github.com/iriseye931-ai/iriseye)

---

## License

MIT
