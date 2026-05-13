import { z } from 'zod'
import { FormTypeSchema } from '../enums.js'

/**
 * DC-012 — EEA Event Sourcing Schemas
 *
 * Architectural rationale:
 * The EEA compliance module uses an append-only, immutable event log as the
 * single source of truth for all form state changes. No record is ever updated
 * or deleted in-place; every mutation is expressed as a new EEAEvent row.
 *
 * This design provides:
 *  - A full, auditable history required by the Employment Equity Act (s.21(4))
 *    and the DoL's inspection rights.
 *  - Deterministic state reconstruction: replaying the event stream from
 *    FORM_CREATED to the latest event always yields the current form state.
 *  - Safe concurrent editing: last-writer-wins conflicts are surfaced explicitly
 *    because the previous value is recorded on every FIELD_UPDATED event.
 *  - HITL governance: the HITL_GATE_* events create a tamper-evident chain of
 *    custody from "CEO sent for sign-off" through to "signed" or "rejected",
 *    satisfying the human-in-the-loop requirement for sensitive submissions.
 *
 * eventId uses UUID v7 (time-sortable) so event ordering is recoverable from
 * the primary key alone, without requiring a separate sequence column.
 *
 * All timestamps are server-generated. Clients MUST NOT supply the timestamp
 * field; the API layer strips it from inbound payloads before persistence.
 *
 * @see DC-012 Event Sourcing specification
 */

// ---------------------------------------------------------------------------
// EEAEventType
// ---------------------------------------------------------------------------

/**
 * EEAEventTypeSchema — exhaustive union of all event types that can occur
 * within the EEA compliance workflow.
 *
 * Each variant is described below with the exact condition that triggers it.
 */
export const EEAEventTypeSchema = z.enum([
  /**
   * FORM_CREATED — emitted once when a new EEA form is initialised for a
   * tenant/reporting period. previousValue is always null for this event.
   */
  'FORM_CREATED',

  /**
   * FIELD_UPDATED — emitted every time a user (or system process) changes a
   * single field value. fieldPath identifies the dot-notation path to the
   * mutated field (e.g. 'sectionB.table1_1.topManagement.africanMale').
   * Both previousValue and newValue are recorded to support diff rendering
   * and conflict detection.
   */
  'FIELD_UPDATED',

  /**
   * SECTION_COMPLETED — emitted when the user explicitly marks a form section
   * as complete (all required fields valid, user confirmed). Triggers
   * downstream cross-form sync checks where applicable.
   */
  'SECTION_COMPLETED',

  /**
   * SECTION_UNLOCKED — emitted when a user navigates back to edit a section
   * that was previously marked complete. Clears any downstream HITL gate that
   * depended on the section, requiring re-completion before re-submission.
   */
  'SECTION_UNLOCKED',

  /**
   * CROSS_FORM_SYNC — emitted when data is automatically propagated between
   * related forms; the canonical example is EEA2 Table 1.1 headcount being
   * copied into EEA4. fieldPath on the destination form is recorded as newValue;
   * the source form/field is captured in metadata.source.
   */
  'CROSS_FORM_SYNC',

  /**
   * VALIDATION_FAILED — emitted when a hard-block validation rule is triggered
   * (e.g. total headcount mismatch, missing mandatory section). The failing
   * rule identifier should be placed in metadata.reason. Blocks submission
   * until resolved.
   */
  'VALIDATION_FAILED',

  /**
   * VALIDATION_RESOLVED — emitted when the user corrects the data that caused
   * a previous VALIDATION_FAILED event. Unblocks the submission path if no
   * other failures remain.
   */
  'VALIDATION_RESOLVED',

  /**
   * PREFILL_APPLIED — emitted when prior-year values are automatically carried
   * forward into the current reporting period form. Each prefilled field
   * produces one PREFILL_APPLIED event so changes can be tracked individually.
   * metadata.source identifies the prefill origin (e.g. 'prior_year_prefill').
   */
  'PREFILL_APPLIED',

  /**
   * PREFILL_OVERRIDDEN — emitted when a user changes a value that was set by
   * a previous PREFILL_APPLIED event. previousValue holds the prefilled value;
   * newValue holds the user's replacement. Provides an audit trail of manual
   * deviations from the prior-year baseline.
   */
  'PREFILL_OVERRIDDEN',

  /**
   * HITL_GATE_OPENED — emitted when the form is dispatched to the designated
   * signatory (CEO / Director) for sign-off. Triggers the human-in-the-loop
   * governance workflow. No further FIELD_UPDATED events are permitted until
   * the gate is either signed or rejected.
   */
  'HITL_GATE_OPENED',

  /**
   * HITL_GATE_SIGNED — emitted when the CEO / Director approves and signs the
   * form. Unblocks the submission bundle step. metadata.triggeredBy holds the
   * signatory's userId.
   */
  'HITL_GATE_SIGNED',

  /**
   * HITL_GATE_REJECTED — emitted when the CEO / Director sends the form back
   * for revision. metadata.reason should contain the rejection rationale.
   * Re-opens the form for editing and resets the HITL gate.
   */
  'HITL_GATE_REJECTED',

  /**
   * SUBMISSION_BUNDLED — emitted when EEA2 and EEA4 are combined into a single
   * DoL submission package. The bundle ID or package reference should be
   * recorded in newValue. No individual form edits are permitted after bundling.
   */
  'SUBMISSION_BUNDLED',

  /**
   * SUBMITTED — emitted when the bundled package is transmitted to the
   * Department of Employment and Labour. newValue should hold the DoL
   * acknowledgement reference number when available.
   */
  'SUBMITTED',

  /**
   * EEA1_POPIA_CONSENT — emitted when an employee explicitly acknowledges the
   * POPIA s.18 prescribed information notice before providing demographic data
   * on the EEA1 workforce profile form. fieldPath is null (form-level event).
   * newValue holds an ISO-8601 timestamp of the acknowledgement. previousValue
   * is always null. Required for the audit trail under EEA s.21(4) and POPIA
   * s.22 (operator accountability).
   */
  'EEA1_POPIA_CONSENT',
])

export type EEAEventType = z.infer<typeof EEAEventTypeSchema>

// ---------------------------------------------------------------------------
// EventReasonSchema
// ---------------------------------------------------------------------------

/**
 * EventReasonSchema — controlled vocabulary for metadata.reason.
 *
 * Describes the business context that caused a mutation:
 *  - manual_edit:              User typed directly into the form field.
 *  - payroll_reconciliation:   Value was updated as a result of a payroll
 *                              data reconciliation pass.
 *  - prefill_carryforward:     Value was carried forward from a prior
 *                              reporting period automatically.
 *  - cross_form_sync:          Value was propagated from a related EEA form
 *                              (e.g. EEA2 → EEA4 headcount sync).
 */
export const EventReasonSchema = z.enum([
  'manual_edit',
  'payroll_reconciliation',
  'prefill_carryforward',
  'cross_form_sync',
])

export type EventReason = z.infer<typeof EventReasonSchema>

// ---------------------------------------------------------------------------
// EventSourceSchema
// ---------------------------------------------------------------------------

/**
 * EventSourceSchema — controlled vocabulary for metadata.source.
 *
 * Identifies the originating system or process that produced the event:
 *  - eea12_prefill:       Values populated from an EEA12 skills report prefill.
 *  - prior_year_prefill:  Values carried forward from the previous year's
 *                         submitted forms.
 *  - csv_import:          Values ingested via a bulk CSV upload.
 *  - api_sync:            Values pushed from an integrated third-party system
 *                         (e.g. HRIS, payroll provider) via the Simplifi API.
 */
export const EventSourceSchema = z.enum([
  'eea12_prefill',
  'prior_year_prefill',
  'csv_import',
  'api_sync',
])

export type EventSource = z.infer<typeof EventSourceSchema>

// ---------------------------------------------------------------------------
// EventMetadataSchema
// ---------------------------------------------------------------------------

/**
 * EventMetadataSchema — contextual information attached to every EEAEvent.
 *
 * All fields except reason and source are required. They are captured by the
 * API layer from the inbound HTTP request and the authenticated session —
 * clients must not supply them directly; the server always overwrites them.
 *
 * reason and source are optional because not every event type has a meaningful
 * value for both fields (e.g. FORM_CREATED has no reason; FIELD_UPDATED by a
 * user has no source).
 */
export const EventMetadataSchema = z.object({
  /**
   * Business context for the mutation. Optional; omit when not applicable.
   * @see EventReasonSchema
   */
  reason: EventReasonSchema.optional(),

  /**
   * userId of the authenticated user who triggered the event, or the literal
   * string 'system' for automated processes (prefill, sync, bundling).
   */
  triggeredBy: z.string().min(1),

  /**
   * IP address of the originating request. Captured server-side for audit
   * and fraud-detection purposes. IPv4 or IPv6 CIDR notation accepted.
   */
  ip: z.string().min(1),

  /**
   * Raw User-Agent header value from the originating HTTP request.
   */
  userAgent: z.string().min(1),

  /**
   * Authenticated session identifier. Allows correlation of all events
   * produced within a single user session for replay and forensic analysis.
   */
  sessionId: z.string().min(1),

  /**
   * Originating system that produced the event. Optional; omit for events
   * initiated directly by a human user through the UI.
   * @see EventSourceSchema
   */
  source: EventSourceSchema.optional(),
})

export type EventMetadata = z.infer<typeof EventMetadataSchema>

// ---------------------------------------------------------------------------
// EEAEventSchema
// ---------------------------------------------------------------------------

/**
 * EEAEventSchema — the canonical immutable event record for the EEA compliance
 * module.
 *
 * Design invariants (enforced at the application layer, not by Zod alone):
 *  1. Records are append-only. No UPDATE or DELETE is ever issued against the
 *     events table.
 *  2. eventId (UUID v7) is generated server-side and provides a globally
 *     unique, time-sortable primary key.
 *  3. timestamp is assigned by the server at the moment of persistence.
 *     Clients submitting an events payload must not include this field.
 *  4. previousValue MUST be null for FORM_CREATED events.
 *     newValue MUST be null for any hypothetical deletion event.
 *  5. fieldPath MUST be non-null for FIELD_UPDATED and PREFILL_OVERRIDDEN;
 *     it is null for form-level events (FORM_CREATED, SUBMITTED, etc.).
 *
 * @see DC-012 Event Sourcing specification
 */
export const EEAEventSchema = z.object({
  /**
   * Globally unique event identifier. UUID v7 format ensures time-sortable
   * ordering so the event stream can be reconstructed from the primary key
   * without a separate sequence column.
   */
  eventId: z.string().uuid(),

  /**
   * Tenant (employer) identifier. All events are scoped to a single tenant;
   * cross-tenant queries are prohibited at the data access layer.
   */
  tenantId: z.string().min(1),

  /**
   * The EEA form type this event belongs to.
   * @see FormTypeSchema in enums.ts
   */
  formType: FormTypeSchema,

  /**
   * Surrogate identifier for the specific form instance (one per tenant per
   * reporting period per formType).
   */
  formId: z.string().min(1),

  /**
   * Classification of the event within the EEA workflow lifecycle.
   * @see EEAEventTypeSchema
   */
  eventType: EEAEventTypeSchema,

  /**
   * Dot-notation path to the mutated field within the form data structure.
   * Example: 'sectionB.table1_1.topManagement.africanMale'
   *
   * null for form-level events that do not target a specific field
   * (FORM_CREATED, SECTION_COMPLETED, HITL_GATE_*, SUBMITTED, etc.).
   */
  fieldPath: z.string().nullable(),

  /**
   * The field's value immediately before this event was applied.
   * null for FORM_CREATED (no prior state exists) and for any form-level
   * event where field-level diffing is not applicable.
   *
   * Stored as JSON. Zod uses z.unknown() to preserve arbitrary JSON shapes
   * without constraining the schema here; callers should narrow the type
   * using the field-specific schema when reading.
   */
  previousValue: z.unknown().nullable(),

  /**
   * The field's value after this event was applied.
   * null for deletion events or form-level events where no new value exists.
   *
   * Stored as JSON. Same widening rationale as previousValue.
   */
  newValue: z.unknown().nullable(),

  /**
   * Contextual metadata captured by the API layer at event creation time.
   * @see EventMetadataSchema
   */
  metadata: EventMetadataSchema,

  /**
   * Server-generated UTC timestamp of when the event was persisted.
   * z.coerce.date() accepts ISO-8601 strings from JSON deserialization and
   * coerces them to Date instances transparently.
   */
  timestamp: z.coerce.date(),
})

export type EEAEvent = z.infer<typeof EEAEventSchema>
