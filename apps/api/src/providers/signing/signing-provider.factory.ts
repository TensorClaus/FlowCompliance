import { config } from '../../config.js'
import { InternalSigner } from './internal-signer.js'
import type { SigningProvider } from './signing-provider.js'

/**
 * Thrown when a configured signing provider is recognised but not yet
 * implemented. Currently applies to "opensign".
 */
export class NotImplementedError extends Error {
  constructor(provider: string) {
    super(`SigningProvider "${provider}" is not implemented`)
    this.name = 'NotImplementedError'
  }
}

/**
 * Factory function that returns a SigningProvider instance based on the
 * SIGNING_PROVIDER environment variable (default: "internal").
 */
export function createSigningProvider(): SigningProvider {
  const provider = config.SIGNING_PROVIDER
  if (provider === 'internal') return new InternalSigner()
  throw new NotImplementedError(provider)
}
