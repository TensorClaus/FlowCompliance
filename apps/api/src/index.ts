/* eslint-disable unicorn/no-process-exit */
import './config.js' // fail-fast env validation — must be first
import { buildApp } from './app.js'

const app = await buildApp()

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutdown signal received')
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

try {
  await app.listen({ port: 3001, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
