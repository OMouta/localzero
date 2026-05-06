import fs from 'fs/promises'
import path from 'path'
import { resolveWritableSafePath } from '../sandbox/security.js'

export async function writeFile(
  filePath: string,
  content: string,
  projectDir: string,
): Promise<string> {
  const safePath = await resolveWritableSafePath(projectDir, filePath)
  await fs.mkdir(path.dirname(safePath), { recursive: true })
  await fs.writeFile(safePath, content, 'utf-8')
  return `Written ${filePath} (${content.length} chars)`
}
