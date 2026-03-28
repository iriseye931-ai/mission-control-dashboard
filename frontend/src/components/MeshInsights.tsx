import { useDashboardStore } from '../store/dashboardStore'
import { MeshInsight } from '../types'

const SEV_COLOR = {
  info:     { text: '#64748b', border: '#1e293b', bg: '#0f172a' },
  warning:  { text: '#f59e0b', border: '#78350f44', bg: '#78350f22' },
  critical: { text: '#ef4444', border: '#7f1d1d44', bg: '#7f1d1d22' },
}

const SEV_LABEL = { info: 'info', warning: 'warn', critical: 'crit' }

function InsightCard({ insight }: { insight: MeshInsight }) {
  const sev = insight.severity as keyof typeof SEV_COLOR
  const colors = SEV_COLOR[sev] ?? SEV_COLOR.info
  const time = insight.timestamp
    ? new Date(insight.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div
      className="rounded px-2 py-2 mb-2"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: colors.text }}
        >
          {SEV_LABEL[sev]}
        </span>
        <span className="text-xs" style={{ color: '#334155' }}>{time}</span>
      </div>

      {/* Summary */}
      <p className="text-xs mb-1" style={{ color: '#94a3b8', lineHeight: '1.4' }}>
        {insight.summary}
      </p>

      {/* Insights */}
      {insight.insights.length > 0 && (
        <ul className="mb-1" style={{ paddingLeft: 0, listStyle: 'none' }}>
          {insight.insights.slice(0, 3).map((item, i) => (
            <li key={i} className="text-xs" style={{ color: '#475569', lineHeight: '1.4' }}>
              · {item}
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      {insight.actions.length > 0 && (
        <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
          {insight.actions.slice(0, 2).map((act, i) => (
            <li key={i} className="text-xs" style={{ color: colors.text, opacity: 0.8, lineHeight: '1.4' }}>
              → {act}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function MeshInsights() {
  const insights = useDashboardStore((s) => s.insights)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>
          Subconscious
        </p>
        {insights.length > 0 && (
          <span className="text-xs" style={{ color: '#334155' }}>
            {insights.length} analysis{insights.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {insights.length === 0 ? (
        <p className="text-xs" style={{ color: '#334155' }}>
          waiting for first analysis…
        </p>
      ) : (
        <div>
          {insights.slice(0, 5).map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      )}
    </div>
  )
}
