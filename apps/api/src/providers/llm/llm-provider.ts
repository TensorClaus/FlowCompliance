import type { SanitisedPrompt } from './sanitised-prompt.js'

export interface LLMCompletionOptions {
  maxTokens?: number // default 1024
  temperature?: number // default 0 (deterministic for compliance)
  model?: string // override default model for this provider
}

export interface LLMCompletionResult {
  text: string
  model: string // actual model used (may differ from requested)
  inputTokens: number
  outputTokens: number
  provider: string // 'bedrock-haiku' | 'anthropic'
}

export interface LLMProvider {
  /**
   * Send a sanitised prompt to the LLM. The `SanitisedPrompt` branded type
   * ensures the compiler rejects any raw string passed here — the caller
   * must have passed through the C3 sanitisation layer first.
   *
   * POPIA: never log `prompt.toString()`. Log only
   * { provider, model, inputTokens, outputTokens }.
   */
  complete(prompt: SanitisedPrompt, options?: LLMCompletionOptions): Promise<LLMCompletionResult>

  /** Human-readable identifier for this provider instance. */
  readonly providerId: string
}
