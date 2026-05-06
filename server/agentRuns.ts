const activeRuns = new Map<string, Set<AbortController>>()

export function registerProjectRun(projectId: string, controller: AbortController): () => void {
  let runs = activeRuns.get(projectId)
  if (!runs) {
    runs = new Set()
    activeRuns.set(projectId, runs)
  }

  runs.add(controller)

  return () => {
    runs?.delete(controller)
    if (runs?.size === 0) activeRuns.delete(projectId)
  }
}

export function cancelProjectRuns(projectId: string, reason = 'Project run cancelled') {
  const runs = activeRuns.get(projectId)
  if (!runs) return

  for (const controller of runs) {
    if (!controller.signal.aborted) controller.abort(reason)
  }
  activeRuns.delete(projectId)
}
