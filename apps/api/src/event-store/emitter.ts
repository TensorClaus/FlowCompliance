import { EEAEventSchema, type AppendResult } from '@simplifi/shared'
import type { Prisma } from '../generated/prisma/client.js'

type EeaEventJsonInput = Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue
type EeaEventMetadataInput = Prisma.JsonNullValueInput | Prisma.InputJsonValue

export type EventStoreTx = Prisma.TransactionClient

export class EventEmitter {
  public async append(event: unknown, tx: EventStoreTx): Promise<AppendResult> {
    const validated = EEAEventSchema.parse(event)

    await tx.eeaEvent.create({
      data: {
        id: validated.eventId,
        tenantId: validated.tenantId,
        formType: validated.formType,
        formId: validated.formId,
        eventType: validated.eventType,
        fieldPath: validated.fieldPath,
        prevValue: validated.previousValue as EeaEventJsonInput,
        newValue: validated.newValue as EeaEventJsonInput,
        metadata: validated.metadata as EeaEventMetadataInput,
      },
    })

    return {
      success: true,
      eventId: validated.eventId,
      newVersion: 1,
      projectionSyncTriggered: false,
    }
  }
}
