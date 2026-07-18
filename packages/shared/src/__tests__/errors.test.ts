import { describe, expect, it } from 'vitest'
import {
  AppError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../errors.js'

describe('AppError', () => {
  it('carries code, message and cause, and sets name to the constructor name', () => {
    const cause = new Error('root cause')
    const error = new AppError('SOME_CODE', 'Something went wrong', cause)

    expect(error.code).toBe('SOME_CODE')
    expect(error.message).toBe('Something went wrong')
    expect(error.name).toBe('AppError')
    expect(error.cause).toBe(cause)
  })

  it('is a genuine Error instance so it can be thrown and caught idiomatically', () => {
    expect(() => {
      throw new AppError('BOOM', 'boom')
    }).toThrow(AppError)
  })

  it('omits the native Error `cause` chain when no cause is supplied', () => {
    const error = new AppError('NO_CAUSE', 'no cause supplied')
    expect(error.cause).toBeUndefined()
  })

  it('serialises to a JSON-safe shape via toJSON', () => {
    const error = new AppError('SOME_CODE', 'Something went wrong')

    expect(error.toJSON()).toEqual({
      name: 'AppError',
      code: 'SOME_CODE',
      message: 'Something went wrong',
    })
  })

  it('produces valid JSON when passed to JSON.stringify (toJSON is invoked automatically)', () => {
    const error = new AppError('SOME_CODE', 'Something went wrong')
    // Intentionally round-tripping through JSON (not structuredClone): the
    // behaviour under test IS that JSON.stringify invokes toJSON()
    // automatically, which structuredClone does not do.
    // eslint-disable-next-line unicorn/prefer-structured-clone
    const serialised = JSON.parse(JSON.stringify(error)) as Record<string, unknown>

    expect(serialised).toEqual({
      name: 'AppError',
      code: 'SOME_CODE',
      message: 'Something went wrong',
    })
  })
})

describe('ValidationError', () => {
  it('sets the VALIDATION_ERROR code and the constructor name, and records the offending field', () => {
    const error = new ValidationError('Name is required', 'name')

    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.name).toBe('ValidationError')
    expect(error.message).toBe('Name is required')
    expect(error.field).toBe('name')
  })

  it('allows field to be omitted for form-level (non-field-scoped) failures', () => {
    const error = new ValidationError('Form submission failed')
    expect(error.field).toBeUndefined()
  })
})

describe('NotFoundError', () => {
  it('builds a message that includes the resource and id when id is supplied', () => {
    const error = new NotFoundError('EmployerProfile', 'tenant-123')

    expect(error.code).toBe('NOT_FOUND')
    expect(error.name).toBe('NotFoundError')
    expect(error.message).toBe("EmployerProfile 'tenant-123' not found")
  })

  it('omits the id clause entirely when id is not supplied', () => {
    const error = new NotFoundError('EmployerProfile')
    expect(error.message).toBe('EmployerProfile not found')
  })
})

describe('ForbiddenError', () => {
  it('defaults to "Access denied" when no message is supplied', () => {
    const error = new ForbiddenError()

    expect(error.code).toBe('FORBIDDEN')
    expect(error.name).toBe('ForbiddenError')
    expect(error.message).toBe('Access denied')
  })

  it('accepts a custom message overriding the default', () => {
    const error = new ForbiddenError('CEO sign-off required before submission')
    expect(error.message).toBe('CEO sign-off required before submission')
  })
})

describe('ExternalServiceError', () => {
  it('prefixes the message with the failing service name and preserves the cause', () => {
    const cause = new Error('ECONNREFUSED')
    const error = new ExternalServiceError('DoL portal', 'connection refused', cause)

    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
    expect(error.name).toBe('ExternalServiceError')
    expect(error.message).toBe('DoL portal: connection refused')
    expect(error.cause).toBe(cause)
  })

  it('works without a cause', () => {
    const error = new ExternalServiceError('DoL portal', 'timeout')
    expect(error.cause).toBeUndefined()
    expect(error.message).toBe('DoL portal: timeout')
  })
})
