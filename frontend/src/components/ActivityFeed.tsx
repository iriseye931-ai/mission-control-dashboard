import { useDashboardStore } from '../store/dashboardStore'
import { MemoryEntry } from '../types'

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

export default function ActivityFeed() {
  const memories = useDashboardStore((s) => s.memories)

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
