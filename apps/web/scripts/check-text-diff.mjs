// Focused verification using the same shared algorithm as the app and server.
import assert from 'node:assert/strict'
import { diffText } from '@gramota/contracts/text-diff'
const original = 'Я пока не могу точно обещать.'
const corrected = 'Я не могу пока точно обещать.'
const result = diffText(original, corrected)
assert.equal(result.groups.length, 1)
assert.equal(result.groups[0].kind, 'move')
assert.deepEqual(
  result.groups[0].correctedSpans.map(({ start, end }) => corrected.slice(start, end)),
  ['пока'],
)
assert.equal(diffText('Я отправел письмо вчера', 'Я отправил письмо вчера.').groups.length, 2)
assert.equal(diffText('Она был готов', 'Она была готова').groups.length, 2)
assert.equal(diffText('A   B', 'A B').groups.length, 1)
console.log('Passed shared diff smoke checks. Full regression suite: npm test -w apps/server.')
