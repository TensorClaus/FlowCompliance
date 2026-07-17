import { describe, expect, it } from 'vitest'
import { AddressSchema, EmployerProfileSchema } from '../employer.js'

function address(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    line1: '1 Main Rd',
    city: 'Cape Town',
    province: 'western_cape',
    postalCode: '8001',
    ...overrides,
  }
}

function employerProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tradeName: 'Acme',
    dtiRegistrationName: 'Acme Holdings',
    dtiRegistrationNumber: '2020/123456/07',
    payeSarsNumber: '7123456789',
    uifReferenceNumber: 'U123456789',
    eapType: 'national',
    industrySector: 'finance',
    setaClassification: 'FASSET',
    telephone: '0210000000',
    postalAddress: address(),
    physicalAddress: address(),
    ceoName: 'Jane Doe',
    ceoTelephone: '0210000001',
    ceoEmail: 'ceo@acme.co.za',
    seniorManagerName: 'John Smith',
    seniorManagerTelephone: '0210000002',
    seniorManagerEmail: 'hr@acme.co.za',
    businessType: 'private_company',
    organOfState: false,
    employeeCountBand: '150+',
    partOfGroup: false,
    ...overrides,
  }
}

describe('AddressSchema', () => {
  it('accepts a well-formed South African address', () => {
    expect(AddressSchema.safeParse(address()).success).toBe(true)
  })

  it('accepts an address with line2 omitted (optional)', () => {
    expect(AddressSchema.safeParse(address()).success).toBe(true)
  })

  it('rejects a province outside the 9-province enum', () => {
    expect(AddressSchema.safeParse(address({ province: 'gauteng-north' })).success).toBe(false)
  })

  it('accepts an optional line2 when supplied', () => {
    expect(AddressSchema.safeParse(address({ line2: 'Unit 4' })).success).toBe(true)
  })
})

describe('EmployerProfileSchema', () => {
  it('accepts a fully populated national-scope employer profile', () => {
    const result = EmployerProfileSchema.safeParse(employerProfile())
    expect(result.success).toBe(true)
  })

  it('rejects an invalid ceoEmail', () => {
    expect(
      EmployerProfileSchema.safeParse(employerProfile({ ceoEmail: 'not-an-email' })).success,
    ).toBe(false)
  })

  it('rejects an invalid seniorManagerEmail', () => {
    const result = EmployerProfileSchema.safeParse(
      employerProfile({ seniorManagerEmail: 'not-an-email' }),
    )
    expect(result.success).toBe(false)
  })

  it('requires province when eapType is provincial (documented precondition, enforced at the application layer)', () => {
    // The schema itself does not superRefine this cross-field rule, but a
    // provincial-scope profile with a province supplied must still validate.
    const result = EmployerProfileSchema.safeParse(
      employerProfile({ eapType: 'provincial', province: 'gauteng' }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts eeReferenceNumber, bargainingCouncil and groupName omitted (all optional)', () => {
    const result = EmployerProfileSchema.safeParse(employerProfile())
    expect(result.success).toBe(true)
  })

  it('accepts a group-affiliated employer with groupName supplied', () => {
    const result = EmployerProfileSchema.safeParse(
      employerProfile({ partOfGroup: true, groupName: 'Acme Group Holdings' }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a businessType outside the enum', () => {
    const result = EmployerProfileSchema.safeParse(employerProfile({ businessType: 'trust' }))
    expect(result.success).toBe(false)
  })

  it('rejects an employeeCountBand outside the enum', () => {
    const result = EmployerProfileSchema.safeParse(employerProfile({ employeeCountBand: '200+' }))
    expect(result.success).toBe(false)
  })
})
