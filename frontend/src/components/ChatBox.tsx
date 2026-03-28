import { useState, useRef, useEffect, FormEvent } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { Message } from '../types'

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatBox() {
  const chatHistory = useDashboardStore((s) => s.chatHistory)
  const isChatLoading = useDashboardStore((s) => s.isChatLoading)
  const addChatMessage = useDashboardStore((s) => s.addChatMessage)
  const appendChatToken = useDashboardStore((s) => s.appendChatToken)
  const setChatLoading = useDashboardStore((s) => s.setChatLoading)

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isChatLoading])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isChatLoading) return

    setInput('')
    setError(null)

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    addChatMessage(userMsg)
    setChatLoading(true)

    // Seed an empty assistant message that we'll stream into
    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    addChatMessage(assistantMsg)

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

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

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
            if (parsed.error) {
              setError(parsed.error)
            } else if (parsed.token) {
              appendChatToken(parsed.token)
            }
          } catch {
            // partial / non-JSON line
          }
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
  }

  function handleStop() {
    abortRef.current?.abort()
    setChatLoading(false)
  }

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
        <span className="text-sm font-semibold" style={{ color: '#06b6d4' }}>
          Atlas
        </span>
        <span className="text-xs" style={{ color: '#475569' }}>
          {isChatLoading ? 'streaming…' : 'Lead Agent'}
        </span>
        {isChatLoading && (
          <button
            onClick={handleStop}
            className="ml-auto text-xs px-2 py-0.5 rounded"
            style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444433' }}
          >
            stop
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3" style={{ minHeight: 0 }}>
        {chatHistory.length === 0 && (
          <p className="text-xs text-center my-auto" style={{ color: '#475569' }}>
            Send a message to talk to Atlas
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

        {error && (
          <div
            className="text-xs px-3 py-2 rounded"
            style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444433' }}
          >
            Error: {error}
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
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Atlas…"
          disabled={isChatLoading}
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
