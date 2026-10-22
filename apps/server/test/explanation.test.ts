import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { DEFAULT_MODEL_ID, MODELS, ExplanationInput, type CorrectionMode } from '@gramota/contracts'
import { SqliteDatabase } from '../src/database'
import { migrateDatabase } from '../src/database/migrations'
import { CorrectionError, type CorrectionTransport } from '../src/correction'
import { createExplanationService } from '../src/explanation'
import {
  EXPLAIN_CORE,
  STRICT_EXPLAIN,
  STRICT_EXPLAIN_PROMPT,
  REWRITE_EXPLAIN,
  REWRITE_EXPLAIN_PROMPT,
  REWRITE_EXPLAIN_PROMPT_VERSION,
} from '../src/explanation/prompt'
import application from '../src/app'
import { mockOpenRouterTransport } from './mock-transport'

const at = '2026-10-21T00:00:00.000Z'
const answer = 'Слово «помощь» пишется с мягким знаком на конце.'
function seed(
  db: SqliteDatabase,
  modelId = DEFAULT_MODEL_ID as string,
  mode: CorrectionMode = 'strict',
  originalText = 'Нужна помощ. Нужна помощ.',
  correctedText = 'Нужна помощь. Нужна помощь.',
) {
  const ids = { correctionId: randomUUID(), requestId: randomUUID() }
  db.corrections.beginAttempt({
    ids,
    originalText,
    modelId,
    mode,
    promptVersion: mode === 'strict' ? 'strict-v3' : 'rewrite-v1',
    parameters: {},
    startedAt: at,
  })
  db.corrections.finishAttempt(ids.requestId, {
    status: 'succeeded',
    correctedText,
    endedAt: at,
    durationMs: 1,
    errorCode: null,
    errorMessage: null,
    costUsd: 0.01,
  })
  return {
    ...ids,
    selection: {
      requestId: ids.requestId,
      originalRange: { start: 6, end: 11 },
      correctedRange: { start: 6, end: 12 },
    },
  }
}
function transport(
  send: CorrectionTransport['send'] = async () => ({
    correctedText: answer,
    errorCode: null,
    details: {},
  }),
): CorrectionTransport {
  return { send, async close() {} }
}
function service(db: SqliteDatabase, send?: CorrectionTransport['send']) {
  return createExplanationService({
    repository: db.explanations,
    transport: transport(send),
    isAvailable: true,
  })
}
function hasCode(code: string) {
  return (error: unknown) => error instanceof CorrectionError && error.code === code
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`each correcting model receives the exact prompt, full context and selected occurrence only on demand (${mode})`, async (t) => {
    const db = new SqliteDatabase(':memory:')
    t.after(() => db.close())
    for (const model of MODELS) {
      const { selection } = seed(db, model.id, mode)
      const before = db.db.prepare('SELECT * FROM model_requests').all()
      let calls = 0
      const explain = service(db, async (body, _signal, isRejectReasoning) => {
        calls++
        const request = body as {
          model: string
          reasoning: object
          messages: { role: string; content: string }[]
        }
        assert.equal(request.model, model.id)
        assert.equal(isRejectReasoning, model.id === DEFAULT_MODEL_ID)
        assert.deepEqual(
          request.reasoning,
          model.id === DEFAULT_MODEL_ID ? { enabled: false } : { effort: 'minimal' },
        )
        assert.equal(
          request.messages[0].content,
          mode === 'strict' ? STRICT_EXPLAIN_PROMPT : REWRITE_EXPLAIN_PROMPT,
        )
        assert.equal(STRICT_EXPLAIN_PROMPT, `${EXPLAIN_CORE}\n\n${STRICT_EXPLAIN}`)
        assert.equal(REWRITE_EXPLAIN_PROMPT, `${EXPLAIN_CORE}\n\n${REWRITE_EXPLAIN}`)
        assert.equal(REWRITE_EXPLAIN_PROMPT_VERSION, 'explain-rewrite-v1')
        const input = JSON.parse(request.messages[1].content)
        assert.equal(input.mode, mode)
        assert.equal(input.originalText, 'Нужна помощ. Нужна помощ.')
        assert.equal(input.editedText, 'Нужна помощь. Нужна помощь.')
        assert.equal(input.selectedChange.originalFragment, 'помощ')
        assert.equal(input.selectedChange.editedFragment, 'помощь')
        assert.deepEqual(input.selectedChange.originalRange, selection.originalRange)
        assert.deepEqual(input.selectedChange.editedRange, selection.correctedRange)
        return { correctedText: answer, errorCode: null, details: { costUsd: 0.5 } }
      })
      assert.deepEqual(explain.lookup(selection), { result: null })
      assert.equal(calls, 0)
      assert.equal((await explain.explain(selection)).explanation, answer)
      assert.equal((await explain.explain(selection)).explanation, answer)
      assert.equal(explain.lookup(selection).result?.explanation, answer)
      assert.equal(calls, 1)
      assert.deepEqual(db.db.prepare('SELECT * FROM model_requests').all(), before)
      const second = {
        ...selection,
        originalRange: { start: 18, end: 23 },
        correctedRange: { start: 19, end: 25 },
      }
      assert.equal(explain.lookup(second).result, null)
    }
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`saved explanations survive reopening, need no configured model and never cross result identity (${mode})`, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'gramota-explain-'))
    const path = join(directory, 'db.sqlite')
    const db = new SqliteDatabase(path)
    const { selection } = seed(db, DEFAULT_MODEL_ID, mode)
    await service(db).explain(selection)
    db.close()
    const reopened = new SqliteDatabase(path)
    t.after(() => {
      reopened.close()
      rmSync(directory, { recursive: true, force: true })
    })
    const offline = createExplanationService({
      repository: reopened.explanations,
      transport: null,
      isAvailable: false,
    })
    assert.equal(offline.lookup(selection).result?.explanation, answer)
    assert.equal((await offline.explain(selection)).explanation, answer)
    assert.equal(offline.lookup(seed(reopened, DEFAULT_MODEL_ID, mode).selection).result, null)
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`invalid, unknown, failed and deleted selections do not call the model (${mode})`, async (t) => {
    const db = new SqliteDatabase(':memory:')
    t.after(() => db.close())
    const { selection, correctionId } = seed(db, DEFAULT_MODEL_ID, mode)
    let calls = 0
    const explain = service(db, async () => {
      calls++
      throw Error('unexpected')
    })
    const invalid = [
      {},
      { ...selection, requestId: randomUUID() },
      { ...selection, originalRange: { start: -1, end: 4 } },
      { ...selection, originalRange: { start: 10, end: 9 } },
      { ...selection, correctedRange: { start: 6, end: 999 } },
      { ...selection, originalRange: { start: 0, end: 5 }, correctedRange: { start: 0, end: 5 } },
      seed(db, 'removed/model', mode).selection,
    ]
    for (const value of invalid)
      await assert.rejects(explain.explain(value), hasCode('INVALID_INPUT'))
    const failed = seed(db, DEFAULT_MODEL_ID, mode)
    db.db
      .prepare(
        "UPDATE model_requests SET status='failed', corrected_text=NULL, error_code='TIMEOUT', error_message='Timed out' WHERE id=?",
      )
      .run(failed.requestId)
    await assert.rejects(explain.explain(failed.selection), hasCode('INVALID_INPUT'))
    db.db.prepare('UPDATE corrections SET deleted_at=? WHERE id=?').run(at, correctionId)
    assert.throws(() => explain.lookup(selection), hasCode('INVALID_INPUT'))
    await assert.rejects(explain.explain(selection), hasCode('INVALID_INPUT'))
    assert.equal(calls, 0)
    assert.equal(
      ExplanationInput.safeParse({ ...selection, modelId: DEFAULT_MODEL_ID }).success,
      false,
    )
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`insertions, deletions, spacing and grouped phrases retain exact UTF-16 context (${mode})`, async (t) => {
    const db = new SqliteDatabase(':memory:')
    t.after(() => db.close())
    for (const [original, corrected, originalRange, correctedRange] of [
      ['Аня привет', 'Аня, привет', { start: 3, end: 3 }, { start: 3, end: 4 }],
      ['Привет!!', 'Привет!', { start: 7, end: 8 }, { start: 7, end: 7 }],
      ['😀  привет', '😀 привет', { start: 2, end: 10 }, { start: 2, end: 9 }],
      [
        'никого подтверждение',
        'никакого подтверждения',
        { start: 0, end: 20 },
        { start: 0, end: 22 },
      ],
    ] as const) {
      const { requestId } = seed(db, DEFAULT_MODEL_ID, mode, original, corrected)
      const selection = { requestId, originalRange, correctedRange }
      const explain = service(db, async (body) => {
        const data = JSON.parse((body as { messages: { content: string }[] }).messages[1].content)
        assert.equal(
          data.selectedChange.originalFragment,
          original.slice(originalRange.start, originalRange.end),
        )
        assert.equal(
          data.selectedChange.editedFragment,
          corrected.slice(correctedRange.start, correctedRange.end),
        )
        return { correctedText: answer, errorCode: null, details: {} }
      })
      await explain.explain(selection)
      if (original.startsWith('😀')) {
        await assert.rejects(
          explain.explain({ ...selection, originalRange: { start: 1, end: 2 } }),
          hasCode('INVALID_INPUT'),
        )
      }
    }
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`duplicate concurrent generation is coalesced and deletion during generation prevents saving (${mode})`, async (t) => {
    const db = new SqliteDatabase(':memory:')
    t.after(() => db.close())
    for (const isDeleted of [false, true]) {
      const { selection, correctionId } = seed(db, DEFAULT_MODEL_ID, mode)
      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let calls = 0
      const explain = service(db, async () => {
        calls++
        await gate
        return { correctedText: answer, errorCode: null, details: {} }
      })
      const first = explain.explain(selection)
      const second = explain.explain(selection)
      if (isDeleted)
        db.db.prepare('UPDATE corrections SET deleted_at=? WHERE id=?').run(at, correctionId)
      release()
      if (isDeleted) {
        await Promise.all([
          assert.rejects(first, hasCode('INVALID_INPUT')),
          assert.rejects(second, hasCode('INVALID_INPUT')),
        ])
        assert.equal(db.explanations.get(selection), null)
      } else {
        assert.deepEqual(await first, await second)
        assert.equal(db.explanations.get(selection), answer)
      }
      assert.equal(calls, 1)
    }
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`timeout, invalid response, upstream failure and reasoning are not saved; explicit retry can succeed (${mode})`, async (t) => {
    const db = new SqliteDatabase(':memory:')
    t.after(() => db.close())
    for (const code of [
      'TIMEOUT',
      'INVALID_RESPONSE',
      'UPSTREAM_ERROR',
      'REASONING_NOT_DISABLED',
    ] as const) {
      const { selection } = seed(db, DEFAULT_MODEL_ID, mode)
      let signal: AbortSignal | undefined
      const failing = mockOpenRouterTransport({
        async send(_body, requestSignal) {
          signal = requestSignal
          if (code === 'TIMEOUT') return new Promise(() => {})
          if (code === 'UPSTREAM_ERROR') throw Error('synthetic failure')
          return {
            status: 200,
            data: {
              choices: [
                {
                  finish_reason: code === 'INVALID_RESPONSE' ? 'length' : 'stop',
                  message: { role: 'assistant', content: answer, reasoning: 'hidden reasoning' },
                },
              ],
            },
          }
        },
        async close() {},
      })
      const explain = createExplanationService({
        repository: db.explanations,
        transport: failing,
        isAvailable: true,
        timeoutMs: 5,
      })
      await assert.rejects(explain.explain(selection), hasCode(code))
      if (code === 'TIMEOUT') assert.equal(signal?.aborted, true)
      assert.equal(db.explanations.get(selection), null)
      assert.equal((await service(db).explain(selection)).explanation, answer)
    }
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`registered API validates payloads, serves saved lookup, and handles storage failures (${mode})`, async (t) => {
    const db = new SqliteDatabase(':memory:')
    const { selection } = seed(db, DEFAULT_MODEL_ID, mode)
    const app = Fastify()
    await application(app, {
      correction: {
        database: db,
        transport: transport(),
        environment: { NODE_ENV: 'development', OPENROUTER_API_KEY: 'fictional-test-key' },
      },
    })
    t.after(() => app.close())
    const post = (url: string, payload: object) => app.inject({ method: 'POST', url, payload })
    assert.deepEqual((await post('/api/explanations/lookup', selection)).json(), { result: null })
    assert.equal((await post('/api/explanations', selection)).json().explanation, answer)
    assert.equal(
      (await post('/api/explanations/lookup', selection)).json().result.explanation,
      answer,
    )
    assert.equal((await post('/api/explanations', {})).statusCode, 400)
    assert.equal((await post('/api/explanations', { text: 'x'.repeat(5000) })).statusCode, 413)
    db.explanations.get = () => {
      throw Error('private database path')
    }
    const failure = await post('/api/explanations/lookup', selection)
    assert.equal(failure.statusCode, 503)
    assert.equal(failure.json().error.code, 'STORAGE_ERROR')
    assert.equal(failure.body.includes('private'), false)
  })
}

test('additive migration preserves existing data and is applied once', () => {
  const raw = new Database(':memory:')
  try {
    const migrations = readMigrationFiles({ migrationsFolder: join(__dirname, '../drizzle') })
    raw.exec(
      'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)',
    )
    for (const migration of migrations.slice(0, 3)) {
      raw.transaction(() => {
        for (const statement of migration.sql) raw.exec(statement)
        raw
          .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
          .run(migration.hash, migration.folderMillis)
      })()
    }
    raw
      .prepare(
        'INSERT INTO corrections (id, created_at, original_text, language, deleted_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run('synthetic', at, 'Текст.', 'ru', at)
    raw.prepare('UPDATE model_preference SET model_id=? WHERE id=1').run(MODELS[1].id)
    raw
      .prepare(
        `INSERT INTO model_requests
      (id, correction_id, requested_model, mode, prompt_version, parameters_json, started_at,
       ended_at, duration_ms, status, corrected_text, cost_usd)
      VALUES ('saved-result', 'synthetic', ?, 'strict', 'strict-v3', '{}', ?, ?, 10, 'succeeded', 'Текст!', 0.01)`,
      )
      .run(DEFAULT_MODEL_ID, at, at)
    const before = ['corrections', 'model_requests', 'model_preference'].map((table) =>
      raw.prepare(`SELECT * FROM ${table}`).all(),
    )
    migrateDatabase(drizzle(raw))
    assert.deepEqual(
      ['corrections', 'model_requests', 'model_preference'].map((table) =>
        raw.prepare(`SELECT * FROM ${table}`).all(),
      ),
      before.map((rows, index) =>
        index === 0 ? rows.map((row) => ({ ...(row as object), last_used_at: at })) : rows,
      ),
    )
    assert.deepEqual(raw.prepare('SELECT * FROM explanations').all(), [])
    migrateDatabase(drizzle(raw))
    assert.equal(
      (raw.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as { n: number }).n,
      migrations.length,
    )
  } finally {
    raw.close()
  }
})

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`Gemini app explanations accept reasoning metadata while Gemma explanations still reject it (${mode})`, async (t) => {
    const db = new SqliteDatabase(':memory:')
    t.after(() => db.close())
    for (const model of MODELS) {
      const { selection } = seed(db, model.id, mode)
      const explain = createExplanationService({
        repository: db.explanations,
        isAvailable: true,
        transport: mockOpenRouterTransport({
          async send(body) {
            assert.equal((body as { model: string }).model, model.id)
            assert.deepEqual(
              (body as { reasoning: object }).reasoning,
              model.id === DEFAULT_MODEL_ID ? { enabled: false } : { effort: 'minimal' },
            )
            return {
              status: 200,
              data: {
                choices: [
                  {
                    finish_reason: 'stop',
                    message: {
                      role: 'assistant',
                      content: answer,
                      reasoning: 'synthetic reasoning',
                      reasoning_details: [{ type: 'reasoning.text', text: 'synthetic reasoning' }],
                    },
                  },
                ],
                usage: { completion_tokens_details: { reasoning_tokens: 0 } },
              },
            }
          },
          async close() {},
        }),
      })
      if (model.id === DEFAULT_MODEL_ID) {
        await assert.rejects(explain.explain(selection), hasCode('REASONING_NOT_DISABLED'))
        assert.equal(db.explanations.get(selection), null)
      } else {
        assert.equal((await explain.explain(selection)).explanation, answer)
        assert.equal(db.explanations.get(selection), answer)
      }
    }
  })
}

test('unknown saved modes are rejected for lookup and generation without a model call', async () => {
  const source = {
    originalText: 'Текст',
    correctedText: 'Текст!',
    modelId: DEFAULT_MODEL_ID,
    mode: 'unsupported',
  }
  let calls = 0
  const explain = createExplanationService({
    repository: {
      getSource: () => source,
      get: () => null,
      save: (_selection, text) => text,
    },
    transport: transport(async () => {
      calls++
      throw Error('unexpected')
    }),
    isAvailable: true,
  })
  const selection = {
    requestId: randomUUID(),
    originalRange: { start: 5, end: 5 },
    correctedRange: { start: 5, end: 6 },
  }
  assert.throws(() => explain.lookup(selection), hasCode('INVALID_INPUT'))
  await assert.rejects(explain.explain(selection), hasCode('INVALID_INPUT'))
  assert.equal(calls, 0)
})
