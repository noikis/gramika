import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import application from '../src/app'
import { parseConfig } from '../src/config'
import { Agent, MockAgent, setGlobalDispatcher } from 'undici'

test('translation configuration requires an environment URL', () => {
  assert.equal(parseConfig({}).libreTranslateUrl, undefined)
  assert.equal(
    parseConfig({ LIBRETRANSLATE_URL: 'ftp://example.test' }).libreTranslateUrl,
    undefined,
  )
})

test('translation route calls the configured service directly', async (t) => {
  const agent = new MockAgent()
  agent.disableNetConnect()
  agent
    .get('https://translate.test')
    .intercept({ path: '/translate', method: 'POST' })
    .reply(200, { translatedText: 'Hello' })
  setGlobalDispatcher(agent)
  t.after(async () => {
    setGlobalDispatcher(new Agent())
    await agent.close()
  })
  const app = Fastify()
  t.after(() => app.close())
  await application(app, {
    correction: {
      environment: { LIBRETRANSLATE_URL: 'https://translate.test' },
      database: null,
    },
  })
  const response = await app.inject({
    method: 'POST',
    url: '/api/translations',
    payload: { text: 'Привет', target: 'en', scope: 'original' },
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { text: 'Hello', target: 'en', scope: 'original' })
  agent.assertNoPendingInterceptors()
})

test('translation route reports missing configuration without calling upstream', async (t) => {
  const agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
  t.after(async () => {
    setGlobalDispatcher(new Agent())
    await agent.close()
  })
  const app = Fastify()
  t.after(() => app.close())
  await application(app, { correction: { environment: {}, database: null } })
  const response = await app.inject({
    method: 'POST',
    url: '/api/translations',
    payload: { text: 'Привет', target: 'en', scope: 'original' },
  })
  assert.equal(response.statusCode, 503)
  assert.equal(response.json().error.code, 'NOT_CONFIGURED')
})

test('translation route rejects invalid input without calling upstream', async (t) => {
  const agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
  t.after(async () => {
    setGlobalDispatcher(new Agent())
    await agent.close()
  })
  const app = Fastify()
  t.after(() => app.close())
  await application(app, {
    correction: { environment: { LIBRETRANSLATE_URL: 'https://translate.test' }, database: null },
  })
  const response = await app.inject({
    method: 'POST',
    url: '/api/translations',
    payload: { text: '', target: 'de', scope: 'original' },
  })
  assert.equal(response.statusCode, 400)
  assert.equal(response.json().error.code, 'INVALID_INPUT')
})
