import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'

test('default root route', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/',
  })
  assert.deepStrictEqual(JSON.parse(res.payload), { root: true })
  assert.equal((await app.inject('/example')).statusCode, 404)
  assert.equal(app.hasDecorator('someSupport'), false)
})
