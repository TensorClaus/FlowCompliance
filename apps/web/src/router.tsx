import { createRouter } from '@tanstack/react-router'
import { Route as rootRoute } from './routes/__root'
import { Route as eea2FormRoute } from './routes/eea2-form'
import { Route as eea2SignRoute } from './routes/eea2-sign'
import { Route as indexRoute } from './routes/index'

const routeTree = rootRoute.addChildren([indexRoute, eea2FormRoute, eea2SignRoute])

export const router = createRouter({ routeTree })

// Register the router for full type-safety across the app
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
