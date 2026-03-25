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

export default function ComputeGauges() {
  const system = useDashboardStore((s) => s.system)
  const llmActive = useDashboardStore((s) => s.llmActive)

  if (!system) {
    return (
      <div style={{ color: '#475569', fontSize: 11, fontFamily: 'ui-monospace, monospace', textAlign: 'center', padding: '8px' }}>
        loading metrics…
      </div>
    )
  }

  const localLabel = llmActive === 'mlx'
    ? `MLX ${system.mlx_ram_gb}GB`
    : 'local LLM'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', margin: 0 }}>
        Compute
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-around', flexWrap: 'wrap' }}>
        <ArcGauge
          label="RAM"
          value={system.ram_pct}
          color="#06b6d4"
          sublabel={`${system.ram_used_gb}/${system.ram_total_gb}GB`}
          size={80}
        />
        <ArcGauge
          label="CPU"
          value={system.cpu_pct}
          color="#a855f7"
          size={80}
        />
        <ArcGauge
          label="Local LLM"
          value={system.mlx_ram_pct}
          color="#10b981"
          sublabel={localLabel}
          size={80}
        />
      </div>
    </div>
  )
}
