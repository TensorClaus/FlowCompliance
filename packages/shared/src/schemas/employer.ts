import { z } from 'zod'
import {
  BusinessTypeSchema,
  EAPTypeSchema,
  EmployeeCountBandSchema,
  ProvinceSchema,
} from '../enums.js'

/**
 * Postal or physical address schema for South African locations
 * Used for employer registration, correspondence, and compliance tracking
 */
export const AddressSchema = z.object({
  /** First line of address (required) */
  line1: z.string(),
  /** Second line of address (optional - e.g., suburb/district) */
  line2: z.string().optional(),
  /** City or town name */
  city: z.string(),
  /** South African province */
  province: ProvinceSchema,
  /** Postal code (4-digit format for SA) */
  postalCode: z.string(),
})

export type Address = z.infer<typeof AddressSchema>

/**
 * Employer profile schema for EEA compliance registration
 * Contains organization details, contact information, and compliance attributes
 * Based on DC-011 employment equity compliance requirements
 */
export const EmployerProfileSchema = z.object({
  /** Trading name of the employer */
  tradeName: z.string(),
  /** Name registered with Department of Trade, Industry and Competition */
  dtiRegistrationName: z.string(),
  /** DTI registration number */
  dtiRegistrationNumber: z.string(),
  /** PAYE SARS registration number for payroll tax purposes */
  payeSarsNumber: z.string(),
  /** Unemployment Insurance Fund reference number */
  uifReferenceNumber: z.string(),
  /** Employment Equity reference number (optional - issued by DoEL) */
  eeReferenceNumber: z.string().optional(),
  /** Employment Equity Plan type: national or provincial scope */
  eapType: EAPTypeSchema,
  /** Province for provincial EEP scope (required if eapType is 'provincial') */
  province: ProvinceSchema.optional(),
  /** Industry sector classification */
  industrySector: z.string(),
  /** SETA (Sector Education and Training Authority) classification */
  setaClassification: z.string(),
  /** Bargaining council code if applicable (optional) */
  bargainingCouncil: z.string().optional(),
  /** Main telephone contact number */
  telephone: z.string(),
  /** Postal address for correspondence */
  postalAddress: AddressSchema,
  /** Physical business address */
  physicalAddress: AddressSchema,
  /** Chief Executive Officer or authorized signatory name */
  ceoName: z.string(),
  /** CEO contact telephone number */
  ceoTelephone: z.string(),
  /** CEO contact email address */
  ceoEmail: z.email(),
  /** Senior manager or HR contact name */
  seniorManagerName: z.string(),
  /** Senior manager contact telephone number */
  seniorManagerTelephone: z.string(),
  /** Senior manager contact email address */
  seniorManagerEmail: z.email(),
  /** Business entity type classification */
  businessType: BusinessTypeSchema,
  /** Whether the employer is an organ of state */
  organOfState: z.boolean(),
  /** Employee count band for statistical reporting */
  employeeCountBand: EmployeeCountBandSchema,
  /** Whether the employer is part of a larger group */
  partOfGroup: z.boolean(),
  /** Name of parent/holding company (optional - required if partOfGroup is true) */
  groupName: z.string().optional(),
})

export type EmployerProfile = z.infer<typeof EmployerProfileSchema>
