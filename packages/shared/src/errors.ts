/**
 * AppError — base error class for all Simplifi errors.
 *
 * Carries a machine-readable `code` (used for i18n, API error bodies,
 * and programmatic error handling) alongside the human-readable message.
 * Subclass per domain; never throw raw Error in application code.
 *
 * Usage:
 *   throw new AppError('NOT_FOUND', 'Employer profile not found')
 *
 *   class ValidationError extends AppError {
 *     constructor(message: string, readonly field: string) {
 *       super('VALIDATION_ERROR', message)
 *     }
 *   }
 */

export class AppError extends Error {
  override readonly name: string

  constructor(
    readonly code: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message, cause instanceof Error ? { cause } : undefined)
    this.name = this.constructor.name
    // Maintain correct prototype chain in compiled JS
    Object.setPrototypeOf(this, new.target.prototype)
  }

  toJSON(): { name: string; code: string; message: string } {
    return { name: this.name, code: this.code, message: this.message }
  }
}

/** Validation failed at a system boundary (Zod parse, form submit, API input). */
export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super('VALIDATION_ERROR', message)
  }
}

/** Requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', id ? `${resource} '${id}' not found` : `${resource} not found`)
  }
}

/** Caller is not authorised to perform this action. */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message)
  }
}

/** External service (DB, AWS, third-party API) returned an error. */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, cause?: unknown) {
    super('EXTERNAL_SERVICE_ERROR', `${service}: ${message}`, cause)
  }
}
