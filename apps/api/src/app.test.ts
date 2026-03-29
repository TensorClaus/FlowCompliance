import type { FastifyInstance } from 'fastify'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildApp } from './app.js'

describe('api startup smoke test', () => {
  let app: FastifyInstance

  beforeEach(() => {
    app = buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('GET /health returns 200 with status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('registers sensible — unknown route returns 404 not 500', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/does-not-exist',
    })

    expect(response.statusCode).toBe(404)
  })

  it('registers helmet — security headers present', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBeDefined()
  })
})
