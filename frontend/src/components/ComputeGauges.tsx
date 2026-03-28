import { useDashboardStore } from '../store/dashboardStore'

interface GaugeProps {
  label: string
  value: number      // 0–100
  color: string
  sublabel?: string
  size?: number
}

function ArcGauge({ label, value, color, sublabel, size = 80 }: GaugeProps) {
  const r = size / 2 - 8
  const cx = size / 2
  const cy = size / 2
  const circumference = Math.PI * r  // half circle arc
  const filled = (Math.min(value, 100) / 100) * circumference

  // arc goes from 180° to 360° (bottom half flipped = top arc)
  const startAngle = Math.PI
  const endAngle = 2 * Math.PI

  function arcPath(from: number, to: number, radius: number) {
    const x1 = cx + radius * Math.cos(from)
    const y1 = cy + radius * Math.sin(from)
    const x2 = cx + radius * Math.cos(to)
    const y2 = cy + radius * Math.sin(to)
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`
  }

  const trackPath = arcPath(startAngle, endAngle, r)

  // filled arc: from startAngle to startAngle + fraction * PI
  const fillEnd = startAngle + (Math.min(value, 100) / 100) * Math.PI
  const fillPath = arcPath(startAngle, fillEnd, r)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 10} style={{ overflow: 'visible' }}>
        {/* track */}
        <path d={trackPath} fill="none" stroke="#1e1e2e" strokeWidth={6} strokeLinecap="round" />
        {/* filled */}
        <path
          d={fillPath}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
        {/* value text */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill={color}
          fontSize={size < 72 ? 13 : 15}
          fontFamily="ui-monospace, monospace"
          fontWeight="bold"
        >
          {Math.round(value)}%
        </text>
      </svg>
      <span style={{ color: '#94a3b8', fontSize: 10, fontFamily: 'ui-monospace, monospace', textAlign: 'center', lineHeight: 1.3 }}>
        {label}
        {sublabel && <><br /><span style={{ color: '#475569', fontSize: 9 }}>{sublabel}</span></>}
      </span>
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #0f172a' }}>
      <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 10, color: accent ?? '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

export default function ComputeGauges() {
  const system   = useDashboardStore((s) => s.system)
  const llmActive = useDashboardStore((s) => s.llmActive)

  if (!system) {
    return <div style={{ color: '#475569', fontSize: 11, fontFamily: 'ui-monospace, monospace', padding: 8 }}>loading…</div>
  }

  const modelName = llmActive === 'mlx' ? 'Qwen3.5 35B-A3B' : 'local LLM'
  const ramColor  = system.mlx_ram_pct > 85 ? '#ef4444' : system.mlx_ram_pct > 65 ? '#f59e0b' : '#10b981'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#475569', margin: 0 }}>
        MLX Inference
      </p>

      {/* Big MLX RAM gauge — center stage */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ArcGauge
          label="MLX RAM"
          value={system.mlx_ram_pct}
          color={ramColor}
          sublabel={`${system.mlx_ram_gb} GB used`}
          size={110}
        />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <StatRow label="Model"    value={modelName}                              accent="#10b981" />
        <StatRow label="RAM"      value={`${system.ram_used_gb} / ${system.ram_total_gb} GB`} />
        <StatRow label="PID"      value={system.mlx_pid ? String(system.mlx_pid) : 'not running'} accent={system.mlx_pid ? '#06b6d4' : '#ef4444'} />
        <StatRow label="Engine"   value={llmActive ?? 'idle'}                    accent={llmActive ? '#a855f7' : '#334155'} />
        <StatRow label="Local"    value={`${Math.round(system.local_pct)}%`} />
      </div>
    </div>
  )
}
