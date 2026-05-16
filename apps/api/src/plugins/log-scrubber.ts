/**
 * Pino log-scrubber plugin — POPIA s.19 compliance.
 *
 * Ensures no raw PII appears in any log output by:
 * 1. Configuring Pino `redact` paths for known PII field names.
 * 2. Adding request/response serializers that recursively strip PII from
 *    logged HTTP bodies (catches nested and dynamic field names).
 */
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

// ---------------------------------------------------------------------------
// PII field definitions
// ---------------------------------------------------------------------------

/** Exact PII field names (case-sensitive, matched in redact paths). */
const EXACT_PII_FIELDS = [
  'gender',
  'race',
  'disability',
  'disabilityNature',
  'remuneration',
  'salary',
  'ctc',
  'compensation',
  'income',
  'signatureDataUrl',
  'totpSecret',
  'nationalId',
  'idNumber',
  'saIdNumber',
] as const

/** Regex that matches any field whose name contains password, secret, or token. */
const DYNAMIC_PII_PATTERN = /password|secret|token/i

const REDACTED = '[REDACTED]'

// ---------------------------------------------------------------------------
// Redact paths for Pino's built-in redaction
// ---------------------------------------------------------------------------

/**
 * Build the flat `redact.paths` array consumed by `pino.redact`.
 *
 * We target the most common locations where PII can appear:
 *   - Top-level log properties   (e.g. `log.info({ salary: 123 })`)
 *   - Nested inside `req.body.*` and `res.body.*` via serializers
 *
 * Pino redact operates on the *serialised* log record, so we cover the
 * serializer output shape as well.
 */
function buildRedactPaths(): string[] {
  const paths: string[] = []

  for (const field of EXACT_PII_FIELDS) {
    // Top-level on the log record
    paths.push(field, `req.body.${field}`, `res.body.${field}`)
  }

  return paths
}

export const REDACT_PATHS = buildRedactPaths()

export const REDACT_CONFIG = {
  paths: REDACT_PATHS,
  censor: REDACTED,
} as const

// ---------------------------------------------------------------------------
// Deep scrub utility — catches dynamic / nested PII that static paths miss
// ---------------------------------------------------------------------------

/**
 * Recursively walk a value and replace any property whose key matches a known
 * PII field name or the dynamic pattern with `[REDACTED]`.
 *
 * Returns a *new* object — the original is never mutated.
 */
function deepScrub(value: unknown): unknown {
  if (value === null || value === undefined) return value

  if (Array.isArray(value)) {
    return value.map((v) => deepScrub(v))
  }

  if (typeof value === 'object') {
    const scrubbed: Record<string, unknown> = {}
    const record = value as Record<string, unknown>

    for (const key of Object.keys(record)) {
      scrubbed[key] = isPiiKey(key) ? REDACTED : deepScrub(record[key])
    }

    return scrubbed
  }

  return value
}

function isPiiKey(key: string): boolean {
  if (DYNAMIC_PII_PATTERN.test(key)) return true

  for (const field of EXACT_PII_FIELDS) {
    if (key === field) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

interface SerializedRequest {
  method: string
  url: string
  hostname: string
  remoteAddress: string | undefined
  body?: unknown
}

interface SerializedResponse {
  statusCode: number
  body?: unknown
}

function requestSerializer(req: FastifyRequest): SerializedRequest {
  const serialized: SerializedRequest = {
    method: req.method,
    url: req.url,
    hostname: req.hostname,
    remoteAddress: req.ip,
  }

  if (req.body !== undefined && req.body !== null) {
    serialized.body = deepScrub(req.body)
  }

  return serialized
}

function responseSerializer(res: FastifyReply): SerializedResponse {
  const serialized: SerializedResponse = {
    statusCode: res.statusCode,
  }

  // Fastify does not natively store the response body on the reply object.
  // If application code attaches it (e.g. via onSend hook), scrub it.
  const payload = (res as unknown as Record<string, unknown>)['body']

  if (payload !== undefined && payload !== null) {
    serialized.body = deepScrub(payload)
  }

  return serialized
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const logScrubberPlugin: FastifyPluginCallback = (fastify, _options, done) => {
  // Attach custom serializers to the existing logger instance.
  // Pino allows rebinding child loggers with additional serializers.
  const child = fastify.log.child(
    {},
    {
      serializers: {
        req: requestSerializer as (value: unknown) => unknown,
        res: responseSerializer as (value: unknown) => unknown,
      },
    },
  )

  // Replace the instance logger with the child that carries our serializers.
  fastify.log = child

  // Hook into onSend to capture response bodies for redaction in logs.
  fastify.addHook('onSend', async (_request, reply, payload) => {
    if (typeof payload === 'string') {
      try {
        const parsed: unknown = JSON.parse(payload)
        ;(reply as unknown as Record<string, unknown>)['body'] = parsed
      } catch {
        // Not JSON — nothing to scrub.
      }
    }

    return payload
  })
  done()

  fastify.log.info('Log scrubber registered — POPIA s.19 PII redaction active')
}

export default fp(logScrubberPlugin, {
  name: 'log-scrubber',
  fastify: '4.x',
})

export { deepScrub, isPiiKey }
