import { Ollama, type Message, type Tool } from 'ollama'
import { TOOL_DEFINITIONS, CREATE_PROJECT_TOOL, assessToolCall, executeTool } from '../tools/index.js'
import type { CommandRisk } from '../sandbox/security.js'
import { SYSTEM_PROMPT, NEW_PROJECT_SYSTEM_PROMPT, newProjectPromptWithStack } from './prompts.js'

const ollama = new Ollama({ host: process.env.OLLAMA_HOST ?? 'http://localhost:11434' })

const VALID_TEMPLATES = ['vite-react', 'next', 'react-router', 'vite-vue', 'astro', 'vite-vanilla', 'blank']

export async function determineStack(prompt: string, model: string): Promise<string> {
  try {
    const response = await ollama.chat({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a web stack selector. Given the user's project description, respond with ONLY one template ID from this list: ${VALID_TEMPLATES.join(', ')}. Do not write anything else — just the template ID.`,
        },
        { role: 'user', content: prompt },
      ],
      stream: false,
    })
    const raw = response.message.content.trim().toLowerCase().split(/\s/)[0]
    return VALID_TEMPLATES.includes(raw) ? raw : 'vite-react'
  } catch {
    return 'vite-react'
  }
}

export type AgentEvent =
  | { type: 'token'; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'tool_start'; id: string; name: string; input: unknown }
  | { type: 'tool_approval_required'; id: string; name: string; input: unknown; reason: string; risk: CommandRisk }
  | { type: 'tool_end'; id: string; output: string; isError?: boolean }
  | { type: 'message_done'; content: string }
  | { type: 'project_created'; id: string; name: string; template: string; description: string }
  | { type: 'error'; message: string }

let callCounter = 0
function nextId() {
  return `call_${++callCounter}_${Date.now()}`
}

interface AgentOptions {
  projectDir?: string       // set for existing projects
  isNewProject?: boolean    // true when starting fresh
  stack?: string            // pre-selected template; undefined means AI chooses
  model: string
  history: Message[]
  onEvent: (event: AgentEvent) => void
  requestApproval?: (request: { id: string; name: string; input: unknown; reason: string; risk: CommandRisk }) => Promise<boolean>
  onProjectCreated?: (name: string, template: string) => Promise<string> // returns projectDir
}

export async function runAgentLoop(
  userMessage: string,
  opts: AgentOptions,
): Promise<Message[]> {
  const { model, history, onEvent, requestApproval, isNewProject = false, stack, onProjectCreated } = opts
  let projectDir = opts.projectDir ?? ''

  const systemPrompt = isNewProject
    ? (stack ? newProjectPromptWithStack(stack) : NEW_PROJECT_SYSTEM_PROMPT)
    : SYSTEM_PROMPT

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ]

  const MAX_ITERATIONS = 25
  let supportsThinking = true   // optimistically try; disabled on first failure

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // For new projects, only expose create_project until the directory exists.
    // This prevents small models from calling file tools before the project is set up.
    const tools = isNewProject && !projectDir
      ? [CREATE_PROJECT_TOOL]
      : TOOL_DEFINITIONS

    let assistantContent = ''
    let toolCalls: Array<{ id: string; function: { name: string; arguments: Record<string, string> } }> = []

    const runChat = async (withThinking: boolean) => {
      const response = await ollama.chat({
        model,
        messages,
        tools: tools as unknown as Tool[],
        stream: true,
        ...(withThinking ? { think: true } : {}),
      } as Parameters<typeof ollama.chat>[0])

      let tokenCount = 0
      for await (const chunk of response) {
        const thinkingDelta = (chunk.message as Record<string, unknown>).thinking as string | undefined
        if (thinkingDelta) {
          onEvent({ type: 'thinking', delta: thinkingDelta })
        }

        const delta = chunk.message.content
        if (delta) {
          assistantContent += delta
          tokenCount++
          if (tokenCount === 1) console.log(`[agent] First token received`)
          else if (tokenCount % 100 === 0) console.log(`[agent] ${tokenCount} tokens so far…`)
          onEvent({ type: 'token', delta })
        }
        if (chunk.message.tool_calls?.length) {
          toolCalls = chunk.message.tool_calls.map((tc) => ({
            id: nextId(),
            function: {
              name: tc.function.name,
              arguments:
                typeof tc.function.arguments === 'string'
                  ? (JSON.parse(tc.function.arguments) as Record<string, string>)
                  : (tc.function.arguments as Record<string, string>),
            },
          }))
        }
      }
    }

    try {
      console.log(`[agent] ollama.chat iteration=${i + 1} model=${model} messages=${messages.length} tools=${tools.map(t => t.function.name).join(',')}`)
      await runChat(supportsThinking)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // If the model doesn't support thinking, disable it and retry once
      if (supportsThinking && msg.includes('does not support thinking')) {
        console.log(`[agent] Model does not support thinking — retrying without it`)
        supportsThinking = false
        try {
          await runChat(false)
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr)
          console.log(`[agent] ERROR from Ollama: ${retryMsg}`)
          onEvent({ type: 'error', message: retryMsg })
          return messages
        }
      } else {
        console.log(`[agent] ERROR from Ollama: ${msg}`)
        onEvent({ type: 'error', message: msg })
        return messages
      }
    }

    const assistantMsg: Message = { role: 'assistant', content: assistantContent || null as unknown as string }
    if (toolCalls.length > 0) {
      console.log(`[agent] Stream done — ${toolCalls.length} tool call(s): ${toolCalls.map(t => t.function.name).join(', ')}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(assistantMsg as any).tool_calls = toolCalls
    }
    messages.push(assistantMsg)

    if (toolCalls.length === 0) {
      console.log(`[agent] Stream done — no tool calls, message complete`)
      onEvent({ type: 'message_done', content: assistantContent })
      return messages
    }

    for (const tc of toolCalls) {
      onEvent({ type: 'tool_start', id: tc.id, name: tc.function.name, input: tc.function.arguments })

      let output: string
      let isError = false

      try {
        if (tc.function.name === 'create_project') {
          if (!onProjectCreated) throw new Error('create_project called outside new-project context')
          const { name, template, description } = tc.function.arguments
          projectDir = await onProjectCreated(name, template)
          onEvent({ type: 'project_created', id: '', name, template, description })
          output = `Project "${name}" created with template "${template}". Directory ready at: ${projectDir}. Now start building.`
        } else {
          if (!projectDir) throw new Error('No project directory — call create_project first')
          const assessment = assessToolCall(tc.function.name, tc.function.arguments)
          if (assessment.action === 'deny') {
            throw new Error(`Blocked: ${assessment.reason}`)
          }
          if (assessment.action === 'approval') {
            if (!requestApproval) {
              throw new Error(`Approval required but no approval handler is available: ${assessment.reason}`)
            }
            onEvent({
              type: 'tool_approval_required',
              id: tc.id,
              name: tc.function.name,
              input: tc.function.arguments,
              reason: assessment.reason,
              risk: assessment.risk,
            })
            const approved = await requestApproval({
              id: tc.id,
              name: tc.function.name,
              input: tc.function.arguments,
              reason: assessment.reason,
              risk: assessment.risk,
            })
            if (!approved) {
              throw new Error(`Rejected by user: ${assessment.reason}`)
            }
          }
          output = await executeTool(tc.function.name, tc.function.arguments, projectDir)
        }
      } catch (err) {
        output = `Error: ${err instanceof Error ? err.message : String(err)}`
        isError = true
      }

      onEvent({ type: 'tool_end', id: tc.id, output, isError })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages.push({ role: 'tool', content: output } as any)
    }
  }

  onEvent({ type: 'error', message: 'Agent reached maximum iteration limit' })
  return messages
}
