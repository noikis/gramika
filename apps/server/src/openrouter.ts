import { Agent, ProxyAgent, request, type Dispatcher } from 'undici'
import type { ServerConfig } from './correction-config'
import type { ErrorCode } from '@gramota/contracts'

export class CorrectionError extends Error {
  constructor(readonly code: ErrorCode) { super(code) }
}

export type UpstreamReply = { status: number; data: unknown }
export interface CorrectionTransport {
  send(body: object, signal: AbortSignal): Promise<UpstreamReply>
  close(): Promise<void>
}

type DispatcherFactories = { direct(): Dispatcher; proxy(url: string): Dispatcher }
const dispatchers: DispatcherFactories = { direct: () => new Agent(), proxy: url => new ProxyAgent(url) }

export function createTransport(config: ServerConfig, factories: DispatcherFactories = dispatchers): CorrectionTransport {
  const dispatcher = config.proxyUrl ? factories.proxy(config.proxyUrl) : factories.direct()
  return {
    async send(body, signal) {
      const response = await request('https://openrouter.ai/api/v1/chat/completions', {
        dispatcher, method: 'POST', signal,
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
          'X-OpenRouter-Metadata': 'enabled',
        },
        body: JSON.stringify(body),
      })
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of response.body) {
        size += chunk.length
        if (size > 1024 * 1024) {
          response.body.destroy()
          throw new CorrectionError('INVALID_RESPONSE')
        }
        chunks.push(Buffer.from(chunk))
      }
      let data: unknown
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
      catch { throw new CorrectionError(response.statusCode === 200 ? 'INVALID_RESPONSE' : 'UPSTREAM_ERROR') }
      return { status: response.statusCode, data }
    },
    async close() { await dispatcher.close() },
  }
}
