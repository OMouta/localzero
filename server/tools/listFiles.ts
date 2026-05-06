import fs from 'fs/promises'
import path from 'path'
import { resolveExistingSafePath } from '../sandbox/security.js'

const IGNORE = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  '.cache',
  '__pycache__',
  '.turbo',
])

interface FileEntry {
  name: string
  type: 'file' | 'directory'
  children?: FileEntry[]
}

async function buildTree(dirPath: string, depth = 0): Promise<FileEntry[]> {
  if (depth > 4) return []
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const result: FileEntry[] = []

  for (const entry of entries) {
    if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      const children = await buildTree(path.join(dirPath, entry.name), depth + 1)
      result.push({ name: entry.name, type: 'directory', children })
    } else {
      result.push({ name: entry.name, type: 'file' })
    }
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function listFiles(dirPath: string, projectDir: string): Promise<string> {
  const safePath = await resolveExistingSafePath(projectDir, dirPath || '.')
  const tree = await buildTree(safePath)
  return JSON.stringify(tree, null, 2)
}

export { buildTree, type FileEntry }
