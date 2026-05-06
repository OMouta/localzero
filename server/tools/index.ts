import { runBash } from './bash.js'
import { applyFilePatch } from './patch.js'
import { readFile } from './readFile.js'
import { writeFile } from './writeFile.js'
import { listFiles } from './listFiles.js'
import { assessCommand, type CommandRisk } from '../sandbox/security.js'

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'bash',
      description: 'Execute a shell command in the project directory. Low-risk commands may run automatically; raw or risky commands require user approval.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'patch',
      description: 'Apply a unified diff to modify an existing file. PREFERRED for edits - read the file first, then generate a minimal diff.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
          diff: { type: 'string', description: 'Unified diff (--- a/file +++ b/file @@ ... @@)' },
        },
        required: ['path', 'diff'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the full contents of a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file. Use only for new files or full rewrites - prefer patch for partial edits.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
          content: { type: 'string', description: 'Full file content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: 'List files and directories (recursive, max depth 4).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory to list (default ".")' },
        },
        required: [],
      },
    },
  },
]

export const CREATE_PROJECT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'create_project',
    description: 'Create a new project. Call this FIRST before any file operations. Picks a name, template, and sets up the directory.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short kebab-case project name (e.g. "todo-app")' },
        template: {
          type: 'string',
          enum: ['vite-react', 'next', 'react-router', 'vite-vue', 'astro', 'vite-vanilla', 'blank'],
          description: 'Starter template to use',
        },
        description: { type: 'string', description: 'One-sentence description of the project' },
      },
      required: ['name', 'template', 'description'],
    },
  },
}

export interface ToolAssessment {
  action: 'allow' | 'approval' | 'deny'
  risk: CommandRisk
  reason: string
}

export function assessToolCall(name: string, args: Record<string, string>): ToolAssessment {
  if (name === 'bash') return assessCommand(args.command ?? '')
  if (name === 'write_file') return { action: 'approval', risk: 'medium', reason: 'writes a full file' }
  if (name === 'patch') return { action: 'allow', risk: 'low', reason: 'applies a path-checked file patch' }
  if (name === 'read_file' || name === 'list_files') return { action: 'allow', risk: 'low', reason: 'read-only path-checked tool' }
  return { action: 'deny', risk: 'high', reason: `unknown tool: ${name}` }
}

export async function executeTool(
  name: string,
  args: Record<string, string>,
  projectDir: string,
  signal?: AbortSignal,
): Promise<string> {
  const assessment = assessToolCall(name, args)
  if (assessment.action === 'deny') {
    throw new Error(`Blocked: ${assessment.reason}`)
  }

  switch (name) {
    case 'bash':
      return runBash(args.command, projectDir, signal)
    case 'patch':
      return applyFilePatch(args.path, args.diff, projectDir)
    case 'read_file':
      return readFile(args.path, projectDir)
    case 'write_file':
      return writeFile(args.path, args.content, projectDir)
    case 'list_files':
      return listFiles(args.path ?? '.', projectDir)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
