import { exec } from 'child_process'
import { promisify } from 'util'
import { ensureCommandDirs, safeCommandEnv, validateCommand } from '../sandbox/security.js'

const execAsync = promisify(exec)
const TIMEOUT_MS = 60_000

export async function runBash(command: string, projectDir: string): Promise<string> {
  validateCommand(command)
  await ensureCommandDirs(projectDir)

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectDir,
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 4,
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
      env: safeCommandEnv(projectDir),
    })
    const out = [stdout, stderr].filter(Boolean).join('\n').trim()
    return out || '(no output)'
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean }
    if (e.killed) return 'Error: command timed out after 60s'
    const out = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').trim()
    return `Error: ${out}`
  }
}
