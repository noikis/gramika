import { HTTP_STATUS } from '../http-status'
import { ErrorCode } from '@gramota/contracts'
import { CorrectionError, type CorrectionTransport } from '../correction'
import { parseOpenRouterReply } from './response'
import { Agent, ProxyAgent, request, type Dispatcher } from 'undici'
import type { ServerConfig } from '../correction-config'

const MAX_RESPONSE_BYTES = 1024 * 1024

type DispatcherFactories = {
  direct(): Dispatcher
  proxy(url: string): Dispatcher
}
const dispatchers: DispatcherFactories = {
  direct: () => new Agent(),
  proxy: (url) => new ProxyAgent(url),
}

export function createTransport(
  config: ServerConfig,
  factories: DispatcherFactories = dispatchers,
): CorrectionTransport {
  const url = 'https://openrouter.ai/api/v1/chat/completions'
  const dispatcher = config.proxyUrl ? factories.proxy(config.proxyUrl) : factories.direct()
  const headers = {
    authorization: `Bearer ${config.apiKey}`,
    'content-type': 'application/json',
    'X-OpenRouter-Metadata': 'enabled',
  }

  return {
    async send(body, signal, isRejectReasoning = true) {
      const response = await request(url, {
        dispatcher,
        method: 'POST',
        signal,
        headers,
        body: JSON.stringify(body),
      })

      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of response.body) {
        size += chunk.length
        if (size > MAX_RESPONSE_BYTES) {
          response.body.destroy()
          throw new CorrectionError(ErrorCode.enum.INVALID_RESPONSE)
        }
        chunks.push(Buffer.from(chunk))
      }

      let data: unknown
      try {
        data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        throw new CorrectionError(
          response.statusCode === HTTP_STATUS.OK
            ? ErrorCode.enum.INVALID_RESPONSE
            : ErrorCode.enum.UPSTREAM_ERROR,
        )
      }
      return parseOpenRouterReply({ status: response.statusCode, data }, isRejectReasoning)
    },
    async close() {
      await dispatcher.close()
    },
  }
}
