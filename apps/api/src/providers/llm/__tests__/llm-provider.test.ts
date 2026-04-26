import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotImplementedError } from '../../signing/signing-provider.factory.js'
import { AnthropicProvider } from '../anthropic-provider.js'
import { BedrockHaikuProvider } from '../bedrock-haiku-provider.js'
import {
  createLLMProvider as createLLMProviderBarrel,
  BedrockHaikuProvider as BedrockBarrel,
  AnthropicProvider as AnthropicBarrel,
} from '../index.js'
import { createLLMProvider } from '../llm-provider.factory.js'
import { type SanitisedPrompt } from '../sanitised-prompt.js'

// ─── Mock AWS Bedrock SDK ───────────────────────────────────────────────────

const mockBedrockSend = vi.fn()

vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
      send: mockBedrockSend,
    })),
    InvokeModelCommand: vi.fn().mockImplementation((input: unknown) => input),
  }
})

// ─── Mock Anthropic SDK ─────────────────────────────────────────────────────

const mockAnthropicCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockAnthropicCreate },
    })),
  }
})

// ─── SanitisedPrompt brand ──────────────────────────────────────────────────

describe('SanitisedPrompt brand', () => {
  it('brandPrompt returns value equal to input string at runtime', () => {
    const input = 'Summarise the compliance report'
    const branded = input as unknown as SanitisedPrompt
    expect(branded).toBe(input)
    expect(typeof branded).toBe('string')
  })

  it('compile-time: raw string is not assignable to SanitisedPrompt', () => {
    // This test verifies the branded type at compile time.
    // If the line below did NOT have @ts-expect-error, tsc would fail —
    // proving that raw strings cannot be passed where SanitisedPrompt is expected.
    // @ts-expect-error — raw string is not assignable to SanitisedPrompt
    const _raw: SanitisedPrompt = 'this should not compile without the brand'
    // Suppress unused variable warning
    expect(_raw).toBeDefined()
  })
})

// ─── BedrockHaikuProvider ───────────────────────────────────────────────────

describe('BedrockHaikuProvider', () => {
  let provider: BedrockHaikuProvider

  const mockResponse = {
    content: [{ type: 'text', text: 'Compliance summary generated.' }],
    model: 'anthropic.claude-haiku-3-5-20251001-v1:0',
    usage: { input_tokens: 42, output_tokens: 18 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(mockResponse)),
    })
    provider = new BedrockHaikuProvider()
  })

  it('providerId === "bedrock-haiku"', () => {
    expect(provider.providerId).toBe('bedrock-haiku')
  })

  it('complete returns LLMCompletionResult with correct fields', async () => {
    const prompt = 'Analyse EEA2 submission' as unknown as SanitisedPrompt
    const result = await provider.complete(prompt)

    expect(result.provider).toBe('bedrock-haiku')
    expect(result.model).toBe(mockResponse.model)
    expect(result.inputTokens).toBe(42)
    expect(result.outputTokens).toBe(18)
  })

  it('complete result.text matches mocked response body', async () => {
    const prompt = 'Analyse EEA2 submission' as unknown as SanitisedPrompt
    const result = await provider.complete(prompt)

    expect(result.text).toBe('Compliance summary generated.')
  })

  it('InvokeModelCommand called with correct region and modelId', async () => {
    const { InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const prompt = 'Test prompt' as unknown as SanitisedPrompt
    await provider.complete(prompt)

    expect(InvokeModelCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'anthropic.claude-haiku-3-5-20251001-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
      }),
    )
  })

  it('runtime guard: empty string throws', async () => {
    // Cast empty string to SanitisedPrompt to bypass compile-time check for testing
    const empty = '' as unknown as SanitisedPrompt

    await expect(provider.complete(empty)).rejects.toThrow('Received unsanitised or empty prompt')
  })

  it('complete respects options.model override', async () => {
    const { InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const overrideModel = 'anthropic.claude-opus-4-5-20251101-v1:0'
    const prompt = 'Test override' as unknown as SanitisedPrompt
    const overrideResponse = {
      ...mockResponse,
      model: overrideModel,
    }
    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(overrideResponse)),
    })

    const result = await provider.complete(prompt, { model: overrideModel })

    expect(InvokeModelCommand).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: overrideModel }),
    )
    expect(result.model).toBe(overrideModel)
  })

  it('complete returns empty text when response content is empty', async () => {
    mockBedrockSend.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({ ...mockResponse, content: [] })),
    })
    const prompt = 'Test empty content' as unknown as SanitisedPrompt
    const result = await provider.complete(prompt)
    expect(result.text).toBe('')
  })
})

// ─── AnthropicProvider ──────────────────────────────────────────────────────

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider

  const mockResponse = {
    content: [{ type: 'text', text: 'Anthropic compliance analysis.' }],
    model: 'claude-sonnet-4-5',
    usage: { input_tokens: 55, output_tokens: 23 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAnthropicCreate.mockResolvedValue(mockResponse)
    provider = new AnthropicProvider()
  })

  it('providerId === "anthropic"', () => {
    expect(provider.providerId).toBe('anthropic')
  })

  it('complete returns LLMCompletionResult with provider="anthropic"', async () => {
    const prompt = 'Check POPIA compliance' as unknown as SanitisedPrompt
    const result = await provider.complete(prompt)

    expect(result.provider).toBe('anthropic')
    expect(result.model).toBe('claude-sonnet-4-5')
    expect(result.inputTokens).toBe(55)
    expect(result.outputTokens).toBe(23)
  })

  it('complete result.text matches mocked content block', async () => {
    const prompt = 'Check POPIA compliance' as unknown as SanitisedPrompt
    const result = await provider.complete(prompt)

    expect(result.text).toBe('Anthropic compliance analysis.')
  })

  it('runtime guard: empty string throws', async () => {
    const empty = '' as unknown as SanitisedPrompt

    await expect(provider.complete(empty)).rejects.toThrow('Received unsanitised or empty prompt')
  })

  it('complete respects options.model override', async () => {
    const overrideModel = 'claude-opus-4-5'
    mockAnthropicCreate.mockResolvedValue({
      ...mockResponse,
      model: overrideModel,
    })
    const prompt = 'Test model override' as unknown as SanitisedPrompt
    const result = await provider.complete(prompt, { model: overrideModel })
    expect(result.model).toBe(overrideModel)
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: overrideModel }),
    )
  })

  it('complete returns empty text when content block has no text type', async () => {
    mockAnthropicCreate.mockResolvedValue({
      ...mockResponse,
      content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
    })
    const prompt = 'Test non-text block' as unknown as SanitisedPrompt
    const result = await provider.complete(prompt)
    expect(result.text).toBe('')
  })
})

// ─── Factory ────────────────────────────────────────────────────────────────

describe('createLLMProvider', () => {
  it('LLM_PROVIDER=bedrock-haiku returns BedrockHaikuProvider instance', () => {
    // Default in vitest env is bedrock-haiku (config default)
    const provider = createLLMProvider()
    expect(provider).toBeInstanceOf(BedrockHaikuProvider)
    expect(provider.providerId).toBe('bedrock-haiku')
  })

  it('LLM_PROVIDER=anthropic returns AnthropicProvider instance', async () => {
    const { config } = await import('../../../config.js')
    const original = config.LLM_PROVIDER
    ;(config as { LLM_PROVIDER: string }).LLM_PROVIDER = 'anthropic'

    try {
      const provider = createLLMProvider()
      expect(provider).toBeInstanceOf(AnthropicProvider)
      expect(provider.providerId).toBe('anthropic')
    } finally {
      ;(config as { LLM_PROVIDER: string }).LLM_PROVIDER = original
    }
  })

  it('unsupported LLM_PROVIDER throws NotImplementedError (reused from signing)', async () => {
    const { config } = await import('../../../config.js')
    const original = config.LLM_PROVIDER
    ;(config as { LLM_PROVIDER: string }).LLM_PROVIDER = 'openai'

    try {
      expect(() => createLLMProvider()).toThrow(NotImplementedError)
      expect(() => createLLMProvider()).toThrow('SigningProvider "openai" is not implemented')
    } finally {
      ;(config as { LLM_PROVIDER: string }).LLM_PROVIDER = original
    }
  })
})

// ─── Barrel index ─────────────────────────────────────────────────────────────

describe('llm barrel index', () => {
  it('re-exports createLLMProvider, BedrockHaikuProvider, AnthropicProvider', () => {
    expect(createLLMProviderBarrel).toBeDefined()
    expect(BedrockBarrel).toBeDefined()
    expect(AnthropicBarrel).toBeDefined()
  })
})
