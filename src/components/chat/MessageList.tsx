import { ChatMessage, ThinkingBlock } from './ChatMessage'
import { ToolCallBlock } from './ToolCallBlock'
import type { ChatMessage as ChatMessageType } from '@/lib/types'

interface Props {
  messages: ChatMessageType[]
  onApproveTool?: (id: string) => void
  onRejectTool?: (id: string) => void
}

export function MessageList({ messages, onApproveTool, onRejectTool }: Props) {
  return (
    <>
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user'

        if (isUser) {
          return (
            <div key={i}>
              <ChatMessage message={msg} />
            </div>
          )
        }

        const hasParts = !!msg.parts && msg.parts.length > 0

        return (
          <div key={i} className="space-y-1.5">
            {hasParts ? (
              <>
                {msg.parts!.map((part, j) => {
                  if (part.type === 'thinking') {
                    return (
                      <ThinkingBlock
                        key={j}
                        content={part.content}
                        streaming={!!msg.streaming && j === msg.parts!.length - 1}
                      />
                    )
                  }
                  if (part.type === 'tool') {
                    return (
                      <ToolCallBlock
                        key={part.tool.id}
                        tool={part.tool}
                        onApprove={onApproveTool}
                        onReject={onRejectTool}
                      />
                    )
                  }
                  return (
                    <ChatMessage
                      key={j}
                      message={{ ...msg, thinking: undefined, content: part.content, streaming: false }}
                    />
                  )
                })}
                {msg.streaming && !msg.parts!.some((p) => p.type === 'text' && p.content) && (
                  <ChatMessage message={{ ...msg, thinking: undefined, content: '' }} />
                )}
              </>
            ) : msg.thinking ? (
              <ThinkingBlock content={msg.thinking} streaming={!!msg.streaming} />
            ) : (
              <ChatMessage message={{ ...msg, thinking: undefined }} />
            )}
          </div>
        )
      })}
    </>
  )
}
