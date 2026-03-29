/**
 * Result<T, E> — explicit success/failure type.
 *
 * Replaces thrown exceptions at system boundaries. Every function that can
 * fail returns Result<T, E> so callers are forced to handle both paths.
 *
 * Usage:
 *   function parse(raw: string): Result<number, AppError> {
 *     const n = Number(raw)
 *     return Number.isNaN(n) ? err(new AppError('PARSE_ERROR', 'Not a number')) : ok(n)
 *   }
 *
 *   const r = parse('42')
 *   if (r.ok) console.log(r.value)   // narrowed to Ok<number>
 *   else console.error(r.error)      // narrowed to Err<AppError>
 */

export type Ok<T> = { readonly ok: true; readonly value: T }
export type Err<E> = { readonly ok: false; readonly error: E }
export type Result<T, E> = Ok<T> | Err<E>

/** Construct a successful Result. */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value })

/** Construct a failed Result. */
export const err = <E>(error: E): Err<E> => ({ ok: false, error })

/** Return the value or throw the error — escape hatch for tests and top-level handlers. */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.ok) return result.value
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw result.error
}

/** Map the Ok value, passing Err through unchanged. */
export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result

/** Map the Err value, passing Ok through unchanged. */
export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  result.ok ? result : err(fn(result.error))
