import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sanitise as barrelSanitise, type SanitiseOptions, type SanitiseResult } from '../index.js'
import { sanitise } from '../sanitise.js'
import { GOLDEN_FIXTURES } from './golden-fixtures.js'

// ─── Golden fixture tests ──────────────────────────────────────────────────

describe('sanitise — golden fixtures', () => {
  const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

  beforeEach(() => {
    consoleSpy.mockClear()
  })

  for (const fixture of GOLDEN_FIXTURES) {
    describe(fixture.name, () => {
      it('sanitised text matches expected output', () => {
        const result = sanitise(fixture.input, { tenantId: 'test-tenant' })
        expect(String(result.prompt)).toBe(fixture.expected)
      })

      it('stripCount matches fixture', () => {
        const result = sanitise(fixture.input, { tenantId: 'test-tenant' })
        expect(result.stripCount).toBe(fixture.stripCount)
      })

      it('suppressedCells matches fixture', () => {
        const result = sanitise(fixture.input, { tenantId: 'test-tenant' })
        expect(result.suppressedCells).toBe(fixture.suppressedCells)
      })
    })
  }
})

// ─── Structural tests ──────────────────────────────────────────────────────

describe('sanitise — structural', () => {
  const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

  beforeEach(() => {
    consoleSpy.mockClear()
  })

  it('result.originalLen === input.length', () => {
    const input = 'Employee 9001015009087 at john@test.com'
    const result = sanitise(input, { tenantId: 'tenant-1' })
    expect(result.originalLen).toBe(input.length)
  })

  it('result.sanitisedLen === sanitised string length', () => {
    const input = 'Employee 9001015009087 at john@test.com'
    const result = sanitise(input, { tenantId: 'tenant-1' })
    expect(result.sanitisedLen).toBe(String(result.prompt).length)
  })

  it('result.prompt is a SanitisedPrompt (runtime: typeof === string)', () => {
    const result = sanitise('Hello world', { tenantId: 'tenant-1' })
    expect(typeof result.prompt).toBe('string')
  })

  it('suppressionMin option: passing suppressionMin=5 suppresses integers <= 5', () => {
    const input = 'Group A: 4, Group B: 5, Group C: 6'
    const result = sanitise(input, {
      tenantId: 'tenant-1',
      suppressionMin: 5,
    })
    expect(String(result.prompt)).toBe('Group A: [SUPPRESSED], Group B: [SUPPRESSED], Group C: 6')
    expect(result.suppressedCells).toBe(2)
  })

  it('suppressionMin default: passing no suppressionMin uses 3', () => {
    const input = 'Count: 3, Count: 4'
    const result = sanitise(input, { tenantId: 'tenant-1' })
    expect(String(result.prompt)).toBe('Count: [SUPPRESSED], Count: 4')
    expect(result.suppressedCells).toBe(1)
  })

  it('log output contains exactly required keys and no text content', () => {
    sanitise('Employee 9001015009087 test', { tenantId: 'log-tenant' })

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const logged = consoleSpy.mock.calls[0]![0] as Record<string, unknown>

    // Required keys present
    expect(logged).toHaveProperty('tenantId', 'log-tenant')
    expect(logged).toHaveProperty('originalLen')
    expect(logged).toHaveProperty('sanitisedLen')
    expect(logged).toHaveProperty('suppressedCells')
    expect(logged).toHaveProperty('stripCount')

    // Forbidden keys absent -- never log text content
    const forbiddenKeys = ['text', 'prompt', 'input', 'sanitised', 'raw']
    for (const key of forbiddenKeys) {
      expect(logged).not.toHaveProperty(key)
    }
  })

  it('brandPrompt is NOT exported from sanitise.ts', async () => {
    const sanitiseModule = await import('../sanitise.js')
    const exportedKeys = Object.keys(sanitiseModule)
    expect(exportedKeys).not.toContain('brandPrompt')
  })

  it('barrel index re-exports sanitise function', () => {
    expect(barrelSanitise).toBe(sanitise)
  })

  it('barrel exports type-check (SanitiseOptions and SanitiseResult)', () => {
    // Compile-time type check: these imports must resolve without error.
    // At runtime we just verify the barrel function works.
    const opts: SanitiseOptions = { tenantId: 'barrel-test' }
    const result: SanitiseResult = barrelSanitise('test', opts)
    expect(result.prompt).toBeDefined()
  })
})
