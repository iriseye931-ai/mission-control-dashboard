import { useDashboardStore } from '../store/dashboardStore'
import { CronJob } from '../types'

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'overdue'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function getProgressFromSeconds(
  nextInSeconds: number | null | undefined,
  intervalSeconds: number | null | undefined,
): number {
  if (nextInSeconds == null) return 0
  if (nextInSeconds <= 0) return 100
  const total = intervalSeconds ?? 3600
  const elapsed = total - nextInSeconds
  return Math.max(0, Math.min(100, (elapsed / total) * 100))
}

const statusColors: Record<string, string> = {
  success: '#22c55e',
  ok: '#22c55e',
  failed: '#ef4444',
  error: '#ef4444',
  never: '#475569',
  running: '#eab308',
}

function CronJobRow({ job }: { job: CronJob }) {
  const progress = getProgressFromSeconds(job.next_run_in_seconds, job.interval_seconds)
  const countdown = job.next_run_in_seconds != null ? formatCountdown(job.next_run_in_seconds) : '—'
  const lastStatus = job.last_status ?? 'never'
  const badgeColor = statusColors[lastStatus] ?? '#475569'
  const isOverdue = (job.next_run_in_seconds ?? 1) <= 0

  return (
    <div className="flex flex-col gap-1.5 py-3" style={{ borderBottom: '1px solid #1e1e2e' }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: '#e2e8f0' }}>
          {job.name}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded font-mono"
          style={{ background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44` }}
        >
          {lastStatus}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: '#94a3b8' }}>
        <span>{job.schedule_display ?? '—'}</span>
        <span style={{ color: isOverdue ? '#ef4444' : '#94a3b8' }}>
          {countdown === 'overdue' ? 'overdue' : `next in ${countdown}`}
        </span>
      </div>

      {job.prompt_snippet && (
        <div
          className="text-xs font-mono truncate"
          style={{ color: '#475569' }}
          title={job.prompt_snippet}
        >
          {job.prompt_snippet}
        </div>
      )}

      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 4, background: '#1e1e2e' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: progress > 90 ? '#eab308' : '#06b6d4',
            transition: 'width 1s linear',
          }}
        />
      </div>
    </div>
  )
}

export default function CronProgress() {
  const cronJobs = useDashboardStore((s) => s.cronJobs)

  if (cronJobs.length === 0) {
    return (
      <div
        className="rounded-lg p-4"
        style={{ background: '#111118', border: '1px solid #1e1e2e' }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>
          Cron Jobs
        </h2>
        <p className="text-xs" style={{ color: '#475569' }}>
          No jobs — waiting for backend
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg px-4"
      style={{ background: '#111118', border: '1px solid #1e1e2e' }}
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest pt-4 pb-1" style={{ color: '#475569' }}>
        Cron Jobs
      </h2>
      {cronJobs.map((job) => (
        <CronJobRow key={job.id} job={job} />
      ))}
      <div style={{ height: 4 }} />
    </div>
  )
}
