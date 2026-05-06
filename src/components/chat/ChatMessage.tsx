import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage as ChatMessageType } from '@/lib/types'

interface Props { message: ChatMessageType }

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'
  const content = message.content ?? ''

  if (isUser) {
    return (
      <div className="flex justify-end anim-slide-left">
        <div className="max-w-[85%] rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-200">
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="anim-slide-right max-w-[92%] text-sm leading-relaxed text-zinc-300">
      <MessageContent content={content} streaming={message.streaming} />
    </div>
  )
}

// Exported so MessageList can render it above tool calls in the correct order
export function ThinkingBlock({ content, streaming }: { content: string | null; streaming?: boolean }) {
  const [open, setOpen] = useState(false)
  const text = content ?? ''

  return (
    <div className="w-full overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-zinc-900/60"
      >
        {open
          ? <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-700" />
          : <ChevronRight className="h-2.5 w-2.5 shrink-0 text-zinc-700" />}
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">
          {streaming ? 'Reasoning…' : 'Reasoning'}
        </span>
        {streaming && (
          <span className="ml-1 flex items-center gap-0.5">
            <span className="anim-thinking-1 h-1 w-1 rounded-full bg-zinc-700" />
            <span className="anim-thinking-2 h-1 w-1 rounded-full bg-zinc-700" />
            <span className="anim-thinking-3 h-1 w-1 rounded-full bg-zinc-700" />
          </span>
        )}
        {!streaming && text.length > 0 && (
          <span className="ml-auto text-[10px] text-zinc-800">
            {text.split(/\s+/).filter(Boolean).length} words
          </span>
        )}
      </button>

      {open && (
        <div className="max-h-48 overflow-y-auto border-t border-zinc-800/60 px-3 py-2.5">
          <p className="font-sans whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-600">
            {text}
            {streaming && (
              <span className="anim-cursor ml-0.5 inline-block h-3 w-0.5 align-middle bg-zinc-700" />
            )}
          </p>
        </div>
      )}
    </div>
  )
}

function MessageContent({ content, streaming }: { content: string; streaming?: boolean }) {
  if (streaming && !content) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <span className="anim-thinking-1 h-1 w-1 rounded-full bg-zinc-500" />
        <span className="anim-thinking-2 h-1 w-1 rounded-full bg-zinc-500" />
        <span className="anim-thinking-3 h-1 w-1 rounded-full bg-zinc-500" />
      </div>
    )
  }

  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).split('\n')
          const lang = lines[0].trim()
          const code = lines.slice(1).join('\n')
          return (
            <pre
              key={i}
              className={cn(
                'font-code my-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3.5 text-[11.5px] leading-relaxed text-zinc-300',
              )}
            >
              {lang && (
                <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-600">{lang}</div>
              )}
              <code>{code}</code>
            </pre>
          )
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>
      })}
      {streaming && content && (
        <span className="anim-cursor ml-0.5 inline-block h-3.5 w-0.5 align-middle bg-zinc-400" />
      )}
    </>
  )
}
