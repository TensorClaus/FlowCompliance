import 'dotenv/config'
import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.url('DATABASE_URL must be a valid URL'),
  REDIS_URL: z.url('REDIS_URL must be a valid URL'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  SIGNING_PROVIDER: z.enum(['internal', 'opensign']).default('internal'),
  LLM_PROVIDER: z.enum(['bedrock-haiku', 'anthropic']).default('bedrock-haiku'),
  AWS_REGION: z.string().default('af-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  KMS_KEY_ID: z.string().optional(),
  BEDROCK_MODEL_ID: z.string().default('anthropic.claude-haiku-3-5-20251001-v1:0'),
  ANTHROPIC_API_KEY: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables - startup aborted')
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  throw new Error('Invalid environment variables')
}

export const config = parsed.data

// eslint-disable-next-line no-console
console.info('Auth config loaded successfully')

export type Config = typeof config
