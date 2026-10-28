import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL_ID } from '@gramota/contracts'
import { requestCorrection } from '../../src/api/corrections'
import { CORRECTION_ID, correctionResult } from './fixtures'

describe('correction API', () => {
  it('sends one explicit correction request with the validated payload', async () => {
    const result = correctionResult()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await requestCorrection({
      text: result.originalText,
      mode: result.mode,
      modelId: DEFAULT_MODEL_ID,
      forceRefresh: false,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/corrections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: result.originalText,
        mode: result.mode,
        modelId: DEFAULT_MODEL_ID,
        forceRefresh: false,
      }),
    })
    expect(response).toEqual({ success: true, result })
  })

  it('returns a typed failure without treating it as a successful result', async () => {
    const failure = {
      error: { code: 'UPSTREAM_ERROR', message: 'Unavailable' },
      correctionId: CORRECTION_ID,
      requestId: null,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(failure), { status: 503 })),
    )

    await expect(
      requestCorrection({
        text: 'Привет мир',
        mode: 'strict',
        modelId: DEFAULT_MODEL_ID,
        correctionId: CORRECTION_ID,
        forceRefresh: false,
      }),
    ).resolves.toEqual({ success: false, failure })
  })
})
