export interface ProjectMeta {
  id: string
  name: string
  template: string
  createdAt: string
  path?: string
  devUrl?: string
}

export interface FileEntry {
  name: string
  type: 'file' | 'directory'
  children?: FileEntry[]
}

export type ChatRole = 'user' | 'assistant' | 'tool' | 'system'

export interface ToolCall {
  id: string
  name: string
  input: unknown
  output?: string
  isError?: boolean
  approval?: {
    status: 'pending' | 'approved' | 'rejected'
    reason: string
    risk: 'low' | 'medium' | 'high'
  }
}

export type MessagePart =
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'tool'; tool: ToolCall }

export interface ChatMessage {
  role: ChatRole
  content: string | null
  thinking?: string | null
  parts?: MessagePart[]
  streaming?: boolean
}

export type AgentEvent =
  | { type: 'token'; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'tool_start'; id: string; name: string; input: unknown }
  | { type: 'tool_approval_required'; id: string; name: string; input: unknown; reason: string; risk: 'low' | 'medium' | 'high' }
  | { type: 'tool_end'; id: string; output: string; isError?: boolean }
  | { type: 'message_done'; content: string }
  | { type: 'project_created'; id: string; name: string; template: string; description: string }
  | { type: 'error'; message: string }
  | { type: 'file_tree_refresh' }

export const TEMPLATES = [
  { id: 'vite-react', label: 'React + Vite' },
  { id: 'next', label: 'Next.js' },
  { id: 'react-router', label: 'React Router' },
  { id: 'vite-vue', label: 'Vue + Vite' },
  { id: 'astro', label: 'Astro' },
  { id: 'vite-vanilla', label: 'Vanilla TS' },
  { id: 'blank', label: 'Blank' },
]
