import {
  CROSS_FORM_RULES,
  evaluateRules,
  OccupationalMatrixSchema,
  RemBreakdownMatrixSchema,
  type MatrixRow,
  type OccupationalMatrix,
  type RemBreakdownCell,
  type RemBreakdownMatrix,
  type RemBreakdownRow,
  type ValidationRule,
} from '@simplifi/shared'
import { clsx } from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  computeGridTotals,
  MatrixGrid,
  remBreakdownCellAdapter,
  type CellAdapter,
  type GridColumn,
  type GridRow,
  type GridTotalsConfig,
  type MatrixGridMode,
  type PasteWarning,
} from '../../eea/components/matrix-grid'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import { singleEmployeeRows } from './d-section-rules'
import { parseIntegerZarToken } from './rem-zar-paste'
import {
  EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID,
  SECTION_C_COLUMN_LABELS,
  SECTION_C_COLUMN_ORDER,
  SECTION_C_DEMO_COLUMN_ORDER,
  SECTION_C_EDITABLE_ROWS,
  SECTION_C_PERMANENT_ROWS,
  SECTION_C_ROW_LABELS,
  SECTION_C_ROW_ORDER,
} from './section-c-prefill'

type DSectionId = 'eea4-section-d1' | 'eea4-section-d2'
type DSectionKey = 'sectionD1' | 'sectionD2'
type DRowKey = keyof RemBreakdownMatrix
type DColKey = keyof RemBreakdownRow
type DRuleSeverity = 'error' | 'warning'

const ZERO_SOURCE = buildZeroOccupationalMatrix()
const D_SUB_FIELDS = ['fixed', 'variable'] as const
const SINGLE_EMPLOYEE_TITLE = 'Single employee at this level captured in D1 only.'
const VALIDATION_RULE = findDValidationRule()
const COMPUTED_ROWS = new Set<DRowKey>(['totalPermanent', 'grandTotal'])

const GRID_ROWS: ReadonlyArray<GridRow<DRowKey>> = SECTION_C_ROW_ORDER.map((key) => ({
  key,
  label: SECTION_C_ROW_LABELS[key],
  computed: COMPUTED_ROWS.has(key),
}))

const GRID_COLUMNS: ReadonlyArray<GridColumn<DColKey>> = SECTION_C_COLUMN_ORDER.map((key) => ({
  key,
  label: SECTION_C_COLUMN_LABELS[key],
  computed: key === 'total',
}))

const TOTALS_CONFIG: GridTotalsConfig<DRowKey, DColKey> = {
  demoCols: SECTION_C_DEMO_COLUMN_ORDER,
  totalCol: 'total',
  editableRows: SECTION_C_EDITABLE_ROWS,
  permanentRows: SECTION_C_PERMANENT_ROWS,
  totalPermanentRow: 'totalPermanent',
  temporaryRow: 'temporaryEmployees',
  grandTotalRow: 'grandTotal',
}

export interface SectionDProps extends StepProps {
  mode?: MatrixGridMode
  onPasteWarnings?: (warnings: PasteWarning[]) => void
}

function findDValidationRule(): ValidationRule {
  const rule = CROSS_FORM_RULES.find(
    (candidate) => candidate.ruleId === 'xform:eea4-highpaid-gte-lowpaid',
  )
  if (rule === undefined) {
    throw new Error('Missing xform:eea4-highpaid-gte-lowpaid rule')
  }
  return rule
}

function buildZeroOccupationalMatrix(): OccupationalMatrix {
  const row = Object.fromEntries(
    SECTION_C_COLUMN_ORDER.map((colKey) => [colKey, { value: 0 }]),
  ) as MatrixRow

  return Object.fromEntries(
    SECTION_C_ROW_ORDER.map((rowKey) => [rowKey, row]),
  ) as OccupationalMatrix
}

function buildZeroBreakdownMatrix(): RemBreakdownMatrix {
  return Object.fromEntries(
    SECTION_C_ROW_ORDER.map((rowKey) => [
      rowKey,
      Object.fromEntries(
        SECTION_C_COLUMN_ORDER.map((colKey) => [colKey, remBreakdownCellAdapter.zero()]),
      ),
    ]),
  ) as RemBreakdownMatrix
}

function parseOccupationalMatrix(value: unknown): OccupationalMatrix {
  const parsed = OccupationalMatrixSchema.safeParse(value)
  return parsed.success ? parsed.data : ZERO_SOURCE
}

function parseBreakdownMatrix(value: unknown): RemBreakdownMatrix | undefined {
  const parsed = RemBreakdownMatrixSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function readBreakdownMatrix(value: unknown): RemBreakdownMatrix {
  return parseBreakdownMatrix(value) ?? buildZeroBreakdownMatrix()
}

function computeBreakdownTotals(matrix: RemBreakdownMatrix): RemBreakdownMatrix {
  return computeGridTotals(matrix, remBreakdownCellAdapter, TOTALS_CONFIG)
}

function normaliseCell(cell: RemBreakdownCell): RemBreakdownCell {
  const fixed = Math.max(0, Math.trunc(cell.fixed))
  const variable = Math.max(0, Math.trunc(cell.variable))
  return { fixed, variable, total: fixed + variable }
}

function normaliseBreakdownMatrix(
  matrix: RemBreakdownMatrix,
  lockedRows: ReadonlySet<DRowKey>,
): RemBreakdownMatrix {
  return Object.fromEntries(
    SECTION_C_ROW_ORDER.map((rowKey) => [
      rowKey,
      Object.fromEntries(
        SECTION_C_COLUMN_ORDER.map((colKey) => {
          const cell = lockedRows.has(rowKey)
            ? remBreakdownCellAdapter.zero()
            : matrix[rowKey][colKey]
          return [colKey, normaliseCell(cell)]
        }),
      ),
    ]),
  ) as RemBreakdownMatrix
}

function mergePastePatch(
  current: RemBreakdownMatrix,
  patch: RemBreakdownMatrix,
  lockedRows: ReadonlySet<DRowKey>,
): RemBreakdownMatrix {
  return Object.fromEntries(
    SECTION_C_ROW_ORDER.map((rowKey) => [
      rowKey,
      Object.fromEntries(
        SECTION_C_COLUMN_ORDER.map((colKey) => {
          const cell = lockedRows.has(rowKey)
            ? remBreakdownCellAdapter.zero()
            : patch[rowKey][colKey]
          return [colKey, normaliseCell(cell)]
        }),
      ),
    ]),
  ) as RemBreakdownMatrix
}

function stripDPath(path: string | null, sectionKey: DSectionKey): string | null {
  const prefix = `${sectionKey}.`
  if (path === null || !path.startsWith(prefix) || !path.endsWith('.total')) {
    return null
  }
  return path.slice(prefix.length, -'.total'.length)
}

function buildErrorsByCellPath({
  formId,
  sectionKey,
  d1,
  d2,
}: {
  formId: string
  sectionKey: DSectionKey
  d1: RemBreakdownMatrix
  d2: RemBreakdownMatrix
}): Map<string, Array<{ severity: DRuleSeverity }>> {
  const report = evaluateRules(
    [VALIDATION_RULE],
    { EEA4: { id: formId, report: { sectionD1: d1, sectionD2: d2 } } },
    { clock: () => new Date(), reportId: `${formId}:section-d` },
  )
  const map = new Map<string, Array<{ severity: DRuleSeverity }>>()

  for (const result of report.rules) {
    if (result.passed || (result.severity !== 'error' && result.severity !== 'warning')) {
      continue
    }
    const cellPath = stripDPath(
      sectionKey === 'sectionD1' ? result.sourcePath : result.targetPath,
      sectionKey,
    )
    if (cellPath === null) {
      continue
    }
    map.set(cellPath, [...(map.get(cellPath) ?? []), { severity: result.severity }])
  }

  return map
}

function createSectionDCellAdapter(
  lockedRows: ReadonlySet<DRowKey>,
): CellAdapter<RemBreakdownCell> {
  return {
    ...remBreakdownCellAdapter,
    subFields: D_SUB_FIELDS,

    parseTokens(tokens) {
      const fixed = parseIntegerZarToken(tokens[0] ?? '')
      const variable = parseIntegerZarToken(tokens[1] ?? '')
      const fixedValue = fixed.value
      const variableValue = variable.value
      return {
        cell: { fixed: fixedValue, variable: variableValue, total: fixedValue + variableValue },
        warnings: [...fixed.warnings, ...variable.warnings] as PasteWarning[],
      }
    },

    render(context, value) {
      const rowKey = context.cellPath.split('.')[0] as DRowKey | undefined
      const rowLocked = rowKey !== undefined && lockedRows.has(rowKey)
      const cell = rowLocked ? remBreakdownCellAdapter.zero() : normaliseCell(value)
      const isEditInteractive = context.mode === 'edit' || context.mode === 'validate'
      const inputClass = clsx(
        'w-14 rounded border px-1 py-0.5 text-center text-xs',
        context.hasError && 'border-red-400 bg-red-50',
        !context.hasError && context.hasWarning && 'border-amber-400 bg-amber-50',
        !context.hasError && !context.hasWarning && 'border-slate-300',
      )

      return (
        <span className="inline-flex gap-1">
          {D_SUB_FIELDS.map((subField) => {
            const readOnly = rowLocked || !isEditInteractive || context.readOnlyField(subField)
            const raw = cell[subField]

            if (readOnly) {
              return (
                <span
                  data-subfield={subField}
                  data-testid="matrix-cell"
                  key={subField}
                  title={rowLocked ? SINGLE_EMPLOYEE_TITLE : undefined}
                >
                  {raw}
                </span>
              )
            }

            return (
              <input
                aria-invalid={context.hasError || undefined}
                className={inputClass}
                data-subfield={subField}
                disabled={context.disabled}
                key={subField}
                min={0}
                onBlur={() => {
                  context.onSubFieldBlur(subField)
                }}
                onChange={(event) => {
                  const next = event.target.valueAsNumber
                  const safe = Number.isFinite(next) && next >= 0 ? Math.trunc(next) : 0
                  const updated = normaliseCell({ ...cell, [subField]: safe })
                  context.onSubFieldChange(subField, updated)
                }}
                onFocus={() => {
                  context.onSubFieldFocus(subField)
                }}
                onPaste={(event) => {
                  context.onPaste(event, subField)
                }}
                step={1}
                type="number"
                value={raw}
              />
            )
          })}
          <span data-subfield="total" data-testid="matrix-cell-total">
            {cell.fixed + cell.variable}
          </span>
        </span>
      )
    },
  }
}

export function SectionDMatrix({
  isLocked = false,
  mode,
  onPasteWarnings,
  formId,
  sectionId,
  sectionKey,
  counterpartId,
  testId,
  label,
  lockSingleEmployeeRows,
}: SectionDProps & {
  sectionId: DSectionId
  sectionKey: DSectionKey
  counterpartId: DSectionId
  testId: string
  label: string
  lockSingleEmployeeRows: boolean
}) {
  const { formState, setStepData } = useWizardFormController()
  const sourceMatrix = parseOccupationalMatrix(
    formState[EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID],
  )
  const sourceSignature = JSON.stringify(sourceMatrix)
  const lockedRows = useMemo(
    () => (lockSingleEmployeeRows ? singleEmployeeRows(sourceMatrix) : new Set<DRowKey>()),
    [lockSingleEmployeeRows, sourceMatrix],
  )
  const lockedSignature = useMemo(() => [...lockedRows].sort().join('|'), [lockedRows])
  const initialExisting = parseBreakdownMatrix(formState[sectionId])

  const [matrix, setMatrix] = useState<RemBreakdownMatrix>(() =>
    computeBreakdownTotals(
      normaliseBreakdownMatrix(initialExisting ?? buildZeroBreakdownMatrix(), lockedRows),
    ),
  )
  const lastSourceSignature = useRef<string | null>(null)

  const flushMatrix = useCallback(
    (next: RemBreakdownMatrix) => {
      setStepData(sectionId, next)
    },
    [sectionId, setStepData],
  )

  useEffect(() => {
    const signature = `${sourceSignature}:${lockedSignature}`
    if (lastSourceSignature.current === signature) {
      return
    }
    lastSourceSignature.current = signature
    setMatrix((current) => {
      const next = computeBreakdownTotals(normaliseBreakdownMatrix(current, lockedRows))
      flushMatrix(next)
      return next
    })
  }, [flushMatrix, lockedRows, lockedSignature, sourceSignature])

  const adapter = useMemo(() => createSectionDCellAdapter(lockedRows), [lockedRows])

  const errorsByCellPath = useMemo(() => {
    const effectiveMode = isLocked ? 'locked' : (mode ?? 'edit')
    if (effectiveMode !== 'validate') {
      return new Map<string, Array<{ severity: DRuleSeverity }>>()
    }
    const counterpart = readBreakdownMatrix(formState[counterpartId])
    const d1 = sectionKey === 'sectionD1' ? matrix : counterpart
    const d2 = sectionKey === 'sectionD2' ? matrix : counterpart
    return buildErrorsByCellPath({ formId, sectionKey, d1, d2 })
  }, [counterpartId, formId, formState, isLocked, matrix, mode, sectionKey])

  const handleCellChange = useCallback(
    (rowKey: DRowKey, colKey: DColKey, next: RemBreakdownCell) => {
      setMatrix((current) => {
        const updated = normaliseBreakdownMatrix(
          {
            ...current,
            [rowKey]: {
              ...current[rowKey],
              [colKey]: normaliseCell(next),
            },
          },
          lockedRows,
        )
        return computeBreakdownTotals(updated)
      })
    },
    [lockedRows],
  )

  const handleCellBlur = useCallback(() => {
    flushMatrix(matrix)
  }, [flushMatrix, matrix])

  const handlePaste = useCallback(
    (patch: RemBreakdownMatrix) => {
      setMatrix((current) =>
        computeBreakdownTotals(
          normaliseBreakdownMatrix(mergePastePatch(current, patch, lockedRows), lockedRows),
        ),
      )
    },
    [lockedRows],
  )

  return (
    <section aria-label={label} className="grid gap-4" data-testid={testId}>
      <MatrixGrid<DRowKey, DColKey, RemBreakdownCell>
        adapter={adapter}
        columnHeaderLabel="Occupational level"
        columns={GRID_COLUMNS}
        data={matrix}
        disabled={isLocked}
        editableColumns={SECTION_C_DEMO_COLUMN_ORDER}
        editableRows={SECTION_C_EDITABLE_ROWS}
        errorsByCellPath={errorsByCellPath}
        mode={isLocked ? 'locked' : (mode ?? 'edit')}
        onCellBlur={handleCellBlur}
        onCellChange={handleCellChange}
        onPaste={handlePaste}
        readOnlyField={() => false}
        rows={GRID_ROWS}
        testId={`${testId}-matrix`}
        {...(onPasteWarnings === undefined ? {} : { onPasteWarnings })}
      />
    </section>
  )
}

export function SectionD1HighestPaid(props: SectionDProps) {
  return (
    <SectionDMatrix
      {...props}
      counterpartId="eea4-section-d2"
      label="Section D1 - Highest-paid employees"
      lockSingleEmployeeRows={false}
      sectionId="eea4-section-d1"
      sectionKey="sectionD1"
      testId="eea4-section-d1"
    />
  )
}
