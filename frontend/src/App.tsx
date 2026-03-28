import { useState, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { useDashboardStore } from './store/dashboardStore'
import ServiceHealth from './components/ServiceHealth'
import AgentCard from './components/AgentCard'
import CronProgress from './components/CronProgress'
import ActivityFeed from './components/ActivityFeed'
import MeshPanel from './components/MeshPanel'
import LLMStatus from './components/LLMStatus'
import MeshGraph from './components/MeshGraph'
import ComputeGauges from './components/ComputeGauges'
import MemoryMonitorLog from './components/MemoryMonitorLog'
import MeshInsights from './components/MeshInsights'

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
      style={{ width: 280, borderLeft: '1px solid #1e1e2e' }}
    >
      {/* vertical tab rail */}
      <div
        className="flex flex-col shrink-0"
        style={{ width: 72, borderRight: '1px solid #1e1e2e', paddingTop: 8 }}
      >
        {RIGHT_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: 'none',
              border: 'none',
              borderLeft: tab === id ? '2px solid #06b6d4' : '2px solid transparent',
              color: tab === id ? '#06b6d4' : '#334155',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'ui-monospace, monospace',
              padding: '10px 0',
              cursor: 'pointer',
              textAlign: 'center',
              width: '100%',
              transition: 'color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* tab content — bounded, internal scroll only */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 10 }}>
        {tab === 'system' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <ComputeGauges />
          </div>
        )}
        {tab === 'memory' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <MemoryMonitorLog />
          </div>
        )}
        {tab === 'schedule' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0 }}>Scheduled</p>
            <CronProgress />
          </div>
        )}
        {tab === 'insights' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <MeshInsights />
          </div>
        )}
        {tab === 'activity' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ActivityFeed />
          </div>
        )}
      </div>
    </aside>
  )
}

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="text-xs tabular-nums" style={{ color: '#475569' }}>
      {time}
    </span>
  )
}

export default function App() {
  const { isConnected } = useWebSocket()
  const agents = useDashboardStore((s) => s.agents)
  const voiceActive = useDashboardStore((s) => s.voiceActive)

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'ui-monospace, monospace' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid #1e1e2e', background: '#0a0a0f' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-widest uppercase" style={{ color: '#e2e8f0' }}>
            Mission Control
          </h1>
          <span
            className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded"
            style={{
              background: isConnected ? '#22c55e22' : '#ef444422',
              color: isConnected ? '#22c55e' : '#ef4444',
              border: `1px solid ${isConnected ? '#22c55e44' : '#ef444444'}`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: isConnected ? '#22c55e' : '#ef4444' }} />
            {isConnected ? 'live' : 'disconnected'}
          </span>
          <LLMStatus />
          {voiceActive && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-mono"
              style={{ background: '#a855f722', color: '#a855f7', border: '1px solid #a855f744' }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#a855f7' }} />
              voice
            </span>
          )}
        </div>
        <Clock />
      </header>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: services + agents */}
        <aside
          className="flex flex-col gap-3 p-3 overflow-hidden shrink-0"
          style={{ width: 210, borderRight: '1px solid #1e1e2e' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#475569' }}>
              Services
            </p>
            <ServiceHealth />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#475569' }}>
              Agents
            </p>
            {agents.length === 0 ? (
              <p className="text-xs" style={{ color: '#475569' }}>connecting…</p>
            ) : (
              <div className="flex flex-col gap-2">
                {agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: mesh graph + chat */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Mesh visualization */}
          <div
            className="shrink-0"
            style={{
              height: '55%',
              borderBottom: '1px solid #1e1e2e',
              position: 'relative',
              background: '#0a0a0f',
            }}
          >
            <span
              style={{
                position: 'absolute', top: 10, left: 14, zIndex: 1,
                fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
                color: '#1e293b', pointerEvents: 'none',
              }}
            >
              Agent Mesh
            </span>
            <MeshGraph />
          </div>

          {/* Mesh Panel — Logs | AMP | Hermes | Atlas */}
          <div className="flex-1 overflow-hidden min-h-0">
            <MeshPanel />
          </div>
        </main>

        <RightPanel />

      </div>
    </div>
  )
}
