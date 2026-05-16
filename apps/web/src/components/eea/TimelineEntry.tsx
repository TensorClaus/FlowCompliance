import { PII_FIELD_PATHS } from '@simplifi/shared/eea/pii-fields'
import { type ReactElement } from 'react'
import { cn } from '@/lib/utils'

// Client-side PII guard — defence-in-depth on top of server-side stripping.
// If a fieldPath is in the PII registry, we display a placeholder rather than
// the raw path name, preventing accidental exposure in the audit timeline.
const PII_PATH_SET = new Set<string>(PII_FIELD_PATHS)

function safeFieldPath(fieldPath: string | null): string | null {
  if (fieldPath === null) return null
  return PII_PATH_SET.has(fieldPath) ? '[Protected field]' : fieldPath
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineEntryProps {
  eventId: string
  eventType: string
  fieldPath: string | null
  timestamp: string
  triggeredBy: string
  onViewSnapshot?: (eventId: string) => void
}

// ---------------------------------------------------------------------------
// TimelineEntry
//
// A single row in the EEA audit event timeline. Renders event metadata and
// exposes a "View snapshot" action that calls onViewSnapshot with the eventId,
// allowing the parent to open the SnapshotDrawer for point-in-time replay.
// ---------------------------------------------------------------------------

export function TimelineEntry({
  eventId,
  eventType,
  fieldPath,
  timestamp,
  triggeredBy,
  onViewSnapshot,
}: TimelineEntryProps): ReactElement {
  return (
    <li
      className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
      data-testid={`timeline-entry-${eventId}`}
    >
      <span className="sr-only" data-testid="timeline-entry">
        Audit timeline entry
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-medium text-slate-900">{eventType}</span>
        {fieldPath !== null && (
          <span className="truncate text-xs text-slate-500">{safeFieldPath(fieldPath)}</span>
        )}
        <span className="text-xs text-slate-400">
          {new Date(timestamp).toLocaleString()} — {triggeredBy}
        </span>
      </div>

      {onViewSnapshot !== undefined && (
        <button
          className={cn(
            'shrink-0 self-start rounded-md border border-slate-300 px-3 py-1.5',
            'text-xs font-medium text-slate-700 whitespace-nowrap',
            'hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
          )}
          data-testid={`view-snapshot-${eventId}`}
          onClick={() => {
            onViewSnapshot(eventId)
          }}
          type="button"
        >
          View snapshot
        </button>
      )}
    </li>
  )
}
