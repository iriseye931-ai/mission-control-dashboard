import { useDashboardStore } from '../store/dashboardStore'

export default function MemoryMonitorLog() {
  const lines = useDashboardStore((s) => s.memoryMonitorLog)

  const warnings = lines.filter((l) => l.includes('WARNING'))
  const hasWarnings = warnings.length > 0

  return (
    <div>
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: hasWarnings ? '#f59e0b' : '#475569' }}
      >
        Memory Monitor
      </p>
      {lines.length === 0 ? (
        <p style={{ fontSize: 10, color: '#334155' }}>No events — all clear</p>
      ) : (
        <div
          style={{
            maxHeight: 120,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {[...lines].reverse().map((line, i) => {
            const isWarning = line.includes('WARNING')
            const isRestart = line.includes('restart')
            const color = isRestart ? '#ef4444' : isWarning ? '#f59e0b' : '#64748b'
            return (
              <p
                key={i}
                style={{
                  fontSize: 9,
                  color,
                  fontFamily: 'monospace',
                  lineHeight: '1.4',
                  wordBreak: 'break-all',
                }}
              >
                {line}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}
