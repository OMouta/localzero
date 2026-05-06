import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const icons: Record<string, string> = {
    ts: '󰛦', tsx: '󰛦', js: '󰌞', jsx: '󰌞',
    css: '󰌜', html: '󰌝', json: '󰘦', md: '󰍔',
    svg: '󰜡', png: '󰔳', jpg: '󰔳', gif: '󰔳',
  }
  return icons[ext] ?? '󰈔'
}

export function langFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    css: 'css', html: 'html', json: 'json', md: 'markdown', mdx: 'markdown',
    yaml: 'yaml', yml: 'yaml', sh: 'shell', py: 'python', rs: 'rust',
    go: 'go', java: 'java', cpp: 'cpp', c: 'c',
  }
  return map[ext] ?? 'plaintext'
}
