import { Router, type Request } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { buildTree } from '../tools/listFiles.js'
import { resolveExistingSafePath, validateProjectId } from '../sandbox/security.js'
import { PROJECTS_DIR } from '../index.js'
import { chatPath } from './projects.js'

const router = Router({ mergeParams: true })

router.get('/tree', async (req: Request<{ id: string }>, res) => {
  validateProjectId(req.params.id)
  const projectDir = path.join(PROJECTS_DIR, req.params.id)
  try {
    const tree = await buildTree(projectDir)
    res.json(tree)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

router.get('/content', async (req: Request<{ id: string }>, res) => {
  const filePath = req.query.path as string
  if (!filePath) return res.status(400).json({ error: 'path required' })

  const projectDir = path.join(PROJECTS_DIR, req.params.id)
  try {
    validateProjectId(req.params.id)
    const safePath = await resolveExistingSafePath(projectDir, filePath)
    const content = await fs.readFile(safePath, 'utf-8')
    res.json({ content })
  } catch (err) {
    res.status(404).json({ error: String(err) })
  }
})

router.get('/chat', async (req: Request<{ id: string }>, res) => {
  validateProjectId(req.params.id)
  const projectChatPath = chatPath(req.params.id)
  try {
    const raw = await fs.readFile(projectChatPath, 'utf-8')
    res.json(JSON.parse(raw))
  } catch {
    res.json([])
  }
})

router.post('/chat', async (req: Request<{ id: string }>, res) => {
  validateProjectId(req.params.id)
  const projectChatPath = chatPath(req.params.id)
  try {
    await fs.mkdir(path.dirname(projectChatPath), { recursive: true })
    await fs.writeFile(projectChatPath, JSON.stringify(req.body, null, 2))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export { router as filesRouter }
