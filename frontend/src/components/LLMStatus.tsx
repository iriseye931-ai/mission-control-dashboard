import { useDashboardStore } from '../store/dashboardStore'

const BACKEND_LABELS: Record<string, string> = {
  mlx: 'MLX',
}

export default function LLMStatus() {
  const llmActive = useDashboardStore((s) => s.llmActive)
  const services = useDashboardStore((s) => s.services)

  if (!llmActive) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          border: '1px solid rgba(156,234,255,0.16)',
          background: 'linear-gradient(180deg, rgba(5,14,22,0.74), rgba(4,10,16,0.58))',
          color: '#b5c5cc',
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#86979f' }} />
        LLM Offline
      </div>
    )
  }

  const backendLabel = BACKEND_LABELS[llmActive] ?? llmActive
  const svc = services['mlx_server'] as any
  const modelName = (svc?.active_model ?? svc?.models?.[0]) ?? null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        border: '1px solid rgba(156,234,255,0.18)',
        background: 'linear-gradient(180deg, rgba(5,14,22,0.78), rgba(4,10,16,0.62))',
        color: '#effcff',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
      title={modelName ?? undefined}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9aefff', boxShadow: '0 0 10px rgba(154,239,255,0.75)' }} />
      <span style={{ color: '#9aefff' }}>{backendLabel}</span>
      {modelName ? <span style={{ color: '#effcff', textTransform: 'none', letterSpacing: '0.03em' }}>{modelName.split('/').pop()}</span> : null}
    </div>
  )
}
