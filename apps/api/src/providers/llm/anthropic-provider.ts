// POPIA s.72 NOTE: AnthropicProvider routes data to Anthropic's servers
// outside the Republic of South Africa. Before enabling in production,
// confirm one of the following is in place:
// (a) A data processor agreement with Anthropic satisfying POPIA s.72(1)(c), OR
// (b) A written consent from the data subject per POPIA s.72(1)(a), OR
// (c) The data subject's country is on the Information Regulator's adequate
//     protection list per POPIA s.72(1)(b).
// BedrockHaikuProvider (af-south-1) is the default for POPIA-safe operation.

import Anthropic from '@anthropic-ai/sdk'
import { config } from '../../config.js'
import type { LLMCompletionOptions, LLMCompletionResult, LLMProvider } from './llm-provider.js'
import type { SanitisedPrompt } from './sanitised-prompt.js'

const DEFAULT_MODEL = 'claude-sonnet-4-5'

export class AnthropicProvider implements LLMProvider {
  readonly providerId = 'anthropic' as const

  private readonly client: Anthropic

  constructor() {
    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  }

  async complete(
    prompt: SanitisedPrompt,
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletionResult> {
    // Runtime defence-in-depth: reject falsy prompts even though the branded
    // type should prevent this at compile time.
    if (!prompt) {
      throw new Error('Received unsanitised or empty prompt')
    }

    const model = options?.model ?? DEFAULT_MODEL

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0,
      messages: [{ role: 'user', content: prompt as string }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')

    const result: LLMCompletionResult = {
      text: textBlock?.type === 'text' ? textBlock.text : '',
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      provider: this.providerId,
    }

    // POPIA: log only metadata — never prompt content
    // eslint-disable-next-line no-console
    console.info({
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })

    return result
  }
}
