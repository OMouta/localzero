import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Trash2, Clock, Loader2, Sparkles } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { DotGrid } from '@/components/ui/DotGrid'
import { useProjects, useDeleteProject, useModels } from '@/hooks/useProject'
import { TEMPLATES } from '@/lib/types'
import { cn } from '@/lib/utils'

const QUICK_PROMPTS = [
  { label: 'Todo app', prompt: 'A todo app with drag-and-drop, local storage, and dark mode' },
  { label: 'Dashboard', prompt: 'An analytics dashboard with charts and a sidebar navigation' },
  { label: 'Blog', prompt: 'A personal blog with markdown posts, tags, and a clean layout' },
  { label: 'Landing page', prompt: 'A SaaS landing page with hero, features, pricing, and CTA sections' },
  { label: 'Chat UI', prompt: 'A messaging app UI with a sidebar of conversations and a chat window' },
]

export function HomePage() {
  const navigate = useNavigate()
  const { data: projects = [], isLoading } = useProjects()
  const { data: models = [] } = useModels()
  const deleteProject = useDeleteProject()

  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [stack, setStack] = useState('ai')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeModel = model || models[0] || 'llama3.1'

  function handleSubmit() {
    if (!prompt.trim()) return
    navigate({ to: '/project/$id', params: { id: 'new' }, search: { prompt: prompt.trim(), model: activeModel, stack } })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-900 px-5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold tracking-wide">LocalZero</span>
        </div>
        <span className="font-code text-[11px] text-zinc-600">
          {models.length > 0
            ? `${models.length} model${models.length !== 1 ? 's' : ''} available`
            : 'connecting to Ollama…'}
        </span>
      </header>

      {/* Hero */}
      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16">
        {/* Animated dot grid — canvas ripple */}
        <DotGrid
          className="pointer-events-none absolute inset-0"
          speed={0.7}
        />

        <div className="relative w-full max-w-[560px] space-y-8">
          {/* Headline */}
          <h1
            className="anim-fade-up font-display text-center text-[2.6rem] italic leading-none text-zinc-50"
            style={{ animationDelay: '60ms' }}
          >
            What should I build?
          </h1>

          {/* Prompt card */}
          <div className="anim-fade-up" style={{ animationDelay: '120ms' }}>
            <div
              className={cn(
                'overflow-hidden rounded-xl border bg-zinc-900 transition-all duration-200',
                focused
                  ? 'border-zinc-700 shadow-[0_0_0_4px_rgba(244,244,245,0.04)]'
                  : 'border-zinc-800',
              )}
            >
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="A todo app with drag-and-drop, local storage, and dark mode…"
                rows={3}
                className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
                style={{ caretColor: '#f4f4f5' }}
              />
              <div className="flex items-center justify-between border-t border-zinc-800/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Select value={activeModel} onValueChange={setModel}>
                    <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-none bg-transparent p-0 text-xs text-zinc-600 hover:border-none focus:border-none [&>svg]:h-3 [&>svg]:w-3">
                      <span className="font-code"><SelectValue /></span>
                    </SelectTrigger>
                    <SelectContent>
                      {models.length === 0
                        ? <SelectItem value="llama3.1">llama3.1</SelectItem>
                        : models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="h-3 w-px bg-zinc-800" />
                  <Select value={stack} onValueChange={setStack}>
                    <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-none bg-transparent p-0 text-xs text-zinc-600 hover:border-none focus:border-none [&>svg]:h-3 [&>svg]:w-3">
                      <span className="font-code flex items-center gap-1">
                        {stack === 'ai' && <Sparkles className="h-2.5 w-2.5" />}
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai">AI picks stack</SelectItem>
                      {TEMPLATES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!prompt.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-all hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Build <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick prompt chips */}
          <div
            className="anim-fade-up flex flex-wrap justify-center gap-2"
            style={{ animationDelay: '180ms' }}
          >
            {QUICK_PROMPTS.map(({ label, prompt: p }) => (
              <button
                key={label}
                onClick={() => { setPrompt(p); textareaRef.current?.focus() }}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500 transition-all hover:border-zinc-700 hover:text-zinc-300"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Recent projects */}
      {(isLoading || projects.length > 0) && (
        <section className="border-t border-zinc-900 px-5 py-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="font-code text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                Recent
              </span>
              <div className="h-px flex-1 bg-zinc-900" />
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {projects.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    template={p.template}
                    createdAt={p.createdAt}
                    index={i}
                    onDelete={() => deleteProject.mutate(p.id)}
                    onClick={() => navigate({ to: '/project/$id', params: { id: p.id } })}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function ProjectCard({
  name, template, createdAt, index, onClick, onDelete,
}: {
  id: string; name: string; template: string; createdAt: string; index: number
  onClick: () => void; onDelete: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="anim-fade-up group relative cursor-pointer rounded-lg border border-zinc-900 bg-zinc-900/40 p-3 transition-all hover:border-zinc-800 hover:bg-zinc-900"
      style={{ animationDelay: `${index * 35}ms` }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute right-2 top-2 rounded p-1 text-zinc-700 opacity-0 transition-all group-hover:opacity-100 hover:text-red-500"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      <p className="truncate text-sm font-medium text-zinc-200 pr-4">{name}</p>
      <p className="font-code mt-0.5 text-[11px] text-zinc-600">{template}</p>
      <div className="font-code mt-2.5 flex items-center gap-1 text-[10px] text-zinc-700">
        <Clock className="h-2.5 w-2.5" />
        {new Date(createdAt).toLocaleDateString()}
      </div>
    </div>
  )
}
