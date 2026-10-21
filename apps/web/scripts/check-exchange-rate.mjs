import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mock } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import {
  createExchangeRateLoader,
  RATE_CACHE_KEY,
  RATE_CACHE_MAX_AGE_MS,
  RATE_TIMEOUT_MS,
} from '../src/lib/exchange-rate.ts'
import { formatCost } from '../src/lib/cost-format.ts'

const success = { result: 'success', base_code: 'USD', rates: { RUB: 80 } }
const response = (data = success) => new Response(JSON.stringify(data))
let currentTime = 1_800_000_000_000
let stored = null
let calls = 0
const storage = {
  getItem(key) {
    assert.equal(key, RATE_CACHE_KEY)
    return stored
  },
  setItem(key, value) {
    assert.equal(key, RATE_CACHE_KEY)
    stored = value
  },
}
const dependencies = {
  now: () => currentTime,
  getStorage: () => storage,
  fetchRate: async (url, options) => {
    calls++
    assert.equal(url, 'https://open.er-api.com/v6/latest/USD')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.referrerPolicy, 'no-referrer')
    return response()
  },
}
const load = createExchangeRateLoader(dependencies)
assert.deepEqual(await Promise.all([load(), load()]), [80, 80])
assert.equal(calls, 1)
assert.deepEqual(JSON.parse(stored), { rate: 80, fetchedAt: currentTime })
assert.equal(await createExchangeRateLoader(dependencies)(), 80)
assert.equal(calls, 1)
currentTime += RATE_CACHE_MAX_AGE_MS - 1
assert.equal(await load(), 80)
assert.equal(calls, 1)
currentTime++
assert.equal(await load(), 80)
assert.equal(calls, 2)

for (const cache of [
  '{',
  'null',
  '{}',
  JSON.stringify({ rate: 0, fetchedAt: currentTime }),
  JSON.stringify({ rate: 80, fetchedAt: currentTime + 1 }),
  JSON.stringify({ rate: 80, fetchedAt: String(currentTime) }),
  JSON.stringify({ rate: 80, fetchedAt: currentTime - RATE_CACHE_MAX_AGE_MS }),
]) {
  stored = cache
  const before = calls
  assert.equal(await createExchangeRateLoader(dependencies)(), 80)
  assert.equal(calls, before + 1)
}

const noStorage = createExchangeRateLoader({
  ...dependencies,
  getStorage: () => {
    throw Error('Storage blocked')
  },
})
const beforeMemory = calls
assert.equal(await noStorage(), 80)
assert.equal(await noStorage(), 80)
assert.equal(calls, beforeMemory + 1)

for (const data of [
  null,
  {},
  { ...success, result: 'error' },
  { ...success, base_code: 'EUR' },
  { ...success, rates: {} },
  ...[0, -1, null, '80'].map((RUB) => ({ ...success, rates: { RUB } })),
]) {
  assert.equal(
    await createExchangeRateLoader({
      ...dependencies,
      getStorage: () => ({ ...storage, getItem: () => null }),
      fetchRate: async () => response(data),
    })(),
    null,
  )
}
for (const fetchRate of [
  async () => {
    throw Error('Offline')
  },
  async () => new Response('{}', { status: 500 }),
  async () => new Response('{'),
  async () => ({ ok: true, json: async () => ({ ...success, rates: { RUB: Infinity } }) }),
]) {
  stored = JSON.stringify({ rate: 80, fetchedAt: currentTime - RATE_CACHE_MAX_AGE_MS })
  assert.equal(await createExchangeRateLoader({ ...dependencies, fetchRate })(), null)
}

stored = null
mock.timers.enable({ apis: ['setTimeout'] })
const timedOut = createExchangeRateLoader({
  ...dependencies,
  fetchRate: async (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Error('Aborted')), { once: true })
    }),
})()
mock.timers.tick(RATE_TIMEOUT_MS)
assert.equal(await timedOut, null)
mock.timers.reset()

assert.equal(formatCost(null, 80), 'Unavailable')
assert.equal(formatCost(null), 'Unavailable')
assert.equal(formatCost(0, 80), '0 копеек')
assert.equal(formatCost(0), '0 USD')
assert.equal(formatCost(0.001, 80), '8 копеек')
assert.equal(formatCost(0.001), '0.001 USD')
for (const [amount, text] of [
  [1, '1 копейка'],
  [2, '2 копейки'],
  [5, '5 копеек'],
  [11, '11 копеек'],
  [21, '21 копейка'],
  [22, '22 копейки'],
  [1.5, '1,5 копейки'],
  [0.00123, '0,00123 копейки'],
  [1.9999, '2 копейки'],
]) {
  assert.equal(formatCost(amount / 100, 1), text)
}
assert.equal(formatCost(1e-12, 1), '1E-10 копейки')
for (const rate of [null, 0, -1, NaN, Infinity]) assert.equal(formatCost(0.001, rate), '0.001 USD')
assert.equal(formatCost(Number.MAX_VALUE, 80).endsWith(' USD'), true)

// Render the actual metrics function with React, without installing a TSX runner.
const source = readFileSync(
  new URL('../src/components/history-request.tsx', import.meta.url),
  'utf8',
)
const ast = ts.createSourceFile(
  'metrics.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
const metrics = ast.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'RequestMetrics',
)
assert.ok(metrics)
const compiled = ts.transpileModule(metrics.getText(ast).replace('export ', ''), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ESNext },
}).outputText
const RequestMetrics = new Function(
  'React',
  'formatCost',
  'formatCount',
  'formatTime',
  'formatDate',
  compiled + '\nreturn RequestMetrics',
)(React, formatCost, String, String, String)
const request = new Proxy(
  {
    costUsd: 0.001,
    upstreamInferenceCostUsd: 0.002,
    upstreamPromptCostUsd: 0.003,
    upstreamCompletionCostUsd: 0.004,
  },
  { get: (target, name) => target[name] ?? null },
)
const converted = renderToStaticMarkup(React.createElement(RequestMetrics, { request, rate: 80 }))
for (const value of [8, 16, 24, 32]) assert.ok(converted.includes(formatCost(value / 8000, 80)))
assert.equal(converted.includes(' USD'), false)
const fallback = renderToStaticMarkup(React.createElement(RequestMetrics, { request, rate: null }))
for (const value of [0.001, 0.002, 0.003, 0.004]) assert.ok(fallback.includes(formatCost(value)))
console.log('Exchange-rate cache, fallback, cost formatting and four rendered metrics passed.')
