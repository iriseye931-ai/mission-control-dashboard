import { useState, useRef, useEffect } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import ChatBox from './ChatBox'
import RAGSearch from './RAGSearch'

type Tab = 'logs' | 'amp' | 'hermes' | 'atlas' | 'rag'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'logs', label: 'Logs' },
  { id: 'amp', label: 'AMP' },
  { id: 'hermes', label: 'Hermes' },
  { id: 'atlas', label: 'Atlas' },
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

function AmpTab() {
  const messages = useDashboardStore((s) => s.ampMessages)

  if (messages.length === 0) {
    return <p style={{ fontSize: 10, color: '#334155', padding: 12 }}>No AMP messages found in ~/.agent-messaging/agents/atlas/</p>
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {messages.map((msg) => {
        const isInbox = msg.direction === 'inbox'
        return (
          <div
            key={msg.id}
            style={{
              background: isInbox ? '#0f172a' : '#0a0a14',
              border: `1px solid ${isInbox ? '#1e293b' : '#1a1a2e'}`,
              borderRadius: 4,
              padding: '6px 8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{
                  fontSize: 8, padding: '1px 5px', borderRadius: 3,
                  background: isInbox ? '#06b6d422' : '#a855f722',
                  color: isInbox ? '#06b6d4' : '#a855f7',
                  border: `1px solid ${isInbox ? '#06b6d444' : '#a855f744'}`,
                }}>
                  {isInbox ? 'IN' : 'OUT'}
                </span>
                <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>
                  {isInbox ? msg.from : msg.to}
                </span>
              </div>
              <span style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace' }}>
                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
              </span>
            </div>
            {msg.subject && (
              <p style={{ fontSize: 9, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>
                {msg.subject}
              </p>
            )}
            <p style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {msg.body}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function HermesTab() {
  const status = useDashboardStore((s) => s.hermesStatus)

  if (!status || status.status === 'unavailable' || status.status === 'no sessions') {
    return <p style={{ fontSize: 10, color: '#334155', padding: 12 }}>No Hermes sessions found in ~/.hermes/sessions/</p>
  }

  const fields: [string, string | number | undefined | null][] = [
    ['Status', status.status],
    ['Session', status.session_id],
    ['Model', status.model],
    ['Task', status.task],
    ['Created', status.created_at ? new Date(status.created_at).toLocaleString() : undefined],
    ['Modified', status.modified ? new Date(status.modified * 1000).toLocaleString() : undefined],
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
  )
}

export default function MeshPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('logs')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0f' }}>
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'logs' && <LogsTab />}
      {activeTab === 'amp' && <AmpTab />}
      {activeTab === 'hermes' && <HermesTab />}
      {activeTab === 'atlas' && (
        <div style={{ flex: 1, padding: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ChatBox />
        </div>
      )}
      {activeTab === 'rag' && (
        <div style={{ flex: 1, padding: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <RAGSearch />
        </div>
      )}
    </div>
  )
}
