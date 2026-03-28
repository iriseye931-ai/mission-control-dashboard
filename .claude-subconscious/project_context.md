# Project Context
_Active projects, architecture decisions, key file locations._

## mission-control-dashboard (PRIMARY)
- **Frontend**: React 19 + Vite + Tailwind, port 3005, `~/Projects/mission-control-dashboard/frontend/`
- **Backend**: FastAPI, port 8000, `~/Projects/mission-control-dashboard/backend/`
- **Vite proxy**: /api and /ws → :8000 (never serve dist/ directly — use `npm run dev`)
- **Backend venv**: `backend/venv` — source before running uvicorn
- **Backend .env**: contains OPENVIKING_KEY=teamirs-dev-key-2026
- **Key components**: ChatBox (SSE streaming + voice), RAGSearch, MorningBrief, MeshPanel (tabs: logs/amp/hermes/atlas/rag)
- **Chat**: SSE streaming via /api/chat/stream → MLX → appendChatToken pattern
- **Voice**: MediaRecorder → webm → /api/stt → Whisper :8082 → transcript appended to input
- **RAG**: ~/Documents/rag/inbox/ → temp_upload → OpenViking parent=viking://resources/rag-inbox

## Local AI Mesh
- **MLX server**: :8081, Qwen3.5 35B-A3B 4-bit MoE
- **Whisper STT**: :8082, faster-whisper large-v3-turbo, LaunchAgent auto-start
- **OpenViking**: :1933, account=teamirs, user=iris, key=teamirs-dev-key-2026
- **Memory MCP**: :2033
- **OpenClaw MCP**: :2034
- **AI Maestro**: :23000

## Key Patterns
- OpenViking auth: conditional header — only set if OPENVIKING_KEY is truthy (empty string crashes httpx)
- OpenViking API requires X-OpenViking-Account and X-OpenViking-User headers on every call
- RAG ingest: must use temp_upload → parent approach (direct path fails on conflict)
- OpenViking watch_interval=5 monitors directories automatically — no custom watcher needed
