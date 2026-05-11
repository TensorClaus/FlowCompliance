import type { EEAEvent } from '@simplifi/shared'
import { FIELD_LABELS, PII_FIELD_PATHS } from '@simplifi/shared'
import { cn } from '../../lib/utils'

const PROTECTED_PLACEHOLDER = '[Protected field]'

/**
 * formatRelativeTime — relative timestamp without date-fns dependency.
 * Returns a human-readable string like "3 minutes ago" or "2 days ago".
 */
function formatRelativeTime(date: Date): string {
  const nowMs = Date.now()
  const diffMs = nowMs - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 60) return 'less than a minute ago'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${String(diffMinutes)} minute${diffMinutes === 1 ? '' : 's'} ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${String(diffHours)} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${String(diffDays)} day${diffDays === 1 ? '' : 's'} ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${String(diffMonths)} month${diffMonths === 1 ? '' : 's'} ago`
  const diffYears = Math.floor(diffMonths / 12)
  return `${String(diffYears)} year${diffYears === 1 ? '' : 's'} ago`
}

/**
 * safeStringify — converts an unknown field value to a display string.
 * Avoids rendering [object Object] for complex values.
 */
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

interface TimelineEntryProps {
  event: EEAEvent
  onViewSnapshot?: (eventId: string) => void
}

/**
 * TimelineEntry — renders a single audit event row in the AuditHistoryPanel.
 *
 * PII GUARD: if fieldPath is in PII_FIELD_PATHS, both prevValue and newValue
 * are unconditionally replaced with PROTECTED_PLACEHOLDER. This is a
 * compliance control — there is no prop, environment variable, or code path
 * that bypasses it.
 */
export function TimelineEntry({ event, onViewSnapshot }: TimelineEntryProps): React.ReactElement {
  const { eventType, fieldPath, previousValue, newValue, timestamp, metadata } = event

  const isoTimestamp = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp)
  const relativeTime = formatRelativeTime(
    timestamp instanceof Date ? timestamp : new Date(timestamp),
  )

  // Strip email addresses from userName to avoid rendering PII.
  // metadata.triggeredBy is a userId; we display it but ensure no @ symbol
  // appears (userId should never be an email, but this is a hard guard).
  const displayUser = metadata.triggeredBy.includes('@')
    ? metadata.triggeredBy.split('@')[0]
    : metadata.triggeredBy

  const fieldLabel = fieldPath === null ? null : (FIELD_LABELS[fieldPath] ?? fieldPath)

  // PII GUARD — unconditional; no bypass
  const isPiiField = fieldPath !== null && PII_FIELD_PATHS.includes(fieldPath)
  const displayPrev = isPiiField ? PROTECTED_PLACEHOLDER : safeStringify(previousValue)
  const displayNext = isPiiField ? PROTECTED_PLACEHOLDER : safeStringify(newValue)

  const hasDiff = fieldPath !== null && (previousValue !== null || newValue !== null)

  return (
    <li
      className={cn(
        'flex flex-col gap-1 rounded-md border border-slate-100 bg-white px-4 py-3',
        'transition-colors hover:bg-slate-50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            'bg-slate-100 text-slate-700',
          )}
        >
          {eventType}
        </span>
        <time
          className="shrink-0 text-xs text-slate-400"
          dateTime={isoTimestamp}
          title={isoTimestamp}
        >
          {relativeTime}
        </time>
      </div>

      {fieldLabel !== null && <p className="text-sm font-medium text-slate-800">{fieldLabel}</p>}

      {hasDiff && (
        <p className="break-all text-xs text-slate-600">
          <span className="line-through text-red-500">{displayPrev}</span>
          <span className="mx-1 text-slate-400">→</span>
          <span className="text-emerald-600">{displayNext}</span>
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">by {displayUser}</p>
        {onViewSnapshot !== undefined && (
          <button
            type="button"
            onClick={() => {
              onViewSnapshot(event.eventId)
            }}
            className={cn(
              'rounded px-2 py-0.5 text-xs font-medium',
              'text-slate-500 hover:text-slate-700',
              'border border-slate-200 hover:bg-slate-50',
              'transition-colors',
            )}
          >
            View snapshot
          </button>
        )}
      </div>
    </li>
  )
}
