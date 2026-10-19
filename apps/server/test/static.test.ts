import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import application from '../src/app'
import rootRoutes from '../src/routes/root'

test('packaged frontend serves HTML and assets alongside API without exposing other files', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-static-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const frontendRoot = join(directory, 'web')
  mkdirSync(join(frontendRoot, 'assets'), { recursive: true })
  writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html><title>Gramota</title>')
  writeFileSync(join(frontendRoot, 'assets/app.js'), 'console.log("asset")')
  writeFileSync(join(frontendRoot, 'assets/font.woff2'), 'synthetic-font')
  writeFileSync(join(frontendRoot, '.env'), 'synthetic-private-value')
  writeFileSync(join(directory, 'private.sqlite'), 'synthetic-database')

  const app = Fastify()
  t.after(() => app.close())
  await application(app, {
    frontendRoot,
    correction: { environment: {}, databasePath: ':memory:' },
  })
  const index = await app.inject('/')
  assert.equal(index.statusCode, 200)
  assert.match(index.headers['content-type']!, /text\/html/)
  assert.match(index.body, /<title>Gramota<\/title>/)
  const asset = await app.inject('/assets/app.js')
  assert.equal(asset.statusCode, 200)
  assert.match(asset.headers['content-type']!, /javascript/)
  assert.equal(asset.body, 'console.log("asset")')
  assert.equal((await app.inject('/assets/font.woff2')).statusCode, 200)

  for (const url of [
    '/api/missing',
    '/assets/missing.js',
    '/history',
    '/.env',
    '/private.sqlite',
    '/%2e%2e/private.sqlite',
    '/assets/%2e%2e/%2e%2e/private.sqlite',
  ]) {
    const response = await app.inject(url)
    assert.equal(response.statusCode, 404, url)
    assert.doesNotMatch(response.body, /synthetic-|<title>/)
  }
  assert.equal((await app.inject('/health')).statusCode, 503)
  assert.equal((await app.inject('/api/history')).statusCode, 200)
  assert.equal((await app.inject('/api/correction-config')).json().available, false)
})

test('packaged frontend refuses startup with missing index', async () => {
  const app = Fastify()
  app.register(rootRoutes, { frontendRoot: join(tmpdir(), 'gramota-missing-build', 'dist') })
  await assert.rejects(async () => app.ready(), { message: 'Production frontend build is missing' })
  await app.close()
})

test('API-only development can explicitly disable static serving', async (t) => {
  const app = Fastify()
  t.after(() => app.close())
  app.register(rootRoutes, { frontendRoot: false })
  assert.deepEqual((await app.inject('/')).json(), { root: true })
  assert.equal((await app.inject('/assets/app.js')).statusCode, 404)
})
