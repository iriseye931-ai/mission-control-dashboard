import { Agent } from '../types'

interface Props {
  agent: Agent & { role?: string; color?: string }
}

const FALLBACK_COLORS: Record<string, string> = {
  atlas:    '#06b6d4',
  hermes:   '#a855f7',
  iriseye:  '#10b981',
  'agent-a':'#f59e0b',
  'agent-c':'#f59e0b',
}

const STATUS_COLORS: Record<string, string> = {
  online:     '#22c55e',
  active:     '#22c55e',
  busy:       '#eab308',
  offline:    '#374151',
  hibernated: '#374151',
}

export default function AgentCard({ agent }: Props) {
  const color = (agent as any).color
    ?? FALLBACK_COLORS[(agent.name ?? '').toLowerCase()]
    ?? '#64748b'
  const dotColor = STATUS_COLORS[agent.status] ?? '#374151'
  const isOnline = agent.status === 'online' || agent.status === 'active' || agent.status === 'busy'

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1.5"
      style={{
        background: '#0d0d14',
        border: `1px solid ${isOnline ? color + '44' : '#1e1e2e'}`,
        boxShadow: isOnline ? `0 0 10px ${color}18` : 'none',
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-sm font-semibold tracking-wide"
          style={{ color: isOnline ? color : '#475569' }}
        >
          {agent.label ?? agent.name}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={isOnline ? 'w-2 h-2 rounded-full animate-pulse' : 'w-2 h-2 rounded-full'}
            style={{
              background: dotColor,
              boxShadow: isOnline ? `0 0 6px ${dotColor}` : 'none',
            }}
          />
          <span className="text-xs" style={{ color: dotColor }}>
            {agent.status}
          </span>
        </span>
      </div>

      {(agent as any).role && (
        <span className="text-xs" style={{ color: '#475569' }}>
          {(agent as any).role}
        </span>
      )}

      {agent.task && (
        <span
          className="text-xs leading-snug"
          style={{
            color: '#64748b',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {agent.task}
        </span>
      )}

      {agent.model && (
        <span
          className="text-xs font-mono px-1.5 py-0.5 rounded w-fit mt-0.5"
          style={{ background: '#0a0a0f', color: '#334155', border: '1px solid #1e1e2e' }}
        >
          {agent.model.split('/').pop()}
        </span>
      )}
    </div>
  )
}
