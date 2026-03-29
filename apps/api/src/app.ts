import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import Fastify from 'fastify'

export function buildApp() {
  const app = Fastify({ logger: true })

  void app.register(sensible)
  void app.register(helmet)
  void app.register(cors)
  void app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  app.get('/health', () => ({ status: 'ok' }))

  return app
}
