import { config } from '../../config.js'
import { NotImplementedError } from '../signing/signing-provider.factory.js'
import { AnthropicProvider } from './anthropic-provider.js'
import { BedrockHaikuProvider } from './bedrock-haiku-provider.js'
import type { LLMProvider } from './llm-provider.js'

/**
 * Factory function that returns an LLMProvider instance based on the
 * LLM_PROVIDER environment variable (default: "bedrock-haiku").
 *
 * Unsupported values throw NotImplementedError (reused from signing factory).
 */
export function createLLMProvider(): LLMProvider {
  const p = config.LLM_PROVIDER
  if (p === 'bedrock-haiku') return new BedrockHaikuProvider()
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (p === 'anthropic') return new AnthropicProvider()
  // Unreachable per current Zod schema; guards against runtime enum extension
  throw new NotImplementedError(p as string)
}
