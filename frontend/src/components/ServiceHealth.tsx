import { useDashboardStore } from '../store/dashboardStore'
import { ServiceHealth as ServiceHealthType } from '../types'

const SERVICE_NAMES: Record<string, string> = {
  openviking: 'OpenViking',
  memory_mcp: 'Memory MCP',
  openclaw_mcp: 'OpenClaw MCP',
  aimaestro: 'AI Maestro',
  llm_server: 'LM Studio (embed)',
  mlx_server: 'MLX Server',
}

const statusColor: Record<string, string> = {
  up: '#22c55e',
  healthy: '#22c55e',
  degraded: '#eab308',
  down: '#ef4444',
}

export default function ServiceHealth() {
  const services = useDashboardStore((s) => s.services)

  const entries = Object.entries(services as Record<string, ServiceHealthType & { status: string }>)

  if (entries.length === 0) {
    return (
      <div className="flex gap-2 flex-wrap">
        {Object.keys(SERVICE_NAMES).map((key) => (
          <span
            key={key}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono"
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: '#374151' }}
            />
            <span style={{ color: '#94a3b8' }}>{SERVICE_NAMES[key]}</span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {entries.map(([key, svc]) => {
        const color = statusColor[svc.status] ?? '#374151'
        const label = SERVICE_NAMES[key] ?? (svc as any).name ?? key
        const isUp = svc.status === 'up' || svc.status === 'healthy'
        return (
          <span
            key={key}
            title={svc.status}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono"
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: color }}
            />
            <span style={{ color: isUp ? '#e2e8f0' : '#94a3b8' }}>
              {label}
            </span>
          </span>
        )
      })}
    </div>
  )
}
