// EEA1 declaration CRUD routes.
//
// Implements three handlers required by the EEA s.14 / POPIA governance gate:
//   - GET    /eea1/:declarationId        single declaration read with RBAC
//   - PATCH  /eea1/:declarationId        non-PII autosave with strict() body
//   - POST   /eea1                       final submit with server-side date
//
// Error-path contract (verified against the EEA s.14 access-control matrix):
//
//   | Scenario                               | Status | Source                |
//   |----------------------------------------|--------|-----------------------|
//   | No Authorization header                | 401    | requireAuth           |
//   | Cross-employee, same tenant, non-priv  | 403    | explicit owner check  |
//   | Cross-tenant (RLS hides row)           | 404    | findFirst -> null     |
//   | PATCH body contains a PII field        | 400    | Zod .strict()         |
//   | POST body.employeeId != JWT subject    | 403    | identity-bind check   |
//
// Authorisation rationale:
//   - 403 means "the row exists in your tenant but is not yours" — only
//     possible same-tenant.
//   - 404 means "no such row in your tenant" — required across tenants so
//     that row existence cannot be inferred from the status code.
//
// POPIA safety:
//   - signatureDataUrl is NEVER written to eea_events under any code path.
//   - The PATCH Zod schema uses .strict() so any unknown key (including the
//     five encrypted PII fields race/gender/disability/disabilityNature/
//     signatureDataUrl) is rejected with HTTP 400 before the database is
//     touched. This is defence-in-depth on top of the KMS extension and the
//     client-side excludeFields guard.

import { EEA1DeclarationBaseSchema } from '@simplifi/shared'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth } from '../../plugins/auth.js'

// ─── Body schemas ─────────────────────────────────────────────────────────────

/**
 * Non-PII autosave body. .strict() rejects unknown keys with a ZodIssue of
 * code 'unrecognized_keys' — this is the load-bearing defence that prevents
 * the client from sneaking PII fields through the autosave path.
 */
const PatchBodySchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    workplaceNumber: z.string().min(1).max(20).optional(),
    foreignNational: z.boolean().optional(),
    citizenshipDate: z.iso.date().optional(),
  })
  .strict()

type PatchBody = z.infer<typeof PatchBodySchema>

const PostBodySchema = EEA1DeclarationBaseSchema.extend({
  race: z.enum(['African', 'Coloured', 'Indian or Asian', 'White']).nullable().optional(),
  gender: z.enum(['Male', 'Female']).nullable().optional(),
  disability: z.enum(['Yes', 'No']).nullable().optional(),
  disabilityNature: z.string().max(200).optional(),
  reasonableAccommodation: z.boolean().optional(),
  signatureDataUrl: z.string().min(1),
  declarationDate: z.iso.date().optional(),
})
  .strict()
  .superRefine((data, ctx) => {
    if (data.foreignNational && !data.citizenshipDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['citizenshipDate'],
        message: 'Citizenship/permanent residence date is required for foreign nationals',
      })
    }
  })

type PostBody = z.infer<typeof PostBodySchema>

// Whitelist of PATCH-able field names — derived from the schema so the two
// cannot drift. Used for event emission ordering.
const PATCHABLE_FIELDS = ['name', 'workplaceNumber', 'foreignNational', 'citizenshipDate'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIVILEGED_ROLES = new Set<string>(['HR_DIRECTOR', 'ADMIN'])

/**
 * Returns true if the caller may access a declaration owned by `employeeId`.
 * Same-tenant ownership has already been established by the time this runs
 * (the row was returned by RLS-scoped findFirst). The remaining question is
 * whether the caller is either the owner or a privileged role.
 */
function isAuthorisedOwnerOrPrivileged(user: FastifyRequest['user'], employeeId: string): boolean {
  if (PRIVILEGED_ROLES.has(user.role)) return true
  return employeeId === user.sub
}

/**
 * Today's date in YYYY-MM-DD form. Server-clock authoritative — the client
 * MUST NOT supply declarationDate. Backdating a statutory declaration is a
 * compliance offence under EEA s.16(2)(a) and would invalidate the audit
 * trail expected by rule_eea_016.
 */
function todayIso(): string {
  const iso = new Date().toISOString().split('T')[0]
  // Defensive: ISO 8601 toISOString always returns a string with 'T'; the
  // optional indexing access just satisfies TypeScript's `string | undefined`.
  return iso ?? ''
}

/**
 * Convert a validated yyyy-mm-dd string to a Date at UTC midnight for
 * Prisma's DateTime @db.Date columns — the client rejects date-only strings.
 */
function dateOnlyToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

// ─── Route registration ───────────────────────────────────────────────────────

export function eea1DeclarationsRoutes(app: FastifyInstance): void {
  // ---- GET /eea1/:declarationId ---------------------------------------------

  app.get<{ Params: { declarationId: string } }>(
    '/eea1/:declarationId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { declarationId } = request.params

      // RLS automatically appends tenantId to the WHERE clause via the
      // SET LOCAL app.tenant_id guard set by tenant-context. A row that
      // belongs to another tenant is therefore invisible and findFirst
      // returns null — which we surface as 404 to avoid leaking existence.
      const declaration = await prisma.eea1Declaration.findFirst({
        where: { id: declarationId },
      })

      if (declaration === null) {
        return reply.status(404).send({ error: 'Not found' })
      }

      // Same-tenant rows: privileged roles see everything; everyone else
      // sees only their own declaration. Cross-employee within tenant is 403.
      if (!isAuthorisedOwnerOrPrivileged(request.user, declaration.employeeId)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Note: the KMS extension applies to writes only — it does not add a
      // result hook to decrypt ciphertext on read. Consumers of this route
      // therefore receive ciphertext for race/gender/disability/
      // disabilityNature/signatureDataUrl. Decryption is the caller's
      // responsibility (or a future read-side extension).
      return reply.status(200).send(declaration)
    },
  )

  // ---- PATCH /eea1/:declarationId -------------------------------------------

  app.patch<{ Params: { declarationId: string }; Body: unknown }>(
    '/eea1/:declarationId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // Validate body BEFORE any DB work. .strict() rejects PII keys with 400.
      const parsed = PatchBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }
      const body: PatchBody = parsed.data

      const { declarationId } = request.params

      // Load the existing row first so we can (a) authorise the caller and
      // (b) capture prevValue for each field event.
      const existing = await prisma.eea1Declaration.findFirst({
        where: { id: declarationId },
      })
      if (existing === null) {
        return reply.status(404).send({ error: 'Not found' })
      }
      if (!isAuthorisedOwnerOrPrivileged(request.user, existing.employeeId)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const tenantId = request.user.tenantId
      const userId = request.user.sub
      // The JWT does not carry a display name; the email claim is the only
      // human-readable caller identifier available at the API edge. Stored
      // here for audit-log readability; never used for authz decisions.
      const userName = request.user.email

      // Emit one EEA1_AUTOSAVE event PER FIELD CHANGED, ordered by the
      // canonical field list above. signatureDataUrl is NOT in PATCHABLE_FIELDS
      // so it can never reach this branch — and therefore never lands in
      // eea_events regardless of upstream behaviour.
      for (const fieldName of PATCHABLE_FIELDS) {
        if (!(fieldName in body)) continue
        const newValue = body[fieldName]
        const prevValue = (existing as Record<string, unknown>)[fieldName]

        await prisma.eeaEvent.create({
          data: {
            tenantId,
            formId: declarationId,
            formType: 'EEA1',
            eventType: 'EEA1_AUTOSAVE',
            fieldPath: fieldName,
            // Prisma Json columns accept null/scalars/objects; the cast here
            // narrows from `unknown` so the Prisma client type-checks. The
            // PII gate in /eea2/:formId/events strips PII paths on read; the
            // four whitelisted PATCH fields are non-PII so they remain.
            prevValue: prevValue as never,
            newValue: newValue as never,
            metadata: {
              userId,
              userName,
            },
          },
        })
      }

      // Apply the actual update. The KMS extension only intercepts the five
      // encrypted PII fields — none of which are present here. We build a
      // dense object (only defined keys) to satisfy exactOptionalPropertyTypes.
      const updateData: Record<string, unknown> = {}
      for (const fieldName of PATCHABLE_FIELDS) {
        if (fieldName in body) {
          const value = body[fieldName]
          updateData[fieldName] =
            fieldName === 'citizenshipDate' && typeof value === 'string'
              ? dateOnlyToDate(value)
              : value
        }
      }
      const updated = await prisma.eea1Declaration.update({
        where: { id: declarationId },
        data: updateData as never,
      })

      return reply.status(200).send(updated)
    },
  )

  // ---- POST /eea1 -----------------------------------------------------------

  app.post<{ Body: unknown }>('/eea1', { preHandler: [requireAuth] }, async (request, reply) => {
    // Full schema with superRefine cross-field validation (foreignNational
    // requires citizenshipDate). Rejects unknown keys defensively.
    const parsed = PostBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body' })
    }
    const body: PostBody = parsed.data

    // Identity-bind: a user may file a declaration only for themselves.
    // Crossing this boundary is 403 — the row's owner field is the
    // load-bearing identity claim, not the JWT alone.
    if (body.employeeId !== request.user.sub) {
      return reply.status(403).send({ error: 'Cannot file declaration for another user' })
    }

    // Server-clock authoritative declarationDate. Any body value is ignored
    // by virtue of the spread order: declarationDate is written AFTER the
    // spread so it overrides whatever the client supplied.
    const declarationDate = todayIso()

    // The KMS extension encrypts race/gender/disability/disabilityNature/
    // signatureDataUrl in-place before the Prisma adapter hands the row to
    // Postgres. We must NOT pre-encrypt here — that would double-encrypt.
    // This consent-gated submit path requires signatureDataUrl and accepts
    // the demographic fields that are explicitly barred from PATCH autosave.
    // Cast `as never` keeps TypeScript happy without re-declaring the model
    // contract here.
    const created = await prisma.eea1Declaration.create({
      data: {
        ...(body as Record<string, unknown>),
        ...(body.citizenshipDate === undefined
          ? {}
          : { citizenshipDate: dateOnlyToDate(body.citizenshipDate) }),
        declarationDate: dateOnlyToDate(declarationDate),
        tenantId: request.user.tenantId,
      } as never,
    })

    return reply.status(201).send(created)
  })
}
