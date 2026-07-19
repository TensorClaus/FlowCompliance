import {
  OccupationalMatrixSchema,
  RemunerationMatrixSchema,
  type MatrixRow,
  type OccupationalMatrix,
  type RemunerationCell,
  type RemunerationMatrix,
} from '@simplifi/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  computeGridTotals,
  MatrixGrid,
  type GridColumn,
  type GridRow,
  type GridTotalsConfig,
  type MatrixGridMode,
  type PasteWarning,
} from '../../eea/components/matrix-grid'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import {
  EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID,
  prefillSectionC,
  SECTION_C_COLUMN_LABELS,
  SECTION_C_COLUMN_ORDER,
  SECTION_C_DEMO_COLUMN_ORDER,
  SECTION_C_EDITABLE_ROWS,
  SECTION_C_PERMANENT_ROWS,
  SECTION_C_ROW_LABELS,
  SECTION_C_ROW_ORDER,
} from './section-c-prefill'
import { sectionCRemunerationCellAdapter } from './section-c-remuneration-adapter'

const STEP_ID = 'eea4-section-c'
const ZERO_SOURCE = buildZeroOccupationalMatrix()
const COMPUTED_ROWS = new Set<keyof RemunerationMatrix>(['totalPermanent', 'grandTotal'])

const GRID_ROWS: ReadonlyArray<GridRow<keyof RemunerationMatrix>> = SECTION_C_ROW_ORDER.map(
  (key) => ({
    key,
    label: SECTION_C_ROW_LABELS[key],
    computed: COMPUTED_ROWS.has(key),
  }),
)

const GRID_COLUMNS: ReadonlyArray<GridColumn<keyof MatrixRow>> = SECTION_C_COLUMN_ORDER.map(
  (key) => ({
    key,
    label: SECTION_C_COLUMN_LABELS[key],
    computed: key === 'total',
  }),
)

const TOTALS_CONFIG: GridTotalsConfig<keyof RemunerationMatrix, keyof MatrixRow> = {
  demoCols: SECTION_C_DEMO_COLUMN_ORDER,
  totalCol: 'total',
  editableRows: SECTION_C_EDITABLE_ROWS,
  permanentRows: SECTION_C_PERMANENT_ROWS,
  totalPermanentRow: 'totalPermanent',
  temporaryRow: 'temporaryEmployees',
  grandTotalRow: 'grandTotal',
}

export interface SectionCRemunerationProps extends StepProps {
  mode?: MatrixGridMode
  onPasteWarnings?: (warnings: PasteWarning[]) => void
}

function buildZeroOccupationalMatrix(): OccupationalMatrix {
  const row = Object.fromEntries(
    SECTION_C_COLUMN_ORDER.map((colKey) => [colKey, { value: 0 }]),
  ) as MatrixRow

  return Object.fromEntries(
    SECTION_C_ROW_ORDER.map((rowKey) => [rowKey, row]),
  ) as OccupationalMatrix
}

function parseOccupationalMatrix(value: unknown): OccupationalMatrix {
  const parsed = OccupationalMatrixSchema.safeParse(value)
  return parsed.success ? parsed.data : ZERO_SOURCE
}

function parseRemunerationMatrix(value: unknown): RemunerationMatrix | undefined {
  const parsed = RemunerationMatrixSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function computeSectionCTotals(matrix: RemunerationMatrix): RemunerationMatrix {
  return computeGridTotals(matrix, sectionCRemunerationCellAdapter, TOTALS_CONFIG)
}

function normaliseAgainstHeadcount(matrix: RemunerationMatrix): RemunerationMatrix {
  return Object.fromEntries(
    SECTION_C_ROW_ORDER.map((rowKey) => [
      rowKey,
      Object.fromEntries(
        SECTION_C_COLUMN_ORDER.map((colKey) => {
          const cell = matrix[rowKey][colKey]
          return [
            colKey,
            {
              headcount: cell.headcount,
              totalRemuneration:
                cell.headcount === 0 ? 0 : Math.max(0, Math.trunc(cell.totalRemuneration)),
            },
          ]
        }),
      ),
    ]),
  ) as RemunerationMatrix
}

function mergePastePatch(
  current: RemunerationMatrix,
  patch: RemunerationMatrix,
): RemunerationMatrix {
  return Object.fromEntries(
    SECTION_C_ROW_ORDER.map((rowKey) => [
      rowKey,
      Object.fromEntries(
        SECTION_C_COLUMN_ORDER.map((colKey) => {
          const currentCell = current[rowKey][colKey]
          const patchCell = patch[rowKey][colKey]
          return [
            colKey,
            {
              headcount: currentCell.headcount,
              totalRemuneration:
                currentCell.headcount === 0 ? 0 : Math.trunc(patchCell.totalRemuneration),
            },
          ]
        }),
      ),
    ]),
  ) as RemunerationMatrix
}

export function SectionCRemuneration({
  isLocked = false,
  mode,
  onPasteWarnings,
}: SectionCRemunerationProps) {
  const { formState, setStepData } = useWizardFormController()
  const sourceMatrix = parseOccupationalMatrix(
    formState[EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID],
  )
  const sourceSignature = JSON.stringify(sourceMatrix)
  const initialExisting = parseRemunerationMatrix(formState[STEP_ID])

  const [matrix, setMatrix] = useState<RemunerationMatrix>(() =>
    computeSectionCTotals(prefillSectionC(sourceMatrix, initialExisting)),
  )
  const lastSourceSignature = useRef<string | null>(null)

  const flushMatrix = useCallback(
    (next: RemunerationMatrix) => {
      setStepData(STEP_ID, next)
    },
    [setStepData],
  )

  useEffect(() => {
    if (lastSourceSignature.current === sourceSignature) {
      return
    }
    lastSourceSignature.current = sourceSignature
    setMatrix((current) => {
      const next = computeSectionCTotals(prefillSectionC(sourceMatrix, current))
      flushMatrix(next)
      return next
    })
  }, [flushMatrix, sourceMatrix, sourceSignature])

  const errorsByCellPath = useMemo(() => new Map<string, Array<{ severity: 'warning' }>>(), [])

  const handleCellChange = useCallback(
    (rowKey: keyof RemunerationMatrix, colKey: keyof MatrixRow, next: RemunerationCell) => {
      setMatrix((current) => {
        const currentCell = current[rowKey][colKey]
        const updated = normaliseAgainstHeadcount({
          ...current,
          [rowKey]: {
            ...current[rowKey],
            [colKey]: {
              headcount: currentCell.headcount,
              totalRemuneration: next.totalRemuneration,
            },
          },
        })
        return computeSectionCTotals(updated)
      })
    },
    [],
  )

  const handleCellBlur = useCallback(() => {
    flushMatrix(matrix)
  }, [flushMatrix, matrix])

  const handlePaste = useCallback((patch: RemunerationMatrix) => {
    setMatrix((current) =>
      computeSectionCTotals(normaliseAgainstHeadcount(mergePastePatch(current, patch))),
    )
  }, [])

  return (
    <section
      aria-label="Section C - Remuneration by occupational level"
      className="grid gap-4"
      data-testid="eea4-section-c"
    >
      <span className="sr-only" data-testid="eea4-section-c-stub">
        Section C remuneration matrix
      </span>
      <MatrixGrid<keyof RemunerationMatrix, keyof MatrixRow, RemunerationCell>
        adapter={sectionCRemunerationCellAdapter}
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
        readOnlyField={(_colKey, subField) => subField === 'headcount'}
        rows={GRID_ROWS}
        testId="eea4-section-c-matrix"
        {...(onPasteWarnings === undefined ? {} : { onPasteWarnings })}
      />
    </section>
  )
}
