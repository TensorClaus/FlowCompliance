import { describe, it, expect } from 'vitest'
import { AppError } from '../errors.js'
import { ok, err, unwrap, mapResult, mapErr } from '../result.js'

describe('ok / err constructors', () => {
  it('ok wraps a value with ok: true', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 })
  })

  it('err wraps an error with ok: false', () => {
    const error = new AppError('PARSE_ERROR', 'Not a number')
    expect(err(error)).toEqual({ ok: false, error })
  })
})

describe('unwrap', () => {
  it('returns the value for Ok', () => {
    expect(unwrap(ok('value'))).toBe('value')
  })

  it('throws the contained error for Err', () => {
    const error = new AppError('NOT_FOUND', 'missing')
    expect(() => unwrap(err(error))).toThrow(error)
  })
})

describe('mapResult', () => {
  it('maps the Ok value', () => {
    expect(mapResult(ok(2), (n) => n * 10)).toEqual({ ok: true, value: 20 })
  })

  it('passes Err through unchanged without calling fn', () => {
    const failure = err('boom')
    let called = false
    const result = mapResult(failure, () => {
      called = true
      return 1
    })
    expect(result).toBe(failure)
    expect(called).toBe(false)
  })
})

describe('mapErr', () => {
  it('maps the Err value', () => {
    expect(mapErr(err('raw'), (e) => `wrapped:${e}`)).toEqual({
      ok: false,
      error: 'wrapped:raw',
    })
  })

  it('passes Ok through unchanged without calling fn', () => {
    const success = ok(7)
    let called = false
    const result = mapErr(success, () => {
      called = true
      return 'never'
    })
    expect(result).toBe(success)
    expect(called).toBe(false)
  })
})
