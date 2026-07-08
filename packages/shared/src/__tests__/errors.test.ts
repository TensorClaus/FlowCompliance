import { describe, it, expect } from 'vitest'
import {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ExternalServiceError,
} from '../errors.js'

describe('AppError', () => {
  it('carries code, message, and derives name from the class', () => {
    const error = new AppError('NOT_FOUND', 'Employer profile not found')
    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toBe('Employer profile not found')
    expect(error.name).toBe('AppError')
    expect(error).toBeInstanceOf(Error)
  })

  it('chains an Error cause onto the native cause option', () => {
    const cause = new Error('socket closed')
    const error = new AppError('EXTERNAL_SERVICE_ERROR', 'DB unavailable', cause)
    expect(error.cause).toBe(cause)
  })

  it('keeps a non-Error cause on the property without setting native cause', () => {
    const error = new AppError('PARSE_ERROR', 'bad payload', { raw: 'x' })
    expect(error.cause).toEqual({ raw: 'x' })
  })

  it('toJSON returns only name, code, and message (no stack, no cause)', () => {
    const error = new AppError('FORBIDDEN', 'Access denied', new Error('secret detail'))
    expect(error.toJSON()).toEqual({
      name: 'AppError',
      code: 'FORBIDDEN',
      message: 'Access denied',
    })
  })

  it('preserves the prototype chain for instanceof checks on subclasses', () => {
    const error = new ValidationError('bad input')
    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(Error)
  })
})

describe('ValidationError', () => {
  it('uses the VALIDATION_ERROR code and records the offending field', () => {
    const error = new ValidationError('must be a number', 'headcount')
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.field).toBe('headcount')
    expect(error.name).toBe('ValidationError')
  })

  it('field is optional', () => {
    const error = new ValidationError('payload invalid')
    expect(error.field).toBeUndefined()
  })
})

describe('NotFoundError', () => {
  it('formats the message with the id when supplied', () => {
    const error = new NotFoundError('EEA2 form', 'abc-123')
    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toBe("EEA2 form 'abc-123' not found")
  })

  it('formats the message without an id', () => {
    const error = new NotFoundError('Employer profile')
    expect(error.message).toBe('Employer profile not found')
  })
})

describe('ForbiddenError', () => {
  it('defaults the message to "Access denied"', () => {
    const error = new ForbiddenError()
    expect(error.code).toBe('FORBIDDEN')
    expect(error.message).toBe('Access denied')
  })

  it('accepts a custom message', () => {
    const error = new ForbiddenError('Tenant mismatch')
    expect(error.message).toBe('Tenant mismatch')
  })
})

describe('ExternalServiceError', () => {
  it('prefixes the message with the service name and chains the cause', () => {
    const cause = new Error('timeout')
    const error = new ExternalServiceError('KMS', 'signing request failed', cause)
    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
    expect(error.message).toBe('KMS: signing request failed')
    expect(error.cause).toBe(cause)
  })
})
