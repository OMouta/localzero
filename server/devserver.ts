import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs/promises'
import net from 'net'
import path from 'path'
import { PROJECTS_DIR } from './index.js'
import { validateProjectId } from './sandbox/security.js'

interface DevServer {
  process: ChildProcess
  url: string
  port: number
}

const running = new Map<string, DevServer>()
const reservedPorts = new Set<number>()

const URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/
const PREVIEW_PORT_START = 4100
const PREVIEW_PORT_END = 4999
const READY_TIMEOUT_MS = 60_000

function canBindPort(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(false)
        return
      }
      reject(err)
    })
    srv.listen(port, '127.0.0.1', () => {
      srv.close(() => resolve(true))
    })
  })
}

async function allocatePreviewPort(): Promise<number> {
  for (let port = PREVIEW_PORT_START; port <= PREVIEW_PORT_END; port++) {
    if (reservedPorts.has(port)) continue
    if (await canBindPort(port)) {
      reservedPorts.add(port)
      return port
    }
  }
  throw new Error(`No preview ports available in ${PREVIEW_PORT_START}-${PREVIEW_PORT_END}`)
}

async function getDevArgs(projectDir: string, port: number): Promise<string[]> {
  const raw = await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8').catch(() => '{}')
  const pkg = JSON.parse(raw) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  const devScript = pkg.scripts?.dev ?? ''
  const portString = String(port)

  if ('next' in deps || /\bnext\s+dev\b/.test(devScript)) {
    return ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', portString]
  }

  if ('astro' in deps || /\bastro\s+dev\b/.test(devScript)) {
    return ['run', 'dev', '--', '--host', '127.0.0.1', '--port', portString]
  }

  return ['run', 'dev', '--', '--host', '127.0.0.1', '--port', portString, '--strictPort']
}

async function waitForHttpReady(url: string, timeoutMs = READY_TIMEOUT_MS): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.status < 500) return
    } catch {
      // The dev server has not bound the port yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for preview server at ${url}`)
}

export function getDevServer(projectId: string): string | null {
  validateProjectId(projectId)
  return running.get(projectId)?.url ?? null
}

export function stopDevServer(projectId: string): void {
  validateProjectId(projectId)
  const srv = running.get(projectId)
  if (srv) {
    srv.process.kill()
    reservedPorts.delete(srv.port)
    running.delete(projectId)
  }
}

export async function startDevServer(
  projectId: string,
  onUrl: (url: string) => void,
  onOutput: (line: string) => void,
  onError: (message: string) => void = () => {},
): Promise<void> {
  validateProjectId(projectId)
  if (running.has(projectId)) {
    onUrl(running.get(projectId)!.url)
    return
  }

  const port = await allocatePreviewPort()
  const projectDir = path.join(PROJECTS_DIR, projectId)
  const args = await getDevArgs(projectDir, port)
  const isWindows = process.platform === 'win32'
  const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm'
  const commandArgs = isWindows ? ['/d', '/s', '/c', 'npm', ...args] : args
  const proc = spawn(command, commandArgs, {
    cwd: projectDir,
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      VITE_PORT: String(port),
    },
  })

  let resolved = false
  let readyStarted = false

  function normalizeUrl(rawUrl: string): string {
    return rawUrl.replace('0.0.0.0', '127.0.0.1').replace('localhost', '127.0.0.1')
  }

  function resolveWhenReady(rawUrl: string): void {
    if (resolved || readyStarted) return
    readyStarted = true
    const url = normalizeUrl(rawUrl)

    waitForHttpReady(url)
      .then(() => {
        if (resolved) return
        resolved = true
        running.set(projectId, { process: proc, url, port })
        onUrl(url)
      })
      .catch((err) => {
        if (resolved) return
        resolved = true
        reservedPorts.delete(port)
        running.delete(projectId)
        proc.kill()
        const message = `Preview failed to start: ${err instanceof Error ? err.message : String(err)}`
        onOutput(message)
        onError(message)
      })
  }

  const handleOutput = (data: Buffer) => {
    const text = data.toString()
    onOutput(text)
    console.log(`[devserver:${projectId}]`, text.trim())

    if (!resolved) {
      const match = text.match(URL_PATTERN)
      if (match) {
        resolveWhenReady(match[0])
      }
    }
  }

  proc.stdout?.on('data', handleOutput)
  proc.stderr?.on('data', handleOutput)

  proc.on('error', (err) => {
    console.log(`[devserver:${projectId}] failed to spawn: ${err.message}`)
    reservedPorts.delete(port)
    running.delete(projectId)
    if (!resolved) {
      resolved = true
      const message = `Preview failed to spawn: ${err.message}`
      onOutput(message)
      onError(message)
    }
  })

  proc.on('exit', (code) => {
    console.log(`[devserver:${projectId}] exited with code ${code}`)
    reservedPorts.delete(port)
    running.delete(projectId)
    if (!resolved) {
      resolved = true
      const message = `Preview exited before it was ready (code ${code})`
      onOutput(message)
      onError(message)
    }
  })

  resolveWhenReady(`http://127.0.0.1:${port}`)
}
