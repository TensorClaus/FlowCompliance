import { Queue, Worker } from 'bullmq'
import { config } from '../config/env.js'
import type { PrismaClient } from '../generated/prisma/client.js'
import { ProjectionBuilder } from './projection-builder.js'

export const PROJECTION_SYNC_QUEUE_NAME = 'projection-sync'

type ProjectionSyncJobData = {
  tenantId: string
  reportingYear: number
}

const parseRedisPort = (port: string): number => {
  if (port.length === 0) {
    return 6379
  }

  const parsedPort = Number.parseInt(port, 10)
  return Number.isNaN(parsedPort) ? 6379 : parsedPort
}

const parseRedisDb = (pathname: string): number => {
  const normalizedPath = pathname.startsWith('/') ? pathname.slice(1) : pathname
  if (normalizedPath.length === 0) {
    return 0
  }

  const parsedDb = Number.parseInt(normalizedPath, 10)
  return Number.isNaN(parsedDb) ? 0 : parsedDb
}

const createRedisConnection = () => {
  const redisUrl = new URL(config.REDIS_URL)

  const baseConnection = {
    host: redisUrl.hostname,
    port: parseRedisPort(redisUrl.port),
    username: redisUrl.username.length > 0 ? decodeURIComponent(redisUrl.username) : undefined,
    password: redisUrl.password.length > 0 ? decodeURIComponent(redisUrl.password) : undefined,
    db: parseRedisDb(redisUrl.pathname),
  }

  if (redisUrl.protocol === 'rediss:') {
    return {
      ...baseConnection,
      tls: {},
    }
  }

  return baseConnection
}

export const createProjectionSyncQueue = (): Queue<ProjectionSyncJobData> =>
  new Queue<ProjectionSyncJobData>(PROJECTION_SYNC_QUEUE_NAME, {
    connection: createRedisConnection(),
  })

export const createProjectionSyncWorker = (prisma: PrismaClient): Worker<ProjectionSyncJobData> =>
  new Worker<ProjectionSyncJobData>(
    PROJECTION_SYNC_QUEUE_NAME,
    async (job: { data: ProjectionSyncJobData }): Promise<void> => {
      const builder = new ProjectionBuilder()

      await prisma.$transaction(async (tx): Promise<void> => {
        // set_config(..., true) is the parameterisable equivalent of
        // SET LOCAL — Postgres rejects bind parameters in SET statements.
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${job.data.tenantId}, true)`
        await builder.build(job.data.tenantId, job.data.reportingYear, tx)
      })
    },
    {
      connection: createRedisConnection(),
      concurrency: 3,
    },
  )
