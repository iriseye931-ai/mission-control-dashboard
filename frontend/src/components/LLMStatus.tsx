import { useDashboardStore } from '../store/dashboardStore'

const BACKEND_LABELS: Record<string, string> = {
  mlx: 'MLX',
}

export default function LLMStatus() {
  const llmActive = useDashboardStore((s) => s.llmActive)
  const services = useDashboardStore((s) => s.services)

  if (!llmActive) {
    return (
      <span
        className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-mono"
        style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444' }}
      >
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#ef4444' }} />
        LLM offline
      </span>
    )
  }

  const backendLabel = BACKEND_LABELS[llmActive] ?? llmActive
  const svc = services['mlx_server'] as any
  const modelName = (svc?.active_model ?? svc?.models?.[0]) ?? null

  return (
    <span
      className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-mono"
      style={{ background: '#06b6d422', color: '#06b6d4', border: '1px solid #06b6d444' }}
      title={modelName ?? undefined}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#06b6d4' }} />
      {backendLabel}{modelName ? ` · ${modelName.split('/').pop()}` : ''}
    </span>
  )
}
