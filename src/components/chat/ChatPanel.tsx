import { useEffect, useRef, useState } from 'react'
import { Send, StopCircle } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MessageList } from './MessageList'
import { useChatMessages } from '@/hooks/useChatMessages'
import type { ChatMessage } from '@/lib/types'

interface Props {
  projectId: string
  model: string
  models: string[]
  onModelChange: (model: string) => void
  onFileTreeRefresh?: () => void
  autoSend?: { content: string; stack?: string }
  onProjectCreated?: (id: string, name: string) => void
  onStreamEnd?: () => void
  initialMessages?: ChatMessage[]
}

export function ChatPanel({
  projectId,
  model,
  models,
  onModelChange,
  onFileTreeRefresh,
  autoSend,
  onProjectCreated,
  onStreamEnd,
  initialMessages,
}: Props) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoSentRef = useRef(false)

  const { messages, setMessages, isStreaming, status, send, approveTool, rejectTool } =
    useChatMessages({ projectId, onFileTreeRefresh, onProjectCreated, onStreamEnd })

  // Load chat history
  useEffect(() => {
    if (autoSend) return
    fetch(`/api/projects/${projectId}/files/chat`)
      .then((r) => r.json())
      .then((history: ChatMessage[]) => {
        if (Array.isArray(history) && history.length > 0) setMessages(() => history)
      })
      .catch(() => {})
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seed from creation flow
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) setMessages(() => initialMessages)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send for creation flow — fires when WS opens OR when autoSend becomes defined
  useEffect(() => {
    if (!autoSend || autoSentRef.current || status !== 'open') return
    autoSentRef.current = true
    send(autoSend.content, model, autoSend.stack)
  }, [status, !!autoSend]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function handleSend() {
    const content = input.trim()
    if (!content || isStreaming) return
    setInput('')
    send(content, model)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Messages — native scroll, no Radix wrapper */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-4 p-4">
          {messages.length === 0 && !isStreaming && (
            <div className="py-12 text-center">
              <p className="text-xs text-zinc-700">
                Describe what you want to add or change
              </p>
            </div>
          )}
          <MessageList
            messages={messages}
            onApproveTool={approveTool}
            onRejectTool={rejectTool}
          />
        </div>
      </div>

      {/* Input */}
      {!autoSend && (
        <div className="shrink-0 border-t border-zinc-900 p-3 space-y-2">
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger className="h-7 w-full border-zinc-800/60 bg-transparent text-xs text-zinc-600 hover:border-zinc-800 hover:text-zinc-400 focus:border-zinc-700 [&>svg]:text-zinc-700">
              <span className="font-code"><SelectValue placeholder="Select model" /></span>
            </SelectTrigger>
            <SelectContent>
              {models.length === 0
                ? <SelectItem value="llama3.1">llama3.1</SelectItem>
                : models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What should I change?"
              rows={3}
              disabled={isStreaming}
              className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 pr-10 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 transition-colors focus:border-zinc-700 disabled:opacity-50"
              style={{ caretColor: '#f4f4f5' }}
            />
            <div className="absolute bottom-2 right-2">
              {isStreaming ? (
                <button className="flex h-6 w-6 items-center justify-center rounded text-red-500 transition-colors hover:bg-red-500/10">
                  <StopCircle className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex h-6 w-6 items-center justify-center rounded bg-zinc-100 text-zinc-950 transition-all hover:bg-white disabled:opacity-30"
                >
                  <Send className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <p className="font-code text-[10px] text-zinc-800">↵ send · ⇧↵ newline</p>
        </div>
      )}
    </div>
  )
}
