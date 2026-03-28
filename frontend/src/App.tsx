import { useState, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { useDashboardStore } from './store/dashboardStore'
import CronProgress from './components/CronProgress'
import ActivityFeed from './components/ActivityFeed'
import MeshPanel from './components/MeshPanel'
import LLMStatus from './components/LLMStatus'
import MeshGraph from './components/MeshGraph'
import ComputeGauges from './components/ComputeGauges'
import MemoryMonitorLog from './components/MemoryMonitorLog'
import MeshInsights from './components/MeshInsights'

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:       '#08080f',
  surface:  '#0d0d1a',
  border:   '#13132a',
  borderHi: '#1e1e3a',
  cyan:     '#06b6d4',
  purple:   '#8b5cf6',
  green:    '#10b981',
  yellow:   '#f59e0b',
  red:      '#ef4444',
  textPri:  '#e2e8f0',
  textSec:  '#475569',
  textDim:  '#1e293b',
}

const AGENT_COLORS: Record<string, string> = {
  atlas: C.cyan, hermes: C.purple, iriseye: C.green,
}

const SERVICE_SHORT: Record<string, string> = {
  openviking: 'Viking', memory_mcp: 'MemMCP', openclaw_mcp: 'Claw',
  aimaestro: 'Maestro', mlx_server: 'MLX', llm_server: 'Ollama',
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, accent, sub,
}: { label: string; value: string | number; accent: string; sub?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 6,
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 2,
      boxShadow: `0 0 20px ${accent}08`,
    }}>
      <span style={{ fontSize: 8, color: C.textSec, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 8, color: C.textDim, letterSpacing: '0.06em' }}>{sub}</span>}
    </div>
  )
}

function AgentDot({ name, status, color }: { name: string; status: string; color: string }) {
  const online = ['online', 'active', 'busy'].includes(status)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '4px 10px',
      background: online ? `${color}0d` : C.surface,
      border: `1px solid ${online ? color + '33' : C.border}`,
      borderRadius: 4,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: online ? color : C.textSec,
        boxShadow: online ? `0 0 6px ${color}` : 'none',
        flexShrink: 0,
        animation: online ? 'pulse 2s infinite' : 'none',
      }} />
      <span style={{ fontSize: 9, color: online ? color : C.textSec, letterSpacing: '0.06em' }}>
        {name}
      </span>
    </div>
  )
}

function KpiStrip() {
  const agents  = useDashboardStore((s) => s.agents)
  const system  = useDashboardStore((s) => s.system)
  const services = useDashboardStore((s) => s.services)
  const ampMessages = useDashboardStore((s) => s.ampMessages)

  const onlineCount = agents.filter(a =>
    ['online', 'active', 'busy'].includes(a.status)
  ).length

  const mlxUp = (services as any).mlx_server?.status === 'up'
  const cpu  = system?.cpu_pct != null ? `${Math.round(system.cpu_pct)}%` : '—'
  const mem  = system?.ram_pct != null ? `${Math.round(system.ram_pct)}%` : '—'

  return (
    <div style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}`, background: C.bg }}>
      {/* KPI cards row */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 16px 8px' }}>
        <KpiCard label="Agents Online" value={`${onlineCount}/${agents.length || '—'}`} accent={C.cyan} />
        <KpiCard label="MLX Server"    value={mlxUp ? 'UP' : 'DOWN'} accent={mlxUp ? C.green : C.red} sub="Qwen3.5 35B" />
        <KpiCard label="Memory"        value={mem}  accent={C.purple} sub="system RAM" />
        <KpiCard label="AMP Messages"  value={ampMessages.length || '—'} accent={C.yellow} sub="in queue" />
        <KpiCard label="CPU"           value={cpu}  accent={C.cyan}   sub="utilization" />
      </div>

      {/* Agent dots + service pills row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px 8px', flexWrap: 'wrap',
      }}>
        {/* Agent status dots */}
        {agents.map(a => (
          <AgentDot
            key={a.id}
            name={a.label ?? a.name ?? '?'}
            status={a.status}
            color={AGENT_COLORS[(a.name ?? '').toLowerCase()] ?? C.textSec}
          />
        ))}

        {agents.length > 0 && (
          <span style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
        )}

        {/* Service pills */}
        {Object.entries(services as Record<string, { status: string }>).map(([key, svc]) => {
          const up = svc.status === 'up' || svc.status === 'healthy'
          const dot = up ? C.green : C.red
          return (
            <span key={key} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 8, color: up ? C.textPri : C.textSec,
              fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em',
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: dot, flexShrink: 0,
                boxShadow: up ? `0 0 4px ${dot}` : 'none',
              }} />
              {SERVICE_SHORT[key] ?? key}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Right Panel ───────────────────────────────────────────────────────────────
type RightTab = 'system' | 'memory' | 'schedule' | 'insights' | 'activity'

const RIGHT_TABS: { id: RightTab; label: string }[] = [
  { id: 'system',   label: 'System'   },
  { id: 'memory',   label: 'Memory'   },
  { id: 'schedule', label: 'Schedule' },
  { id: 'insights', label: 'Insights' },
  { id: 'activity', label: 'Activity' },
]

function RightPanel() {
  const [tab, setTab] = useState<RightTab>('system')
  return (
    <aside
      className="flex shrink-0 overflow-hidden"
      style={{ width: 280, borderLeft: `1px solid ${C.border}`, background: C.bg }}
    >
      {/* vertical tab rail */}
      <div className="flex flex-col shrink-0" style={{ width: 70, borderRight: `1px solid ${C.border}`, paddingTop: 6 }}>
        {RIGHT_TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: tab === id ? `${C.cyan}0a` : 'none',
            border: 'none',
            borderLeft: `2px solid ${tab === id ? C.cyan : 'transparent'}`,
            color: tab === id ? C.cyan : C.textSec,
            fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: 'ui-monospace, monospace',
            padding: '11px 0', cursor: 'pointer', textAlign: 'center', width: '100%',
            transition: 'color 0.15s, background 0.15s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 10 }}>
        {tab === 'system'   && <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}><ComputeGauges /></div>}
        {tab === 'memory'   && <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}><MemoryMonitorLog /></div>}
        {tab === 'schedule' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 9, color: C.textSec, fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0 }}>Scheduled</p>
            <CronProgress />
          </div>
        )}
        {tab === 'insights' && <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}><MeshInsights /></div>}
        {tab === 'activity' && <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><ActivityFeed /></div>}
      </div>
    </aside>
  )
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span style={{ fontSize: 11, color: C.textSec, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { isConnected } = useWebSocket()
  const voiceActive = useDashboardStore((s) => s.voiceActive)

  return (
    <div className="h-screen flex flex-col overflow-hidden"
      style={{ background: C.bg, color: C.textPri, fontFamily: 'ui-monospace, monospace' }}
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between shrink-0"
        style={{ padding: '0 20px', height: 44, borderBottom: `1px solid ${C.border}`, background: C.bg }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textPri }}>
            Mission Control
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 9,
            padding: '2px 8px', borderRadius: 3,
            background: isConnected ? `${C.green}15` : `${C.red}15`,
            color: isConnected ? C.green : C.red,
            border: `1px solid ${isConnected ? C.green + '33' : C.red + '33'}`,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: isConnected ? C.green : C.red,
              boxShadow: isConnected ? `0 0 5px ${C.green}` : 'none',
            }} />
            {isConnected ? 'live' : 'disconnected'}
          </span>
          <LLMStatus />
          {voiceActive && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 9,
              padding: '2px 8px', borderRadius: 3,
              background: `${C.purple}15`, color: C.purple, border: `1px solid ${C.purple}33`,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.purple }} />
              voice
            </span>
          )}
        </div>
        <Clock />
      </header>

      {/* ── KPI Strip ── */}
      <KpiStrip />

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* CENTER */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Mesh graph */}
          <div className="shrink-0" style={{
            height: '60%', borderBottom: `1px solid ${C.border}`,
            position: 'relative', background: C.bg,
          }}>
            <span style={{
              position: 'absolute', top: 10, left: 14, zIndex: 1,
              fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: C.textDim, pointerEvents: 'none',
            }}>
              Agent Mesh
            </span>
            <MeshGraph />
          </div>

          {/* Bottom panel */}
          <div className="flex-1 overflow-hidden min-h-0">
            <MeshPanel />
          </div>
        </main>

        <RightPanel />
      </div>
    </div>
  )
}
