import { useEffect, useRef, useMemo } from 'react'
import { useDashboardStore } from '../store/dashboardStore'

// ── Node definitions ─────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  atlas:   '#06b6d4',
  hermes:  '#a855f7',
  iriseye: '#10b981',
}

const SERVICE_COLORS: Record<string, string> = {
  openviking:   '#06b6d4',
  mlx_server:   '#10b981',
  memory_mcp:   '#a855f7',
  openclaw_mcp: '#10b981',
  ollama:       '#6366f1',
  aimaestro:    '#f59e0b',
}

const SERVICE_LABELS: Record<string, string> = {
  openviking:   'OpenViking',
  mlx_server:   'MLX / Qwen',
  memory_mcp:   'Mem MCP',
  openclaw_mcp: 'OpenClaw',
  ollama:       'Ollama',
  aimaestro:    'AI Maestro',
}

// Radial layout — center (0.50, 0.48), services on outer ring r=0.32, agents inner r=0.14
// All coords as fraction of canvas W/H
const CX = 0.50
const CY = 0.48

const AGENT_POSITIONS: Record<string, [number, number]> = {
  atlas:   [CX,            CY],
  hermes:  [CX - 0.16,    CY + 0.10],   // lower-left
  iriseye: [CX + 0.16,    CY + 0.10],   // lower-right
}

const SERVICE_POSITIONS: Record<string, [number, number]> = {
  openviking:   [CX,                    CY - 0.32],          // top
  mlx_server:   [CX + 0.32 * 0.866,    CY - 0.32 * 0.5],   // upper-right
  openclaw_mcp: [CX + 0.32 * 0.866,    CY + 0.32 * 0.5],   // lower-right
  ollama:       [CX,                    CY + 0.32],          // bottom
  memory_mcp:   [CX - 0.32 * 0.866,    CY + 0.32 * 0.5],   // lower-left
  aimaestro:    [CX - 0.32 * 0.866,    CY - 0.32 * 0.5],   // upper-left
}

// which services connect to which agents
const SERVICE_EDGES: Array<[string, string]> = [
  ['openviking', 'atlas'],
  ['openviking', 'hermes'],
  ['openviking', 'iriseye'],
  ['mlx_server', 'atlas'],
  ['mlx_server', 'hermes'],
  ['mlx_server', 'iriseye'],
  ['memory_mcp', 'atlas'],
  ['memory_mcp', 'hermes'],
  ['openclaw_mcp', 'iriseye'],
  ['openclaw_mcp', 'atlas'],
  ['ollama', 'openviking'],
  ['aimaestro', 'hermes'],
  ['aimaestro', 'iriseye'],
]

// agent-to-agent edges
const AGENT_EDGES: Array<[string, string]> = [
  ['atlas', 'hermes'],
  ['atlas', 'iriseye'],
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MeshGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)

  const agents = useDashboardStore((s) => s.agents)
  const services = useDashboardStore((s) => s.services)

  // build lookup for live data
  const agentStatus = useMemo(() => {
    const m: Record<string, string> = {}
    for (const a of agents) {
      const key = (a.name ?? '').toLowerCase().replace(/\s+/g, '-')
      m[key] = a.status
    }
    return m
  }, [agents])

  const serviceStatus = useMemo(() => {
    const m: Record<string, string> = {}
    for (const [k, v] of Object.entries(services)) {
      m[k] = v.status
    }
    return m
  }, [services])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const draw = (ts: number) => {
      if (!running) return
      timeRef.current = ts / 1000

      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      const t = timeRef.current

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // ── Background hex grid ──────────────────────────────────────────────
      ctx.save()
      ctx.strokeStyle = 'rgba(30,30,50,0.6)'
      ctx.lineWidth = 0.5
      const hexR = 28
      const hexW = hexR * Math.sqrt(3)
      const hexH = hexR * 2
      for (let row = -1; row < H / hexH + 2; row++) {
        for (let col = -1; col < W / hexW + 2; col++) {
          const cx = col * hexW + (row % 2 === 0 ? 0 : hexW / 2)
          const cy = row * hexH * 0.75
          ctx.beginPath()
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6
            const x = cx + hexR * Math.cos(angle)
            const y = cy + hexR * Math.sin(angle)
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.stroke()
        }
      }
      ctx.restore()

      // helper: canvas coords — square viewport centered in canvas so graph never stretches
      const size = Math.min(W, H) * 0.92
      const ox = (W - size) / 2
      const oy = (H - size) / 2
      const pos = (frac: [number, number]): [number, number] => [
        ox + frac[0] * size,
        oy + frac[1] * size,
      ]

      // ── Draw edges ──────────────────────────────────────────────────────
      const drawEdge = (
        fromPos: [number, number],
        toPos: [number, number],
        color: string,
        active: boolean,
        animated: boolean,
      ) => {
        const [x1, y1] = pos(fromPos)
        const [x2, y2] = pos(toPos)
        const alpha = active ? 0.35 : 0.08
        ctx.save()
        ctx.strokeStyle = `rgba(${hexToRgb(color)},${alpha})`
        ctx.lineWidth = active ? 1.5 : 0.8
        ctx.setLineDash(active ? [] : [4, 6])
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        ctx.setLineDash([])

        // animated pulse dot along edge
        if (active && animated) {
          const phase = (t * 0.6) % 1
          const px = x1 + (x2 - x1) * phase
          const py = y1 + (y2 - y1) * phase
          ctx.beginPath()
          ctx.arc(px, py, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${hexToRgb(color)},0.9)`
          ctx.fill()
        }
        ctx.restore()
      }

      // service → agent edges
      for (const [svcKey, agentKey] of SERVICE_EDGES) {
        const svcPos = SERVICE_POSITIONS[svcKey]
        const agentPos = AGENT_POSITIONS[agentKey]
        if (!svcPos || !agentPos) continue
        const svcOk = serviceStatus[svcKey] === 'up'
        const agentOk = ['online', 'active', 'busy'].includes(agentStatus[agentKey] ?? 'online')
        const color = SERVICE_COLORS[svcKey] ?? '#475569'
        drawEdge(svcPos, agentPos, color, svcOk && agentOk, svcOk && agentOk)
      }

      // agent → agent edges
      for (const [a, b] of AGENT_EDGES) {
        const aPos = AGENT_POSITIONS[a]
        const bPos = AGENT_POSITIONS[b]
        if (!aPos || !bPos) continue
        const bothOnline =
          ['online', 'active', 'busy'].includes(agentStatus[a] ?? 'online') &&
          ['online', 'active', 'busy'].includes(agentStatus[b] ?? 'online')
        drawEdge(aPos, bPos, '#334155', bothOnline, false)
      }

      // ── Draw service nodes ───────────────────────────────────────────────
      const drawServiceNode = (key: string) => {
        const frac = SERVICE_POSITIONS[key]
        if (!frac) return
        const [cx, cy] = pos(frac)
        const status = serviceStatus[key] ?? 'unknown'
        const up = status === 'up'
        const color = SERVICE_COLORS[key] ?? '#475569'
        const r = 18

        // glow
        if (up) {
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5)
          grd.addColorStop(0, `rgba(${hexToRgb(color)},0.18)`)
          grd.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.beginPath()
          ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        }

        // outer ring
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = up ? `rgba(${hexToRgb(color)},0.7)` : 'rgba(71,85,105,0.4)'
        ctx.lineWidth = 1
        ctx.stroke()

        // inner fill
        ctx.beginPath()
        ctx.arc(cx, cy, r - 4, 0, Math.PI * 2)
        ctx.fillStyle = up
          ? `rgba(${hexToRgb(color)},0.12)`
          : 'rgba(10,10,15,0.8)'
        ctx.fill()

        // status dot
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fillStyle = up ? color : '#374151'
        if (up) {
          ctx.shadowColor = color
          ctx.shadowBlur = 6
        }
        ctx.fill()
        ctx.shadowBlur = 0

        // label below
        ctx.font = '10px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = up ? `rgba(${hexToRgb(color)},0.9)` : '#374151'
        ctx.fillText(SERVICE_LABELS[key] ?? key, cx, cy + r + 13)
      }

      for (const key of Object.keys(SERVICE_POSITIONS)) drawServiceNode(key)

      // ── Draw agent nodes ─────────────────────────────────────────────────
      const drawAgentNode = (key: string) => {
        const frac = AGENT_POSITIONS[key]
        if (!frac) return
        const [cx, cy] = pos(frac)
        const status = agentStatus[key] ?? 'online'
        const online = ['online', 'active', 'busy'].includes(status)
        const color = AGENT_COLORS[key] ?? '#64748b'
        const r = key === 'atlas' ? 28 : 22

        // pulsing outer ring for active agents
        if (online) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 2 + (key === 'atlas' ? 0 : key === 'hermes' ? 2 : 4))
          ctx.beginPath()
          ctx.arc(cx, cy, r + 6 + pulse * 4, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${hexToRgb(color)},${0.12 + pulse * 0.1})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // glow
        if (online) {
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3)
          grd.addColorStop(0, `rgba(${hexToRgb(color)},0.2)`)
          grd.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.beginPath()
          ctx.arc(cx, cy, r * 3, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        }

        // rotating outer ring for atlas (lead agent)
        if (key === 'atlas') {
          ctx.save()
          ctx.translate(cx, cy)
          ctx.rotate(t * 0.4)
          ctx.beginPath()
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2
            const r1 = r + 8
            const r2 = r + 11
            ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1)
            ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2)
          }
          ctx.strokeStyle = `rgba(${hexToRgb(color)},0.5)`
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.restore()
        }

        // hexagonal shape for agents
        ctx.save()
        ctx.translate(cx, cy)
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6
          const x = r * Math.cos(a)
          const y = r * Math.sin(a)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fillStyle = online
          ? `rgba(${hexToRgb(color)},0.15)`
          : 'rgba(10,10,15,0.85)'
        ctx.fill()
        ctx.strokeStyle = online ? `rgba(${hexToRgb(color)},0.8)` : 'rgba(71,85,105,0.4)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()

        // agent name
        ctx.font = `${key === 'atlas' ? 11 : 10}px ui-monospace, monospace`
        ctx.textAlign = 'center'
        ctx.fillStyle = online ? color : '#374151'
        if (online) {
          ctx.shadowColor = color
          ctx.shadowBlur = 8
        }
        ctx.fillText(key, cx, cy + 3.5)
        ctx.shadowBlur = 0

        // status dot below name
        const dotColor = status === 'busy' ? '#eab308' : online ? '#22c55e' : '#374151'
        ctx.beginPath()
        ctx.arc(cx, cy + r + 10, 3, 0, Math.PI * 2)
        ctx.fillStyle = dotColor
        if (online) { ctx.shadowColor = dotColor; ctx.shadowBlur = 6 }
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.font = '9px ui-monospace, monospace'
        ctx.fillStyle = dotColor
        ctx.fillText(status, cx, cy + r + 23)
      }

      for (const key of Object.keys(AGENT_POSITIONS)) drawAgentNode(key)

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
    }
  }, [agentStatus, serviceStatus])

  // resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    })
    ro.observe(canvas)
    // initial size
    canvas.width = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = canvas.offsetHeight * window.devicePixelRatio
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    return () => ro.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
