import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectMeta } from '@/lib/types'

export function useProjects() {
  return useQuery<ProjectMeta[]>({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects').then((r) => r.json()) as Promise<ProjectMeta[]>,
  })
}

export function useProject(id: string) {
  return useQuery<ProjectMeta>({
    queryKey: ['project', id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()) as Promise<ProjectMeta>,
    enabled: !!id,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation<ProjectMeta, Error, { name: string; template: string }>({
    mutationFn: (body) =>
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json() as { error?: string }
          throw new Error(err.error ?? 'Failed to create project')
        }
        return r.json() as Promise<ProjectMeta>
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      fetch(`/api/projects/${id}`, { method: 'DELETE' }).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useModels() {
  return useQuery<string[]>({
    queryKey: ['models'],
    queryFn: () => fetch('/api/models').then((r) => r.json()) as Promise<string[]>,
    staleTime: 30_000,
  })
}

export function useFileTree(projectId: string, refreshKey: number) {
  return useQuery({
    queryKey: ['filetree', projectId, refreshKey],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/files/tree`).then((r) => r.json()),
    enabled: !!projectId,
  })
}

export function useFileContent(projectId: string, filePath: string | null) {
  return useQuery<{ content: string }>({
    queryKey: ['filecontent', projectId, filePath],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/files/content?path=${encodeURIComponent(filePath!)}`).then(
        (r) => r.json(),
      ) as Promise<{ content: string }>,
    enabled: !!projectId && !!filePath,
  })
}

export function useChatHistory(projectId: string) {
  return useQuery({
    queryKey: ['chat', projectId],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/files/chat`).then((r) => r.json()),
    enabled: !!projectId && projectId !== 'new',
  })
}
