import { z } from 'zod'
import { FormTypeSchema } from '../enums.js'
import { EEAEventSchema } from './events.js'

/**
 * DC-012 — Event Store Infrastructure Schemas
 *
 * The EEA compliance module is built on an append-only, immutable event log as
 * the single source of truth. No form record is ever mutated in place; every
 * state transition is expressed as an EEAEvent appended to the stream.
 *
 * Read-side access is served from materialised Projections, which are rebuilt
 * asynchronously from the event stream within a 500 ms SLA after each append.
 * Should a Projection become corrupted or fall out of sync, the system is
 * self-healing: the stream is replayed from the first event to reconstruct a
 * fresh projection without any data loss.
 *
 * Point-in-time replay (replayTo) enables forensic reconstruction of a form's
 * exact state at any historical moment — a capability required by the DoL's
 * inspection rights and POPIA's right-of-access obligations.
 *
 * Concurrency safety is enforced through optimistic locking: the caller
 * supplies the current stream version when appending, and the persistence layer
 * rejects the write if the version has advanced since the caller last read,
 * surfacing the conflict explicitly rather than silently overwriting data.
 *
 * @see DC-012 Event Sourcing specification
 */

// Re-export the EEAEvent type so consumers of this module do not need a
// separate import from events.js when working with EventStream.events.

// ---------------------------------------------------------------------------
// EventStream
// ---------------------------------------------------------------------------

/**
 * EventStreamSchema — the append-only, ordered log of every EEAEvent that has
 * ever occurred for a specific form instance (one stream per formId).
 *
 * The events array is ordered by timestamp ascending and is the definitive
 * source of truth for all downstream state representations. Projections and
 * Snapshots are derived artefacts; this stream is canonical.
 *
 * version is incremented atomically on every successful append and is used for
 * optimistic concurrency control: a writer must present the version it last
 * observed, and the persistence layer will reject the write if the version has
 * since advanced (indicating a concurrent write).
 *
 * lastEventAt is null when the stream has been created but no events have been
 * appended yet (i.e. events is empty and version is 0).
 *
 * @see DC-012 Event Sourcing specification
 */
export const EventStreamSchema = z.object({
  /**
   * Globally unique stream identifier. UUID v4. One stream exists per formId.
   */
  streamId: z.string().uuid(),

  /**
   * Tenant (employer) identifier. All streams are strictly scoped to a single
   * tenant; cross-tenant reads are prohibited at the data access layer.
   */
  tenantId: z.string().min(1),

  /**
   * EEA form type that this stream tracks.
   * @see FormTypeSchema in enums.ts
   */
  formType: FormTypeSchema,

  /**
   * UUID of the specific form instance this stream belongs to.
   * The combination (tenantId, formType, reportingPeriod) is unique, but
   * formId is the canonical cross-service reference key.
   */
  formId: z.string().uuid(),

  /**
   * Ordered, immutable list of all events in this stream, sorted by
   * timestamp ascending. Must never be mutated after persistence; new state
   * is expressed by appending a new EEAEvent.
   */
  events: z.array(EEAEventSchema),

  /**
   * Monotonically increasing counter incremented on every successful append.
   * Starts at 0 for an empty stream. Used for optimistic concurrency control.
   */
  version: z.number().int().nonnegative(),

  /**
   * UTC timestamp of when this stream record was first created (i.e. when
   * the form was initialised). Immutable after creation.
   */
  createdAt: z.coerce.date(),

  /**
   * UTC timestamp of the most recent event in the stream.
   * null when the stream has been created but no events have been appended.
   */
  lastEventAt: z.coerce.date().nullable(),
})

export type EventStream = z.infer<typeof EventStreamSchema>

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * ProjectionSchema — the materialised, read-optimised current state of a form,
 * rebuilt from the event stream.
 *
 * Projections are derived artefacts. They are rebuilt asynchronously within
 * 500 ms of each event append via a background sync job. Because they are
 * derived, they are fully expendable: if a Projection is corrupted, becomes
 * stale, or is suspected of being incorrect, it can be discarded and rebuilt
 * from scratch by replaying the EventStream from the first event to the latest.
 * This self-healing property guarantees eventual consistency without requiring
 * compensating transactions or manual data repairs.
 *
 * stale is set to true when new events exist in the EventStream beyond the
 * builtFromEventId used for the last build. A stale projection may be served
 * to read clients with an appropriate staleness indicator; the sync job will
 * clear the flag once the rebuild is complete.
 *
 * version mirrors the EventStream.version at the time of the last rebuild so
 * callers can detect drift by comparing the two values.
 *
 * @see DC-012 Event Sourcing specification — self-healing projection guarantee
 */
export const ProjectionSchema = z.object({
  /**
   * Globally unique projection identifier. UUID v4.
   */
  projectionId: z.string().uuid(),

  /**
   * Tenant (employer) identifier. Mirrors the EventStream tenantId.
   */
  tenantId: z.string().min(1),

  /**
   * EEA form type this projection represents.
   * @see FormTypeSchema in enums.ts
   */
  formType: FormTypeSchema,

  /**
   * UUID of the form instance this projection materialises. Matches
   * EventStream.formId for the same form.
   */
  formId: z.string().uuid(),

  /**
   * The full materialised form state produced by replaying all events up to
   * builtFromEventId. The runtime shape is one of EEA2Report, EEA4Report,
   * etc., narrowed by formType at the application layer.
   *
   * z.unknown() is used deliberately: the projection storage layer is
   * polymorphic and must not enforce a single form schema. Callers narrow
   * the type using the appropriate form schema after reading.
   */
  state: z.unknown(),

  /**
   * The EventStream.version from which this projection was built. Allows
   * drift detection: if EventStream.version > Projection.version, the
   * projection is stale and will be flagged accordingly.
   */
  version: z.number().int().nonnegative(),

  /**
   * eventId of the last EEAEvent that was applied when this projection was
   * built. Used to determine the replay start point for incremental rebuilds
   * and to set the stale flag when new events are appended beyond this point.
   */
  builtFromEventId: z.string().uuid(),

  /**
   * UTC timestamp of when this projection was most recently rebuilt.
   * Used by monitoring to track sync lag against the 500 ms SLA.
   */
  builtAt: z.coerce.date(),

  /**
   * Indicates whether the projection is out of date. Set to true when the
   * EventStream contains events with a version higher than Projection.version.
   * Cleared to false once the background sync job completes a rebuild.
   */
  stale: z.boolean(),
})

export type Projection = z.infer<typeof ProjectionSchema>

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

/**
 * SnapshotSchema — a frozen, point-in-time capture of a form's materialised
 * state, retained for audit and regulatory compliance purposes.
 *
 * Snapshots serve two primary roles in Simplifi:
 *
 *  1. Audit trail — POPIA (s.22) and the Employment Equity Act (s.21(4))
 *     require that designated employers retain evidence of what data was
 *     submitted and what state a form was in at the moment of a significant
 *     action (CEO sign-off, DoL submission). Snapshots provide tamper-evident,
 *     immutable evidence of that state.
 *
 *  2. DoL inspection readiness — The Department of Employment and Labour may
 *     request access to historical submission data at any time. Snapshots
 *     allow the system to surface the exact form state at the moment of
 *     submission without replaying the full event stream on demand.
 *
 * Snapshots are write-once. They are never updated after creation. If a
 * subsequent snapshot is needed for the same formId, a new Snapshot record is
 * created; the original is preserved indefinitely.
 *
 * reason uses a controlled vocabulary to facilitate programmatic querying of
 * compliance-relevant snapshots (e.g. "show me all CEO sign-off snapshots for
 * this tenant's 2025 submission cycle").
 *
 * @see DC-012 Event Sourcing specification — audit snapshot requirements
 * @see POPIA s.22 — right of access to personal information
 * @see Employment Equity Act s.21(4) — record-keeping obligations
 */
export const SnapshotSchema = z.object({
  /**
   * Globally unique snapshot identifier. UUID v4.
   */
  snapshotId: z.string().uuid(),

  /**
   * Tenant (employer) identifier. All snapshots are strictly tenant-scoped.
   */
  tenantId: z.string().min(1),

  /**
   * EEA form type at the moment the snapshot was taken.
   * @see FormTypeSchema in enums.ts
   */
  formType: FormTypeSchema,

  /**
   * UUID of the form instance this snapshot captures. Matches
   * EventStream.formId and Projection.formId for the same form.
   */
  formId: z.string().uuid(),

  /**
   * The full form state at the point in time represented by snapshotAt.
   * Write-once and immutable after creation.
   *
   * z.unknown() is used deliberately: the snapshot storage layer is
   * polymorphic. Callers narrow the type using the appropriate form schema
   * (e.g. EEA2ReportSchema) after reading, guided by the formType field.
   */
  state: z.unknown(),

  /**
   * The exact point in time this snapshot represents. For a dol_submission
   * snapshot this is the submission timestamp; for a ceo_sign_off snapshot
   * this is the moment the signatory approved.
   */
  snapshotAt: z.coerce.date(),

  /**
   * The EventStream.version at the moment this snapshot was captured.
   * Enables verification that the snapshot state is consistent with the
   * event stream at that version.
   */
  eventVersion: z.number().int().nonnegative(),

  /**
   * The eventId of the most recent EEAEvent included in this snapshot's
   * state. Combined with eventVersion, this provides a precise anchor into
   * the event stream for future forensic replay.
   */
  lastEventId: z.string().uuid(),

  /**
   * Controlled vocabulary describing why this snapshot was taken.
   *
   *  - ceo_sign_off:        Captured at the moment the CEO / Director signed
   *                         the form (HITL_GATE_SIGNED event).
   *  - dol_submission:      Captured at the moment the bundle was transmitted
   *                         to the Department of Employment and Labour.
   *  - manual_request:      Captured on explicit request by an authorised user
   *                         (e.g. compliance officer audit preparation).
   *  - pre_edit_backup:     Captured automatically before a bulk edit or data
   *                         import to provide a rollback reference point.
   */
  reason: z.enum(['ceo_sign_off', 'dol_submission', 'manual_request', 'pre_edit_backup']),

  /**
   * userId of the user or process that triggered snapshot creation.
   * Use the literal string 'system' for snapshots created by automated
   * processes (e.g. the HITL_GATE_SIGNED event handler).
   */
  createdBy: z.string().min(1),

  /**
   * UTC timestamp of when the snapshot record was persisted. Distinct from
   * snapshotAt, which is the business-relevant point in time the snapshot
   * represents. For most use cases these will be equal, but they may diverge
   * if a snapshot is reconstructed retroactively from the event stream.
   */
  createdAt: z.coerce.date(),
})

export type Snapshot = z.infer<typeof SnapshotSchema>

// ---------------------------------------------------------------------------
// AppendResult
// ---------------------------------------------------------------------------

/**
 * AppendResultSchema — the response returned to callers after an event is
 * successfully appended to an EventStream.
 *
 * projectionSyncTriggered indicates whether the async projection rebuild job
 * was enqueued as a result of this append. Under normal operating conditions
 * this will always be true; false indicates a degraded state where the sync
 * job could not be enqueued (the event is still persisted — projections will
 * self-heal once the queue recovers).
 *
 * @see DC-012 Event Sourcing specification — append semantics
 */
export const AppendResultSchema = z.object({
  /**
   * Whether the append operation completed successfully and the event was
   * durably persisted to the event store.
   */
  success: z.boolean(),

  /**
   * The eventId of the event that was just appended. Matches EEAEvent.eventId.
   */
  eventId: z.string().uuid(),

  /**
   * The EventStream.version after the append. Callers should use this value
   * as their expected version in any subsequent append to maintain optimistic
   * concurrency guarantees.
   */
  newVersion: z.number().int().nonnegative(),

  /**
   * Whether the asynchronous projection sync job was successfully enqueued
   * following this append. Normally true; false signals queue degradation.
   * The projection will be reconciled once normal queue operation resumes.
   */
  projectionSyncTriggered: z.boolean(),
})

export type AppendResult = z.infer<typeof AppendResultSchema>

// ---------------------------------------------------------------------------
// ReplayRequest
// ---------------------------------------------------------------------------

/**
 * ReplayRequestSchema — parameters for a point-in-time event stream replay.
 *
 * Replay reconstructs the exact state of a form at a given historical moment
 * by filtering the EventStream to events with timestamp <= replayTo and
 * applying them in order. This is the mechanism underlying:
 *
 *  - Self-healing projection rebuild (replayTo = now, full stream)
 *  - Forensic investigation (replayTo = the moment of interest)
 *  - DoL audit response (replayTo = submission timestamp)
 *
 * includeEvent controls whether an event whose timestamp matches replayTo
 * exactly is included in the replay window. Defaults to true so that
 * "replay to the moment of submission" includes the SUBMITTED event itself.
 *
 * @see DC-012 Event Sourcing specification — replayTo semantics
 */
export const ReplayRequestSchema = z.object({
  /**
   * UUID of the form whose event stream should be replayed.
   */
  formId: z.string().uuid(),

  /**
   * Replay events with timestamp up to and (by default) including this
   * UTC timestamp. Events after this point are excluded.
   */
  replayTo: z.coerce.date(),

  /**
   * When true (default), an event whose timestamp equals replayTo exactly
   * is included in the replay. When false, the boundary is exclusive.
   * Omit to accept the default inclusive behaviour.
   */
  includeEvent: z.boolean().optional(),
})

export type ReplayRequest = z.infer<typeof ReplayRequestSchema>

export { type EEAEvent } from './events.js'
