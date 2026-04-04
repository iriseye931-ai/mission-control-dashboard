import { useDashboardStore } from '../store/dashboardStore'
import { MemoryEntry, MemoryEvent } from '../types'

function MemoryRow({ entry, index }: { entry: MemoryEntry; index: number }) {
  const text = entry.text ?? entry.content ?? '(no content)'
  const score = entry.score != null ? entry.score.toFixed(2) : null

  return (
    <div
      className="flex flex-col gap-1 py-3"
      style={{ borderBottom: '1px solid #1e1e2e' }}
    >
      {score != null && (
        <span className="text-xs font-mono" style={{ color: '#475569' }}>
          relevance {score}
        </span>
      )}
      <p
        className="text-xs leading-relaxed"
        style={{
          color: '#94a3b8',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {text}
      </p>
    </div>
  )
}

function EventRow({ event }: { event: MemoryEvent }) {
  const tone = event.status === 'error' ? '#ff8d7a' : event.status === 'warn' ? '#f3b55e' : '#8fe6b8'
  const label = event.type.split('_').join(' ')
  const metaBits = [
    event.source,
    event.latency_ms != null ? `${event.latency_ms}ms` : null,
    event.resource?.free_mb != null ? `${event.resource.free_mb}MB free` : null,
  ].filter(Boolean)
  return (
    <div className="flex flex-col gap-1 py-2" style={{ borderBottom: '1px solid #1e1e2e' }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: tone }}>
          {label}
        </span>
        <span className="text-[10px] font-mono" style={{ color: '#475569' }}>
          {event.ts ? new Date(event.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'unknown'}
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
        {event.summary}
      </p>
      {metaBits.length > 0 ? (
        <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: '#475569' }}>
          {metaBits.join(' · ')}
        </p>
      ) : null}
    </div>
  )
}

export default function ActivityFeed() {
  const memories = useDashboardStore((s) => s.memories)
  const memorySummary = useDashboardStore((s) => s.memorySummary)
  const memoryEvents = useDashboardStore((s) => s.memoryEvents)
  const routingSummary = useDashboardStore((s) => s.routingSummary)

  const freshness = memorySummary?.freshness_seconds
  const freshnessLabel =
    freshness == null ? 'unknown' : freshness < 60 ? `${freshness}s` : freshness < 3600 ? `${Math.floor(freshness / 60)}m` : `${Math.floor(freshness / 3600)}h`
  const componentHealth = memorySummary?.component_health ?? {}
  const primaryCause = memorySummary?.primary_cause
  const modeLabel = routingSummary?.memory_mode ?? primaryCause?.kind ?? 'healthy'

  return (
    <div
      className="rounded-lg px-4 flex flex-col h-full"
      style={{ background: '#111118', border: '1px solid #1e1e2e' }}
    >
      <h2
        className="text-xs font-semibold uppercase tracking-widest pt-4 pb-1"
        style={{ color: '#475569' }}
      >
        Memory Recalls
      </h2>

      {memorySummary && (
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 8,
            paddingBottom: 12,
            borderBottom: '1px solid #1e1e2e',
          }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#475569' }}>Health</div>
            <div className="text-xs font-mono mt-1" style={{ color: memorySummary.status === 'up' ? '#8fe6b8' : '#f3b55e' }}>
              {memorySummary.status}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#475569' }}>Freshness</div>
            <div className="text-xs font-mono mt-1" style={{ color: '#94a3b8' }}>
              {freshnessLabel}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#475569' }}>Recall</div>
            <div className="text-xs font-mono mt-1" style={{ color: '#74d8ff' }}>
              {memorySummary.recall_count}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#475569' }}>Pressure</div>
            <div className="text-xs font-mono mt-1" style={{ color: (memorySummary.pressure_events ?? 0) > 0 ? '#f3b55e' : '#8fe6b8' }}>
              {memorySummary.pressure_events ?? 0}
            </div>
          </div>
        </div>
      )}

      {memorySummary && (
        <div className="py-3" style={{ borderBottom: '1px solid #1e1e2e' }}>
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#475569' }}>
            Cause Ranking
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              ['gateway', componentHealth.gateway],
              ['substrate', componentHealth.substrate],
              ['pressure', componentHealth.pressure],
              ['freshness', componentHealth.freshness],
            ].map(([label, state]) => (
              <span
                key={label}
                className="text-[10px] font-mono uppercase tracking-[0.14em]"
                style={{
                  color: state === 'up' ? '#8fe6b8' : state === 'down' ? '#ff8d7a' : '#f3b55e',
                  border: '1px solid #1e1e2e',
                  borderRadius: 999,
                  padding: '4px 8px',
                }}
              >
                {label}:{state ?? 'unknown'}
              </span>
            ))}
          </div>
          <p className="text-xs leading-relaxed mt-3" style={{ color: '#94a3b8' }}>
            Primary cause: <span style={{ color: '#e2e8f0' }}>{modeLabel}</span>
            {primaryCause?.summary ? ` — ${primaryCause.summary}` : ''}
          </p>
        </div>
      )}

      {memorySummary?.warnings?.length ? (
        <div className="py-3" style={{ borderBottom: '1px solid #1e1e2e' }}>
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#475569' }}>
            Memory Warnings
          </p>
          <p className="text-xs leading-relaxed mt-2" style={{ color: '#f3b55e' }}>
            {memorySummary.warnings[0]}
          </p>
        </div>
      ) : null}

      {memoryEvents.length > 0 ? (
        <div className="py-3" style={{ borderBottom: '1px solid #1e1e2e' }}>
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#475569' }}>
            Recent Events
          </p>
          <div className="mt-2">
            {memoryEvents.slice(0, 4).map((event, index) => (
              <EventRow key={`${event.ts ?? 'event'}-${index}`} event={event} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {memories.length === 0 ? (
          <p className="text-xs py-3" style={{ color: '#475569' }}>
            No memories yet
          </p>
        ) : (
          memories.map((entry, i) => (
            <MemoryRow key={entry.id ?? i} entry={entry} index={i} />
          ))
        )}
      </div>
    </div>
  )
}
