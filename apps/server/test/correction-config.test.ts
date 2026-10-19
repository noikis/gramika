import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import process from 'node:process'
import { readEnvironment } from '../src/correction-config'

test('environment loader uses the repository root rather than the server workspace', (t) => {
  const loader = t.mock.method(process, 'loadEnvFile', () => {})

  assert.ok(readEnvironment() === process.env)
  assert.equal(loader.mock.callCount(), 1)
  assert.deepEqual(loader.mock.calls[0].arguments, [resolve(__dirname, '../../../.env')])
})

test('missing root env file preserves runtime environment supplied by Docker', (t) => {
  t.mock.method(process, 'loadEnvFile', () => {
    throw Object.assign(new Error('Missing fixture'), { code: 'ENOENT' })
  })

  assert.ok(readEnvironment() === process.env)
})

test('unreadable root env file fails closed', (t) => {
  t.mock.method(process, 'loadEnvFile', () => {
    throw Object.assign(new Error('Unreadable fixture'), { code: 'EACCES' })
  })

  assert.deepEqual(readEnvironment(), {})
})
