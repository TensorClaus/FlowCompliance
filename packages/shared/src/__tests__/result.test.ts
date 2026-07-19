import { describe, expect, it } from 'vitest'
import { err, mapErr, mapResult, ok, unwrap } from '../result.js'

describe('ok', () => {
  it('wraps a value in a success Result', () => {
    const result = ok(42)
    expect(result).toEqual({ ok: true, value: 42 })
  })
})

describe('err', () => {
  it('wraps an error in a failure Result', () => {
    const result = err('PARSE_ERROR')
    expect(result).toEqual({ ok: false, error: 'PARSE_ERROR' })
  })
})

describe('unwrap', () => {
  it('returns the value for a successful Result', () => {
    expect(unwrap(ok('value'))).toBe('value')
  })

  it('throws the error for a failed Result', () => {
    const failure = err(new Error('parse failed'))
    expect(() => unwrap(failure)).toThrow('parse failed')
  })

  it('throws non-Error values as-is (escape hatch, not for production error paths)', () => {
    const failure = err('PARSE_ERROR')
    expect(() => unwrap(failure)).toThrow('PARSE_ERROR')
  })
})

describe('mapResult', () => {
  it('applies fn to the value of an Ok result', () => {
    const doubled = mapResult(ok(21), (n) => n * 2)
    expect(doubled).toEqual({ ok: true, value: 42 })
  })

  it('passes an Err result through unchanged, without invoking fn', () => {
    let called = false
    const failure = err('PARSE_ERROR')

    const result = mapResult(failure, (n: number) => {
      called = true
      return n * 2
    })

    expect(result).toBe(failure)
    expect(called).toBe(false)
  })
})

describe('mapErr', () => {
  it('applies fn to the error of an Err result', () => {
    const mapped = mapErr(err('PARSE_ERROR'), (code) => `wrapped:${code}`)
    expect(mapped).toEqual({ ok: false, error: 'wrapped:PARSE_ERROR' })
  })

  it('passes an Ok result through unchanged, without invoking fn', () => {
    let called = false
    const success = ok(42)

    const result = mapErr(success, (e: string) => {
      called = true
      return `wrapped:${e}`
    })

    expect(result).toBe(success)
    expect(called).toBe(false)
  })
})
