import { useDashboardStore } from '../store/dashboardStore'
import { TrendingRepo } from '../types'

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  'C++': '#f34b7d',
  C: '#555555',
  Java: '#b07219',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Ruby: '#701516',
  'C#': '#178600',
  Zig: '#ec915c',
  Nix: '#7e7eff',
}

function StarIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'inline', marginRight: 2 }}>
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.873 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  )
}

function RepoRow({ repo, rank }: { repo: TrendingRepo; rank: number }) {
  const langColor = repo.language ? (LANG_COLORS[repo.language] ?? '#64748b') : null

  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div
        className="flex flex-col gap-1 px-2 py-2 rounded"
        style={{
          borderBottom: rank < 5 ? '1px solid #1e1e2e' : 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#12121a')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Rank + name */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span style={{ color: '#334155', fontSize: 10, fontWeight: 700, minWidth: 14 }}>{rank}</span>
          <span
            className="truncate text-xs font-semibold"
            style={{ color: '#94a3b8' }}
            title={repo.name}
          >
            {repo.name}
          </span>
        </div>

        {/* Description */}
        {repo.description && (
          <p
            className="text-xs truncate"
            style={{ color: '#475569', paddingLeft: 20, lineHeight: '1.3' }}
            title={repo.description}
          >
            {repo.description}
          </p>
        )}

        {/* Meta: stars + language + topics */}
        <div className="flex items-center gap-2" style={{ paddingLeft: 20 }}>
          <span className="flex items-center text-xs" style={{ color: '#f59e0b' }}>
            <StarIcon />
            {repo.stars.toLocaleString()}
          </span>
          {langColor && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#64748b' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: langColor,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {repo.language}
            </span>
          )}
          {repo.topics.slice(0, 2).map((t) => (
            <span
              key={t}
              className="text-xs px-1 rounded"
              style={{ background: '#1e293b', color: '#64748b', fontSize: 9 }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </a>
  )
}

export default function TrendingRepos() {
  const repos = useDashboardStore((s) => s.trendingRepos)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>
          Trending
        </p>
        <span className="text-xs" style={{ color: '#1e293b' }}>
          7d · stars
        </span>
      </div>

      {repos.length === 0 ? (
        <p className="text-xs" style={{ color: '#334155' }}>
          loading…
        </p>
      ) : (
        <div className="flex flex-col">
          {repos.map((repo, i) => (
            <RepoRow key={repo.id} repo={repo} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
