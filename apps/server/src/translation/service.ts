import {
  TIMEOUT_MS,
  TranslationInput,
  TranslationSuccess,
  type TranslationErrorCode,
  type TranslationScope,
  type TranslationTarget,
} from '@gramota/contracts'
import { request } from 'undici'
import { HTTP_STATUS } from '../http-status'

export function createTranslationService(deps: { url?: string; timeoutMs?: number }) {
  return async function translate(
    text: string,
    target: TranslationTarget,
    scope: TranslationScope,
  ) {
    const input = TranslationInput.safeParse({ text, target, scope })
    if (!input.success) throw new TranslationError('INVALID_INPUT')
    if (!deps.url) throw new TranslationError('NOT_CONFIGURED')

    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new TranslationError('TIMEOUT'))
        }, deps.timeoutMs ?? TIMEOUT_MS)
      })
      const response = await Promise.race([
        request(`${deps.url}/translate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ q: input.data.text, source: 'ru', target, format: 'text' }),
          signal: controller.signal,
        }),
        timeout,
      ])
      if (response.statusCode !== HTTP_STATUS.OK) throw new TranslationError('UPSTREAM_ERROR')
      let payload: unknown
      try {
        payload = await response.body.json()
      } catch {
        throw new TranslationError('INVALID_RESPONSE')
      }
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('translatedText' in payload) ||
        typeof payload.translatedText !== 'string' ||
        !payload.translatedText.trim()
      )
        throw new TranslationError('INVALID_RESPONSE')
      return TranslationSuccess.parse({ text: payload.translatedText, target, scope })
    } catch (error) {
      if (error instanceof TranslationError) throw error
      throw new TranslationError('UPSTREAM_ERROR')
    } finally {
      clearTimeout(timer)
    }
  }
}

export class TranslationError extends Error {
  constructor(readonly code: TranslationErrorCode) {
    super(code)
  }
}
