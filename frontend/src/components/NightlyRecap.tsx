import { useState, useEffect } from 'react'

interface NightlyStatus {
  last_run: string | null
  rotation: string | null
  branch: string | null
  pr_url: string | null
  log_tail: string | null
}

const ROTATION_COLOR: Record<string, string> = {
  features: '#8b5cf6',
  tests:    '#06b6d4',
  refactor: '#f59e0b',
}

export default function NightlyRecap() {
  const [status, setStatus] = useState<NightlyStatus | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/nightly/status')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => {})
  }, [])

  if (!status) return null

  const accent = status.rotation ? (ROTATION_COLOR[status.rotation] ?? '#475569') : '#475569'

  return (
    <div style={{
      background: '#0d0d14',
      border: `1px solid ${accent}33`,
      borderRadius: 5,
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 8, color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Last Nightly Build
        </span>
        {status.log_tail && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{ fontSize: 8, background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: 0 }}
          >
            {expanded ? 'hide' : 'log'}
          </button>
        )}
      </div>

      {!status.last_run ? (
        <p style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>No builds yet — first run tonight</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 8, padding: '1px 6px', borderRadius: 3,
              background: `${accent}22`, color: accent, border: `1px solid ${accent}44`,
              fontFamily: 'monospace', letterSpacing: '0.06em',
            }}>
              {status.rotation}
            </span>
            <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>{status.last_run}</span>
          </div>

          {status.branch && (
            <span style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {status.branch}
            </span>
          )}

          {status.pr_url && (
            <a
              href={status.pr_url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 8, color: '#06b6d4', fontFamily: 'monospace',
                textDecoration: 'none', wordBreak: 'break-all',
              }}
            >
              View PR →
            </a>
          )}

          {expanded && status.log_tail && (
            <pre style={{
              fontSize: 7, color: '#475569', fontFamily: 'monospace',
              background: '#080810', borderRadius: 3, padding: '6px 8px',
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0, maxHeight: 160, overflowY: 'auto',
            }}>
              {status.log_tail}
            </pre>
          )}
        </>
      )}
    </div>
  )
}
