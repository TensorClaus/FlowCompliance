import { createRouter } from '@tanstack/react-router'
import { Route as rootRoute } from './routes/__root'
import { Route as calendarRoute } from './routes/calendar'
import { Route as dashboardRoute } from './routes/dashboard'
import { Route as eea1NewRoute } from './routes/eea1-new'
import { Route as eea2FormRoute } from './routes/eea2-form'
import { Route as eea2SignRoute } from './routes/eea2-sign'
import { Route as eea4Route } from './routes/eea4'
import { Route as indexRoute } from './routes/index'
import { Route as targetsRoute } from './routes/targets'
import { Route as workforceMatrixRoute } from './routes/workforce-matrix'

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  targetsRoute,
  workforceMatrixRoute,
  calendarRoute,
  eea4Route,
  eea1NewRoute,
  eea2FormRoute,
  eea2SignRoute,
])

export const router = createRouter({ routeTree })

// Register the router for full type-safety across the app
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
