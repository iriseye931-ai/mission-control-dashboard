# 🚀 Mission Control Dashboard

A production-grade, real-time web dashboard for monitoring multi-agent AI systems.

## Features

- **Real-time Updates**: WebSocket-powered instant updates (no polling)
- **Mission Control UI**: Futuristic operations center design
- **Agent Monitoring**: Track multiple agents simultaneously
- **Live Logs**: Streaming console output from all agents
- **Progress Tracking**: Visual progress bars and metrics
- **System Metrics**: Token usage, uptime, events/sec
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

**Backend:**
- FastAPI (async WebSockets)
- Pydantic (data validation)
- uvicorn (ASGI server)

**Frontend:**
- React 19 + Vite
- TypeScript
- Tailwind CSS
- Zustand (state management)

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- WebSocket: ws://localhost:8000/ws/{client_id}

### Option 2: Manual Setup

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

## Project Structure

```
mission-control-dashboard/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket handler
│   ├── models.py            # Pydantic models
│   ├── websocket_manager.py # WebSocket connection manager
│   ├── event_bus.py         # In-memory pub/sub
│   └── agent_simulator.py   # Demo agent generator
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MissionProgress.tsx
│   │   │   ├── AgentCard.tsx
│   │   │   ├── SystemMetrics.tsx
│   │   │   └── LiveLogFeed.tsx
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts
│   │   ├── store/
│   │   │   └── agentStore.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── App.tsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docker-compose.yml
└── requirements.txt
```

## API Endpoints

- `GET /` - API info
- `GET /api/health` - Health check
- `GET /api/metrics` - System metrics
- `GET /api/logs` - Recent logs
- `GET /api/agents` - Active agents
- `GET /api/mission` - Mission progress
- `WS /ws/{client_id}` - WebSocket for real-time events

## Event Types

Agents emit the following events to the WebSocket:

- `thought` - Agent's internal thought process
- `tool_call` - Tool invocation
- `tool_result` - Tool execution result
- `progress_update` - Task progress (0-100%)
- `output_chunk` - Generated output
- `task_assigned` - New task assignment
- `system_metric` - System-wide metrics

## Agent Integration

To integrate your own agents:

1. Import the event bus: `from backend.event_bus import event_bus`
2. Create agent events:
```python
from backend.models import AgentEvent, EventType

event = AgentEvent(
    event_type=EventType.PROGRESS_UPDATE,
    source="my_agent",
    data={"agent_id": "agent_1", "progress": 50, "task": "working..."}
)
await event_bus.publish(event)
```

## Customization

- **Colors**: Modify Tailwind config in `frontend/tailwind.config.js`
- **Theme**: Edit CSS in `frontend/src/index.css`
- **Components**: Extend React components in `frontend/src/components/`

## Development

```bash
# Run backend with auto-reload
uvicorn backend.main:app --reload

# Run frontend with auto-reload
cd frontend && npm run dev
```

## License

MIT License

---

Built with ❤️ by Team Hermes
