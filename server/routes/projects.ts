import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { PROJECTS_DIR } from '../index.js'
import { validateProjectId } from '../sandbox/security.js'

const execAsync = promisify(exec)
const router = Router()

export interface ProjectMeta {
  id: string
  name: string
  template: string
  createdAt: string
  path: string
  devUrl?: string
}

const TEMPLATES: Record<string, string | null> = {
  'vite-react': 'npx create-vite@latest . --template react-ts',
  'vite-vue': 'npx create-vite@latest . --template vue-ts',
  'vite-vanilla': 'npx create-vite@latest . --template vanilla-ts',
  'next': 'npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes',
  'astro': 'npx create-astro@latest . --template minimal --no-install --yes',
  'react-router': 'npx create-react-router@latest . --yes',
  'blank': null,
}

function metaDir(): string {
  return path.join(PROJECTS_DIR, '_meta')
}

function chatDir(): string {
  return path.join(PROJECTS_DIR, '_chat')
}

function metaPath(projectId: string): string {
  return path.join(metaDir(), `${projectId}.json`)
}

export function chatPath(projectId: string): string {
  return path.join(chatDir(), `${projectId}.json`)
}

export function isValidTemplate(template: string): template is keyof typeof TEMPLATES {
  return template in TEMPLATES
}

export function projectSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'app'
}

export function projectNameFromPrompt(prompt: string): string {
  const cleaned = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !['a', 'an', 'the', 'with', 'and', 'for', 'to', 'of', 'in'].includes(word))
    .slice(0, 5)
    .join('-')
  return cleaned || 'app'
}

export async function readProjectMeta(projectId: string): Promise<ProjectMeta> {
  validateProjectId(projectId)
  const raw = await fs.readFile(metaPath(projectId), 'utf-8')
  return JSON.parse(raw) as ProjectMeta
}

export async function writeProjectMeta(meta: ProjectMeta): Promise<void> {
  await fs.mkdir(metaDir(), { recursive: true })
  await fs.writeFile(metaPath(meta.id), JSON.stringify(meta, null, 2))
}

export async function createProjectFromTemplate(
  name: string,
  template: string,
  onLog: (message: string) => void = () => {},
): Promise<{ meta: ProjectMeta; projectDir: string }> {
  if (!isValidTemplate(template)) throw new Error(`Unknown template: ${template}`)

  const id = `${Date.now()}-${projectSlug(name)}`
  const projectDir = path.join(PROJECTS_DIR, id)
  const meta: ProjectMeta = { id, name, template, createdAt: new Date().toISOString(), path: projectDir }

  await fs.mkdir(projectDir, { recursive: true })

  const templateCmd = TEMPLATES[template]
  if (templateCmd) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
    onLog(`Running scaffold: ${templateCmd}`)
    const { stdout, stderr } = await execAsync(templateCmd, {
      cwd: projectDir,
      shell,
      timeout: 120_000,
      env: { ...process.env, npm_config_yes: 'true', CI: 'true' },
    })
    if (stdout) onLog(`Scaffold stdout: ${stdout.slice(0, 300)}`)
    if (stderr) onLog(`Scaffold stderr: ${stderr.slice(0, 300)}`)

    const hasPkg = await fs.access(path.join(projectDir, 'package.json')).then(() => true).catch(() => false)
    if (hasPkg) {
      onLog('Running npm install')
      await execAsync('npm install', { cwd: projectDir, shell, timeout: 120_000, env: { ...process.env, npm_config_yes: 'true', CI: 'true' } })
      onLog('npm install done')
    }
  }

  await writeProjectMeta(meta)
  return { meta, projectDir }
}

router.get('/', async (_req, res) => {
  try {
    await fs.mkdir(metaDir(), { recursive: true })
    const entries = await fs.readdir(metaDir(), { withFileTypes: true })
    const projects: ProjectMeta[] = []

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      try {
        const raw = await fs.readFile(path.join(metaDir(), entry.name), 'utf-8')
        projects.push(JSON.parse(raw) as ProjectMeta)
      } catch {
        // skip malformed metadata
      }
    }

    projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json(projects)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

router.post('/', async (req, res) => {
  const { name, template } = req.body as { name?: string; template?: string }
  if (!name || !template) return res.status(400).json({ error: 'name and template required' })

  try {
    const { meta } = await createProjectFromTemplate(name, template)
    res.json(meta)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

router.get('/:id', async (req, res) => {
  try {
    res.json(await readProjectMeta(req.params.id))
  } catch {
    res.status(404).json({ error: 'project not found' })
  }
})

async function rmDir(dirPath: string): Promise<void> {
  if (process.platform === 'win32') {
    // fs.rm fails on Windows when node_modules contains paths > 260 chars or locked files.
    // rd /s /q via cmd handles long paths and is more reliable.
    await execAsync(`rd /s /q "${dirPath}"`, { shell: 'cmd.exe' }).catch(() => {})
  } else {
    await fs.rm(dirPath, { recursive: true, force: true })
  }
}

router.delete('/:id', async (req, res) => {
  try {
    validateProjectId(req.params.id)
    await rmDir(path.join(PROJECTS_DIR, req.params.id))
    await fs.rm(metaPath(req.params.id), { force: true })
    await fs.rm(chatPath(req.params.id), { force: true })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export { router as projectsRouter, TEMPLATES }
