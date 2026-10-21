// Focused local verification with Node 24's native TypeScript support; no test runner.
import assert from 'node:assert/strict'
import { diffText, isWhitespaceOnlyChange } from '../src/lib/text-diff.ts'
import {
  correctionDescription,
  whitespaceComparison,
  whitespaceSummary,
} from '../src/lib/whitespace-display.ts'

assert.equal(
  correctionDescription('Фраза.  Следующая', 'Фраза. Следующая', true),
  'Removed an extra space after the period: 2 → 1.',
)
assert.equal(correctionDescription('A   B', 'A B', true), 'Removed 2 extra spaces: 3 → 1.')
assert.equal(correctionDescription('A', 'A ', true), 'Added a space: 0 → 1.')
assert.equal(
  correctionDescription('A\r\n\r\nB', 'A\r\nB', true),
  'Adjusted spacing: 2 line breaks → 1 line break.',
)
assert.equal(correctionDescription('не удобно.', 'неудобно.', false), 'Joined two words.')
assert.equal(correctionDescription('неверно', 'не верно', false), 'Split one word into two.')
assert.equal(correctionDescription('не удобно.', 'Неудобно.', false), 'Text change')
assert.equal(correctionDescription('кот', 'кит', false), 'Text change')
assert.equal(whitespaceSummary('A\tB', 'A B'), '1 tab → 1 space')
assert.equal(whitespaceSummary(' A', 'A'), '1 space → no whitespace')
for (const [original, corrected] of [
  ['Фраза.  Следующая.', 'Фраза. Следующая.'],
  ['A   B', 'A B'],
  ['A\n\nB', 'A\nB'],
  ['A\t\tB', 'A\tB'],
]) {
  const parts = diffText(original, corrected)
  const index = parts.findIndex((part) => part.kind === 'correction')
  const comparison = whitespaceComparison(parts[index], parts[index + 1])
  assert.equal(comparison.original, original)
  assert.equal(comparison.corrected, corrected)
  assert.equal(parts.map((part) => part.original).join(''), original)
  assert.equal(parts.map((part) => part.corrected).join(''), corrected)
  if (original.startsWith('Фраза')) {
    assert.equal(whitespaceSummary(comparison.original, comparison.corrected), '2 spaces → 1 space')
  }
}

const cases = [
  ['Превет мир', 'Привет мир'],
  ['по этому', 'поэтому'],
  ['неверно', 'не верно'],
  ['кот пёс', 'кит лис'],
  ['Привет мир', 'Привет, мир!'],
  ['слово,', 'слово'],
  ['слово', 'слово,'],
  ['a  b', 'a b'],
  ['a\nb', 'a\n\nb'],
  ['\t', '\u00a0'],
  ['', '😀'],
  ['👩‍💻е́', '👩‍🔬ё'],
  ['текст', ''],
  ['', ''],
  ['один один два', 'один два два'],
  ['без правок', 'без правок'],
  ['Новая фраза здесь.', 'Другая мысль тут.'],
  ['a '.repeat(2500), 'b '.repeat(2500)],
  [
    'Сегодя  не удобно. Завтра  приеду  в город 7 ого.',
    'Сегодня неудобно. Завтра приеду в город 7-го.',
  ],
  ['Первое слово. Чтобы закончить', 'Первое слово, чтобы закончить.'],
  ['Вижу кота и пса.', 'Вижу кота, пса.'],
  ['Один  пробел.', 'Один пробел.'],
  ['Кто то пришёл.', 'Кто-то пришёл.'],
]

for (const [original, corrected] of [
  ['слово  ', 'слово '],
  ['два  слова', 'два слова'],
  ['строка\nслова', 'строка слова'],
  ['\t', '\u00a0'],
])
  assert.equal(isWhitespaceOnlyChange(original, corrected), true)
for (const [original, corrected] of [
  ['не удобно', 'неудобно'],
  ['кот', 'кит'],
  ['слово', 'слово,'],
  ['Слово  ', 'слово '],
  ['одинаково', 'одинаково'],
])
  assert.equal(isWhitespaceOnlyChange(original, corrected), false)

const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' })
function edges(text) {
  return new Set([text.length, ...Array.from(graphemes.segment(text), (part) => part.index)])
}

function verify(original, corrected) {
  const segments = diffText(original, corrected)
  assert.equal(segments.map((part) => part.original).join(''), original)
  assert.equal(segments.map((part) => part.corrected).join(''), corrected)
  const oldEdges = edges(original)
  const newEdges = edges(corrected)
  let oldOffset = 0
  let newOffset = 0
  for (const part of segments) {
    if (part.kind === 'correction') {
      assert.deepEqual(part.originalRange, {
        start: oldOffset,
        end: oldOffset + part.original.length,
      })
      assert.deepEqual(part.correctedRange, {
        start: newOffset,
        end: newOffset + part.corrected.length,
      })
      assert(oldEdges.has(part.originalRange.start) && oldEdges.has(part.originalRange.end))
      assert(newEdges.has(part.correctedRange.start) && newEdges.has(part.correctedRange.end))
      assert.notEqual(part.original, part.corrected)
    }
    oldOffset += part.original.length
    newOffset += part.corrected.length
  }
}

for (const [original, corrected] of cases) verify(original, corrected)

// Deterministic combinations exercise repeated tokens and mixed Unicode alignment.
let seed = 42
const vocabulary = ['кот', 'кит', ' ', '  ', ',', '\n', 'е́', '👩‍💻', '👍🏽']
function sample() {
  let text = ''
  for (let index = 0; index < 12; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    text += vocabulary[seed % vocabulary.length]
  }
  return text
}
for (let index = 0; index < 200; index++) verify(sample(), sample())

const units = (original, corrected) =>
  diffText(original, corrected).filter((part) => part.kind === 'correction')
assert.equal(units('кот пёс', 'кит лис').length, 1)
const groupedCases = [
  ['никого подтверждение', 'никакого подтверждения'],
  ['кот  пёс', 'кит  лис'],
  ['кот\u00a0пёс', 'кит\u00a0лис'],
  ['кот пёс дом', 'кит лис дым'],
  ['е́нот кот', 'е́ноты кит'],
]
for (const [original, corrected] of groupedCases) {
  verify(original, corrected)
  assert.deepEqual(
    units(original, corrected).map((part) => [part.original, part.corrected]),
    [[original, corrected]],
  )
}
const separatedCases = [
  ['кот и пёс', 'кит и лис'],
  ['кот, пёс', 'кит, лис'],
  ['кот. пёс', 'кит. лис'],
  ['кот; пёс', 'кит; лис'],
  ['кот - пёс', 'кит - лис'],
  ['кот\nпёс', 'кит\nлис'],
  ['кот\r\nпёс', 'кит\r\nлис'],
  ['кот\n\nпёс', 'кит\n\nлис'],
  ['кот\u2028пёс', 'кит\u2028лис'],
  ['кот\u2029пёс', 'кит\u2029лис'],
  ['кот\tпёс', 'кит\tлис'],
  ['кот 👩‍💻 пёс', 'кит 👩‍💻 лис'],
]
for (const [original, corrected] of separatedCases) {
  verify(original, corrected)
  assert.equal(units(original, corrected).length, 2, original)
}
assert(units('кот лишний пёс', 'кот пёс').some((part) => part.corrected === ''))
assert.equal(units('по этому', 'поэтому').length, 1)
assert.equal(units('неверно', 'не верно').length, 1)
assert.equal(units('без правок', 'без правок').length, 0)
assert.equal(units('a '.repeat(2500), 'b '.repeat(2500)).length, 1)
assert.deepEqual(
  units('город 7 ого.', 'город 7-го.').map((part) => [part.original, part.corrected]),
  [['7 ого.', '7-го.']],
)
assert.deepEqual(
  units('Вижу кота и пса.', 'Вижу кота, пса.').map((part) => [part.original, part.corrected]),
  [['кота и', 'кота,']],
)
assert.deepEqual(
  units('Сегодя не удобно.', 'Сегодня неудобно.').map((part) => [part.original, part.corrected]),
  [['Сегодя не удобно.', 'Сегодня неудобно.']],
)
assert.deepEqual(
  units('не удобно сегодя', 'неудобно сегодня').map((part) => [part.original, part.corrected]),
  [['не удобно сегодя', 'неудобно сегодня']],
)
assert.deepEqual(
  units('Первое слово. Чтобы закончить', 'Первое слово, чтобы закончить.').map((part) => [
    part.original,
    part.corrected,
  ]),
  [
    ['слово.', 'слово,'],
    ['Чтобы закончить', 'чтобы закончить.'],
  ],
)
assert.deepEqual(
  units('Кто то пришёл.', 'Кто-то пришёл.').map((part) => [part.original, part.corrected]),
  [['Кто то', 'Кто-то']],
)
for (const [original, corrected] of cases.filter(([text]) => /\S/u.test(text))) {
  for (const part of units(original, corrected)) {
    assert(
      /\S/u.test(part.original + part.corrected),
      'Whitespace edits must retain visible word context',
    )
  }
}
console.log(
  `Passed ${cases.length} edge cases, ${groupedCases.length} grouped cases, ${separatedCases.length} boundary cases and 200 generated pairs; ranges, reconstruction, graphemes and grouping.`,
)
