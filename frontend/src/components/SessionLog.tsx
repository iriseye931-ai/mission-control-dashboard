import { useState, useEffect, useRef } from 'react'
import { SessionEntry } from '../types'

const ROLE_STYLE: Record<string, { color: string; label: string }> = {
  user:      { color: '#06b6d4', label: 'you'     },
  assistant: { color: '#8b5cf6', label: 'atlas'   },
  system:    { color: '#f59e0b', label: 'system'  },
  note:      { color: '#10b981', label: 'note'    },
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

export default function SessionLog() {
  const [entries, setEntries] = useState<SessionEntry[]>([])
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function fetchToday() {
    try {
      const r = await fetch('/api/sessions/today')
      if (!r.ok) return
      const d = await r.json()
      setEntries(d.entries ?? [])
      setDate(d.date ?? '')
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchToday()
    const id = setInterval(fetchToday, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  async function saveNote(e: React.FormEvent) {
    e.preventDefault()
    const text = note.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      await fetch('/api/sessions/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'note', content: text }),
      })
      setNote('')
      await fetchToday()
    } catch { /* silent */ } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* date header */}
      <div style={{
        padding: '4px 0 6px',
        fontSize: 8, color: '#334155',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        fontFamily: 'monospace', flexShrink: 0,
      }}>
        {date || 'today'}
      </div>

      {/* entries */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
        {entries.length === 0 ? (
          <p style={{ fontSize: 9, color: '#1e293b', fontFamily: 'monospace' }}>
            No log entries yet. Drop a note below — I'll start here next session.
          </p>
        ) : (
          entries.map((e, i) => {
            const s = ROLE_STYLE[e.role] ?? { color: '#475569', label: e.role }
            return (
              <div key={i} style={{
                background: '#0a0a0f', border: '1px solid #13132a',
                borderRadius: 4, padding: '5px 8px',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 7, padding: '1px 5px', borderRadius: 2,
                    background: `${s.color}18`, color: s.color,
                    border: `1px solid ${s.color}33`, fontFamily: 'monospace',
                  }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 7, color: '#1e293b', fontFamily: 'monospace', marginLeft: 'auto' }}>
                    {formatTs(e.ts)}
                  </span>
                </div>
                <p style={{
                  fontSize: 9, color: '#475569', fontFamily: 'monospace',
                  lineHeight: 1.5, margin: 0, wordBreak: 'break-word',
                }}>
                  {e.content}
                </p>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* note input */}
      <form onSubmit={saveNote} style={{
        display: 'flex', gap: 4, paddingTop: 6,
        borderTop: '1px solid #13132a', flexShrink: 0,
      }}>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Leave a note for next session…"
          disabled={saving}
          style={{
            flex: 1, fontSize: 9, padding: '4px 6px', borderRadius: 3,
            background: '#08080f', border: '1px solid #1e1e2e',
            color: '#94a3b8', outline: 'none', fontFamily: 'monospace',
          }}
        />
        <button
          type="submit"
          disabled={saving || !note.trim()}
          style={{
            fontSize: 9, padding: '4px 8px', borderRadius: 3, border: 'none',
            background: saving || !note.trim() ? '#1e293b' : '#10b981',
            color: '#0a0a0f', cursor: saving || !note.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          {saving ? '…' : 'log'}
        </button>
      </form>
    </div>
  )
}
