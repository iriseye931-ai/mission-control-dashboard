import { useState, useRef, useEffect, FormEvent } from 'react'

interface SearchResult {
  uri: string
  score: number
  abstract: string
  context_type: string
}

function uriLabel(uri: string): string {
  // viking://resources/rag-inbox/some-file.pdf → some-file.pdf
  const parts = uri.split('/')
  const last = parts[parts.length - 1].split('#')[0]
  return last || uri
}

export default function RAGSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inboxCount, setInboxCount] = useState<number | null>(null)
  const [inboxFiles, setInboxFiles] = useState<string[]>([])
  const [showFiles, setShowFiles] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/rag/status')
      if (res.ok) {
        const data = await res.json()
        setInboxCount(data.inbox_count ?? 0)
        setInboxFiles(data.inbox_files ?? [])
      }
    } catch { /* ignore */ }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q || loading) return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    setResults([])

    try {
      const res = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: 8 }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResults(data.results ?? [])
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Search failed')
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  async function handleReindex() {
    setIngesting(true)
    try {
      const res = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        await fetchStatus()
      }
    } catch { /* ignore */ } finally {
      setIngesting(false)
    }
  }

  return (
    <div
      className="rounded-lg flex flex-col h-full"
      style={{ background: '#111118', border: '1px solid #1e1e2e' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid #1e1e2e' }}
      >
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ background: '#8b5cf6', boxShadow: '0 0 6px #8b5cf6' }}
        />
        <span className="text-sm font-semibold" style={{ color: '#8b5cf6' }}>RAG Search</span>
        <span className="text-xs" style={{ color: '#475569' }}>Document Knowledge</span>
        <div className="ml-auto flex items-center gap-2">
          {inboxCount !== null && (
            <button
              onClick={() => setShowFiles((v) => !v)}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}
            >
              {inboxCount} file{inboxCount !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={handleReindex}
            disabled={ingesting}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: '#8b5cf622',
              color: '#8b5cf6',
              border: '1px solid #8b5cf633',
              opacity: ingesting ? 0.5 : 1,
              cursor: ingesting ? 'not-allowed' : 'pointer',
            }}
          >
            {ingesting ? 'indexing…' : 'reindex'}
          </button>
        </div>
      </div>

      {/* Inbox file list (collapsible) */}
      {showFiles && inboxFiles.length > 0 && (
        <div
          className="px-4 py-2 flex flex-col gap-1"
          style={{ borderBottom: '1px solid #1e1e2e', background: '#0d0d14' }}
        >
          <p className="text-xs" style={{ color: '#475569' }}>
            Inbox: ~/Documents/rag/inbox/
          </p>
          {inboxFiles.map((f) => (
            <span key={f} className="text-xs" style={{ color: '#64748b' }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ minHeight: 0 }}>
        {results.length === 0 && !loading && !error && (
          <p className="text-xs text-center my-auto" style={{ color: '#475569' }}>
            Drop files into ~/Documents/rag/inbox/ then search
          </p>
        )}

        {loading && (
          <p className="text-xs text-center my-auto" style={{ color: '#8b5cf6' }}>
            searching…
          </p>
        )}

        {error && (
          <div
            className="text-xs px-3 py-2 rounded"
            style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444433' }}
          >
            {error}
          </div>
        )}

        {results.map((r, i) => (
          <div
            key={i}
            className="px-3 py-2 rounded flex flex-col gap-1"
            style={{ background: '#0d0d14', border: '1px solid #1e1e2e' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium truncate" style={{ color: '#c4b5fd' }}>
                {uriLabel(r.uri)}
              </span>
              <span
                className="text-xs ml-auto shrink-0 px-1.5 py-0.5 rounded"
                style={{ background: '#1e293b', color: '#64748b' }}
              >
                {(r.score * 100).toFixed(0)}%
              </span>
            </div>
            {r.abstract && (
              <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                {r.abstract.length > 200 ? r.abstract.slice(0, 200) + '…' : r.abstract}
              </p>
            )}
            <span className="text-xs" style={{ color: '#334155' }}>
              {r.uri.split('#')[0]}
            </span>
          </div>
        ))}
      </div>

      {/* Search input */}
      <form
        onSubmit={handleSearch}
        className="px-4 py-3 flex gap-2"
        style={{ borderTop: '1px solid #1e1e2e' }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your documents…"
          disabled={loading}
          className="flex-1 text-sm px-3 py-2 rounded outline-none"
          style={{
            background: '#0a0a0f',
            border: '1px solid #1e1e2e',
            color: '#e2e8f0',
          }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-3 py-2 rounded text-sm font-medium"
          style={{
            background: '#8b5cf6',
            color: '#0a0a0f',
            opacity: loading || !query.trim() ? 0.4 : 1,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Search
        </button>
      </form>
    </div>
  )
}
