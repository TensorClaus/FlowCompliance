import { describe, it, expect } from 'vitest'
import * as api from '../index.js'

/**
 * Guards the package's public surface: consumers (apps/api, apps/web) import
 * everything through this barrel, so an accidentally dropped re-export is a
 * breaking change that typecheck alone may not catch at the package boundary.
 */
describe('@simplifi/shared public API', () => {
  it.each([
    // result + errors
    'ok',
    'err',
    'unwrap',
    'mapResult',
    'mapErr',
    'AppError',
    'ValidationError',
    'NotFoundError',
    'ForbiddenError',
    'ExternalServiceError',
    // enums
    'OccupationalLevelSchema',
    'RaceCodeSchema',
    'GenderCodeSchema',
    'EEAFormStatusSchema',
    'FormTypeSchema',
    // form schemas
    'EmployeeDeclarationSchema',
    'EEA1FormSchema',
    'EEA4ReportSchema',
    'EEA4FormSchema',
    'EmployerProfileSchema',
    'OccupationalMatrixSchema',
    'RemunerationMatrixSchema',
    'RemBreakdownMatrixSchema',
    'CEODeclarationSchema',
    // event sourcing
    'EEAEventSchema',
    'EEAEventTypeSchema',
    'EventMetadataSchema',
    'EventStreamSchema',
    'ProjectionSchema',
    'SnapshotSchema',
    'AppendResultSchema',
    'ReplayRequestSchema',
    // validation rules
    'ValidationRuleSchema',
    'ValidationResultSchema',
    'ValidationReportSchema',
    'CROSS_FORM_RULES',
    // eea metadata
    'PII_FIELD_PATHS',
    'FIELD_LABELS',
    'EEA2_DECLARATION_TEXT',
    'EEA1DeclarationBaseSchema',
    'EEA1DeclarationSchema',
  ])('exports %s', (name) => {
    expect(api).toHaveProperty(name)
    expect((api as Record<string, unknown>)[name]).toBeDefined()
  })
})
