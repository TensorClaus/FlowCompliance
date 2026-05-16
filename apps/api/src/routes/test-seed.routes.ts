import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

const ROLE_FIXTURES = [
  'EE_MANAGER',
  'HR_DIRECTOR',
  'CFO',
  'SENIOR_MANAGER',
  'CEO',
  'ADMIN',
] as const
type RoleFixture = (typeof ROLE_FIXTURES)[number]
const STEP_IDS = [
  'section-a',
  'section-b',
  'section-c1',
  'section-c2',
  'section-d1',
  'section-d2',
  'section-e-sector-targets',
  'section-e-next-year-targets',
  'section-f-consultation',
  'section-f-barriers',
  'section-g-monitoring',
  'section-h-declaration',
  'section-h-hitl',
] as const

function issueTestJwt(sub: string, tenantId: string, role: string): string {
  return jwt.sign(
    {
      sub,
      tenantId,
      email: `${sub.slice(0, 8)}@test.local`,
      role,
      totpVerified: true,
      tokenType: 'access',
      jti: randomUUID(),
    },
    config.SESSION_SECRET,
    { algorithm: 'HS256', expiresIn: 3600 },
  )
}

function createMatrix(total: number): Record<string, Record<string, { value: number }>> {
  const columns = [
    'africanMale',
    'africanFemale',
    'colouredMale',
    'colouredFemale',
    'indianMale',
    'indianFemale',
    'whiteMale',
    'whiteFemale',
    'foreignNationalMale',
    'foreignNationalFemale',
    'total',
  ] as const
  const rows = [
    'topManagement',
    'seniorManagement',
    'professionallyQualified',
    'skilledTechnical',
    'semiSkilled',
    'unskilled',
    'temporaryEmployees',
    'totalPermanent',
    'grandTotal',
  ] as const

  const matrix = Object.fromEntries(
    rows.map((row) => [row, Object.fromEntries(columns.map((col) => [col, { value: 0 }]))]),
  ) as Record<string, Record<string, { value: number }>>

  for (const row of ['topManagement', 'totalPermanent', 'grandTotal']) {
    const rowData = matrix[row]
    if (rowData === undefined) continue
    const africanMale = rowData['africanMale']
    const total_ = rowData['total']
    if (africanMale !== undefined) africanMale.value = total
    if (total_ !== undefined) total_.value = total
  }

  return matrix
}

function createSignedState(): Record<string, unknown> {
  const emptyMatrix = createMatrix(0)
  return {
    'section-a': {
      registrationNumber: '2026/123456/07',
      sector: 'FIN',
      province: 'Gauteng',
      totalEmployeesPriorYear: 18,
      primaryContactName: 'EE Manager',
      primaryContactEmail: 'ee.manager@test.local',
      reportingYear: 2026,
    },
    'section-b': {
      permanent: { male: 8, female: 7 },
      nonPermanent: { male: 1, female: 1 },
      contract: { male: 1, female: 0 },
      totals: { permanent: 15, nonPermanent: 2, contract: 1, grandTotal: 18 },
    },
    'section-c1': createMatrix(18),
    'section-c2': emptyMatrix,
    'section-d1': createMatrix(5),
    'section-d2': {
      totalBudget: 12_000,
      percentages: [20, 20, 20, 20, 20],
      narrative: 'Training spend allocated evenly.',
    },
    'section-e-sector-targets': {
      fromLevel: 6,
      toLevel: 0,
      matrix: emptyMatrix,
      noPromotions: true,
    },
    'section-e-next-year-targets': emptyMatrix,
    'section-f-consultation': { matrix: emptyMatrix, reasonsByRow: {} },
    'section-f-barriers': {},
    'section-g-monitoring': {
      matrix: emptyMatrix,
      wspSubmitted: true,
      narrative: 'WSP submitted and aligned.',
    },
    'section-h-declaration': {
      physical: { count: 0, status: 'Granted', createdAt: '2026-05-01' },
      sensory: { count: 0, status: 'Granted', createdAt: '2026-05-01' },
      intellectual: { count: 0, status: 'Granted', createdAt: '2026-05-01' },
      psychosocial: { count: 0, status: 'Granted', createdAt: '2026-05-01' },
      neurological: { count: 0, status: 'Granted', createdAt: '2026-05-01' },
      multiple: { count: 0, status: 'Granted', createdAt: '2026-05-01' },
    },
    'section-h-hitl': {
      lastAssessmentDate: '2026-05-01',
      nextScheduledDate: '2026-11-01',
    },
    completedSteps: [...STEP_IDS],
    wizardContext: {
      disabilityFlagActive: false,
      barrierTerminationFlag: false,
      accommodationOverdueFlag: false,
      sectionBTotals: { permanent: 15, nonPermanent: 2, contract: 1, grandTotal: 18 },
    },
  }
}

export function testSeedRoutes(app: FastifyInstance): void {
  app.post('/test/seed', async (_request, reply): Promise<FastifyReply> => {
    const tenantId = randomUUID()
    const users: Record<RoleFixture, string> = {
      EE_MANAGER: randomUUID(),
      HR_DIRECTOR: randomUUID(),
      CFO: randomUUID(),
      SENIOR_MANAGER: randomUUID(),
      CEO: randomUUID(),
      ADMIN: randomUUID(),
    }
    const eeaManagerId = users['EE_MANAGER']
    const employeeBId = randomUUID()
    const ceoId = users['CEO']

    await prisma.$transaction(async (tx) => {
      // Set RLS GUC for the new tenant before any DML inside this transaction.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`

      await tx.tenant.create({
        data: {
          id: tenantId,
          name: `test-${tenantId.slice(0, 8)}`,
          kmsKeyId: 'local-dev-placeholder',
        },
      })

      await tx.user.createMany({
        data: [
          ...ROLE_FIXTURES.map((role) => ({
            id: users[role],
            email: `${role.toLowerCase().replaceAll('_', '-')}-${users[role].slice(0, 6)}@test.local`,
            tenantId,
            passwordHash: '',
            role,
          })),
          {
            id: employeeBId,
            email: `emp-${employeeBId.slice(0, 6)}@test.local`,
            tenantId,
            passwordHash: '',
            role: 'EE_MANAGER',
          },
        ],
      })
    })

    return reply.status(201).send({
      tenantId,
      eeaManagerToken: issueTestJwt(eeaManagerId, tenantId, 'EE_MANAGER'),
      eeaManagerSub: eeaManagerId,
      employeeBToken: issueTestJwt(employeeBId, tenantId, 'EE_MANAGER'),
      employeeBSub: employeeBId,
      ceoToken: issueTestJwt(ceoId, tenantId, 'CEO'),
      hrDirectorToken: issueTestJwt(users['HR_DIRECTOR'], tenantId, 'HR_DIRECTOR'),
      cfoToken: issueTestJwt(users['CFO'], tenantId, 'CFO'),
      seniorManagerToken: issueTestJwt(users['SENIOR_MANAGER'], tenantId, 'SENIOR_MANAGER'),
      adminToken: issueTestJwt(users['ADMIN'], tenantId, 'ADMIN'),
    })
  })

  app.post<{ Body: unknown }>(
    '/test/seed/eea2-signed',
    async (request, reply): Promise<FastifyReply> => {
      const body =
        typeof request.body === 'object' && request.body !== null
          ? (request.body as Record<string, unknown>)
          : {}
      const tenantId = body['tenantId']
      if (typeof tenantId !== 'string' || tenantId.length === 0) {
        return reply.status(400).send({ error: 'tenantId is required' })
      }

      const formId = randomUUID()
      const signerId = randomUUID()

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
        await tx.eea2Draft.create({
          data: {
            id: formId,
            tenantId,
            reportingYear: 2026,
            state: createSignedState() as Prisma.InputJsonObject,
            status: 'signed',
          },
        })
        await tx.eeaEvent.create({
          data: {
            tenantId,
            formType: 'EEA2',
            formId,
            eventType: 'EEA2_SIGNED',
            fieldPath: 'sectionH.signature',
            prevValue: Prisma.JsonNull,
            newValue: { status: 'signed' },
            metadata: { userId: signerId, source: 'test-seed' },
          },
        })
      })

      return reply.status(201).send({ formId, tenantId })
    },
  )

  app.delete<{ Params: { tenantId: string } }>(
    '/test/seed/:tenantId',
    async (request, reply): Promise<FastifyReply> => {
      const { tenantId } = request.params
      // Cascade deletes users, eea1_declarations, eea_events via FK constraints.
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      return reply.status(204).send()
    },
  )
}
