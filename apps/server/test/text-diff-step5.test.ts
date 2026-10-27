import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffText } from '@gramota/text-diff'

import { assertOutcomes, invariants } from './support/text-diff/invariants'

function fragments(text: string, spans: { start: number; end: number }[]) {
  return spans.map((span) => text.slice(span.start, span.end))
}

function resultFor(original: string, corrected: string) {
  const result = diffText(original, corrected)
  assertOutcomes(invariants(original, corrected, result))
  return result
}

test('Step 5 groups low-confidence phrase rewrites locally', () => {
  for (const [original, corrected, expectedOriginal, expectedCorrected] of [
    ['Очень хорошо', 'Просто отлично', 'Очень хорошо', 'Просто отлично'],
    ['Новая фраза здесь.', 'Другая мысль тут.', 'Новая фраза здесь', 'Другая мысль тут'],
    [
      'Мы очень хорошо выполнили эту работу.',
      'Мы просто отлично выполнили эту работу.',
      'очень хорошо',
      'просто отлично',
    ],
    [
      'Он быстро написал письмо и проверил адрес.',
      'Он тщательно подготовил сообщение и проверил адрес.',
      'быстро написал письмо',
      'тщательно подготовил сообщение',
    ],
    [
      'На встрече мы обсудили важные детали проекта.',
      'На встрече мы рассмотрели ключевые вопросы проекта.',
      'обсудили важные детали',
      'рассмотрели ключевые вопросы',
    ],
  ] as const) {
    const result = resultFor(original, corrected)
    assert.equal(result.groups.length, 1)
    assert.equal(result.groups[0].kind, 'replace')
    assert.deepEqual(fragments(original, result.groups[0].originalSpans), [expectedOriginal])
    assert.deepEqual(fragments(corrected, result.groups[0].correctedSpans), [expectedCorrected])
  }
})

test('Step 5 preserves reliable local corrections', () => {
  for (const [original, corrected, expected] of [
    [
      'Она был готов, когда началась встреча.',
      'Она была готова, когда началась встреча.',
      ['был', 'готов'],
    ],
    [
      'Я допустил ашибку при отправке письма.',
      'Я допустил ошибку при отправке письма.',
      ['ашибку'],
    ],
    [
      'Мы отправили старый отчёт клиенту вчера.',
      'Мы отправили новый отчёт клиенту вчера.',
      ['старый'],
    ],
  ] as const) {
    const result = resultFor(original, corrected)
    assert.deepEqual(
      result.groups.flatMap((group) => fragments(original, group.originalSpans)),
      expected,
    )
    assert(result.groups.every((group) => group.kind === 'replace'))
  }
})

test('Step 5 separates a rewrite from an independent spelling correction', () => {
  const original = 'Мы быстро сделали отчёт, но допустили ашибку.'
  const corrected = 'Мы тщательно подготовили документ, но допустили ошибку.'
  const result = resultFor(original, corrected)
  assert.equal(result.groups.length, 2)
  assert.deepEqual(
    result.groups.map((group) => fragments(original, group.originalSpans)),
    [['быстро сделали отчёт'], ['ашибку']],
  )
  assert.deepEqual(
    result.groups.map((group) => fragments(corrected, group.correctedSpans)),
    [['тщательно подготовили документ'], ['ошибку']],
  )
})

test('Step 5 preserves Step 3 and Step 4 local corrections', () => {
  const separator = resultFor(
    'Мы настроили чат бот и проверили его ответы.',
    'Мы настроили чат-бот и проверили его ответы.',
  )
  assert.equal(separator.groups.length, 1)
  assert.equal(separator.groups[0].kind, 'replace')
  assert.deepEqual(
    fragments('Мы настроили чат бот и проверили его ответы.', separator.groups[0].originalSpans),
    [' '],
  )
  assert.deepEqual(
    fragments('Мы настроили чат-бот и проверили его ответы.', separator.groups[0].correctedSpans),
    ['-'],
  )

  const punctuation = resultFor(
    'Добрый день! Файл готов.Проверьте вложение.',
    'Добрый день! Файл готов. Проверьте вложение.',
  )
  assert.equal(punctuation.groups.length, 1)
  assert.equal(punctuation.groups[0].kind, 'whitespace')
  assert.deepEqual(
    fragments('Добрый день! Файл готов.Проверьте вложение.', punctuation.groups[0].originalSpans),
    [],
  )
  assert.deepEqual(
    fragments('Добрый день! Файл готов. Проверьте вложение.', punctuation.groups[0].correctedSpans),
    [' '],
  )
})
