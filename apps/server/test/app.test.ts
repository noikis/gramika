import { mockOpenRouterTransport } from './mock-transport'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import application from '../src/app'
import { SqliteStorage } from '../src/storage'

test('application registers every route group with separate public error contracts', async (t) => {
  const app = Fastify()
  t.after(() => app.close())

  await application(app, { correction: { environment: {}, storage: null } })

  assert.deepEqual((await app.inject('/')).json(), { root: true })

  for (const [method, url, expectedCode] of [
    ['POST', '/api/corrections', 'INVALID_INPUT'],
    ['PUT', '/api/model-preference', 'INVALID_INPUT'],
    ['POST', '/api/history/search', 'INVALID_HISTORY_QUERY'],
  ] as const) {
    const response = await app.inject({
      method,
      url,
      payload: '{',
      headers: { 'content-type': 'application/json' },
    })

    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, expectedCode)
    assert.equal('correctionId' in response.json(), url !== '/api/history/search')
  }

  for (const [url, expectedCode] of [
    ['/api/correction-config', 'STORAGE_ERROR'],
    ['/api/history', 'HISTORY_UNAVAILABLE'],
  ]) {
    const response = await app.inject(url)

    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, expectedCode)
  }
})

test('application closes shared resources once even when transport shutdown fails', async (t) => {
  for (const failClose of [false, true]) {
    await t.test(failClose ? 'transport close fails' : 'normal shutdown', async (t) => {
      const app = Fastify()
      t.after(() => app.close().catch(() => {}))

      const database = new SqliteStorage(':memory:')
      const closeDatabase = database.close.bind(database)
      let databaseCloses = 0
      let transportCloses = 0

      database.close = () => {
        databaseCloses++
        closeDatabase()
      }

      await application(app, {
        correction: {
          environment: {},
          storage: database,
          transport: mockOpenRouterTransport({
            async send() {
              throw new Error('Unexpected upstream call')
            },
            async close() {
              transportCloses++
              if (failClose) throw new Error('Transport close failed')
            },
          }),
        },
      })
      await app.ready()

      if (failClose) await assert.rejects(app.close(), /Transport close failed/)
      else await app.close()

      assert.equal(transportCloses, 1)
      assert.equal(databaseCloses, 1)
    })
  }
})
