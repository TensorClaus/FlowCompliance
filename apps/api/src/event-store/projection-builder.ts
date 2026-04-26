import { FormTypeSchema } from '@simplifi/shared'
import type { Prisma } from '../generated/prisma/client.js'

type StateObject = Record<string, unknown>

const EEA2_FORM_TYPE = FormTypeSchema.enum.EEA2

const isStateObject = (value: unknown): value is StateObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const setPath = (target: StateObject, path: string, value: unknown): void => {
  const segments = path.split('.').filter((segment) => segment.length > 0)
  if (segments.length === 0) {
    return
  }

  let current: StateObject = target
  const lastIndex = segments.length - 1

  for (let index = 0; index < lastIndex; index += 1) {
    const segment = segments[index]
    if (segment === undefined) {
      continue
    }

    const existing = current[segment]
    if (!isStateObject(existing)) {
      const nextState: StateObject = {}
      current[segment] = nextState
      current = nextState
      continue
    }

    current = existing
  }

  const leafKey = segments[lastIndex]
  if (leafKey !== undefined) {
    current[leafKey] = value
  }
}

export class ProjectionBuilder {
  public async build(
    tenantId: string,
    reportingYear: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const events = await tx.eeaEvent.findMany({
      where: {
        tenantId,
        formType: EEA2_FORM_TYPE,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    let state: StateObject = {}

    for (const event of events) {
      if (event.eventType === 'FORM_CREATED') {
        state = {}
        continue
      }

      if (event.eventType === 'FIELD_UPDATED') {
        if (event.fieldPath === null) {
          continue
        }
        setPath(state, event.fieldPath, event.newValue)
      }
    }

    const lastEventId = events.at(-1)?.id ?? null

    await tx.eea2Draft.upsert({
      where: {
        tenantId_reportingYear: {
          tenantId,
          reportingYear,
        },
      },
      create: {
        tenantId,
        reportingYear,
        state: state as Prisma.InputJsonValue,
        lastEventId,
        status: 'draft',
      },
      update: {
        state: state as Prisma.InputJsonValue,
        lastEventId,
        updatedAt: new Date(),
      },
    })
  }
}
