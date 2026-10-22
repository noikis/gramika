import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import Fastify from 'fastify'
import { DEFAULT_MODEL_ID, HealthResponse } from '@gramota/contracts'
import application, { options } from '../src/app'
import { SqliteDatabase } from '../src/database'

const environment = { NODE_ENV: 'development', OPENROUTER_API_KEY: 'synthetic-secret-key' }
const unusedTransport = {
  async send(): Promise<never> {
    throw new Error('Unexpected network call')
  },
  async close() {},
}

function captureApp() {
  const lines: string[] = []
  const app = Fastify({
    ...options,
    logger: {
      ...(typeof options.logger === 'object' ? options.logger : {}),
      stream: { write: (line: string) => lines.push(line) },
    },
  })
  return { app, lines }
}

test('health checks local database/configuration without upstream calls or polling logs', async (t) => {
  const { app, lines } = captureApp()
  const database = new SqliteDatabase(':memory:')
  let calls = 0
  await application(app, {
    correction: {
      environment: {
        ...environment,
        NODE_ENV: 'production',
        OPENROUTER_PROXY_URL: 'http://synthetic-user:synthetic-secret-proxy@proxy.example:8888',
      },
      database,
      transport: {
        async send() {
          calls++
          throw new Error('Unexpected network call')
        },
        async close() {},
      },
    },
  })
  t.after(() => app.close())

  for (let i = 0; i < 2; i++) {
    const response = await app.inject('/health')
    assert.equal(response.statusCode, 200)
    assert.deepEqual(HealthResponse.parse(response.json()), { status: 'ok' })
    assert.equal(response.headers['cache-control'], 'no-store')
  }

  const getPreference = database.modelPreferences.get
  database.modelPreferences.get = () => {
    throw new Error('synthetic-private-database-path')
  }
  const failed = await app.inject('/health')
  assert.equal(failed.statusCode, 503)
  assert.deepEqual(HealthResponse.parse(failed.json()), {
    status: 'unavailable',
    reason: 'DATABASE_UNAVAILABLE',
  })
  database.modelPreferences.get = getPreference
  assert.equal((await app.inject('/health')).statusCode, 200)
  assert.equal(calls, 0)
  assert.equal(lines.length, 0)
})

test('health reports missing database and invalid configuration using safe reasons', async (t) => {
  for (const [env, isDatabasePresent, reason] of [
    [environment, false, 'DATABASE_UNAVAILABLE'],
    [{}, true, 'NOT_CONFIGURED'],
    [{ ...environment, NODE_ENV: 'unknown' }, true, 'NOT_CONFIGURED'],
    [{ ...environment, NODE_ENV: 'production' }, true, 'NOT_CONFIGURED'],
    [
      { ...environment, NODE_ENV: 'production', OPENROUTER_PROXY_URL: 'invalid' },
      true,
      'NOT_CONFIGURED',
    ],
  ] as const) {
    await t.test(reason + JSON.stringify(env), async (t) => {
      const { app, lines } = captureApp()
      await application(app, {
        correction: {
          environment: env,
          database: isDatabasePresent ? new SqliteDatabase(':memory:') : null,
          transport: unusedTransport,
        },
      })
      t.after(() => app.close())
      const startupCount = lines.length
      for (let i = 0; i < 2; i++) {
        const response = await app.inject('/health')
        assert.equal(response.statusCode, 503)
        assert.deepEqual(HealthResponse.parse(response.json()), { status: 'unavailable', reason })
      }
      assert.equal(lines.length, startupCount)
    })
  }
})

test('successful requests stay quiet; upstream failures log safe correlated diagnostics only', async (t) => {
  const { app, lines } = captureApp()
  let isFailing = false
  await application(app, {
    correction: {
      environment,
      databasePath: ':memory:',
      transport: {
        async send() {
          if (isFailing) throw new Error('synthetic-private-provider-response')
          return { correctedText: 'synthetic-private-result', errorCode: null, details: {} }
        },
        async close() {},
      },
    },
  })
  t.after(() => app.close())

  const request = {
    method: 'POST' as const,
    url: '/api/corrections?private=synthetic-private-query',
    headers: {
      authorization: 'Bearer synthetic-private-auth',
      cookie: 'synthetic-private-cookie',
      'x-request-id': 'synthetic-private-client-id',
    },
    payload: { text: 'synthetic-private-original', modelId: DEFAULT_MODEL_ID },
  }
  assert.equal((await app.inject(request)).statusCode, 200)
  assert.equal((await app.inject('/api/history')).statusCode, 200)
  assert.equal((await app.inject('/health')).statusCode, 200)
  assert.equal(lines.length, 0)

  isFailing = true
  const failure = await app.inject({
    ...request,
    payload: { ...request.payload, forceRefresh: true },
  })
  assert.equal(failure.statusCode, 502)
  assert.equal(lines.length, 1)
  const event = JSON.parse(lines[0])
  assert.equal(event.code, 'UPSTREAM_ERROR')
  assert.equal(event.attemptId, failure.json().requestId)
  assert.equal(typeof event.reqId, 'string')
  assert.equal(typeof event.durationMs, 'number')
  assert.deepEqual(event.req, { method: 'POST', route: '/api/corrections' })
  assert.equal(event.operation, 'correction-api')
  assert.doesNotMatch(lines.join(''), /synthetic-private|synthetic-secret/)
})

test('unexpected errors and existing history failures never log arbitrary exception messages', async (t) => {
  const { app, lines } = captureApp()
  const database = new SqliteDatabase(':memory:')
  await application(app, { correction: { environment, database, transport: unusedTransport } })
  t.after(() => app.close())
  app.get('/synthetic-error/:id', async () => {
    const error = new Error('synthetic-private-exception')
    error.stack = `Error: ${error.message}\n    at synthetic-private-function (/synthetic-private-path:24:5)`
    throw error
  })
  database.history.list = () => {
    throw new Error('synthetic-private-sql-parameters')
  }

  const unexpected = await app.inject(
    '/synthetic-error/synthetic-private-id?text=synthetic-private-query',
  )
  assert.equal(unexpected.statusCode, 500)
  assert.deepEqual(unexpected.json(), { error: 'Internal server error' })
  assert.equal((await app.inject('/api/history')).statusCode, 503)
  assert.equal(lines.length, 2)
  assert.deepEqual(
    lines.map((line) => JSON.parse(line).code),
    ['INTERNAL_ERROR', 'HISTORY_UNAVAILABLE'],
  )
  assert.ok(lines.every((line) => typeof JSON.parse(line).reqId === 'string'))
  const event = JSON.parse(lines[0])
  assert.deepEqual(event.req, { method: 'GET', route: '/synthetic-error/:id' })
  assert.equal(event.err.message, 'Exception details omitted')
  assert.equal(event.err.stack, '')
  assert.equal('location' in event.err, false)
  assert.doesNotMatch(lines.join(''), /synthetic-private|synthetic-secret/)
})

test('storage failure diagnostics retain request correlation and safe operation context', async (t) => {
  const { app, lines } = captureApp()
  const database = new SqliteDatabase(':memory:')
  database.corrections.beginAttempt = () => {
    throw Object.assign(new Error('synthetic-private-database-query'), { code: 'SQLITE_FULL' })
  }
  await application(app, { correction: { environment, database, transport: unusedTransport } })
  t.after(() => app.close())
  const response = await app.inject({
    method: 'POST',
    url: '/api/corrections',
    payload: { text: 'synthetic-private-text', modelId: DEFAULT_MODEL_ID },
  })
  assert.equal(response.statusCode, 503)
  const events = lines.map((line) => JSON.parse(line))
  assert.equal(events.length, 2)
  assert.equal(events[0].driverCode, 'SQLITE_FULL')
  assert.equal(events[0].stage, 'begin')
  assert.equal(events[0].operation, 'correction-storage')
  assert.deepEqual(events[0].req, { method: 'POST', route: '/api/corrections' })
  assert.equal(events[0].reqId, events[1].reqId)
  assert.doesNotMatch(lines.join(''), /synthetic-private|synthetic-secret/)
})

test('response stream failures remain visible while normal requests and 404s stay quiet', async (t) => {
  const { app, lines } = captureApp()
  await application(app, {
    correction: { environment, databasePath: ':memory:', transport: unusedTransport },
  })
  t.after(() => app.close())
  app.get('/broken-stream', async (_request, reply) => {
    const stream = Readable.from(
      (async function* () {
        yield 'synthetic-response-chunk'
        throw new Error('synthetic-private-stream-error')
      })(),
    )
    return reply.send(stream)
  })
  assert.equal((await app.inject('/missing/synthetic-private-route')).statusCode, 404)
  assert.equal((await app.inject('/health')).statusCode, 200)
  assert.equal(lines.length, 0)
  await assert.rejects(app.inject('/broken-stream'))
  assert.ok(lines.length > 0)
  assert.ok(lines.some((line) => JSON.parse(line).operation === 'response-stream'))
  assert.ok(lines.every((line) => JSON.parse(line).req?.route === '/broken-stream'))
  assert.doesNotMatch(lines.join(''), /synthetic-private|synthetic-secret/)
})
