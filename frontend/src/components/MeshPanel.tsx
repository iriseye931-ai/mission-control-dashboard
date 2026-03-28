import { useState, useRef, useEffect } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import RAGSearch from './RAGSearch'
import AmpInbox from './AmpInbox'

type Tab = 'logs' | 'amp' | 'hermes' | 'rag'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'logs', label: 'Logs' },
  { id: 'amp', label: 'AMP' },
  { id: 'hermes', label: 'Hermes' },
  { id: 'rag', label: 'RAG' },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex shrink-0" style={{ borderBottom: '1px solid #1e1e2e' }}>
      {TAB_LABELS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            padding: '6px 14px',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: 'monospace',
            border: 'none',
            borderBottom: active === id ? `1px solid ${id === 'rag' ? '#8b5cf6' : '#06b6d4'}` : '1px solid transparent',
            marginBottom: -1,
            background: 'transparent',
            color: active === id ? (id === 'rag' ? '#8b5cf6' : '#06b6d4') : '#475569',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function LogsTab() {
  const logs = useDashboardStore((s) => s.logs)
  const bottomRef = useRef<HTMLDivElement>(null)

  const combined = [
    ...logs.memory.map((l) => ({ src: 'mem', line: l })),
    ...logs.mlx.map((l) => ({ src: 'mlx', line: l })),
  ].sort((a, b) => {
    // Best-effort sort by any timestamp prefix
    const ta = a.line.match(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/)?.[0] ?? ''
    const tb = b.line.match(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/)?.[0] ?? ''
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [combined.length])

  if (combined.length === 0) {
    return <p style={{ fontSize: 10, color: '#334155', padding: 12 }}>No log entries — logs appear here as MLX and memory monitor write them.</p>
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {combined.map(({ src, line }, i) => {
        const isWarn = line.includes('WARNING') || line.includes('WARN')
        const isErr = line.includes('ERROR') || line.includes('restart') || line.includes('OOM')
        const color = isErr ? '#ef4444' : isWarn ? '#f59e0b' : src === 'mlx' ? '#64748b' : '#475569'
        const badge = src === 'mlx' ? '#1e293b' : '#0f172a'
        return (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 8, color: '#334155', background: badge, padding: '1px 4px', borderRadius: 2, flexShrink: 0, marginTop: 1 }}>
              {src}
            </span>
            <span style={{ fontSize: 9, color, fontFamily: 'monospace', lineHeight: 1.5, wordBreak: 'break-all' }}>
              {line}
            </span>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}


function HermesTab() {
  const status = useDashboardStore((s) => s.hermesStatus)
  const cronJobs = useDashboardStore((s) => s.cronJobs)

  const nextJob = cronJobs
    .filter((j) => j.enabled !== false && j.next_run_in_seconds != null)
    .sort((a, b) => (a.next_run_in_seconds ?? Infinity) - (b.next_run_in_seconds ?? Infinity))[0]

  function fmtIn(secs: number | null | undefined) {
    if (secs == null) return '—'
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    return `${Math.floor(secs / 3600)}h`
  }

  const showSession = status && status.status !== 'unavailable' && status.status !== 'no sessions'

  const fields: [string, string | number | undefined | null][] = showSession ? [
    ['Status', status!.status],
    ['Session', status!.session_id],
    ['Model', status!.model],
    ['Task', status!.task],
    ['Created', status!.created_at ? new Date(status!.created_at).toLocaleString() : undefined],
    ['Modified', status!.modified ? new Date(status!.modified * 1000).toLocaleString() : undefined],
  ] : []

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cronJobs.length > 0 && (
        <div>
          <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Cron ({cronJobs.length} jobs)
          </p>
          {nextJob && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #0f172a' }}>
              <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {nextJob.name}
              </span>
              <span style={{ fontSize: 9, color: '#06b6d4', fontFamily: 'monospace', flexShrink: 0 }}>
                in {fmtIn(nextJob.next_run_in_seconds)}
              </span>
            </div>
          )}
          {cronJobs.slice(0, 4).map((job) => (
            <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #0a0a14' }}>
              <span style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {job.name}
              </span>
              <span style={{ fontSize: 8, color: job.last_status === 'success' ? '#10b981' : job.last_status ? '#f59e0b' : '#334155', fontFamily: 'monospace', flexShrink: 0 }}>
                {job.last_status ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {showSession ? (
        <div>
          <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Session</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {fields.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', width: 60, flexShrink: 0, textAlign: 'right' }}>
                  {label}
                </span>
                <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 10, color: '#334155' }}>No active Hermes session</p>
      )}
    </div>
  )
}

export default function MeshPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('logs')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0f' }}>
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'logs' && <LogsTab />}
      {activeTab === 'amp' && <AmpInbox />}
      {activeTab === 'hermes' && <HermesTab />}
      {activeTab === 'rag' && (
        <div style={{ flex: 1, padding: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <RAGSearch />
        </div>
      )}
    </div>
  )
}
