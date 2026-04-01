import { useState, useRef, useEffect, FormEvent } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import type { PermissionAuditEntry } from '../types'
import RAGSearch from './RAGSearch'
import AmpInbox from './AmpInbox'

type Tab = 'logs' | 'amp' | 'hermes' | 'rag'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'logs', label: 'Logs' },
  { id: 'amp', label: 'AMP' },
  { id: 'hermes', label: 'Hermes' },
  { id: 'rag', label: 'RAG' },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex shrink-0" style={{ borderBottom: '1px solid #1e1e2e' }}>
      {TAB_LABELS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            padding: '6px 14px',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: 'monospace',
            border: 'none',
            borderBottom: active === id ? `1px solid ${id === 'rag' ? '#8b5cf6' : '#06b6d4'}` : '1px solid transparent',
            marginBottom: -1,
            background: 'transparent',
            color: active === id ? (id === 'rag' ? '#8b5cf6' : '#06b6d4') : '#475569',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function LogsTab() {
  const logs = useDashboardStore((s) => s.logs)
  const bottomRef = useRef<HTMLDivElement>(null)

  const combined = [
    ...logs.memory.map((l) => ({ src: 'mem', line: l })),
    ...logs.mlx.map((l) => ({ src: 'mlx', line: l })),
  ].sort((a, b) => {
    // Best-effort sort by any timestamp prefix
    const ta = a.line.match(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/)?.[0] ?? ''
    const tb = b.line.match(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/)?.[0] ?? ''
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [combined.length])

  if (combined.length === 0) {
    return <p style={{ fontSize: 10, color: '#334155', padding: 12 }}>No log entries — logs appear here as MLX and memory monitor write them.</p>
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {combined.map(({ src, line }, i) => {
        const isWarn = line.includes('WARNING') || line.includes('WARN')
        const isErr = line.includes('ERROR') || line.includes('restart') || line.includes('OOM')
        const color = isErr ? '#ef4444' : isWarn ? '#f59e0b' : src === 'mlx' ? '#64748b' : '#475569'
        const badge = src === 'mlx' ? '#1e293b' : '#0f172a'
        return (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 8, color: '#334155', background: badge, padding: '1px 4px', borderRadius: 2, flexShrink: 0, marginTop: 1 }}>
              {src}
            </span>
            <span style={{ fontSize: 9, color, fontFamily: 'monospace', lineHeight: 1.5, wordBreak: 'break-all' }}>
              {line}
            </span>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}


function HermesTab() {
  const status = useDashboardStore((s) => s.hermesStatus)
  const cronJobs = useDashboardStore((s) => s.cronJobs)
  const agents = useDashboardStore((s) => s.agents)
  const routingSummary = useDashboardStore((s) => s.routingSummary)
  const permissionAuditSummary = useDashboardStore((s) => s.permissionAuditSummary)
  const premiumPool = agents.filter((agent) => agent.routing_group === 'premium-pool')
  const localDefault = agents.find((agent) => agent.routing_group === 'local-default')
  const [taskText, setTaskText] = useState('')
  const [dispatchTask, setDispatchTask] = useState(false)
  const [submittingTask, setSubmittingTask] = useState(false)
  const [taskResult, setTaskResult] = useState<string | null>(null)
  const [availabilityBusy, setAvailabilityBusy] = useState<string | null>(null)
  const [profileBusy, setProfileBusy] = useState<string | null>(null)
  const [auditEntries, setAuditEntries] = useState<PermissionAuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const nextJob = cronJobs
    .filter((j) => j.enabled !== false && j.next_run_in_seconds != null)
    .sort((a, b) => (a.next_run_in_seconds ?? Infinity) - (b.next_run_in_seconds ?? Infinity))[0]

  function fmtIn(secs: number | null | undefined) {
    if (secs == null) return '—'
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    return `${Math.floor(secs / 3600)}h`
  }

  function fmtAgo(secs: number | null | undefined) {
    if (secs == null) return 'unknown'
    if (secs < 60) return `${secs}s ago`
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
  }

  async function loadAudit() {
    setAuditLoading(true)
    try {
      const res = await fetch('/api/permissions/audit?last=12')
      const data = await res.json()
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setAuditEntries(Array.isArray(data.entries) ? data.entries.slice().reverse() : [])
    } catch {
      setAuditEntries([])
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    void loadAudit()
  }, [])

  const showSession = status && status.status !== 'unavailable' && status.status !== 'no sessions'

  const fields: [string, string | number | undefined | null][] = showSession ? [
    ['Status', status!.status],
    ['Session', status!.session_id],
    ['Model', status!.model],
    ['Task', status!.task],
    ['Created', status!.created_at ? new Date(status!.created_at).toLocaleString() : undefined],
    ['Modified', status!.modified ? new Date(status!.modified * 1000).toLocaleString() : undefined],
  ] : []

  async function submitTask(e: FormEvent) {
    e.preventDefault()
    if (!taskText.trim()) return
    setSubmittingTask(true)
    setTaskResult(null)
    try {
      const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskText, dispatch: dispatchTask }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setTaskResult(`${data.status}: ${data.task_class} -> ${data.recommended_agent}${data.recommended_profile ? ` [${data.recommended_profile}]` : ''}${data.fallback_agent ? ` (fallback ${data.fallback_agent})` : ''}`)
    } catch (err) {
      setTaskResult(err instanceof Error ? err.message : 'Task routing failed')
    } finally {
      setSubmittingTask(false)
      if (dispatchTask) void loadAudit()
    }
  }

  async function updateAvailability(agentName: string, availability: string) {
    setAvailabilityBusy(agentName)
    try {
      const note = availability === 'rate_limited' ? 'Anthropic usage limit reached' : null
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentName, availability, note }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setTaskResult(`availability updated: ${agentName} -> ${availability}`)
    } catch (err) {
      setTaskResult(err instanceof Error ? err.message : 'Availability update failed')
    } finally {
      setAvailabilityBusy(null)
      void loadAudit()
    }
  }

  async function runProfileAction(agentName: string, profileName: string, action: 'start' | 'stop') {
    setProfileBusy(`${agentName}:${profileName}:${action}`)
    try {
      const res = await fetch('/api/local-profiles/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentName, profile: profileName, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail ?? `Server error: ${res.status}`)
      }
      setTaskResult(`profile ${action}: ${profileName} -> ${data.status}`)
    } catch (err) {
      setTaskResult(err instanceof Error ? err.message : `Profile ${action} failed`)
    } finally {
      setProfileBusy(null)
      void loadAudit()
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {(premiumPool.length > 0 || localDefault) && (
        <div>
          <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Routing Policy
          </p>
          {premiumPool.length > 0 && (
            <div style={{ padding: '7px 8px', border: '1px solid #0f172a', borderRadius: 6, background: '#0b0b12', marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#e2e8f0', fontFamily: 'monospace' }}>
                premium pool: {premiumPool.map((agent) => agent.label ?? agent.name).join(' + ')}
              </div>
              {routingSummary && (
                <div style={{ marginTop: 4, fontSize: 8, color: '#64748b', fontFamily: 'monospace', lineHeight: 1.5 }}>
                  available now: {routingSummary.premium_available_count}/{routingSummary.premium_total_count} ({routingSummary.premium_available.join(', ') || 'none'})
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: 8, color: '#64748b', fontFamily: 'monospace', lineHeight: 1.5 }}>
                Atlas is a lead role shared by Codex and Claude Code
              </div>
              <div style={{ marginTop: 3, fontSize: 8, color: '#334155', fontFamily: 'monospace' }}>
                reserve this pool for planning, tricky refactors, ambiguous debugging, and final review
              </div>
              <div style={{ marginTop: 3, fontSize: 8, color: '#334155', fontFamily: 'monospace' }}>
                if one hits a limit, fail over to the other
              </div>
            </div>
          )}
          {localDefault && (
            <div style={{ padding: '7px 8px', border: '1px solid #0f172a', borderRadius: 6, background: '#0b0b12' }}>
              <div style={{ fontSize: 9, color: '#e2e8f0', fontFamily: 'monospace' }}>
                local default: {localDefault.label ?? localDefault.name}
              </div>
              <div style={{ marginTop: 4, fontSize: 8, color: '#64748b', fontFamily: 'monospace', lineHeight: 1.5 }}>
                use for cron, summaries, memory consolidation, repo scans, and routine execution
              </div>
              {routingSummary?.guidance && (
                <div style={{ marginTop: 3, fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
                  router: routine → {routingSummary.guidance.routine}, specialized → {routingSummary.guidance.specialized}, premium → {routingSummary.guidance.premium}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Permission Audit
        </p>
        <div style={{ padding: '7px 8px', border: '1px solid #0f172a', borderRadius: 6, background: '#0b0b12', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
              total: <span style={{ color: '#94a3b8' }}>{permissionAuditSummary?.count ?? 0}</span>
            </span>
            <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
              allow: <span style={{ color: '#10b981' }}>{permissionAuditSummary?.decision_counts?.allow ?? 0}</span>
            </span>
            <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
              deny: <span style={{ color: '#ef4444' }}>{permissionAuditSummary?.decision_counts?.deny ?? 0}</span>
            </span>
            <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
              ask: <span style={{ color: '#f59e0b' }}>{permissionAuditSummary?.decision_counts?.ask ?? 0}</span>
            </span>
            <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
              bypass: <span style={{ color: '#06b6d4' }}>{permissionAuditSummary?.decision_counts?.bypass ?? 0}</span>
            </span>
          </div>
          {permissionAuditSummary?.last_event_at && (
            <div style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
              last event: {new Date(permissionAuditSummary.last_event_at).toLocaleString()}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 8, color: '#475569', fontFamily: 'monospace' }}>
              recent control-plane decisions
            </div>
            <button
              type="button"
              onClick={() => void loadAudit()}
              disabled={auditLoading}
              style={{
                fontSize: 8,
                padding: '3px 6px',
                borderRadius: 4,
                border: '1px solid #1e293b',
                background: '#0a0a0f',
                color: auditLoading ? '#475569' : '#94a3b8',
                cursor: auditLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {auditLoading ? 'refreshing' : 'refresh'}
            </button>
          </div>
          {auditEntries.length === 0 ? (
            <div style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
              no audit entries yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {auditEntries.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} style={{ padding: '5px 6px', border: '1px solid #111827', borderRadius: 4, background: '#09090d' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 8, color: '#cbd5e1', fontFamily: 'monospace' }}>
                      {entry.tool ?? 'unknown-tool'}
                      {entry.agent ? ` -> ${entry.agent}` : ''}
                    </span>
                    <span style={{ fontSize: 8, color: entry.decision === 'allow' ? '#10b981' : entry.decision === 'deny' ? '#ef4444' : entry.decision === 'ask' ? '#f59e0b' : '#06b6d4', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                      {entry.decision}
                    </span>
                  </div>
                  <div style={{ marginTop: 3, fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
                    {new Date(entry.timestamp).toLocaleString()} · source {entry.source} · mode {entry.mode}
                  </div>
                  {entry.reason && (
                    <div style={{ marginTop: 3, fontSize: 8, color: '#475569', fontFamily: 'monospace', lineHeight: 1.5 }}>
                      {entry.reason}
                    </div>
                  )}
                  {entry.input_summary && (
                    <div style={{ marginTop: 3, fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
                      input: {entry.input_summary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Task Router
        </p>
        <form onSubmit={submitTask} style={{ padding: '7px 8px', border: '1px solid #0f172a', borderRadius: 6, background: '#0b0b12', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            rows={4}
            placeholder="Describe the task to see where the mesh will route it..."
            style={{
              background: '#0a0a0f',
              border: '1px solid #1e293b',
              color: '#e2e8f0',
              borderRadius: 4,
              padding: '7px 8px',
              fontSize: 10,
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="submit"
              disabled={submittingTask || !taskText.trim()}
              style={{
                fontSize: 10,
                padding: '5px 10px',
                borderRadius: 4,
                border: 'none',
                background: submittingTask ? '#06b6d466' : '#06b6d4',
                color: '#0a0a0f',
                cursor: submittingTask ? 'not-allowed' : 'pointer',
                fontFamily: 'monospace',
                opacity: taskText.trim() ? 1 : 0.4,
              }}
            >
              {submittingTask ? 'Routing…' : 'Route Task'}
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
              <input
                type="checkbox"
                checked={dispatchTask}
                onChange={(e) => setDispatchTask(e.target.checked)}
              />
              dispatch
            </label>
            {taskResult && (
              <span style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'monospace' }}>
                {taskResult}
              </span>
            )}
          </div>
        </form>
      </div>

      {agents.length > 0 && (
        <div>
          <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Mesh State
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {agents.map((agent) => (
              <div key={agent.id} style={{ padding: '7px 8px', border: '1px solid #0f172a', borderRadius: 6, background: '#0b0b12' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 10, color: '#e2e8f0', fontFamily: 'monospace' }}>
                    {agent.label ?? agent.name}
                  </span>
                  <span style={{ fontSize: 8, color: agent.health_status === 'healthy' ? '#10b981' : agent.health_status === 'degraded' ? '#f59e0b' : '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    {agent.health_status ?? agent.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5 }}>
                  <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
                    tier: <span style={{ color: agent.tier === 'premium' ? '#f59e0b' : agent.tier === 'local-default' ? '#a855f7' : '#94a3b8' }}>{agent.tier ?? 'unknown'}</span>
                  </span>
                  <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
                    runtime: <span style={{ color: '#94a3b8' }}>{agent.runtime_status ?? agent.status}</span>
                  </span>
                  <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
                    presence: <span style={{ color: agent.presence?.status === 'online' ? '#10b981' : agent.presence?.status === 'registered' ? '#06b6d4' : '#ef4444' }}>{agent.presence?.status ?? 'unknown'}</span>
                  </span>
                  <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
                    maestro: <span style={{ color: '#94a3b8' }}>{agent.registration_status === 'registered' ? (agent.orchestration_status ?? 'unknown') : 'not registered'}</span>
                  </span>
                  <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
                    activity: <span style={{ color: agent.activity_status === 'live' ? '#10b981' : agent.activity_status === 'recent' ? '#06b6d4' : agent.activity_status === 'idle' ? '#f59e0b' : agent.activity_status === 'stale' ? '#ef4444' : '#94a3b8' }}>{agent.activity_status ?? 'unknown'}</span>
                  </span>
                  <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
                    availability: <span style={{ color: agent.availability_status === 'available' ? '#10b981' : agent.availability_status === 'rate_limited' ? '#f59e0b' : '#ef4444' }}>{agent.availability_status ?? 'available'}</span>
                  </span>
                </div>
                {agent.last_active && (
                  <div style={{ marginTop: 3, fontSize: 8, color: '#475569', fontFamily: 'monospace' }}>
                    last active: {new Date(agent.last_active).toLocaleString()} ({fmtAgo(agent.activity_age_seconds)})
                  </div>
                )}
                {agent.status_reason && (
                  <div style={{ marginTop: 3, fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
                    {agent.status_reason}
                  </div>
                )}
                {agent.presence?.reason && (
                  <div style={{ marginTop: 3, fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
                    presence: {agent.presence.reason}
                  </div>
                )}
                {agent.availability_reason && (
                  <div style={{ marginTop: 3, fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
                    availability note: {agent.availability_reason}
                  </div>
                )}
                {agent.routing_group === 'premium-pool' && (
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>set:</span>
                    <select
                      value={agent.availability_status ?? 'available'}
                      onChange={(e) => updateAvailability(agent.name, e.target.value)}
                      disabled={availabilityBusy === agent.name}
                      style={{
                        background: '#0a0a0f',
                        border: '1px solid #1e293b',
                        color: '#94a3b8',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 8,
                        fontFamily: 'monospace',
                      }}
                    >
                      <option value="available">available</option>
                      <option value="rate_limited">rate_limited</option>
                      <option value="offline">offline</option>
                    </select>
                  </div>
                )}
                {(agent.reserve_for && agent.reserve_for.length > 0) && (
                  <div style={{ marginTop: 3, fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
                    reserve: {agent.reserve_for.join(', ')}
                  </div>
                )}
                {(agent.local_profiles && agent.local_profiles.length > 0) && (
                  <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                      local profiles
                    </div>
                    {agent.local_profiles.map((profile) => (
                      <div
                        key={profile.name}
                        style={{
                          padding: '5px 6px',
                          border: '1px solid #111827',
                          borderRadius: 4,
                          background: '#09090d',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <div style={{ fontSize: 8, color: '#cbd5e1', fontFamily: 'monospace' }}>
                          {profile.name}: {profile.model.split('/').pop() ?? profile.model}
                        </div>
                        {profile.mode && (
                          <div style={{ fontSize: 8, color: profile.mode === 'active' ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>
                            mode: {profile.mode}
                          </div>
                        )}
                        <div style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
                          state: <span style={{ color: profile.running ? '#10b981' : profile.installed ? '#94a3b8' : '#ef4444' }}>
                            {profile.running ? 'running' : profile.installed ? 'installed' : 'missing'}
                          </span>
                        </div>
                        {profile.purpose && (
                          <div style={{ fontSize: 8, color: '#475569', fontFamily: 'monospace', lineHeight: 1.5 }}>
                            {profile.purpose}
                          </div>
                        )}
                        {profile.base_url && (
                          <div style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
                            endpoint: {profile.base_url}
                          </div>
                        )}
                        {profile.mode === 'on-demand' && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                            <button
                              type="button"
                              disabled={!profile.installed || profile.running || profileBusy === `${agent.name}:${profile.name}:start`}
                              onClick={() => runProfileAction(agent.name, profile.name, 'start')}
                              style={{
                                fontSize: 8,
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: 'none',
                                background: !profile.installed || profile.running ? '#1f2937' : '#10b981',
                                color: !profile.installed || profile.running ? '#64748b' : '#0a0a0f',
                                cursor: !profile.installed || profile.running ? 'not-allowed' : 'pointer',
                                fontFamily: 'monospace',
                              }}
                            >
                              start
                            </button>
                            <button
                              type="button"
                              disabled={!profile.running || profileBusy === `${agent.name}:${profile.name}:stop`}
                              onClick={() => runProfileAction(agent.name, profile.name, 'stop')}
                              style={{
                                fontSize: 8,
                                padding: '3px 6px',
                                borderRadius: 4,
                                border: 'none',
                                background: profile.running ? '#ef4444' : '#1f2937',
                                color: profile.running ? '#0a0a0f' : '#64748b',
                                cursor: profile.running ? 'pointer' : 'not-allowed',
                                fontFamily: 'monospace',
                              }}
                            >
                              stop
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {agent.fallback_to && (
                  <div style={{ marginTop: 3, fontSize: 8, color: '#334155', fontFamily: 'monospace', lineHeight: 1.5 }}>
                    failover: {agent.fallback_to}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cronJobs.length > 0 && (
        <div>
          <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Cron ({cronJobs.length} jobs)
          </p>
          {nextJob && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #0f172a' }}>
              <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {nextJob.name}
              </span>
              <span style={{ fontSize: 9, color: '#06b6d4', fontFamily: 'monospace', flexShrink: 0 }}>
                in {fmtIn(nextJob.next_run_in_seconds)}
              </span>
            </div>
          )}
          {cronJobs.slice(0, 4).map((job) => (
            <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #0a0a14' }}>
              <span style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {job.name}
              </span>
              <span style={{ fontSize: 8, color: job.last_status === 'success' ? '#10b981' : job.last_status ? '#f59e0b' : '#334155', fontFamily: 'monospace', flexShrink: 0 }}>
                {job.last_status ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {showSession ? (
        <div>
          <p style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Session</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {fields.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', width: 60, flexShrink: 0, textAlign: 'right' }}>
                  {label}
                </span>
                <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 10, color: '#334155' }}>No active Hermes session</p>
      )}
    </div>
  )
}

export default function MeshPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('logs')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0f' }}>
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'logs' && <LogsTab />}
      {activeTab === 'amp' && <AmpInbox />}
      {activeTab === 'hermes' && <HermesTab />}
      {activeTab === 'rag' && (
        <div style={{ flex: 1, padding: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <RAGSearch />
        </div>
      )}
    </div>
  )
}
