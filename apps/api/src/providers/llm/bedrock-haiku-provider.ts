// POPIA DATA RESIDENCY: AWS Bedrock af-south-1 keeps all data within the
// Republic of South Africa. No cross-border transfer occurs — no POPIA s.72
// concern when using this provider.

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { config } from '../../config.js'
import type { LLMCompletionOptions, LLMCompletionResult, LLMProvider } from './llm-provider.js'
import type { SanitisedPrompt } from './sanitised-prompt.js'

interface BedrockAnthropicResponse {
  content: Array<{ type: string; text: string }>
  model: string
  usage: { input_tokens: number; output_tokens: number }
}

export class BedrockHaikuProvider implements LLMProvider {
  readonly providerId = 'bedrock-haiku' as const

  private readonly client: BedrockRuntimeClient

  constructor() {
    this.client = new BedrockRuntimeClient({ region: config.AWS_REGION })
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

    const modelId = options?.model ?? config.BEDROCK_MODEL_ID

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0,
      messages: [{ role: 'user', content: prompt as string }],
    })

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    })

    const response = await this.client.send(command)
    const decoded = new TextDecoder().decode(response.body)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed: BedrockAnthropicResponse = JSON.parse(decoded)

    const result: LLMCompletionResult = {
      text: parsed.content[0]?.text ?? '',
      model: parsed.model,
      inputTokens: parsed.usage.input_tokens,
      outputTokens: parsed.usage.output_tokens,
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
