import fs from 'fs/promises'
import { applyPatch } from 'diff'
import { resolveWritableSafePath } from '../sandbox/security.js'

export async function applyFilePatch(
  filePath: string,
  diffText: string,
  projectDir: string,
): Promise<string> {
  const safePath = await resolveWritableSafePath(projectDir, filePath)
  const original = await fs.readFile(safePath, 'utf-8').catch(() => '')

  const result = applyPatch(original, diffText)
  if (result === false) {
    throw new Error(
      'Patch failed to apply — the diff may not match the current file contents. Read the file first, then generate a fresh diff.',
    )
  }

  await fs.writeFile(safePath, result, 'utf-8')
  return `Patched ${filePath} successfully`
}
