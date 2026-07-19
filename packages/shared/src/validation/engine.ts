import type { FormType } from '../enums.js'
import {
  type DerivedFormMeta,
  type ValidationReport,
  ValidationReportSchema,
  type ValidationResult,
  type ValidationRule,
} from '../schemas/validation-rules.js'

type RuleDocs = {
  EEA2?: unknown
  EEA4?: unknown
}

type EvaluateRulesOptions = {
  clock: () => Date
  reportId: string
}

type SupportedFormType = Extract<FormType, 'EEA2' | 'EEA4'>

type FormView = {
  id?: string
  report?: Record<string, unknown>
  wrapper?: Record<string, unknown>
}

type ResolvedPair = {
  sourcePath: string
  targetPath: string | null
  sourceValue: unknown
  targetValue: unknown
}

const OCCUPATIONAL_LEVELS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'totalPermanent',
  'temporaryEmployees',
  'grandTotal',
] as const

const MATRIX_ROW_KEYS = [
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
  'total',
] as const

export class EngineError extends Error {
  constructor(
    message: string,
    readonly ruleId?: string,
    readonly path?: string,
  ) {
    super(message)
    this.name = 'EngineError'
  }
}

export function evaluateRules(
  rules: ValidationRule[],
  docs: RuleDocs,
  opts: EvaluateRulesOptions,
): ValidationReport {
  const forms = buildFormViews(docs)
  const meta: Record<SupportedFormType, DerivedFormMeta> = {
    EEA2: materialiseMeta('EEA2', forms.EEA2),
    EEA4: materialiseMeta('EEA4', forms.EEA4),
  }
  const generatedAt = opts.clock()
  const results: ValidationResult[] = []

  for (const rule of rules) {
    validateRulePaths(rule)
    const ruleResults = evaluateRule(rule, forms, meta, generatedAt)
    results.push(...ruleResults)

    if (rule.ruleId === 'xform:eea2-eea4-headcount') {
      meta.EEA4.headcountValidationPassed =
        ruleResults.length > 0 && ruleResults.every((result) => result.passed)
    }
  }

  const errorCount = results.filter(
    (result) => result.severity === 'error' && !result.passed,
  ).length
  const warningCount = results.filter(
    (result) => result.severity === 'warning' && !result.passed,
  ).length
  const firstRule = rules[0]
  const sourceForm = firstRule ? toSupportedForm(firstRule.sourceForm) : undefined
  const targetForm = firstRule?.targetForm ? toSupportedForm(firstRule.targetForm) : undefined

  return ValidationReportSchema.parse({
    reportId: opts.reportId,
    sourceFormId: sourceForm ? (forms[sourceForm].id ?? 'unknown') : 'unknown',
    targetFormId: targetForm ? (forms[targetForm].id ?? null) : null,
    rules: results,
    allPassed: errorCount === 0,
    errorCount,
    warningCount,
    generatedAt,
  })
}

function evaluateRule(
  rule: ValidationRule,
  forms: Record<SupportedFormType, FormView>,
  meta: Record<SupportedFormType, DerivedFormMeta>,
  timestamp: Date,
): ValidationResult[] {
  if (rule.ruleType === 'bundle') {
    return [evaluateBundle(rule, forms, meta, timestamp)]
  }

  if (rule.ruleType === 'requires') {
    return [evaluateRequires(rule, forms, meta, timestamp)]
  }

  return resolveComparablePairs(rule, forms, meta).map((pair) => {
    const passed = compare(rule.ruleType, pair.sourceValue, pair.targetValue)
    return makeResult(rule, pair, passed, timestamp)
  })
}

function evaluateRequires(
  rule: ValidationRule,
  forms: Record<SupportedFormType, FormView>,
  meta: Record<SupportedFormType, DerivedFormMeta>,
  timestamp: Date,
): ValidationResult {
  const pairs = resolveRequiresPairs(rule, forms, meta)
  const failedPair = pairs.find((pair) => requiresPairFails(rule, pair))
  const firstPair = pairs[0]
  const passed = failedPair === undefined

  return makeResult(
    rule,
    {
      sourcePath: rule.sourcePath,
      targetPath: rule.targetPath,
      sourceValue: valuesForResult(pairs.map((pair) => pair.sourceValue)),
      targetValue: valuesForResult(pairs.map((pair) => pair.targetValue)),
    },
    passed,
    timestamp,
    passed ? firstPair : failedPair,
  )
}

function evaluateBundle(
  rule: ValidationRule,
  forms: Record<SupportedFormType, FormView>,
  meta: Record<SupportedFormType, DerivedFormMeta>,
  timestamp: Date,
): ValidationResult {
  const sourceForm = toSupportedForm(rule.sourceForm)
  const targetForm = rule.targetForm ? toSupportedForm(rule.targetForm) : undefined
  const sourceValue = readPath(forms[sourceForm], rule.sourcePath, meta, {
    metaForm: sourceForm,
  })
  const targetValue =
    targetForm && rule.targetPath
      ? readPath(forms[targetForm], rule.targetPath, meta, { metaForm: targetForm })
      : undefined
  const passed = sourceValue === 'signed' && targetValue === 'signed'

  return makeResult(
    rule,
    {
      sourcePath: rule.sourcePath,
      targetPath: rule.targetPath,
      sourceValue,
      targetValue,
    },
    passed,
    timestamp,
  )
}

function resolveComparablePairs(
  rule: ValidationRule,
  forms: Record<SupportedFormType, FormView>,
  meta: Record<SupportedFormType, DerivedFormMeta>,
): ResolvedPair[] {
  if (rule.targetPath === null) {
    throw new EngineError('Comparable rules require a targetPath', rule.ruleId)
  }

  const sourcePaths = expandPath(rule.sourcePath, rule.ruleId)
  const targetPaths = expandPath(rule.targetPath, rule.ruleId)
  if (sourcePaths.length !== targetPaths.length) {
    throw new EngineError('Wildcard expansion count mismatch', rule.ruleId, rule.sourcePath)
  }

  return sourcePaths.map((sourcePath, index) => {
    const targetPath = targetPaths[index] as string
    const sourceForm = toSupportedForm(rule.sourceForm)
    const targetForm = toSupportedForm(rule.targetForm ?? rule.sourceForm)

    return {
      sourcePath,
      targetPath,
      sourceValue: readPath(forms[sourceForm], sourcePath, meta, {
        metaForm: sourceForm,
      }),
      targetValue: readPath(forms[targetForm], targetPath, meta, {
        metaForm: targetPath.startsWith('meta.') ? sourceForm : targetForm,
      }),
    }
  })
}

function resolveRequiresPairs(
  rule: ValidationRule,
  forms: Record<SupportedFormType, FormView>,
  meta: Record<SupportedFormType, DerivedFormMeta>,
): ResolvedPair[] {
  if (rule.targetPath === null) {
    throw new EngineError('Requires rules require a targetPath', rule.ruleId)
  }

  const sourcePaths = expandPath(rule.sourcePath, rule.ruleId)
  const targetPaths = expandPath(rule.targetPath, rule.ruleId)
  if (sourcePaths.length !== targetPaths.length) {
    throw new EngineError('Wildcard expansion count mismatch', rule.ruleId, rule.sourcePath)
  }

  return sourcePaths.map((sourcePath, index) => {
    const targetPath = targetPaths[index] as string
    const sourceForm = toSupportedForm(rule.sourceForm)
    const targetForm = toSupportedForm(rule.targetForm ?? rule.sourceForm)

    return {
      sourcePath,
      targetPath,
      sourceValue: readPath(forms[sourceForm], sourcePath, meta, {
        metaForm: sourceForm,
      }),
      targetValue: readPath(forms[targetForm], targetPath, meta, {
        metaForm: targetPath.startsWith('meta.') ? sourceForm : targetForm,
        wrapperRoot: rule.ruleId === 'xform:eea4-requires-eea2' && targetPath === 'id',
      }),
    }
  })
}

function requiresPairFails(rule: ValidationRule, pair: ResolvedPair): boolean {
  if (!requiresTriggered(rule.sourcePath, pair.sourceValue)) return false
  if (rule.ruleId === 'xform:eea4-requires-eea2') {
    return (
      pair.sourceValue === undefined ||
      pair.targetValue === undefined ||
      pair.sourceValue !== pair.targetValue
    )
  }
  if (typeof pair.targetValue === 'boolean') return !pair.targetValue
  return pair.targetValue === undefined || pair.targetValue === null || pair.targetValue === ''
}

function requiresTriggered(sourcePath: string, sourceValue: unknown): boolean {
  if (sourcePath.endsWith('signatureDataUrl')) {
    return typeof sourceValue === 'string' && sourceValue.length > 0
  }

  return sourceValue !== undefined && sourceValue !== null && sourceValue !== ''
}

function compare(ruleType: ValidationRule['ruleType'], sourceValue: unknown, targetValue: unknown) {
  if (sourceValue === undefined || targetValue === undefined) return false

  if (ruleType === 'equality') return sourceValue === targetValue

  if (typeof sourceValue !== 'number' || typeof targetValue !== 'number') return false

  if (ruleType === 'lte') return sourceValue <= targetValue
  if (ruleType === 'gte') return sourceValue >= targetValue

  throw new EngineError(`Unsupported comparable ruleType ${ruleType}`)
}

function makeResult(
  rule: ValidationRule,
  pair: ResolvedPair,
  passed: boolean,
  timestamp: Date,
  concretePair = pair,
): ValidationResult {
  return {
    ruleId: rule.ruleId,
    passed,
    severity: rule.severity,
    message: passed ? passMessage(rule, concretePair) : failMessage(rule, concretePair),
    sourceValue: pair.sourceValue,
    targetValue: pair.targetValue,
    sourcePath: pair.sourcePath,
    targetPath: pair.targetPath,
    timestamp,
  }
}

function passMessage(rule: ValidationRule, pair: ResolvedPair) {
  return `${rule.name} passed for ${pair.sourcePath}${pair.targetPath ? ` against ${pair.targetPath}` : ''}.`
}

function failMessage(rule: ValidationRule, pair: ResolvedPair) {
  return `${rule.name} failed for ${pair.sourcePath}${pair.targetPath ? ` against ${pair.targetPath}` : ''}.`
}

function valuesForResult(values: unknown[]) {
  return values.length === 1 ? values[0] : values
}

function buildFormViews(docs: RuleDocs): Record<SupportedFormType, FormView> {
  return {
    EEA2: buildFormView(docs.EEA2),
    EEA4: buildFormView(docs.EEA4),
  }
}

function buildFormView(doc: unknown): FormView {
  if (!isRecord(doc)) return {}

  const report = isRecord(doc.report) ? doc.report : doc
  const view: FormView = {
    wrapper: doc,
    report,
  }
  if (typeof doc.id === 'string') view.id = doc.id
  return view
}

function materialiseMeta(formType: SupportedFormType, form: FormView): DerivedFormMeta {
  const status = readStatus(form)
  if (formType === 'EEA2') {
    return {
      status,
      priorSectionsComplete:
        hasReportKey(form, 'employerProfile') &&
        hasReportKey(form, 'sectionB') &&
        hasReportKey(form, 'sectionC') &&
        hasReportKey(form, 'sectionD') &&
        hasReportKey(form, 'sectionE') &&
        hasReportKey(form, 'sectionF') &&
        hasReportKey(form, 'sectionG'),
    }
  }

  return { status }
}

function readStatus(form: FormView): DerivedFormMeta['status'] {
  const status = form.wrapper?.status ?? form.report?.status
  return typeof status === 'string' ? (status as DerivedFormMeta['status']) : undefined
}

function hasReportKey(form: FormView, key: string) {
  return form.report !== undefined && form.report[key] !== undefined && form.report[key] !== null
}

function readPath(
  form: FormView,
  path: string,
  meta: Record<SupportedFormType, DerivedFormMeta>,
  opts: { metaForm: SupportedFormType; wrapperRoot?: boolean },
): unknown {
  if (path.startsWith('meta.')) {
    return readObjectPath(meta[opts.metaForm], path.slice('meta.'.length))
  }

  if (opts.wrapperRoot) {
    return readObjectPath(form.wrapper, path)
  }

  const value = readObjectPath(form.report, path)
  if (value !== undefined) return value

  if (path.startsWith('sectionD') && path.endsWith('.total')) {
    const cell = readObjectPath(form.report, path.slice(0, -'.total'.length))
    if (isRecord(cell) && typeof cell.fixed === 'number' && typeof cell.variable === 'number') {
      return cell.fixed + cell.variable
    }
  }

  return undefined
}

function readObjectPath(root: unknown, path: string): unknown {
  if (!isRecord(root)) return undefined

  let current: unknown = root
  for (const key of path.split('.')) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

function expandPath(path: string, ruleId: string): string[] {
  validatePath(path, ruleId)
  const starCount = countStars(path)
  if (starCount === 0) return [path]
  if (starCount === 1) {
    return OCCUPATIONAL_LEVELS.map((level) => path.replace('*', level))
  }

  const paths: string[] = []
  for (const level of OCCUPATIONAL_LEVELS) {
    for (const cell of MATRIX_ROW_KEYS) {
      paths.push(path.replace('*', level).replace('*', cell))
    }
  }
  return paths
}

function validateRulePaths(rule: ValidationRule) {
  validatePath(rule.sourcePath, rule.ruleId)
  if (rule.targetPath !== null) validatePath(rule.targetPath, rule.ruleId)

  if (
    rule.targetPath !== null &&
    rule.ruleType !== 'bundle' &&
    countStars(rule.sourcePath) !== countStars(rule.targetPath)
  ) {
    throw new EngineError('sourcePath and targetPath wildcard counts differ', rule.ruleId)
  }
}

function validatePath(path: string, ruleId: string) {
  if (path.length === 0 || path.includes('..') || path.startsWith('.') || path.endsWith('.')) {
    throw new EngineError('Malformed validation path', ruleId, path)
  }

  if (countStars(path) > 2) {
    throw new EngineError('Validation paths support at most two wildcards', ruleId, path)
  }
}

function countStars(path: string) {
  return (path.match(/\*/g) ?? []).length
}

function toSupportedForm(formType: FormType): SupportedFormType {
  if (formType === 'EEA2' || formType === 'EEA4') return formType
  throw new EngineError(`Unsupported validation form type ${formType}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
