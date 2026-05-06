import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileEntry } from '@/lib/types'

interface FileTreeProps {
  entries: FileEntry[]
  selectedPath?: string
  onSelect: (path: string) => void
  depth?: number
  prefix?: string
}

export function FileTree({ entries, selectedPath, onSelect, depth = 0, prefix = '' }: FileTreeProps) {
  return (
    <div className={cn(depth > 0 && 'ml-2.5 border-l border-zinc-900 pl-0.5')}>
      {entries.map((entry) => (
        <FileTreeEntry
          key={entry.name}
          entry={entry}
          path={prefix ? `${prefix}/${entry.name}` : entry.name}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </div>
  )
}

function FileTreeEntry({
  entry, path, selectedPath, onSelect, depth,
}: {
  entry: FileEntry; path: string; selectedPath?: string; onSelect: (path: string) => void; depth: number
}) {
  const [open, setOpen] = useState(depth < 1)

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
        >
          {open
            ? <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-700" />
            : <ChevronRight className="h-2.5 w-2.5 shrink-0 text-zinc-700" />}
          <span className="truncate font-code">{entry.name}</span>
        </button>
        {open && entry.children && (
          <FileTree
            entries={entry.children}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={depth + 1}
            prefix={path}
          />
        )}
      </div>
    )
  }

  const isSelected = selectedPath === path

  return (
    <button
      onClick={() => onSelect(path)}
      className={cn(
        'flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors font-code',
        isSelected
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300',
      )}
    >
      <span className="w-2 shrink-0 text-center text-zinc-700">·</span>
      <span className="truncate">{entry.name}</span>
    </button>
  )
}
