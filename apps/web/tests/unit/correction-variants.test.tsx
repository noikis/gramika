import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useResultPair } from '../../src/hooks/use-result-pair'
import { correctionResult } from './fixtures'

describe('correction variants', () => {
  it('keeps results from both modes in a single mobile sequence', () => {
    const { result } = renderHook(() => useResultPair(0))
    const strict = correctionResult()
    const rewrite = correctionResult({
      requestId: '00000000-0000-4000-8000-000000000003',
      correctedText: 'Привет, дорогой мир',
      mode: 'gentle-rewrite',
    })

    act(() => result.current.receive(strict, 0))
    expect(result.current.variants).toHaveLength(1)
    expect(result.current.visibleVariant?.requestId).toBe(strict.requestId)
    expect(result.current.variants[0].view).toBe('changes')

    act(() => result.current.receive(rewrite, 0))
    expect(result.current.variants).toHaveLength(2)
    expect(result.current.visibleVariant?.requestId).toBe(rewrite.requestId)

    act(() => result.current.selectVariant(strict.requestId))
    expect(result.current.visibleVariant?.requestId).toBe(strict.requestId)
    expect(result.current.variants).toHaveLength(2)
  })

  it('retains each variant display mode independently', () => {
    const { result } = renderHook(() => useResultPair(0))
    const strict = correctionResult()
    const rewrite = correctionResult({
      requestId: '00000000-0000-4000-8000-000000000003',
      mode: 'gentle-rewrite',
    })
    act(() => {
      result.current.receive(strict, 0)
      result.current.receive(rewrite, 0)
    })
    act(() => result.current.setResultView(strict.requestId, 'text'))
    expect(result.current.variants.find((entry) => entry.result.requestId === strict.requestId)?.view)
      .toBe('text')
    expect(result.current.variants.find((entry) => entry.result.requestId === rewrite.requestId)?.view)
      .toBe('changes')
  })
})
