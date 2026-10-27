import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verify } from './support/text-diff/invariants'

const fragments = (text: string, spans: { start: number; end: number }[]) =>
  spans.map((span) => text.slice(span.start, span.end))

test('Step 4 isolates punctuation-boundary spacing', () => {
  const original = 'Добрый день! Файл готов.Проверьте вложение.'
  const corrected = 'Добрый день! Файл готов. Проверьте вложение.'
  const result = verify(original, corrected)
  assert.equal(result.groups.length, 1)
  assert.equal(result.groups[0].kind, 'whitespace')
  assert.deepEqual(result.groups[0].originalSpans, [])
  assert.deepEqual(result.groups[0].correctedSpans, [{ start: 24, end: 25 }])
  assert.deepEqual(fragments(corrected, result.groups[0].correctedSpans), [' '])
  assert.equal(corrected.slice(18, 24), 'готов.')
  assert.equal(corrected.slice(25, 34), 'Проверьте')
})

test('Step 4 keeps punctuation replacement local', () => {
  const original = 'Мы уже закончили работу! Всё проверено.'
  const corrected = 'Мы уже закончили работу? Всё проверено.'
  const result = verify(original, corrected)
  assert.equal(result.groups.length, 1)
  assert.equal(result.groups[0].kind, 'replace')
  assert.deepEqual(fragments(original, result.groups[0].originalSpans), ['!'])
  assert.deepEqual(fragments(corrected, result.groups[0].correctedSpans), ['?'])
})

test('Step 4 keeps whitespace and spelling independent', () => {
  const original = 'Я отправил файл,но допустил ашибку.'
  const corrected = 'Я отправил файл, но допустил ошибку.'
  const result = verify(original, corrected)
  assert.deepEqual(
    result.groups.map((group) => ({
      kind: group.kind,
      original: fragments(original, group.originalSpans),
      corrected: fragments(corrected, group.correctedSpans),
    })),
    [
      { kind: 'whitespace', original: [], corrected: [' '] },
      { kind: 'replace', original: ['ашибку'], corrected: ['ошибку'] },
    ],
  )
})

test('Step 4 leaves ambiguous punctuation tokens conservative', () => {
  for (const [original, corrected] of [
    ['3.14 готово', '3.14 готово'],
    ['т. д. готово', 'т. д. готово'],
    ['https://пример.рф', 'https://пример.рф'],
    ['Проверка... готова', 'Проверка... готова'],
    ['😀 готово', '😀 готово'],
    ['A\r\nB', 'A\nB'],
  ]) {
    const result = verify(original, corrected)
    assert.equal(result.groups.length, original === corrected ? 0 : 1)
  }
})
