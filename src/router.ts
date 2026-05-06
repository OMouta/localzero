import { createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router'
import { HomePage } from './pages/HomePage'
import { WorkspacePage } from './pages/WorkspacePage'

const rootRoute = createRootRoute({ component: Outlet })

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$id',
  component: WorkspacePage,
  validateSearch: (search: Record<string, unknown>): { prompt?: string; model?: string; stack?: string } => ({
    prompt: (search.prompt as string) || undefined,
    model: (search.model as string) || undefined,
    stack: (search.stack as string) || undefined,
  }),
})

const routeTree = rootRoute.addChildren([homeRoute, workspaceRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
