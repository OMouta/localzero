import { useState } from 'react'
import { RefreshCw, ExternalLink, Play, Square } from 'lucide-react'

interface Props {
  projectId: string
}

export function PreviewFrame({ projectId }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  async function startServer() {
    setLoading(true)
    try {
      const r = await fetch(`/api/projects/${projectId}/devserver/start`, { method: 'POST' })
      const data = await r.json() as { url?: string; error?: string }
      if (data.url) setUrl(data.url)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function stopServer() {
    await fetch(`/api/projects/${projectId}/devserver/stop`, { method: 'POST' })
    setUrl(null)
  }

  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="text-center space-y-1.5">
          <p className="text-sm font-medium text-zinc-400">No preview running</p>
          <p className="font-code text-xs text-zinc-600">Start the dev server to see your project</p>
        </div>
        <button
          onClick={startServer}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5" />
          {loading ? 'Starting…' : 'Start Dev Server'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Preview toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-900 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" style={{ boxShadow: '0 0 6px rgba(74,222,128,0.5)' }} />
          <span className="font-code truncate text-[11px] text-zinc-500">{url}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <a href={url} target="_blank" rel="noreferrer"
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-300">
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={stopServer}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-700 transition-colors hover:bg-red-500/10 hover:text-red-500"
          >
            <Square className="h-3 w-3" />
          </button>
        </div>
      </div>

      <iframe
        key={reloadKey}
        src={url}
        className="flex-1 w-full border-none bg-white"
        title="Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
      />
    </div>
  )
}
