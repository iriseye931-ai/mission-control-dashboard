# Last Session
_Single-block snapshot of the most recent session. Always overwritten, never appended._

## Date
2026-03-27

## What was accomplished
- Built drag-and-drop file upload in RAGSearch panel (POST /api/rag/upload)
- Added TTS to ChatBox: edge-tts via /api/tts, 🔊/🔇 toggle, speaks completed responses
- Fixed LaunchAgent PATH issue (node not found) — added /opt/homebrew/bin to EnvironmentVariables
- Upgraded subconscious system: pruning, last_session block, smarter project_context updates

## What changed architecturally
- backend/main.py: added /api/rag/upload and /api/tts endpoints
- frontend/src/components/RAGSearch.tsx: drag-and-drop with overlay, upload status
- frontend/src/components/ChatBox.tsx: TTS toggle, speakText() via Audio API

## Open threads
- PR #836 (OpenViking) still not started
- RAG inbox not yet populated with real docs
