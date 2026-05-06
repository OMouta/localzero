import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentEvent, ChatMessage } from '@/lib/types'

export type WSStatus = 'connecting' | 'open' | 'closed' | 'error'

interface UseWebSocketOptions {
  /** pass projectId for existing projects, 'new' for new project creation */
  projectId: string
  onFileTreeRefresh?: () => void
}

export function useWebSocket({ projectId, onFileTreeRefresh }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<WSStatus>('closed')

  function buildUrl() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // In dev Vite runs on :5173 but shares its own WS for HMR, which
    // conflicts with proxying. Connect directly to the API server port.
    const apiHost = import.meta.env.DEV
      ? `${window.location.hostname}:3001`
      : window.location.host
    return projectId === 'new'
      ? `${proto}://${apiHost}/ws/new`
      : `${proto}://${apiHost}/ws/projects/${projectId}`
  }

  function connect(): WebSocket {
    const ws = new WebSocket(buildUrl())
    wsRef.current = ws
    ws.onopen = () => setStatus('open')
    ws.onclose = () => setStatus('closed')
    ws.onerror = () => setStatus('error')
    return ws
  }

  useEffect(() => {
    const ws = connect()
    return () => ws.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const sendChat = useCallback(
    (
      content: string,
      model: string,
      history: ChatMessage[],
      onEvent: (event: AgentEvent) => void,
      stack?: string,
    ) => {
      let ws = wsRef.current
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        ws = connect()
      }

      const handler = (raw: MessageEvent<string>) => {
        const event = JSON.parse(raw.data) as AgentEvent
        if (event.type === 'file_tree_refresh') {
          onFileTreeRefresh?.()
          return
        }
        onEvent(event)
        if (event.type === 'message_done' || event.type === 'error') {
          ws!.removeEventListener('message', handler)
        }
      }

      const ollamaHistory = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content ?? '' }))

      const payload = JSON.stringify({ type: 'chat', content, model, history: ollamaHistory, stack })

      if (ws.readyState === WebSocket.OPEN) {
        ws.addEventListener('message', handler)
        ws.send(payload)
      } else {
        ws.addEventListener('open', () => {
          ws!.addEventListener('message', handler)
          ws!.send(payload)
        }, { once: true })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, onFileTreeRefresh],
  )

  const sendToolApproval = useCallback((id: string, approved: boolean) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'tool_approval', id, approved }))
  }, [])

  return { status, sendChat, sendToolApproval }
}
