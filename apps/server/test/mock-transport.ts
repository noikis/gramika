import type { CorrectionTransport } from '../src/correction'
import { parseOpenRouterReply, type OpenRouterReply } from '../src/openrouter'

export function mockOpenRouterTransport(transport: {
  send(body: object, signal: AbortSignal): Promise<OpenRouterReply>
  close(): Promise<void>
}): CorrectionTransport {
  return {
    async send(body, signal, isRejectReasoning) {
      return parseOpenRouterReply(await transport.send(body, signal), isRejectReasoning)
    },
    close: () => transport.close(),
  }
}
