import { describe, expect, it } from 'vitest'
import { diffText } from '../../src/lib/text-diff'

describe('text diff', () => {
  it('keeps deterministic ranges for a punctuation correction', () => {
    const diff = diffText('Привет мир', 'Привет, мир')
    expect(diff.groups).toHaveLength(1)
    expect(diff.groups[0]).toMatchObject({
      kind: 'insert',
      correctedRange: { start: 6, end: 7 },
    })
  })
})
