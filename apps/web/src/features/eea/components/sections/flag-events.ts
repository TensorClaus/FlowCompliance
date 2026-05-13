const EVENT_APPEND_ENDPOINT = '/api/event-store/append'

export interface FlagEventBody {
  eventType: string
  fieldPath: string
  newValue?: string
}

export async function postFlagEvent(body: FlagEventBody): Promise<void> {
  try {
    await fetch(EVENT_APPEND_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Best-effort: the latch in useEEAWizard persists the flag regardless of
    // network failure. The event-store write is a redundant audit signal.
  }
}
