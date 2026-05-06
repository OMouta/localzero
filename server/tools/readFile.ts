import fs from 'fs/promises'
import { resolveExistingSafePath } from '../sandbox/security.js'

const MAX_BYTES = 200_000

export async function readFile(filePath: string, projectDir: string): Promise<string> {
  const safePath = await resolveExistingSafePath(projectDir, filePath)
  const stat = await fs.stat(safePath)

  if (stat.size > MAX_BYTES) {
    throw new Error(`File too large (${stat.size} bytes). Max is ${MAX_BYTES} bytes.`)
  }

  return fs.readFile(safePath, 'utf-8')
}
