import { useState, useEffect } from 'react'
import { useDashboardStore } from '../store/dashboardStore'

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  return `${Math.floor(diff / 60)}h ago`
}

export default function MorningBrief() {
  const brief = useDashboardStore((s) => s.brief)
  const briefGeneratedAt = useDashboardStore((s) => s.briefGeneratedAt)
  const setBrief = useDashboardStore((s) => s.setBrief)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)

  // Fetch brief on mount if not yet loaded
  useEffect(() => {
    if (!brief) fetchBrief(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchBrief(force: boolean) {
    setLoading(true)
    try {
      const res = await fetch(`/api/brief${force ? '?refresh=true' : ''}`)
      const data = await res.json()
      setBrief(data.brief ?? '', data.generated_at ?? null)
    } catch {
      // silently ignore — dashboard still works without brief
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: 12 }}>
      <div className="flex items-center gap-2 mb-2">
        <p
          className="text-xs font-semibold uppercase tracking-widest cursor-pointer select-none"
          style={{ color: '#475569' }}
          onClick={() => setExpanded((v) => !v)}
        >
          Morning Brief
        </p>
        <span
          className="text-xs"
          style={{ color: '#1e293b', marginLeft: 'auto' }}
        >
          {briefGeneratedAt ? timeAgo(briefGeneratedAt) : ''}
        </span>
        <button
          onClick={() => fetchBrief(true)}
          disabled={loading}
          title="Regenerate brief"
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            background: 'transparent',
            border: '1px solid #1e1e2e',
            color: loading ? '#1e293b' : '#475569',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '…' : '↺'}
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs"
          style={{ background: 'transparent', border: 'none', color: '#1e293b', cursor: 'pointer' }}
        >
          {expanded ? '▴' : '▾'}
        </button>
      </div>

      {expanded && (
        <div
          className="text-xs leading-relaxed whitespace-pre-wrap rounded p-3"
          style={{
            background: '#0d1117',
            border: '1px solid #1e1e2e',
            color: loading ? '#1e293b' : '#94a3b8',
            minHeight: 60,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {loading && !brief ? (
            <span style={{ color: '#334155' }}>Generating brief…</span>
          ) : brief ? (
            brief
          ) : (
            <span style={{ color: '#334155' }}>No brief yet — click ↺ to generate.</span>
          )}
        </div>
      )}
    </div>
  )
}
