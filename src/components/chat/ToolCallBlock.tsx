import { useState } from 'react'
import { Terminal, FileDiff, Eye, FilePen, Folder, Wrench, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolCall } from '@/lib/types'

type IconComponent = React.ComponentType<{ className?: string }>

const TOOL_META: Record<string, { Icon: IconComponent; label: string }> = {
  bash:           { Icon: Terminal, label: 'bash' },
  patch:          { Icon: FileDiff, label: 'patch' },
  read_file:      { Icon: Eye,      label: 'read_file' },
  write_file:     { Icon: FilePen,  label: 'write_file' },
  list_files:     { Icon: Folder,   label: 'list_files' },
  create_project: { Icon: Wrench,   label: 'create_project' },
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[-\s]+/g, '_')
}

function getToolMeta(name: string): { Icon: IconComponent; label: string } {
  return TOOL_META[name] ?? TOOL_META[normalizeName(name)] ?? { Icon: Wrench, label: name }
}

const RISK_STYLES = {
  low:    'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
  medium: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
  high:   'text-red-400 border-red-500/20 bg-red-500/5',
}

function getPreview(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const i = input as Record<string, string>
  if (name === 'bash') return i.command?.slice(0, 80) ?? ''
  if (name === 'patch' || name === 'read_file' || name === 'write_file') return i.path ?? ''
  if (name === 'list_files') return i.path ?? '.'
  if (name === 'create_project') return i.name ?? ''
  return ''
}

export function ToolCallBlock({
  tool,
  onApprove,
  onReject,
}: {
  tool: ToolCall
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { Icon, label } = getToolMeta(tool.name)
  const needsApproval = tool.approval?.status === 'pending'
  const pending = tool.output === undefined && !needsApproval
  const done = tool.output !== undefined
  const preview = getPreview(normalizeName(tool.name), tool.input)
  const riskStyle = RISK_STYLES[tool.approval?.risk ?? 'low']

  return (
    <div className="font-code my-0.5 text-[12px]">
      {/* Row */}
      <div
        onClick={() => done && setExpanded((o) => !o)}
        className={cn(
          'flex items-center gap-2 py-1 select-none',
          done ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        {/* Status */}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {pending && <Loader2 className="h-2.5 w-2.5 animate-spin text-zinc-600" />}
          {needsApproval && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
          {done && !tool.isError && <span className="text-[10px] text-zinc-700">✓</span>}
          {done && tool.isError && <span className="text-[10px] text-red-500">✗</span>}
        </span>

        {/* Icon + Label */}
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 font-medium',
            tool.isError ? 'text-red-400' : needsApproval ? 'text-amber-400' : 'text-zinc-300',
          )}
        >
          <Icon className="h-3 w-3 shrink-0" />
          {label}
        </span>

        {/* Preview */}
        {preview && (
          <span className="min-w-0 flex-1 truncate text-zinc-600">{preview}</span>
        )}

        {/* Expand indicator */}
        {done && (
          <span className="ml-auto shrink-0 text-[10px] text-zinc-800">
            {expanded ? '▲' : '▾'}
          </span>
        )}
      </div>

      {/* Approval panel */}
      {needsApproval && tool.approval && (
        <div className={cn('ml-6 mb-2 rounded-lg border p-2.5 space-y-2', riskStyle)}>
          <div className="space-y-1">
            <span className={cn('text-[10px] font-semibold uppercase tracking-widest', RISK_STYLES[tool.approval.risk].split(' ')[0])}>
              {tool.approval.risk} risk
            </span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">{tool.approval.reason}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApprove?.(tool.id)}
              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              Approve
            </button>
            <button
              onClick={() => onReject?.(tool.id)}
              className="rounded border border-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-400"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Expanded output */}
      {expanded && done && (
        <div className="ml-6 mb-1 rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-2.5 space-y-2.5">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-700">Input</div>
            <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap break-all text-[11px] text-zinc-600">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          {tool.output !== undefined && (
            <div>
              <div className={cn('mb-1 text-[10px] uppercase tracking-widest', tool.isError ? 'text-red-500/70' : 'text-zinc-700')}>
                Output
              </div>
              <pre className={cn('max-h-40 overflow-y-auto whitespace-pre-wrap break-all text-[11px]', tool.isError ? 'text-red-400' : 'text-zinc-600')}>
                {tool.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
