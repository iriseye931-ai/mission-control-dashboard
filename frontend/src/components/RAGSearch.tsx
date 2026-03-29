import { useState, useRef, useEffect, FormEvent, DragEvent } from 'react'

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
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const dragCountRef = useRef(0)

  useEffect(() => {
    fetchStatus()
    return () => { abortRef.current?.abort() }
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

  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

  function uploadFileXHR(file: File): Promise<{ ok: boolean; detail?: string }> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      const form = new FormData()
      form.append('file', file, file.name)
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })
      xhr.addEventListener('load', () => {
        setUploadProgress(null)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ ok: true })
        } else {
          try { resolve({ ok: false, detail: JSON.parse(xhr.responseText).detail }) }
          catch { resolve({ ok: false, detail: `HTTP ${xhr.status}` }) }
        }
      })
      xhr.addEventListener('error', () => { setUploadProgress(null); resolve({ ok: false }) })
      xhr.open('POST', '/api/rag/upload')
      xhr.send(form)
    })
  }

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploading(true)
    setUploadMsg(null)
    let ok = 0
    let fail = 0
    for (const file of arr) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadMsg(`${file.name} is too large (max 50MB)`)
        fail++
        continue
      }
      const result = await uploadFileXHR(file)
      if (result.ok) {
        ok++
      } else {
        setUploadMsg(result.detail || 'Upload failed')
        fail++
      }
    }
    setUploadProgress(null)
    setUploadMsg(
      fail === 0
        ? `Uploaded ${ok} file${ok !== 1 ? 's' : ''} — click reindex to search`
        : `${ok} uploaded, ${fail} failed`
    )
    setUploading(false)
    await fetchStatus()
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    dragCountRef.current++
    setDragging(true)
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    dragCountRef.current--
    if (dragCountRef.current === 0) setDragging(false)
  }

  function onDragOver(e: DragEvent) { e.preventDefault() }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    dragCountRef.current = 0
    setDragging(false)
    if (e.dataTransfer.files.length > 0) await uploadFiles(e.dataTransfer.files)
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
      className="rounded-lg flex flex-col h-full relative"
      style={{ background: '#111118', border: `1px solid ${dragging ? '#8b5cf6' : '#1e1e2e'}`, transition: 'border-color 0.15s' }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div
          className="absolute inset-0 rounded-lg flex items-center justify-center z-10 pointer-events-none"
          style={{ background: '#8b5cf611', border: '2px dashed #8b5cf6' }}
        >
          <span className="text-sm font-medium" style={{ color: '#8b5cf6' }}>
            Drop files to add to inbox
          </span>
        </div>
      )}
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

      {/* Upload status */}
      {(uploading || uploadMsg) && (
        <div
          className="px-4 py-2 text-xs"
          style={{
            borderBottom: '1px solid #1e1e2e',
            color: uploading ? '#8b5cf6' : uploadMsg?.includes('failed') ? '#ef4444' : '#22c55e',
            background: '#0d0d14',
          }}
        >
          {uploading ? (uploadProgress !== null ? `Uploading… ${uploadProgress}%` : 'Uploading…') : uploadMsg}
          {uploading && uploadProgress !== null && (
            <div style={{ marginTop: 4, height: 2, background: '#1e1e2e', borderRadius: 1 }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#8b5cf6', borderRadius: 1, transition: 'width 0.1s' }} />
            </div>
          )}
        </div>
      )}

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
            Drag files here or drop into ~/Documents/rag/inbox/ then search
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
