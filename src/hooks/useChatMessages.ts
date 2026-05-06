import { useRef, useState } from 'react'
import { useWebSocket } from './useWebSocket'
import type { ChatMessage, ToolCall, AgentEvent, MessagePart } from '@/lib/types'

interface Options {
  projectId: string
  onFileTreeRefresh?: () => void
  onProjectCreated?: (id: string, name: string) => void
  onStreamEnd?: () => void
}

export function useChatMessages({ projectId, onFileTreeRefresh, onProjectCreated, onStreamEnd }: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const pendingRef = useRef<Record<string, ToolCall>>({})
  const historyRef = useRef<ChatMessage[]>([])
  const projectIdRef = useRef(projectId)

  const { status, sendChat, sendToolApproval } = useWebSocket({ projectId, onFileTreeRefresh })

  function mutate(updater: (prev: ChatMessage[]) => ChatMessage[]) {
    setMessages((prev) => {
      const next = updater(prev)
      historyRef.current = next
      return next
    })
  }

  function makeEventHandler() {
    return (event: AgentEvent) => {
      if (event.type === 'project_created') {
        projectIdRef.current = event.id
        onProjectCreated?.(event.id, event.name)
        return
      }

      if (event.type === 'message_done') {
        mutate((prev) => {
          const msgs = [...prev]
          const last = msgs[msgs.length - 1]
          if (!last || last.role !== 'assistant') return msgs
          msgs[msgs.length - 1] = { ...last, content: event.content, streaming: false }
          const pid = projectIdRef.current
          if (pid && pid !== 'new') {
            fetch(`/api/projects/${pid}/files/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(msgs.filter((m) => !m.streaming)),
            }).catch(() => {})
          }
          return msgs
        })
        setIsStreaming(false)
        pendingRef.current = {}
        onStreamEnd?.()
        return
      }

      if (event.type === 'error') {
        mutate((prev) => [...prev, { role: 'assistant', content: `Error: ${event.message}` }])
        setIsStreaming(false)
        pendingRef.current = {}
        onStreamEnd?.()
        return
      }

      mutate((prev) => {
        const msgs = [...prev]
        const last = msgs[msgs.length - 1]
        if (!last || last.role !== 'assistant') return msgs

        const parts: MessagePart[] = [...(last.parts ?? [])]

        switch (event.type) {
          case 'token': {
            const lp = parts[parts.length - 1]
            if (lp?.type === 'text') {
              parts[parts.length - 1] = { type: 'text', content: lp.content + event.delta }
            } else {
              parts.push({ type: 'text', content: event.delta })
            }
            msgs[msgs.length - 1] = { ...last, parts, content: (last.content ?? '') + event.delta }
            break
          }
          case 'thinking': {
            const lp = parts[parts.length - 1]
            if (lp?.type === 'thinking') {
              parts[parts.length - 1] = { type: 'thinking', content: lp.content + event.delta }
            } else {
              parts.push({ type: 'thinking', content: event.delta })
            }
            msgs[msgs.length - 1] = { ...last, parts }
            break
          }
          case 'tool_start': {
            const tc: ToolCall = { id: event.id, name: event.name, input: event.input }
            pendingRef.current[event.id] = tc
            parts.push({ type: 'tool', tool: tc })
            msgs[msgs.length - 1] = { ...last, parts }
            break
          }
          case 'tool_end': {
            const prev_tc = pendingRef.current[event.id] ?? { id: event.id, name: '', input: {} }
            const updated: ToolCall = {
              ...prev_tc,
              output: event.output,
              isError: event.isError,
              approval: prev_tc.approval
                ? { ...prev_tc.approval, status: event.isError ? prev_tc.approval.status : 'approved' }
                : undefined,
            }
            delete pendingRef.current[event.id]
            msgs[msgs.length - 1] = {
              ...last,
              parts: parts.map((p) =>
                p.type === 'tool' && p.tool.id === event.id ? { type: 'tool' as const, tool: updated } : p
              ),
            }
            break
          }
          case 'tool_approval_required': {
            const cur = pendingRef.current[event.id] ?? { id: event.id, name: event.name, input: event.input }
            const updated: ToolCall = {
              ...cur,
              approval: { status: 'pending', reason: event.reason, risk: event.risk },
            }
            pendingRef.current[event.id] = updated
            const exists = parts.some((p) => p.type === 'tool' && p.tool.id === event.id)
            msgs[msgs.length - 1] = {
              ...last,
              parts: exists
                ? parts.map((p) =>
                    p.type === 'tool' && p.tool.id === event.id
                      ? { type: 'tool' as const, tool: updated }
                      : p
                  )
                : [...parts, { type: 'tool' as const, tool: updated }],
            }
            break
          }
        }
        return msgs
      })
    }
  }

  function send(content: string, model: string, stack?: string) {
    const trimmed = content.trim()
    if (!trimmed || isStreaming) return
    pendingRef.current = {}

    const history = historyRef.current
    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', parts: [], streaming: true }
    mutate((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    sendChat(trimmed, model, [...history, userMsg], makeEventHandler(), stack)
  }

  function approveTool(id: string) {
    sendToolApproval(id, true)
    mutate((prev) =>
      prev.map((msg) => ({
        ...msg,
        parts: msg.parts?.map((part) =>
          part.type === 'tool' && part.tool.id === id && part.tool.approval
            ? { type: 'tool' as const, tool: { ...part.tool, approval: { ...part.tool.approval, status: 'approved' as const } } }
            : part,
        ),
      }))
    )
  }

  function rejectTool(id: string) {
    sendToolApproval(id, false)
    mutate((prev) =>
      prev.map((msg) => ({
        ...msg,
        parts: msg.parts?.map((part) =>
          part.type === 'tool' && part.tool.id === id && part.tool.approval
            ? { type: 'tool' as const, tool: { ...part.tool, approval: { ...part.tool.approval, status: 'rejected' as const } } }
            : part,
        ),
      }))
    )
  }

  return { messages, setMessages: mutate, isStreaming, status, send, approveTool, rejectTool }
}
