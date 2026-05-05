import type {
  EEAEvent,
  MatrixRow,
  OccupationalMatrix as OccupationalMatrixData,
} from '@simplifi/shared'
import { clsx } from 'clsx'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useEEAAutosave, type UseEEAAutosaveOptions } from '../../hooks/use-eea-autosave'
import { DisabilityFlagBanner } from './DisabilityFlagBanner'
import { computeMatrixTotals } from './totals'
import { validateOccupationalMatrix, type MatrixValidationError } from './validate'

// ---------------------------------------------------------------------------
// Constants — EEA2 Table 1.1 structure
// ---------------------------------------------------------------------------

export const EEA2_ROW_ORDER = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'temporaryEmployees',
  'totalPermanent',
  'grandTotal',
] as const satisfies ReadonlyArray<keyof OccupationalMatrixData>

export const EEA2_ROW_LABELS: Record<(typeof EEA2_ROW_ORDER)[number], string> = {
  topManagement: 'Top management',
  seniorManagement: 'Senior management',
  professionallyQualified:
    'Professionally qualified and experienced specialists and mid-management',
  skilledTechnical:
    'Skilled technical and academically qualified workers, junior management, supervisors, foremen, and superintendents',
  semiSkilled: 'Semi-skilled and discretionary decision-making',
  unskilled: 'Unskilled and defined decision-making',
  temporaryEmployees: 'Temporary employees',
  totalPermanent: 'Total permanent',
  grandTotal: 'Grand total',
}

export const EEA2_DEMO_COLUMN_ORDER = [
  'africanMale',
  'africanFemale',
  'colouredMale',
  'colouredFemale',
  'indianMale',
  'indianFemale',
  'whiteMale',
  'whiteFemale',
  'foreignNationalMale',
  'foreignNationalFemale',
] as const satisfies ReadonlyArray<keyof Omit<MatrixRow, 'total'>>

export const EEA2_COLUMN_ORDER = [...EEA2_DEMO_COLUMN_ORDER, 'total'] as const

export const EEA2_COLUMN_LABELS: Record<(typeof EEA2_COLUMN_ORDER)[number], string> = {
  africanMale: 'African Male',
  africanFemale: 'African Female',
  colouredMale: 'Coloured Male',
  colouredFemale: 'Coloured Female',
  indianMale: 'Indian/Asian Male',
  indianFemale: 'Indian/Asian Female',
  whiteMale: 'White Male',
  whiteFemale: 'White Female',
  foreignNationalMale: 'Foreign National Male',
  foreignNationalFemale: 'Foreign National Female',
  total: 'Total',
}

export const EDITABLE_ROWS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'temporaryEmployees',
] as const satisfies ReadonlyArray<keyof OccupationalMatrixData>

export const CALCULATED_ROWS = ['totalPermanent', 'grandTotal'] as const satisfies ReadonlyArray<
  keyof OccupationalMatrixData
>

const CALCULATED_ROWS_SET = new Set<string>(CALCULATED_ROWS)
const EDITABLE_ROW_INDEX = new Map<string, number>(EDITABLE_ROWS.map((r, i) => [r, i]))
const DEMO_COL_INDEX = new Map<string, number>(EEA2_DEMO_COLUMN_ORDER.map((c, i) => [c, i]))

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OccupationalMatrixHandle {
  disabilityFlagActive: boolean
}

export interface OccupationalMatrixEventContext {
  tenantId: string
  formId: string
  triggeredBy: string
  sessionId: string
}

export interface OccupationalMatrixProps {
  mode: 'view' | 'edit' | 'validate' | 'locked'
  data: OccupationalMatrixData
  isDesignatedEmployer: boolean
  disabilityHeadcount?: number
  onChange?: (updated: OccupationalMatrixData) => void
  onValidationError?: (errors: MatrixValidationError[]) => void
  autosaveOptions?: UseEEAAutosaveOptions
  eventContext?: OccupationalMatrixEventContext
}

// ---------------------------------------------------------------------------
// Lock icon — inline SVG, no external dependency
// ---------------------------------------------------------------------------

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mb-0.5 inline h-3 w-3"
      fill="currentColor"
      viewBox="0 0 12 12"
    >
      <rect height="6" rx="1" width="8" x="2" y="5.5" />
      <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// OccupationalMatrix component
// ---------------------------------------------------------------------------

export const OccupationalMatrix = forwardRef<OccupationalMatrixHandle, OccupationalMatrixProps>(
  function OccupationalMatrixInner(
    {
      mode,
      data,
      isDesignatedEmployer,
      disabilityHeadcount = 0,
      onChange,
      onValidationError,
      autosaveOptions,
      eventContext,
    },
    ref,
  ) {
    const { autosave } = useEEAAutosave(autosaveOptions ?? {})

    // Track value at focus time so the autosave event captures the correct previousValue
    const prevValueOnFocus = useRef<Record<string, number>>({})

    // Stable ref for onValidationError to avoid stale closure in effects
    const onValidationErrorRef = useRef(onValidationError)
    useEffect(() => {
      onValidationErrorRef.current = onValidationError
    })

    // Derive validation errors synchronously — only in validate mode
    const validationErrors = useMemo(() => {
      if (mode !== 'validate') return []
      return validateOccupationalMatrix(data, { isDesignatedEmployer, disabilityHeadcount })
    }, [mode, data, isDesignatedEmployer, disabilityHeadcount])

    // Propagate validation errors to caller
    useEffect(() => {
      if (mode !== 'validate') return
      onValidationErrorRef.current?.(validationErrors)
    }, [mode, validationErrors])

    // Scroll to first error cell when validate mode activates
    useEffect(() => {
      if (mode !== 'validate' || validationErrors.length === 0) return
      const first = validationErrors.find((e) => e.cellPath)
      if (!first?.cellPath) return
      const el = document.querySelector(`[data-cell="${first.cellPath}"]`)
      el?.scrollIntoView({ block: 'center' })
    }, [mode, validationErrors])

    // Disability flag: show when designated employer and disability headcount < 3% of grand total
    const grandTotalHeadcount = data.grandTotal.total.value
    const disabilityPct =
      grandTotalHeadcount > 0 ? (disabilityHeadcount / grandTotalHeadcount) * 100 : 0
    const disabilityFlagActive =
      isDesignatedEmployer && grandTotalHeadcount > 0 && disabilityPct < 3

    useImperativeHandle(ref, () => ({ disabilityFlagActive }), [disabilityFlagActive])

    // Build a lookup map for validation errors by cell path
    const errorsByCellPath = useMemo(() => {
      const map = new Map<string, MatrixValidationError[]>()
      for (const err of validationErrors) {
        if (!err.cellPath) continue
        const existing = map.get(err.cellPath) ?? []
        existing.push(err)
        map.set(err.cellPath, existing)
      }
      return map
    }, [validationErrors])

    const handleCellChange = useCallback(
      (rowKey: keyof OccupationalMatrixData, colKey: keyof MatrixRow, rawValue: number) => {
        const safeVal = Number.isFinite(rawValue) && rawValue >= 0 ? Math.floor(rawValue) : 0
        const updatedRow = { ...data[rowKey], [colKey]: { value: safeVal } }
        const updated = computeMatrixTotals({
          ...data,
          [rowKey]: updatedRow,
        } as OccupationalMatrixData)
        onChange?.(updated)
      },
      [data, onChange],
    )

    const handleCellBlur = useCallback(
      (rowKey: string, colKey: string) => {
        if (!eventContext) return
        const cellKey = `${rowKey}.${colKey}`
        const prevVal = prevValueOnFocus.current[cellKey] ?? 0
        const newVal = data[rowKey as keyof OccupationalMatrixData][colKey as keyof MatrixRow].value
        // Reset stored prevVal to current value (no delete — handleCellFocus overwrites on next focus)
        prevValueOnFocus.current[cellKey] = newVal
        if (prevVal === newVal) return

        const event: EEAEvent = {
          eventId: crypto.randomUUID(),
          tenantId: eventContext.tenantId,
          formType: 'EEA2',
          formId: eventContext.formId,
          eventType: 'FIELD_UPDATED',
          fieldPath: `sectionB.table1_1.${rowKey}.${colKey}`,
          previousValue: prevVal,
          newValue: newVal,
          metadata: {
            reason: 'manual_edit',
            triggeredBy: eventContext.triggeredBy,
            ip: '0.0.0.0',
            userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
            sessionId: eventContext.sessionId,
          },
          timestamp: new Date(),
        }
        void autosave(event)
      },
      [data, eventContext, autosave],
    )

    const handleCellFocus = useCallback((rowKey: string, colKey: string, currentValue: number) => {
      prevValueOnFocus.current[`${rowKey}.${colKey}`] = currentValue
    }, [])

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>, editableRowIdx: number, demoColIdx: number) => {
        e.preventDefault()
        const tsv = e.clipboardData.getData('text/plain')
        const tsvRows = tsv.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim().split('\n')

        const pasteWarnings: MatrixValidationError[] = []
        let updated = { ...data }

        for (const [r, tsvRow] of tsvRows.entries()) {
          for (const [c, rawCellStr] of tsvRow.split('\t').entries()) {
            const targetRowIdx = editableRowIdx + r
            const targetColIdx = demoColIdx + c
            if (targetRowIdx >= EDITABLE_ROWS.length) break
            if (targetColIdx >= EEA2_DEMO_COLUMN_ORDER.length) break

            const rowKey = EDITABLE_ROWS[targetRowIdx]
            const colKey = EEA2_DEMO_COLUMN_ORDER[targetColIdx]
            if (rowKey === undefined || colKey === undefined) continue

            const rawVal = rawCellStr.trim()
            const numVal = Number(rawVal)
            const isValid =
              rawVal !== '' && Number.isFinite(numVal) && Number.isInteger(numVal) && numVal >= 0
            const cellValue = isValid ? numVal : 0

            if (!isValid && rawVal !== '') {
              pasteWarnings.push({
                code: 'PASTE_NON_NUMERIC',
                cellPath: `${rowKey}.${colKey}`,
                severity: 'warning',
                message: `Non-numeric value "${rawVal}" replaced with 0 during paste.`,
              })
            }

            updated = {
              ...updated,
              [rowKey]: { ...updated[rowKey], [colKey]: { value: cellValue } },
            }
          }
        }

        if (pasteWarnings.length > 0) {
          onValidationError?.(pasteWarnings)
        }
        onChange?.(computeMatrixTotals(updated as OccupationalMatrixData))
      },
      [data, onChange, onValidationError],
    )

    const isEditInteractive = mode === 'edit' || mode === 'validate'

    return (
      <div
        aria-disabled={mode === 'locked' ? 'true' : undefined}
        className={clsx('overflow-x-auto', mode === 'locked' && 'pointer-events-none opacity-75')}
        data-testid="occupational-matrix"
      >
        {disabilityFlagActive && (
          <DisabilityFlagBanner
            headcount={disabilityHeadcount}
            percentage={disabilityPct}
            total={grandTotalHeadcount}
          />
        )}

        <table className="w-full border-collapse text-xs" role="grid">
          <thead>
            <tr>
              <th className="border border-slate-300 bg-slate-50 px-2 py-1 text-left font-semibold">
                Occupational level
              </th>
              {EEA2_COLUMN_ORDER.map((col) => (
                <th
                  className="border border-slate-300 bg-slate-50 px-2 py-1 text-center font-semibold"
                  key={col}
                  scope="col"
                >
                  {mode === 'locked' && <LockIcon />} {EEA2_COLUMN_LABELS[col]}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {EEA2_ROW_ORDER.map((rowKey) => {
              const isCalculated = CALCULATED_ROWS_SET.has(rowKey)
              const editableRowIdx = EDITABLE_ROW_INDEX.get(rowKey) ?? -1

              return (
                <tr
                  className={clsx(
                    isCalculated && 'bg-slate-50 font-semibold',
                    mode === 'locked' && 'bg-slate-100',
                  )}
                  key={rowKey}
                >
                  <td className="border border-slate-300 px-2 py-1">{EEA2_ROW_LABELS[rowKey]}</td>

                  {EEA2_COLUMN_ORDER.map((colKey) => {
                    const isTotal = colKey === 'total'
                    const showInput = isEditInteractive && !isCalculated && !isTotal
                    const cell = data[rowKey][colKey as keyof MatrixRow]
                    const cellPath = `${rowKey}.${colKey}`
                    const cellErrors = errorsByCellPath.get(cellPath) ?? []
                    const hasError = cellErrors.some((e) => e.severity === 'error')
                    const hasWarning = !hasError && cellErrors.some((e) => e.severity === 'warning')
                    const demoColIdx = DEMO_COL_INDEX.get(colKey) ?? -1

                    return (
                      <td
                        className={clsx(
                          'border border-slate-300 px-1 py-0.5 text-center',
                          (isCalculated || isTotal) && 'bg-slate-50',
                          mode === 'locked' && 'bg-slate-100',
                          hasError && 'cell--error bg-red-50',
                          hasWarning && 'cell--warning bg-amber-50',
                        )}
                        data-cell={cellPath}
                        key={colKey}
                      >
                        {showInput ? (
                          <input
                            aria-invalid={hasError || undefined}
                            className={clsx(
                              'w-14 rounded border px-1 py-0.5 text-center text-xs',
                              hasError
                                ? 'border-red-400 bg-red-50'
                                : hasWarning
                                  ? 'border-amber-400 bg-amber-50'
                                  : 'border-slate-300',
                            )}
                            min={0}
                            onBlur={() => {
                              handleCellBlur(rowKey, colKey)
                            }}
                            onChange={(e) => {
                              handleCellChange(
                                rowKey as keyof OccupationalMatrixData,
                                colKey as keyof MatrixRow,
                                e.target.valueAsNumber,
                              )
                            }}
                            onFocus={() => {
                              handleCellFocus(rowKey, colKey, cell.value)
                            }}
                            onPaste={(e) => {
                              if (editableRowIdx >= 0 && demoColIdx >= 0) {
                                handlePaste(e, editableRowIdx, demoColIdx)
                              }
                            }}
                            step={1}
                            type="number"
                            value={cell.value}
                          />
                        ) : (
                          <span>{cell.value}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  },
)
