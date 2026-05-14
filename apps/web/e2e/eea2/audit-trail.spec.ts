import { test, expect } from '../fixtures'
import { API_URL, completeEea2Wizard, seedAuditEvents } from './helpers'

interface AuditEvent {
  id: string
  tenantId: string | null
  eventType: string | null
  fieldPath: string | null
  newValue: unknown
  metadata: unknown
  createdAt: string | null
}

interface EventsResponse {
  events: AuditEvent[]
}

function eventUserId(event: AuditEvent): unknown {
  if (typeof event.metadata !== 'object' || event.metadata === null) {
    return null
  }
  return (event.metadata as Record<string, unknown>)['userId']
}

function eventTotpVerified(event: AuditEvent): unknown {
  if (typeof event.metadata !== 'object' || event.metadata === null) {
    return null
  }
  return (event.metadata as Record<string, unknown>)['totpVerified']
}

test.describe.configure({ mode: 'serial' })

test.describe('EEA2 audit trail', () => {
  test('events are complete, PII-stripped, signed, and replayable to a midpoint', async ({
    page,
    setup,
  }) => {
    const { seed } = setup
    const { formId } = await completeEea2Wizard(page, setup)
    await seedAuditEvents(seed, formId)

    const eventsResponse = await fetch(`${API_URL}/eea2/${formId}/events?limit=100`, {
      headers: { Authorization: `Bearer ${seed.ceoToken}` },
    })
    expect(eventsResponse.status).toBe(200)

    const body = (await eventsResponse.json()) as EventsResponse
    expect(body.events.length).toBeGreaterThanOrEqual(14)

    for (const event of body.events) {
      expect(eventUserId(event)).toBeTruthy()
      expect(event.tenantId).toBeTruthy()
      expect(
        event.fieldPath ?? (event.eventType === 'EEA2_SIGNED' ? 'sectionH.signature' : null),
      ).toBeTruthy()
      expect(event.createdAt).toBeTruthy()
    }

    expect(
      body.events.some(
        (event) => event.eventType === 'EEA2_SIGNED' && eventTotpVerified(event) === true,
      ),
    ).toBe(true)

    for (const event of body.events) {
      const serialisedValue = JSON.stringify(event.newValue)
      expect(serialisedValue).not.toContain('African')
      expect(serialisedValue).not.toContain('Coloured')
      expect(serialisedValue).not.toContain('Male')
      expect(serialisedValue).not.toContain('Female')
    }

    const midpointEvent = body.events.find((event) => event.fieldPath === 'sectionC.goals')
    expect(midpointEvent).toBeDefined()
    if (midpointEvent === undefined) {
      throw new Error('Expected a midpoint audit event')
    }

    const replayResponse = await fetch(`${API_URL}/eea2/${formId}/replay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${seed.ceoToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ toEventId: midpointEvent.id }),
    })
    expect(replayResponse.status).toBe(200)

    const snapshot = (await replayResponse.json()) as Record<string, unknown>
    expect(snapshot['sectionA']).toMatchObject({ registrationNumber: '2026/123456/07' })
    expect(snapshot['sectionD']).toBeUndefined()
  })
})
