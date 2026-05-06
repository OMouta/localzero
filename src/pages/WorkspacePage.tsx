import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Code2, Eye, Loader2, PanelLeft, FolderOpen, Sparkles, CheckCircle2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTree } from '@/components/filetree/FileTree'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { PreviewFrame } from '@/components/preview/PreviewFrame'
import { useProject, useModels, useFileTree, useFileContent } from '@/hooks/useProject'
import { Button } from '@/components/ui/button'
import { TEMPLATES } from '@/lib/types'
import { cn } from '@/lib/utils'

type RightTab = 'code' | 'preview'

const CHAT_MIN = 260
const CHAT_MAX = 640
const CHAT_DEFAULT = 380

const stackPickRequests = new Map<string, Promise<string>>()

function determineStackOnce(prompt: string, model: string): Promise<string> {
  const key = `${model}:${prompt}`
  const hit = stackPickRequests.get(key)
  if (hit) return hit

  const apiHost = import.meta.env.DEV ? `${window.location.hostname}:3001` : ''
  const req = fetch(`${apiHost ? `http://${apiHost}` : ''}/api/determine-stack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model }),
  })
    .then((r) => r.json())
    .then((d: { template: string }) => d.template)
    .catch(() => 'vite-react')
    .finally(() => stackPickRequests.delete(key))

  stackPickRequests.set(key, req)
  return req
}

export function WorkspacePage() {
  const { id } = useParams({ from: '/project/$id' })
  const navigate = useNavigate()
  const isNew = id === 'new'

  const search = useSearch({ from: '/project/$id' })
  const initPrompt = search.prompt ?? ''
  const initStack = search.stack ?? 'vite-react'

  const { data: existingProject, isLoading } = useProject(isNew ? '' : id)
  const { data: models = [] } = useModels()

  const [model, setModel] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('code')
  const [filesPanelOpen, setFilesPanelOpen] = useState(true)
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT)

  // New-project creation state
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const [createdProjectName, setCreatedProjectName] = useState<string | null>(null)
  const [buildDone, setBuildDone] = useState(false)

  // Stack resolution for AI-pick mode
  const [resolvedStack, setResolvedStack] = useState<string | null>(
    isNew && initStack !== 'ai' ? initStack : null,
  )
  const [pickingStack, setPickingStack] = useState(isNew && initStack === 'ai')

  const activeModel = model || search.model || models[0] || 'llama3.1'

  const effectiveId = isNew ? (createdProjectId ?? '') : id
  const { data: fileTree = [] } = useFileTree(effectiveId, refreshKey)
  const { data: fileContent } = useFileContent(effectiveId, selectedFile)
  const handleFileTreeRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Resolve stack when AI-pick mode
  useEffect(() => {
    if (!isNew || initStack !== 'ai') return
    let cancelled = false
    determineStackOnce(initPrompt, activeModel).then((template) => {
      if (cancelled) return
      setResolvedStack(template)
      setPickingStack(false)
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleProjectCreated(pid: string, name: string) {
    setCreatedProjectId(pid)
    setCreatedProjectName(name)
    window.history.replaceState(window.history.state, '', `/project/${pid}`)
  }

  useEffect(() => {
    if (!isNew || !buildDone || !createdProjectId) return
    navigate({ to: '/project/$id', params: { id: createdProjectId }, replace: true })
  }, [isNew, buildDone, createdProjectId, navigate])

  const resizeRef = useRef<{ startX: number; startW: number } | null>(null)

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    resizeRef.current = { startX: e.clientX, startW: chatWidth }
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const delta = ev.clientX - resizeRef.current.startX
      setChatWidth(Math.max(CHAT_MIN, Math.min(CHAT_MAX, resizeRef.current.startW + delta)))
    }
    function onUp() {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!isNew && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-700" />
      </div>
    )
  }

  if (!isNew && !existingProject) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-950">
        <p className="text-sm text-zinc-500">Project not found</p>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: '/' })}>
          Go home
        </Button>
      </div>
    )
  }

  const displayName = isNew
    ? (createdProjectName ?? 'New project')
    : (existingProject?.name ?? '')

  const displayTemplate = isNew
    ? (resolvedStack ? (TEMPLATES.find((t) => t.id === resolvedStack)?.label ?? resolvedStack) : null)
    : (existingProject?.template ?? '')

  const chatProjectId = isNew ? 'new' : id
  const autoSend = isNew && !pickingStack && resolvedStack
    ? { content: initPrompt, stack: resolvedStack }
    : undefined

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex h-10 shrink-0 items-center border-b border-zinc-900">
        <button
          onClick={() => navigate({ to: '/' })}
          className="flex h-10 w-10 shrink-0 items-center justify-center border-r border-zinc-900 text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>

        <div className="flex flex-1 items-center gap-2.5 px-4 min-w-0">
          <span className={cn(
            'truncate text-sm font-medium',
            isNew && !createdProjectName ? 'text-zinc-500' : 'text-zinc-200',
          )}>
            {displayName}
          </span>

          {displayTemplate && (
            <span className="font-code shrink-0 rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 text-[10px] text-zinc-600">
              {displayTemplate}
            </span>
          )}

          {isNew && (
            <div className="flex items-center gap-2 ml-1 text-xs">
              {pickingStack && (
                <>
                  <Sparkles className="h-3 w-3 animate-pulse text-violet-400" />
                  <span className="font-code text-zinc-600">Picking stack…</span>
                </>
              )}
              {!pickingStack && !buildDone && resolvedStack && !createdProjectName && (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                  <span className="font-code text-zinc-600">Ready…</span>
                </>
              )}
              {!pickingStack && !buildDone && createdProjectName && (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                  <span className="font-code text-zinc-600">Building…</span>
                </>
              )}
              {buildDone && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span className="font-code text-emerald-400">Done</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex h-10 shrink-0 items-center gap-0.5 border-l border-zinc-900 px-1.5">
          {(['code', 'preview'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                rightTab === tab ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
              )}
            >
              {tab === 'code' ? <Code2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              <span className="capitalize">{tab}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel — resizable */}
        <div
          className="flex shrink-0 flex-col overflow-hidden"
          style={{ width: chatWidth }}
        >
          <ChatPanel
            projectId={chatProjectId}
            model={activeModel}
            models={models}
            onModelChange={setModel}
            onFileTreeRefresh={handleFileTreeRefresh}
            autoSend={autoSend}
            onProjectCreated={isNew ? handleProjectCreated : undefined}
            onStreamEnd={isNew ? () => setBuildDone(true) : undefined}
          />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="group relative flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-zinc-900 transition-colors hover:bg-zinc-700 active:bg-zinc-600"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Right — code (files + editor) or preview */}
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {rightTab === 'preview' ? (
            effectiveId ? (
              <PreviewFrame projectId={effectiveId} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="font-code text-xs text-zinc-700">Preview available after build</p>
              </div>
            )
          ) : (
            <>
              {/* Files sidebar */}
              {filesPanelOpen && (
                <div className="flex w-44 shrink-0 flex-col border-r border-zinc-900 overflow-hidden">
                  <div className="flex h-8 shrink-0 items-center justify-between border-b border-zinc-900 px-2.5">
                    <span className="font-code text-[11px] text-zinc-600">Files</span>
                    <button
                      onClick={() => setFilesPanelOpen(false)}
                      className="text-zinc-700 transition-colors hover:text-zinc-500"
                    >
                      <PanelLeft className="h-3 w-3" />
                    </button>
                  </div>
                  <ScrollArea className="flex-1">
                    {fileTree.length === 0 ? (
                      <div className="flex h-20 items-center justify-center">
                        <p className="font-code text-[11px] text-zinc-800">
                          {isNew ? 'Building…' : 'No files yet'}
                        </p>
                      </div>
                    ) : (
                      <div className="px-1 py-1.5">
                        <FileTree
                          entries={fileTree}
                          selectedPath={selectedFile ?? undefined}
                          onSelect={(p) => setSelectedFile(p)}
                        />
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}

              {/* Editor */}
              <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
                <div className="flex h-8 shrink-0 items-center gap-2 border-b border-zinc-900 px-2">
                  {!filesPanelOpen && (
                    <button
                      onClick={() => setFilesPanelOpen(true)}
                      className="flex h-5 w-5 items-center justify-center rounded text-zinc-700 transition-colors hover:bg-zinc-900 hover:text-zinc-500"
                    >
                      <PanelLeft className="h-3 w-3" />
                    </button>
                  )}
                  {selectedFile && (
                    <span className="font-code truncate text-[11px] text-zinc-600">{selectedFile}</span>
                  )}
                </div>

                <div className="flex-1 overflow-hidden">
                  {selectedFile && fileContent ? (
                    <CodeEditor filePath={selectedFile} content={fileContent.content} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                      {isNew && !createdProjectId ? (
                        <>
                          <div className="flex gap-1">
                            <span className="anim-thinking-1 h-1.5 w-1.5 rounded-full bg-zinc-700" />
                            <span className="anim-thinking-2 h-1.5 w-1.5 rounded-full bg-zinc-700" />
                            <span className="anim-thinking-3 h-1.5 w-1.5 rounded-full bg-zinc-700" />
                          </div>
                          <p className="font-code text-xs text-zinc-700">Building…</p>
                          <p className="font-code text-[11px] text-zinc-800">
                            Files appear as they are created
                          </p>
                        </>
                      ) : (
                        <>
                          <FolderOpen className="h-7 w-7 text-zinc-800" />
                          <p className="font-code text-xs text-zinc-700">
                            {fileTree.length === 0 ? 'No files yet' : 'Select a file to view'}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
