import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export type CommandRisk = 'low' | 'medium' | 'high'
export type CommandDecision =
  | { action: 'allow'; risk: CommandRisk; reason: string }
  | { action: 'approval'; risk: CommandRisk; reason: string }
  | { action: 'deny'; risk: CommandRisk; reason: string }

const DENY_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: />\s*\/dev\/(sd[a-z]|nvme)/i, reason: 'writes directly to a block device' },
  { pattern: /\bmkfs(\.[a-z]+)?\b/i, reason: 'formats a filesystem' },
  { pattern: /\bdd\b.*\bof=\/dev\/(sd|nvme)/i, reason: 'writes raw bytes to a disk device' },
  { pattern: /\bformat\s+[a-zA-Z]:/i, reason: 'formats a Windows drive' },
  { pattern: /:\(\)\s*\{/, reason: 'looks like a fork bomb' },
  { pattern: /[a-zA-Z]:\\windows\\system32/i, reason: 'targets Windows system files' },
  { pattern: /\/(etc|boot|sys|proc)\//i, reason: 'targets sensitive system paths' },
  { pattern: /\/etc\/(passwd|shadow)\b/i, reason: 'targets account credential files' },
]

const APPROVAL_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string; risk: CommandRisk }> = [
  { pattern: /\b(rm|rmdir|del|rd|Remove-Item|erase)\b/i, reason: 'deletes files or directories', risk: 'high' },
  { pattern: /\b(mv|move|ren|rename|cp|copy|robocopy|xcopy)\b/i, reason: 'moves or copies files', risk: 'medium' },
  { pattern: /\b(npm\s+install|npm\s+i|npx|pnpm|yarn|bunx?)\b/i, reason: 'runs package manager code or downloads dependencies', risk: 'medium' },
  { pattern: /\b(curl|wget|Invoke-WebRequest|iwr|ssh|scp|rsync|git\s+clone)\b/i, reason: 'uses network or remote access', risk: 'high' },
  { pattern: /\b(sudo|su|runas|Start-Process)\b/i, reason: 'may elevate privileges or spawn another process', risk: 'high' },
  { pattern: /\b(chmod|chown|icacls|takeown|attrib)\b/i, reason: 'changes permissions or ownership', risk: 'medium' },
  { pattern: /\b(git\s+clean|git\s+reset|git\s+checkout|git\s+switch|git\s+restore)\b/i, reason: 'can discard or replace work', risk: 'high' },
  { pattern: /\b(powershell|pwsh|cmd|bash|sh)\b.*(-Command|-c|\/c)\b/i, reason: 'starts a nested shell', risk: 'high' },
  { pattern: /\b(node|python|python3|ruby|perl)\b\s+(-e|-c)\b/i, reason: 'executes inline code', risk: 'high' },
]

const AUTO_ALLOW_COMMAND_PATTERNS = [
  /^\s*(npm\s+run\s+(build|test|lint|typecheck|check)|npm\s+test)\s*$/i,
  /^\s*(git\s+(status|diff|log)(\s+--?[\w=-]+)*)\s*$/i,
  /^\s*(pwd|ls|dir|Get-ChildItem)\s*$/i,
]

const SHELL_CONTROL_PATTERN = /[;&|`$<>]|\b(2>|1>|>>|<<)\b/

export function assessCommand(command: string): CommandDecision {
  const trimmed = command.trim()
  if (!trimmed) return { action: 'deny', risk: 'low', reason: 'empty command' }

  for (const { pattern, reason } of DENY_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) return { action: 'deny', risk: 'high', reason }
  }

  for (const { pattern, reason, risk } of APPROVAL_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) return { action: 'approval', risk, reason }
  }

  if (SHELL_CONTROL_PATTERN.test(trimmed)) {
    return { action: 'approval', risk: 'high', reason: 'uses shell control, redirection, or command substitution' }
  }

  if (AUTO_ALLOW_COMMAND_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return { action: 'allow', risk: 'low', reason: 'matches the low-risk command allowlist' }
  }

  return { action: 'approval', risk: 'medium', reason: 'raw shell command is not on the low-risk allowlist' }
}

export function validateCommand(command: string): void {
  const decision = assessCommand(command)
  if (decision.action === 'deny') {
    throw new Error(`Blocked: ${decision.reason}`)
  }
}

export function safeCommandEnv(projectDir: string): NodeJS.ProcessEnv {
  const runtimeDir = path.join(os.tmpdir(), 'localzero-runtime', path.basename(projectDir))
  const sandboxHome = path.join(runtimeDir, 'home')
  const npmCache = path.join(runtimeDir, 'npm-cache')
  const tmp = path.join(runtimeDir, 'tmp')
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '',
    Path: process.env.Path ?? process.env.PATH ?? '',
    CI: 'true',
    FORCE_COLOR: '0',
    HOME: sandboxHome,
    USERPROFILE: sandboxHome,
    TMPDIR: tmp,
    TEMP: tmp,
    TMP: tmp,
    npm_config_yes: 'true',
    npm_config_cache: npmCache,
  }

  for (const key of ['SystemRoot', 'WINDIR', 'COMSPEC', 'ComSpec', 'PATHEXT']) {
    if (process.env[key]) env[key] = process.env[key]
  }

  return env
}

export function validateProjectId(projectId: string): void {
  if (!/^\d{10,}-[a-z0-9-]+$/.test(projectId)) {
    throw new Error(`Invalid project id: "${projectId}"`)
  }
}

export function resolveSafePath(projectDir: string, relativePath: string): string {
  if (relativePath.includes('\0')) {
    throw new Error('Null bytes are not allowed in paths')
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Absolute paths are not allowed: "${relativePath}" - use a relative path`)
  }
  if (relativePath === '~' || relativePath.startsWith(`~${path.sep}`) || relativePath.startsWith('~/')) {
    throw new Error(`Home-relative paths are not allowed: "${relativePath}"`)
  }

  const normalized = relativePath.replace(/\\/g, '/')
  const resolved = path.resolve(projectDir, normalized)
  const projectDirNorm = path.resolve(projectDir)

  if (resolved !== projectDirNorm && !resolved.startsWith(projectDirNorm + path.sep)) {
    throw new Error(`Path traversal blocked: "${relativePath}" escapes project directory`)
  }
  return resolved
}

async function realProjectDir(projectDir: string): Promise<string> {
  return fs.realpath(projectDir)
}

function assertInside(realProject: string, candidate: string, originalPath: string): void {
  const rel = path.relative(realProject, candidate)
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return
  throw new Error(`Path traversal blocked: "${originalPath}" escapes project directory`)
}

export async function resolveExistingSafePath(projectDir: string, relativePath: string): Promise<string> {
  const safePath = resolveSafePath(projectDir, relativePath)
  const [projectReal, pathReal] = await Promise.all([realProjectDir(projectDir), fs.realpath(safePath)])
  assertInside(projectReal, pathReal, relativePath)
  return pathReal
}

export async function resolveWritableSafePath(projectDir: string, relativePath: string): Promise<string> {
  const safePath = resolveSafePath(projectDir, relativePath)
  const projectReal = await realProjectDir(projectDir)
  const existingReal = await fs.realpath(safePath).catch(() => null)
  if (existingReal) {
    assertInside(projectReal, existingReal, relativePath)
    return existingReal
  }

  const parentReal = await fs.realpath(path.dirname(safePath)).catch(() => null)
  if (parentReal) assertInside(projectReal, parentReal, relativePath)
  return safePath
}

export async function ensureCommandDirs(projectDir: string): Promise<void> {
  const runtimeDir = path.join(os.tmpdir(), 'localzero-runtime', path.basename(projectDir))
  await Promise.all([
    fs.mkdir(path.join(runtimeDir, 'home'), { recursive: true }),
    fs.mkdir(path.join(runtimeDir, 'tmp'), { recursive: true }),
    fs.mkdir(path.join(runtimeDir, 'npm-cache'), { recursive: true }),
  ])
}

export function hostSandboxHint(): string {
  if (process.env.LOCALZERO_CONTAINERIZED === '1') return 'containerized'
  return os.platform() === 'win32'
    ? 'host process with approvals; use Windows Sandbox, Hyper-V, or Docker for a hard boundary'
    : 'host process with approvals; use Docker or Podman with dropped capabilities for a hard boundary'
}
