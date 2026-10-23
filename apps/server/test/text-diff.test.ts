import { test } from 'node:test'
import assert from 'node:assert/strict'
import { explanationSelection } from '@gramota/contracts/text-diff'
import { diffText, resolveWordMoves } from '@gramota/text-diff'
import { ExplanationInput, explanationSelectionKey } from '@gramota/contracts'

const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' })
function verify(original: string, corrected: string) {
  const result = diffText(original, corrected)
  assert.deepEqual(result, diffText(original, corrected), 'deterministic output')
  const equal: string[] = []
  for (const [text, runs, side] of [
    [original, result.originalRuns, 'originalSpans'],
    [corrected, result.correctedRuns, 'correctedSpans'],
  ] as const) {
    const boundaries = new Set([
      text.length,
      ...Array.from(graphemes.segment(text), (part) => part.index),
    ])
    let offset = 0
    for (const run of runs) {
      assert.equal(run.range.start, offset, 'runs partition the text without gaps/overlaps')
      assert(run.range.end > run.range.start)
      assert(boundaries.has(run.range.start) && boundaries.has(run.range.end))
      offset = run.range.end
      if (run.groupId) {
        const group = result.groups.find((value) => value.id === run.groupId)!
        assert(group)
        assert(
          group[side].some((span) => span.start === run.range.start && span.end === run.range.end),
        )
      }
    }
    assert.equal(offset, text.length)
    assert.equal(runs.map((run) => text.slice(run.range.start, run.range.end)).join(''), text)
    equal.push(
      runs
        .filter((run) => !run.groupId)
        .map((run) => text.slice(run.range.start, run.range.end))
        .join(''),
    )
  }
  // Independent coverage check: removing all claimed changes leaves the same text.
  if (result.groups.some((group) => group.kind === 'move')) {
    // Removing a moved word leaves a separator at its former slot. Compare the
    // retained lexical order and exact separator sequence independently.
    assert.equal(
      equal[0].replace(/\s/gu, ''),
      equal[1].replace(/\s/gu, ''),
      'retained lexical order',
    )
    assert.equal(
      equal[0].replace(/\S/gu, ''),
      equal[1].replace(/\S/gu, ''),
      'exact retained separators',
    )
  } else assert.equal(equal[0], equal[1], 'all remaining differences must be accounted for')
  for (const group of result.groups) {
    assert(
      ExplanationInput.safeParse(
        explanationSelection('00000000-0000-4000-8000-000000000000', group),
      ).success,
    )
    for (const [spans, context] of [
      [group.originalSpans, group.originalRange],
      [group.correctedSpans, group.correctedRange],
    ] as const)
      for (const span of spans) assert(span.start >= context.start && span.end <= context.end)
  }
  for (const marker of result.markers) {
    assert(marker.correctedOffset >= 0 && marker.correctedOffset <= corrected.length)
    assert(result.groups.some((group) => group.id === marker.groupId))
  }
  return result
}

test('whole words, punctuation and related grammar remain independent; unchanged context is not highlighted', () => {
  const original = 'Я отправел письмо вчера'
  const corrected = 'Я отправил письмо вчера.'
  const result = verify(original, corrected)
  assert.deepEqual(
    result.groups.map((group) =>
      group.correctedSpans.map((span) => corrected.slice(span.start, span.end)),
    ),
    [['отправил'], ['.']],
  )
  assert.equal(verify('Она был готов', 'Она была готова').groups.length, 2)
  const agreement = verify(
    'Я не получил никакого подтверждение.',
    'Я не получил никакого подтверждения.',
  )
  assert.equal(agreement.groups.length, 1)
  assert.equal(agreement.groups[0].correctedSpans[0].start, 'Я не получил никакого '.length)
  assert.equal(verify('Я посмотрел документацию.', 'Я изучил документацию.').groups.length, 1)
})

test('movement analysis chooses the smallest unique relocation independently of initial alignment', () => {
  // A hypothetical alignment retaining `пока` instead of `не могу` cannot influence this pass.
  assert.deepEqual(resolveWordMoves(['пока', 'не', 'могу'], ['не', 'могу', 'пока']), [
    { original: [0], corrected: [2] },
  ])
  for (const [original, corrected] of [
    ['Я пока не могу точно обещать.', 'Я не могу пока точно обещать.'],
    ['Я не могу пока точно обещать.', 'Я пока не могу точно обещать.'],
    ['пока я не могу', 'я не могу пока'],
    ['я не могу пока', 'пока я не могу'],
  ]) {
    const result = verify(original, corrected)
    const moves = result.groups.filter((group) => group.kind === 'move')
    assert.equal(moves.length, 1)
    assert.deepEqual(
      moves[0].originalSpans.map((span) => original.slice(span.start, span.end)),
      ['пока'],
    )
    assert.deepEqual(
      moves[0].correctedSpans.map((span) => corrected.slice(span.start, span.end)),
      ['пока'],
    )
    assert(
      result.markers.some(
        (marker) => marker.groupId === moves[0].id && marker.kind === 'move-source',
      ),
    )
  }
})

test('movement analysis stays local when sentence counts change', () => {
  const insertedSentence = verify(
    'Я пока не могу обещать, что закончу работу к пятнице. Мне нужно проверить несколько деталей.',
    'Я не могу пока обещать, что закончу работу к пятнице. Мне нужно проверить несколько деталей. Завтра обсудим сроки.',
  )
  assert.equal(insertedSentence.groups.filter((group) => group.kind === 'move').length, 1)
  assert(
    insertedSentence.groups.some((group) =>
      group.correctedSpans.some((span) =>
        'Я не могу пока обещать, что закончу работу к пятнице. Мне нужно проверить несколько деталей. Завтра обсудим сроки.'
          .slice(span.start, span.end)
          .includes('Завтра'),
      ),
    ),
  )

  const splitSentence = verify(
    'Я уже отправил преподавателю документы вчера. Он обещал посмотреть их на этой неделе, но пока ничего не ответил.',
    'Я уже вчера отправил преподавателю документы. Он обещал посмотреть их на этой неделе. Пока он ничего не ответил.',
  )
  const moves = splitSentence.groups.filter((group) => group.kind === 'move')
  assert.equal(moves.length, 1)
  assert.deepEqual(
    moves[0].originalSpans.map((span) =>
      'Я уже отправил преподавателю документы вчера.'.slice(span.start, span.end),
    ),
    ['вчера'],
  )
})

test('multiword/disjoint moves, competing interpretations, repeated words and budgets', () => {
  assert.deepEqual(
    resolveWordMoves(['сейчас', 'же', 'я', 'не', 'могу'], ['я', 'не', 'могу', 'сейчас', 'же']),
    [{ original: [0, 1], corrected: [3, 4] }],
  )
  const pair = verify('Я пока не могу и сразу не хочу.', 'Я не могу пока и не хочу сразу.')
  assert.equal(pair.groups.filter((group) => group.kind === 'move').length, 2)
  for (const [a, b] of [
    ['А Б', 'Б А'],
    ['кот кот пёс', 'кот пёс кот'],
  ])
    assert.equal(verify(a, b).groups.filter((group) => group.kind === 'move').length, 0)
  assert.deepEqual(resolveWordMoves(['а', 'б', 'в'], ['б', 'в', 'а'], { remaining: 0 }), [])
  const repeated = verify('кот кот пёс пёс', 'пёс кот пёс кот')
  assert.equal(
    repeated.groups.some((group) => group.kind === 'move'),
    false,
  )
})

test('split/join, whitespace, restructuring and mixed Unicode preserve every difference', () => {
  for (const [a, b] of [
    ['по этому', 'поэтому'],
    ['неверно', 'не верно'],
    ['Кто то пришёл.', 'Кто-то пришёл.'],
    ['Привет мир', 'Привет, мир!'],
    ['слово,', 'слово'],
    ['', '😀'],
    ['текст', ''],
    ['', ''],
    ['👩‍💻е́', '👩‍🔬ё'],
    ['\t', '\u00a0'],
    ['A   B', 'A B'],
    ['A\r\n\r\nB', 'A\r\nB'],
    [' A ', 'A'],
    ['A\tB', 'A B'],
    ['строка\nслова', 'строка слова'],
    ['Первое слово. Чтобы закончить', 'Первое слово, чтобы закончить.'],
    ['Новая фраза здесь.', 'Другая мысль тут.'],
    ['Вижу кота и пса.', 'Вижу кота, пса.'],
    ['Сегодя не удобно.', 'Сегодня неудобно.'],
    ['город 7 ого.', 'город 7-го.'],
    ['Я пока не могу.', 'Я не могу пока!'],
    ['Я пока не могу.\nЗдесь текст.', 'Я не могу пока.\nЗдесь текст!'],
  ])
    verify(a, b)
  assert.equal(diffText('по этому', 'поэтому').groups.length, 1)
  assert.equal(diffText('A   B', 'A B').groups.length, 1)
  assert.equal(diffText('Сегодя не удобно.', 'Сегодня неудобно.').groups.length, 2)
  assert.equal(
    diffText('пока я\nне могу', 'я\nне могу пока').groups.some((group) => group.kind === 'move'),
    false,
  )
})

test('bounded fallback preserves unique equal islands and large text', () => {
  verify('a '.repeat(2500), 'b '.repeat(2500))
  verify('слово '.repeat(800), 'слова '.repeat(799))
  const original = 'a '.repeat(200) + 'ЯКОРЬ ' + 'b '.repeat(200)
  const corrected = 'c '.repeat(200) + 'ЯКОРЬ ' + 'd '.repeat(200)
  const result = verify(original, corrected)
  assert(
    result.correctedRuns.some(
      (run) => !run.groupId && corrected.slice(run.range.start, run.range.end).includes('ЯКОРЬ'),
    ),
  )
  const repeatedOriginal = 'a '.repeat(200) + 'ОСТРОВ ОСТРОВ ' + 'b '.repeat(200)
  const repeatedCorrected = 'c '.repeat(200) + 'ОСТРОВ ОСТРОВ ' + 'd '.repeat(200)
  const repeated = verify(repeatedOriginal, repeatedCorrected)
  assert(
    repeated.correctedRuns.some(
      (run) =>
        !run.groupId && repeatedCorrected.slice(run.range.start, run.range.end).includes('ОСТРОВ'),
    ),
  )

  const stressOriginal = Array.from({ length: 8000 }, (_, index) => `слово${index % 8}`).join(' ')
  const stressCorrected = stressOriginal.split(' ').reverse().join(' ')
  const started = performance.now()
  const stress = verify(stressOriginal, stressCorrected)
  const elapsed = performance.now() - started
  assert(stress.groups.length > 0)
  assert(Number.isFinite(elapsed))
  console.log(`text-diff stress fallback: ${Math.round(elapsed)}ms for 8,000 words`)
})

test('selection keys separate exact targets even when context is identical', () => {
  const selection = explanationSelection(
    '00000000-0000-4000-8000-000000000000',
    diffText('кот пёс', 'кит лис').groups[0],
  )
  assert.notEqual(
    explanationSelectionKey(selection),
    explanationSelectionKey({ ...selection, correctedSpans: [{ start: 4, end: 7 }] }),
  )
})

test('deterministic generated combinations cover repeats, Unicode, separators and punctuation', () => {
  let seed = 42
  const vocabulary = ['кот', 'кит', ' ', '  ', ',', '\n', 'е́', '👩‍💻', '👍🏽']
  function sample() {
    let text = ''
    for (let i = 0; i < 12; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      text += vocabulary[seed % vocabulary.length]
    }
    return text
  }
  for (let i = 0; i < 200; i++) verify(sample(), sample())
})
