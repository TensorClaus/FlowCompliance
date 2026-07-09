import { randomUUID } from 'node:crypto'
import { type EEAEvent, type EventMetadata } from '@simplifi/shared'
import { describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import {
  EventEmitter as EventStoreEmitter,
  ProjectionBuilder,
  PROJECTION_SYNC_QUEUE_NAME,
  createProjectionSyncQueue,
  createProjectionSyncWorker,
  replayTo,
} from '../event-store/index.js'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

type QueueRegistration = {
  name: string
  options: unknown
}

type WorkerRegistration = {
  name: string
  options: unknown
}

type BullMqMockState = {
  queues: QueueRegistration[]
  workers: WorkerRegistration[]
}

const bullMqMockState = vi.hoisted<BullMqMockState>(() => ({
  queues: [],
  workers: [],
}))

vi.mock('bullmq', () => {
  class MockQueue {
    public readonly name: string
    public readonly options: unknown

    public constructor(name: string, options?: unknown) {
      this.name = name
      this.options = options
      bullMqMockState.queues.push({ name, options })
    }

    public on(_eventName: string, _handler: () => void): this {
      return this
    }

    public async close(): Promise<void> {}
  }

  class MockWorker<TData = unknown> {
    public readonly name: string
    public readonly options: unknown
    private readonly processor: (job: { data: TData }) => Promise<void>

    public constructor(
      name: string,
      processor: (job: { data: TData }) => Promise<void>,
      options?: unknown,
    ) {
      this.name = name
      this.processor = processor
      this.options = options
      bullMqMockState.workers.push({ name, options })
    }

    public on(_eventName: string, _handler: () => void): this {
      return this
    }

    public async runJob(data: TData): Promise<void> {
      await this.processor({ data })
    }

    public async close(): Promise<void> {}
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
  }
})

const ROLLBACK_SENTINEL = new Error('event-store-test-rollback')
const REPORTING_YEAR = 2026

type JsonRecord = Record<string, unknown>

type TenantTxContext = {
  tenantId: string
  formId: string
  reportingYear: number
  tx: Prisma.TransactionClient
}

type SyncJobData = {
  tenantId: string
  reportingYear: number
}

type RunnableWorker<TData> = {
  runJob: (data: TData) => Promise<void>
  close: () => Promise<void>
}

type ClosableQueue = {
  close: () => Promise<void>
}

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getPathValue = (source: unknown, path: string): unknown => {
  const segments = path.split('.').filter((segment) => segment.length > 0)
  let current: unknown = source

  for (const segment of segments) {
    if (!isJsonRecord(current)) {
      return undefined
    }
    current = current[segment]
  }

  return current
}

const buildTestMetadata = (): EventMetadata => ({
  triggeredBy: 'test-user',
  ip: '127.0.0.1',
  userAgent: 'vitest',
  sessionId: 'session-001',
})

type BuildEventInput = Partial<
  Pick<
    EEAEvent,
    | 'eventId'
    | 'tenantId'
    | 'formType'
    | 'formId'
    | 'eventType'
    | 'fieldPath'
    | 'previousValue'
    | 'newValue'
    | 'metadata'
    | 'timestamp'
  >
>

const buildEvent = (input: BuildEventInput): EEAEvent => ({
  eventId: input.eventId ?? randomUUID(),
  tenantId: input.tenantId ?? randomUUID(),
  formType: input.formType ?? 'EEA2',
  formId: input.formId ?? randomUUID(),
  eventType: input.eventType ?? 'FIELD_UPDATED',
  fieldPath: input.fieldPath ?? 'section.default',
  previousValue: input.previousValue ?? null,
  newValue: input.newValue ?? 'value',
  metadata: input.metadata ?? buildTestMetadata(),
  timestamp: input.timestamp ?? new Date(),
})

const appendEventRow = async (tx: Prisma.TransactionClient, event: EEAEvent): Promise<void> => {
  await tx.eeaEvent.create({
    data: {
      id: event.eventId,
      tenantId: event.tenantId,
      formType: event.formType,
      formId: event.formId,
      eventType: event.eventType,
      fieldPath: event.fieldPath,
      prevValue: event.previousValue as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
      newValue: event.newValue as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
      metadata: event.metadata as Prisma.JsonNullValueInput | Prisma.InputJsonValue,
      createdAt: event.timestamp,
    },
  })
}

const runInTenantTransaction = async <T>(
  tenantId: string,
  execute: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> =>
  prisma.$transaction(async (tx): Promise<T> => {
    // set_config(..., true) — Postgres rejects bind parameters in SET.
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
    return execute(tx)
  })

const withRollbackTenantTransaction = async (
  execute: (context: TenantTxContext) => Promise<void>,
): Promise<void> => {
  const tenantId = randomUUID()
  const formId = randomUUID()

  try {
    await runInTenantTransaction(tenantId, async (tx): Promise<void> => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: 'Event Store Test Tenant',
          kmsKeyId: 'local-dev-placeholder',
        },
      })

      await execute({
        tenantId,
        formId,
        reportingYear: REPORTING_YEAR,
        tx,
      })

      throw ROLLBACK_SENTINEL
    })
  } catch (error: unknown) {
    if (error === ROLLBACK_SENTINEL) {
      return
    }
    throw error
  }
}

describe('event-store integration', () => {
  it('EventEmitter append validates schema and writes within the provided tenant tx', async () => {
    await withRollbackTenantTransaction(async ({ tenantId, formId, tx }) => {
      const emitter = new EventStoreEmitter()
      const payload = buildEvent({
        tenantId,
        formId,
        eventType: 'FORM_CREATED',
        fieldPath: null,
        previousValue: null,
        newValue: null,
      })

      const result = await emitter.append(payload, tx)
      const persisted = await tx.eeaEvent.findUnique({
        where: { id: payload.eventId },
      })

      expect(result.success).toBe(true)
      expect(result.eventId).toBe(payload.eventId)
      expect(persisted?.tenantId).toBe(tenantId)
      expect(persisted?.formId).toBe(formId)
      expect(persisted?.eventType).toBe('FORM_CREATED')
    })
  })

  it('EventEmitter throws ZodError on invalid event payload', async () => {
    await withRollbackTenantTransaction(async ({ tx }) => {
      const emitter = new EventStoreEmitter()
      await expect(
        emitter.append(
          {
            eventId: randomUUID(),
          },
          tx,
        ),
      ).rejects.toBeInstanceOf(ZodError)
    })
  })

  it('ProjectionBuilder is deterministic for a fixed event sequence', async () => {
    await withRollbackTenantTransaction(async ({ tenantId, formId, reportingYear, tx }) => {
      const builder = new ProjectionBuilder()
      const t0 = new Date('2026-01-01T00:00:00.000Z')

      const events: EEAEvent[] = [
        buildEvent({
          tenantId,
          formId,
          eventType: 'FORM_CREATED',
          fieldPath: null,
          previousValue: null,
          newValue: null,
          timestamp: t0,
        }),
        buildEvent({
          tenantId,
          formId,
          fieldPath: 'sectionA.name',
          previousValue: null,
          newValue: 'Alice',
          timestamp: new Date(t0.getTime() + 1000),
        }),
        buildEvent({
          tenantId,
          formId,
          fieldPath: 'sectionA.count',
          previousValue: null,
          newValue: 7,
          timestamp: new Date(t0.getTime() + 2000),
        }),
      ]

      for (const event of events) {
        await appendEventRow(tx, event)
      }

      await builder.build(tenantId, reportingYear, tx)
      const firstBuild = await tx.eea2Draft.findUnique({
        where: {
          tenantId_reportingYear: {
            tenantId,
            reportingYear,
          },
        },
      })

      await builder.build(tenantId, reportingYear, tx)
      const secondBuild = await tx.eea2Draft.findUnique({
        where: {
          tenantId_reportingYear: {
            tenantId,
            reportingYear,
          },
        },
      })

      expect(firstBuild).not.toBeNull()
      expect(secondBuild).not.toBeNull()
      if (firstBuild === null || secondBuild === null) {
        throw new Error('Expected eea2_drafts row to exist')
      }

      expect(JSON.stringify(firstBuild.state)).toBe(JSON.stringify(secondBuild.state))
      expect(firstBuild.lastEventId).toBe(secondBuild.lastEventId)
    })
  })

  it('replayTo(t0/t1/tn) matches expected state and replayTo(tn) matches materialized projection byte-for-byte', async () => {
    await withRollbackTenantTransaction(async ({ tenantId, formId, reportingYear, tx }) => {
      const builder = new ProjectionBuilder()
      const t0 = new Date('2026-02-01T09:00:00.000Z')
      const t1 = new Date('2026-02-01T09:00:01.000Z')
      const t2 = new Date('2026-02-01T09:00:02.000Z')
      const tn = new Date('2026-02-01T09:00:03.000Z')

      const events: EEAEvent[] = [
        buildEvent({
          tenantId,
          formId,
          eventType: 'FORM_CREATED',
          fieldPath: null,
          previousValue: null,
          newValue: null,
          timestamp: t0,
        }),
        buildEvent({
          tenantId,
          formId,
          fieldPath: 'sectionB.value',
          previousValue: null,
          newValue: 'first',
          timestamp: t1,
        }),
        buildEvent({
          tenantId,
          formId,
          eventType: 'SECTION_COMPLETED',
          fieldPath: null,
          previousValue: null,
          newValue: null,
          timestamp: t2,
        }),
        buildEvent({
          tenantId,
          formId,
          fieldPath: 'sectionB.nested.total',
          previousValue: null,
          newValue: 12,
          timestamp: tn,
        }),
      ]

      for (const event of events) {
        await appendEventRow(tx, event)
      }

      const replayAtT0 = await replayTo(tenantId, formId, t0, tx)
      const replayAtT1 = await replayTo(tenantId, formId, t1, tx)
      const replayAtTn = await replayTo(tenantId, formId, tn, tx)

      expect(replayAtT0).toStrictEqual({})
      expect(getPathValue(replayAtT1, 'sectionB.value')).toBe('first')
      expect(getPathValue(replayAtT1, 'sectionB.nested.total')).toBeUndefined()
      expect(getPathValue(replayAtTn, 'sectionB.value')).toBe('first')
      expect(getPathValue(replayAtTn, 'sectionB.nested.total')).toBe(12)

      await builder.build(tenantId, reportingYear, tx)
      const draft = await tx.eea2Draft.findUnique({
        where: {
          tenantId_reportingYear: {
            tenantId,
            reportingYear,
          },
        },
      })

      expect(draft).not.toBeNull()
      if (draft === null) {
        throw new Error('Expected eea2_drafts row to exist')
      }

      expect(JSON.stringify(replayAtTn)).toBe(JSON.stringify(draft.state))
    })
  })

  it('BullMQ worker catches up lagging projections idempotently and exports queue name/factories correctly', async () => {
    const tenantId = randomUUID()
    const formId = randomUUID()
    const t0 = new Date('2026-03-01T08:00:00.000Z')
    const t1 = new Date('2026-03-01T08:00:01.000Z')

    bullMqMockState.queues.length = 0
    bullMqMockState.workers.length = 0

    await runInTenantTransaction(tenantId, async (tx): Promise<void> => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: 'Event Store Worker Test Tenant',
          kmsKeyId: 'local-dev-placeholder',
        },
      })

      await appendEventRow(
        tx,
        buildEvent({
          tenantId,
          formId,
          eventType: 'FORM_CREATED',
          fieldPath: null,
          previousValue: null,
          newValue: null,
          timestamp: t0,
        }),
      )
      await appendEventRow(
        tx,
        buildEvent({
          tenantId,
          formId,
          fieldPath: 'sectionC.answer',
          previousValue: null,
          newValue: 42,
          timestamp: t1,
        }),
      )
    })

    const queue = createProjectionSyncQueue() as unknown as ClosableQueue
    const worker = createProjectionSyncWorker(prisma) as unknown as RunnableWorker<SyncJobData>

    try {
      expect(PROJECTION_SYNC_QUEUE_NAME).toBe('projection-sync')
      expect(bullMqMockState.queues.at(-1)?.name).toBe('projection-sync')
      expect(bullMqMockState.workers.at(-1)?.name).toBe('projection-sync')

      const workerOptions = bullMqMockState.workers.at(-1)?.options
      const concurrency =
        isJsonRecord(workerOptions) && typeof workerOptions['concurrency'] === 'number'
          ? workerOptions['concurrency']
          : undefined
      expect(concurrency).toBe(3)

      await worker.runJob({ tenantId, reportingYear: REPORTING_YEAR })
      const firstDraft = await runInTenantTransaction(tenantId, async (tx) =>
        tx.eea2Draft.findUnique({
          where: {
            tenantId_reportingYear: {
              tenantId,
              reportingYear: REPORTING_YEAR,
            },
          },
        }),
      )

      await worker.runJob({ tenantId, reportingYear: REPORTING_YEAR })
      const secondDraft = await runInTenantTransaction(tenantId, async (tx) =>
        tx.eea2Draft.findUnique({
          where: {
            tenantId_reportingYear: {
              tenantId,
              reportingYear: REPORTING_YEAR,
            },
          },
        }),
      )

      expect(firstDraft).not.toBeNull()
      expect(secondDraft).not.toBeNull()
      if (firstDraft === null || secondDraft === null) {
        throw new Error('Expected eea2_drafts row to exist')
      }

      expect(getPathValue(firstDraft.state, 'sectionC.answer')).toBe(42)
      expect(JSON.stringify(firstDraft.state)).toBe(JSON.stringify(secondDraft.state))
      expect(firstDraft.lastEventId).toBe(secondDraft.lastEventId)
    } finally {
      await worker.close()
      await queue.close()
      // Plain sequential deletes: cleanup must not depend on the tenant-tx
      // helper under test, and a cleanup failure here masks the real assertion.
      await prisma.eea2Draft.deleteMany({ where: { tenantId } })
      await prisma.eeaEvent.deleteMany({ where: { tenantId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
    }
  })
})
