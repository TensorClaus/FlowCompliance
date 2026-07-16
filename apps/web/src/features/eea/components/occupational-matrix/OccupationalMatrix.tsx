import type {
  EEAEvent,
  MatrixCell,
  MatrixRow,
  OccupationalMatrix as OccupationalMatrixData,
} from '@simplifi/shared'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useEEAAutosave, type UseEEAAutosaveOptions } from '../../hooks/use-eea-autosave'
import { MatrixGrid, singleValueCellAdapter, type GridColumn, type GridRow } from '../matrix-grid'
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

// Row / column descriptors for MatrixGrid (labels + computed flags)
const GRID_ROWS: ReadonlyArray<GridRow<keyof OccupationalMatrixData>> = EEA2_ROW_ORDER.map(
  (key) => ({
    key,
    label: EEA2_ROW_LABELS[key],
    computed: CALCULATED_ROWS_SET.has(key),
  }),
)

const GRID_COLUMNS: ReadonlyArray<GridColumn<keyof MatrixRow>> = EEA2_COLUMN_ORDER.map((key) => ({
  key,
  label: EEA2_COLUMN_LABELS[key],
  computed: key === 'total',
}))

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
  disabled?: boolean
  disabilityHeadcount?: number
  onChange?: (updated: OccupationalMatrixData) => void
  onValidationError?: (
    errors: MatrixValidationError[],
    context?: { disabilityFlagActive: boolean },
  ) => void
  autosaveOptions?: UseEEAAutosaveOptions
  eventContext?: OccupationalMatrixEventContext
}

// ---------------------------------------------------------------------------
// OccupationalMatrix — thin wrapper over MatrixGrid + singleValueCellAdapter
// ---------------------------------------------------------------------------

export const OccupationalMatrix = forwardRef<OccupationalMatrixHandle, OccupationalMatrixProps>(
  function OccupationalMatrixInner(
    {
      mode,
      data,
      isDesignatedEmployer,
      disabled = false,
      disabilityHeadcount = 0,
      onChange,
      onValidationError,
      autosaveOptions,
      eventContext,
    },
    ref,
  ) {
    const { autosave, isSaving } = useEEAAutosave(autosaveOptions ?? {})

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

    // Disability flag: show when designated employer and disability headcount < 3% of grand total
    const grandTotalHeadcount = data.grandTotal.total.value
    const disabilityPct =
      grandTotalHeadcount > 0 ? (disabilityHeadcount / grandTotalHeadcount) * 100 : 0
    const disabilityFlagActive =
      isDesignatedEmployer && grandTotalHeadcount > 0 && disabilityPct < 3

    useImperativeHandle(ref, () => ({ disabilityFlagActive }), [disabilityFlagActive])

    // Propagate validation errors to caller
    useEffect(() => {
      if (mode !== 'validate') return
      onValidationErrorRef.current?.(validationErrors, { disabilityFlagActive })
    }, [mode, validationErrors])

    // Scroll to first error cell when validate mode activates
    useEffect(() => {
      if (mode !== 'validate' || validationErrors.length === 0) return
      const first = validationErrors.find((e) => e.cellPath)
      if (!first?.cellPath) return
      const el = document.querySelector(`[data-cell="${first.cellPath}"]`)
      el?.scrollIntoView({ block: 'center' })
    }, [mode, validationErrors])

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
      (rowKey: keyof OccupationalMatrixData, colKey: keyof MatrixRow, next: MatrixCell) => {
        const updatedRow = { ...data[rowKey], [colKey]: next }
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

    const handleCellFocus = useCallback(
      (rowKey: string, colKey: string) => {
        const currentValue =
          data[rowKey as keyof OccupationalMatrixData][colKey as keyof MatrixRow].value
        prevValueOnFocus.current[`${rowKey}.${colKey}`] = currentValue
      },
      [data],
    )

    const handlePaste = useCallback(
      (patch: OccupationalMatrixData) => {
        onChange?.(computeMatrixTotals(patch))
      },
      [onChange],
    )

    const savingIndicator = isSaving ? (
      <span className="block pb-2 text-xs font-medium text-amber-700" data-testid="save-pending">
        Saving
      </span>
    ) : null

    const banner = disabilityFlagActive ? (
      <DisabilityFlagBanner
        headcount={disabilityHeadcount}
        percentage={disabilityPct}
        total={grandTotalHeadcount}
      />
    ) : null

    return (
      <MatrixGrid<keyof OccupationalMatrixData, keyof MatrixRow, MatrixCell>
        adapter={singleValueCellAdapter}
        banner={banner}
        columns={GRID_COLUMNS}
        data={data}
        disabled={disabled}
        editableColumns={EEA2_DEMO_COLUMN_ORDER}
        editableRows={EDITABLE_ROWS}
        errorsByCellPath={errorsByCellPath}
        mode={mode}
        onCellBlur={handleCellBlur}
        onCellChange={handleCellChange}
        onCellFocus={handleCellFocus}
        onPaste={handlePaste}
        onPasteWarnings={(warnings) => {
          onValidationError?.(warnings)
        }}
        rows={GRID_ROWS}
        savingIndicator={savingIndicator}
      />
    )
  },
)
