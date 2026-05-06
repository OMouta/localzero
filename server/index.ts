import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import {
  chatPath,
  createProjectFromTemplate,
  isValidTemplate,
  projectNameFromPrompt,
  projectsRouter,
} from './routes/projects.js'
import { filesRouter } from './routes/files.js'
import { runAgentLoop, determineStack, type AgentEvent } from './ollama/agent.js'
import { startDevServer, stopDevServer, getDevServer } from './devserver.js'
import type { Message } from 'ollama'
import { validateProjectId } from './sandbox/security.js'

export const PROJECTS_DIR = process.env.PROJECTS_DIR
  ?? path.join(os.homedir(), '.localzero', 'projects')

function log(label: string, ...args: unknown[]) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 23)
  console.log(`[${ts}] [${label}]`, ...args)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.use((req, _res, next) => {
  log('HTTP', req.method, req.url)
  next()
})

app.use('/api/projects', projectsRouter)
app.use('/api/projects/:id/files', filesRouter)

app.post('/api/determine-stack', async (req, res) => {
  const { prompt, model = 'llama3.1' } = req.body as { prompt: string; model?: string }
  log('determine-stack', `prompt="${prompt.slice(0, 80)}" model=${model}`)
  const template = await determineStack(prompt, model)
  log('determine-stack', `-> ${template}`)
  res.json({ template })
})

app.get('/api/models', async (_req, res) => {
  try {
    const r = await fetch('http://localhost:11434/api/tags')
    const data = await r.json() as { models: Array<{ name: string }> }
    const names = data.models.map((m) => m.name)
    log('models', `Ollama OK - ${names.length} model(s): ${names.join(', ') || '(none)'}`)
    res.json(names)
  } catch (err) {
    log('models', `ERROR reaching Ollama at http://localhost:11434 - ${err}`)
    res.json([])
  }
})

app.post('/api/projects/:id/devserver/start', (req, res) => {
  const { id } = req.params
  startDevServer(
    id,
    (url) => { if (!res.headersSent) res.json({ url }) },
    () => {},
    (message) => { if (!res.headersSent) res.status(500).json({ error: message }) },
  )
    .catch((e) => { if (!res.headersSent) res.status(500).json({ error: String(e) }) })
  setTimeout(() => { if (!res.headersSent) res.status(504).json({ error: 'timeout' }) }, 65_000)
})

app.post('/api/projects/:id/devserver/stop', (req, res) => {
  stopDevServer(req.params.id)
  res.json({ ok: true })
})

app.get('/api/projects/:id/devserver/status', (req, res) => {
  res.json({ url: getDevServer(req.params.id) })
})

const server = createServer(app)
const wss = new WebSocketServer({ server })

function send(ws: WebSocket, event: AgentEvent | { type: string; [k: string]: unknown }) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event))
}

type ApprovalResolver = (approved: boolean) => void

function createApprovalRequester(ws: WebSocket) {
  const pending = new Map<string, ApprovalResolver>()

  ws.on('message', (raw) => {
    let payload: { type?: string; id?: string; approved?: boolean }
    try { payload = JSON.parse(raw.toString()) as typeof payload } catch { return }
    if (payload.type !== 'tool_approval' || !payload.id) return

    const resolve = pending.get(payload.id)
    if (!resolve) return
    pending.delete(payload.id)
    resolve(payload.approved === true)
  })

  return (request: { id: string }) => new Promise<boolean>((resolve) => {
    pending.set(request.id, resolve)
    setTimeout(() => {
      if (!pending.has(request.id)) return
      pending.delete(request.id)
      resolve(false)
    }, 120_000)
  })
}

function uiChatMessage(message: Message) {
  return { ...message, content: message.content ?? '' }
}

function forwardAgentEvent(ws: WebSocket, event: AgentEvent) {
  if (event.type === 'token') {
    // skip verbose token logging
  } else if (event.type === 'tool_start') {
    log('agent', `tool_start: ${event.name}`, event.input)
  } else if (event.type === 'tool_end') {
    log('agent', `tool_end: id=${event.id} isError=${event.isError ?? false}`)
  } else if (event.type === 'error') {
    log('agent', `ERROR: ${event.message}`)
  } else {
    log('agent', `event: ${event.type}`)
  }

  send(ws, event)
  if (event.type === 'tool_end' && !event.isError) {
    send(ws, { type: 'file_tree_refresh' })
  }
}

wss.on('connection', (ws, req) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  const isNew = pathname === '/ws/new'
  const projectId = isNew ? null : pathname.split('/').at(-1)

  if (!isNew && !projectId) {
    log('ws', `Rejected bad path: ${pathname}`)
    ws.close(1008, 'bad path')
    return
  }

  log('ws', `Client connected -> ${pathname}`)
  ws.on('close', (code) => log('ws', `Client disconnected (code ${code}) <- ${pathname}`))

  const requestApproval = createApprovalRequester(ws)

  ws.on('message', async (raw) => {
    let payload: { type: string; content?: string; model?: string; history?: Message[]; stack?: string }
    try { payload = JSON.parse(raw.toString()) as typeof payload } catch {
      log('ws', 'Ignored unparseable message')
      return
    }
    if (payload.type !== 'chat') return

    const { content = '', model = 'llama3.1', history = [], stack } = payload
    log('agent', `Starting - model=${model} isNew=${isNew} stack=${stack ?? 'ai'} projectId=${projectId ?? 'n/a'} historyLen=${history.length}`)

    if (isNew) {
      const selectedTemplate = stack && isValidTemplate(stack) ? stack : 'vite-react'
      const name = projectNameFromPrompt(content)
      const scaffoldId = `scaffold_${Date.now()}`
      let createdDir = ''
      let createdId = ''

      send(ws, { type: 'tool_start', id: scaffoldId, name: 'scaffold_project', input: { name, template: selectedTemplate } })

      try {
        const { meta, projectDir } = await createProjectFromTemplate(name, selectedTemplate, (message) => log('project', message))
        createdDir = projectDir
        createdId = meta.id
        send(ws, { type: 'tool_end', id: scaffoldId, output: `Created ${selectedTemplate} project "${name}"` })
        send(ws, { type: 'project_created', id: meta.id, name: meta.name, template: meta.template, description: content })
        send(ws, { type: 'file_tree_refresh' })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        log('project', `Scaffold error: ${message}`)
        send(ws, { type: 'tool_end', id: scaffoldId, output: `Error: ${message}`, isError: true })
        send(ws, { type: 'error', message })
        return
      }

      await runAgentLoop(content, {
        projectDir: createdDir,
        model,
        history,
        requestApproval,
        onEvent: (event) => forwardAgentEvent(ws, event),
      }).then(async (messages) => {
        log('agent', `Loop finished - ${messages.length} messages`)
        const targetChatPath = chatPath(createdId)
        await fs.mkdir(path.dirname(targetChatPath), { recursive: true })
        await fs.writeFile(
          targetChatPath,
          JSON.stringify(messages.filter((m) => m.role !== 'system').map(uiChatMessage), null, 2),
        ).catch((e) => log('agent', `Failed to persist chat: ${e}`))
      })

      return
    }

    validateProjectId(projectId!)
    const projectDir = path.join(PROJECTS_DIR, projectId!)

    await runAgentLoop(content, {
      projectDir,
      model,
      history,
      requestApproval,
      onEvent: (event) => forwardAgentEvent(ws, event),
    }).then((messages) => {
      log('agent', `Loop finished - ${messages.length} messages`)
    })
  })
})

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001
server.listen(PORT, () => {
  log('server', `Listening on http://localhost:${PORT}`)
  log('server', `Projects dir: ${PROJECTS_DIR}`)
  log('server', `Ollama host: ${process.env.OLLAMA_HOST ?? 'http://localhost:11434'}`)
  fetch(`${process.env.OLLAMA_HOST ?? 'http://localhost:11434'}/api/tags`)
    .then((r) => r.json() as Promise<{ models: Array<{ name: string }> }>)
    .then((d) => log('server', `Ollama reachable - ${d.models.length} model(s) available`))
    .catch((e) => log('server', `WARNING: Cannot reach Ollama - ${e.message ?? e}`))
})
