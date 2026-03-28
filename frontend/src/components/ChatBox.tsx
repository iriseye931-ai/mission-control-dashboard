import { useState, useRef, useEffect, FormEvent } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { Message } from '../types'

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Voice recording hook
// ---------------------------------------------------------------------------

function useVoiceRecorder(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    setVoiceError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await sendToWhisper(blob)
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch (err) {
      setVoiceError('Mic access denied')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    mediaRef.current = null
    setRecording(false)
    setTranscribing(true)
  }

  async function sendToWhisper(blob: Blob) {
    try {
      const form = new FormData()
      form.append('file', blob, 'recording.webm')
      const res = await fetch('/api/stt', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`STT error ${res.status}`)
      const data = await res.json()
      const text = data.text?.trim()
      if (text) onTranscript(text)
      else setVoiceError('No speech detected')
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setTranscribing(false)
    }
  }

  return { recording, transcribing, voiceError, startRecording, stopRecording }
}

// ---------------------------------------------------------------------------
// ChatBox
// ---------------------------------------------------------------------------

export default function ChatBox() {
  const chatHistory = useDashboardStore((s) => s.chatHistory)
  const isChatLoading = useDashboardStore((s) => s.isChatLoading)
  const addChatMessage = useDashboardStore((s) => s.addChatMessage)
  const appendChatToken = useDashboardStore((s) => s.appendChatToken)
  const setChatLoading = useDashboardStore((s) => s.setChatLoading)

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const { recording, transcribing, voiceError, startRecording, stopRecording } =
    useVoiceRecorder((text) => setInput((prev) => (prev ? prev + ' ' + text : text)))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isChatLoading])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isChatLoading) return

    setInput('')
    setError(null)

    addChatMessage({ role: 'user', content: text, timestamp: new Date() })
    setChatLoading(true)
    addChatMessage({ role: 'assistant', content: '', timestamp: new Date() })

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistory
            .filter((m) => m.content)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw)
            if (parsed.error) setError(parsed.error)
            else if (parsed.token) appendChatToken(parsed.token)
          } catch { /* partial */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Stream failed')
      }
    } finally {
      setChatLoading(false)
      abortRef.current = null
    }

    // TTS: speak the completed assistant response
    if (ttsEnabled) {
      const store = useDashboardStore.getState()
      const msgs = store.chatHistory
      const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')
      if (lastAssistant?.content) {
        speakText(lastAssistant.content)
      }
    }
  }

  async function speakText(text: string) {
    try {
      audioRef.current?.pause()
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 1000) }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.play()
      audio.onended = () => URL.revokeObjectURL(url)
    } catch { /* tts is best-effort */ }
  }

  function handleStop() {
    abortRef.current?.abort()
    setChatLoading(false)
  }

  const micBusy = recording || transcribing

  return (
    <div
      className="rounded-lg flex flex-col h-full"
      style={{ background: '#111118', border: '1px solid #1e1e2e' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid #1e1e2e' }}
      >
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ background: '#06b6d4', boxShadow: '0 0 6px #06b6d4' }}
        />
        <span className="text-sm font-semibold" style={{ color: '#06b6d4' }}>Atlas</span>
        <span className="text-xs" style={{ color: '#475569' }}>
          {isChatLoading ? 'streaming…' : recording ? 'listening…' : transcribing ? 'transcribing…' : 'Lead Agent'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setTtsEnabled((v) => !v); audioRef.current?.pause() }}
            title={ttsEnabled ? 'TTS on — click to mute' : 'TTS off — click to enable'}
            className="px-2 py-0.5 rounded text-xs"
            style={{
              background: ttsEnabled ? '#06b6d422' : '#1e293b',
              color: ttsEnabled ? '#06b6d4' : '#475569',
              border: `1px solid ${ttsEnabled ? '#06b6d433' : '#334155'}`,
            }}
          >
            {ttsEnabled ? '🔊' : '🔇'}
          </button>
          {isChatLoading && (
            <button
              onClick={handleStop}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444433' }}
            >
              stop
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3" style={{ minHeight: 0 }}>
        {chatHistory.length === 0 && (
          <p className="text-xs text-center my-auto" style={{ color: '#475569' }}>
            Send a message or hold the mic button to talk to Atlas
          </p>
        )}

        {chatHistory.map((msg, i) => {
          const isUser = msg.role === 'user'
          const isEmpty = !msg.content && !isUser
          return (
            <div key={i} className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className="text-xs px-3 py-2 rounded-lg max-w-[85%] leading-relaxed whitespace-pre-wrap"
                style={
                  isUser
                    ? { background: '#1e293b', color: '#e2e8f0' }
                    : { background: '#06b6d411', color: '#e2e8f0', border: '1px solid #06b6d422' }
                }
              >
                {isEmpty ? (
                  <span style={{ color: '#06b6d4', opacity: 0.6 }}>▋</span>
                ) : (
                  <>
                    {msg.content}
                    {isChatLoading && i === chatHistory.length - 1 && !isUser && (
                      <span style={{ color: '#06b6d4' }}>▋</span>
                    )}
                  </>
                )}
              </div>
              {msg.content && (
                <span className="text-xs px-1" style={{ color: '#374151' }}>
                  {formatTime(msg.timestamp)}
                </span>
              )}
            </div>
          )
        })}

        {(error || voiceError) && (
          <div
            className="text-xs px-3 py-2 rounded"
            style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444433' }}
          >
            {error || voiceError}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 flex gap-2"
        style={{ borderTop: '1px solid #1e1e2e' }}
      >
        {/* Mic button */}
        <button
          type="button"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording() }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording() }}
          disabled={isChatLoading}
          title="Hold to speak"
          className="px-2 py-2 rounded flex items-center justify-center shrink-0"
          style={{
            background: recording ? '#ef444422' : '#1e293b',
            border: `1px solid ${recording ? '#ef4444' : '#334155'}`,
            color: recording ? '#ef4444' : transcribing ? '#f59e0b' : '#64748b',
            cursor: isChatLoading ? 'not-allowed' : 'pointer',
            opacity: isChatLoading ? 0.4 : 1,
            boxShadow: recording ? '0 0 8px #ef444466' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {transcribing ? (
            <span style={{ fontSize: 10 }}>…</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
            </svg>
          )}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={micBusy ? '' : 'Message Atlas…'}
          disabled={isChatLoading || micBusy}
          className="flex-1 text-sm px-3 py-2 rounded outline-none"
          style={{
            background: '#0a0a0f',
            border: '1px solid #1e1e2e',
            color: '#e2e8f0',
          }}
        />
        <button
          type="submit"
          disabled={isChatLoading || !input.trim()}
          className="px-3 py-2 rounded text-sm font-medium transition-opacity"
          style={{
            background: '#06b6d4',
            color: '#0a0a0f',
            opacity: isChatLoading || !input.trim() ? 0.4 : 1,
            cursor: isChatLoading || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
