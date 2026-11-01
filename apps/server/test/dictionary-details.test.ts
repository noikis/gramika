import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import undici from 'undici'
import Fastify from 'fastify'
import {
  adaptDefinitions,
  DefinitionsResponse,
  adaptDetails,
  createDictionaryService,
  createDictionaryDetailsService,
  DictionaryError,
} from '../src/dictionary'
import { dictionaryRoutes } from '../src/routes/dictionary'

const BASE_URL = 'https://dictionary.test'
afterEach(() => mock.restoreAll())

test('example citations are verbatim and code-point highlights become valid UTF-16 ranges', () => {
  const response = DefinitionsResponse.parse({
    word: 'слово',
    edition: 'ru',
    definitions: [
      {
        pos: 'noun',
        lang_code: 'ru',
        senses: [
          {
            glosses: ['Определение.'],
            tags: [],
            examples: [
              {
                text: '😀 Сло́во.',
                ref: '  Автор, 1900 г.  ',
                bold_text_offsets: [
                  [2, 8],
                  [3, 6],
                  [90, 91],
                ],
                extra: 'ignored',
              },
            ],
          },
        ],
      },
    ],
  })
  const example = adaptDefinitions(response, []).definitions[0].senses[0].examples[0]
  assert.deepEqual(example, {
    text: '😀 Сло́во.',
    source: 'wiktionary',
    citation: '  Автор, 1900 г.  ',
    highlights: [{ start: 3, end: 9 }],
  })
  assert.equal(
    example.text.slice(example.highlights![0].start, example.highlights![0].end),
    'Сло́во',
  )
})

test('details keep separate entries and forms, prefer HTTPS MP3 and omit unsafe audio URLs', () => {
  const result = adaptDetails({
    word: 'слово',
    entries: [
      {
        pos: 'noun',
        forms: [{ form: 'сло́ва', tags: ['plural', 'unknown-tag'] }, { form: 'сло́во' }],
        sounds: [
          {
            ipa: '[test]',
            mp3_url: 'https://audio.test/word.mp3',
            ogg_url: 'https://audio.test/word.ogg',
          },
          { ipa: '[other]', mp3_url: 'javascript:alert(1)', ogg_url: 'http://local.test/private' },
          { mp3_url: 'data:audio/mpeg;base64,AAA' },
          { ipa: null, mp3_url: null, ogg_url: null },
        ],
      },
      {},
    ],
  })
  assert.equal(result.entries.length, 2)
  assert.deepEqual(result.entries[0].forms[1], { form: 'сло́во', tags: [] })
  assert.deepEqual(result.entries[0].pronunciations, [
    { ipa: '[test]', audioUrl: 'https://audio.test/word.mp3', tags: [] },
    { ipa: '[other]', audioUrl: null, tags: [] },
  ])
  assert.deepEqual(result.entries[1], { partOfSpeech: null, forms: [], pronunciations: [] })
})

test('details make one encoded full-word request without resolving again', async () => {
  const calls: string[] = []
  mock.method(undici, 'request', async (url: string) => {
    calls.push(url)
    return {
      statusCode: 200,
      body: { json: async () => ({ word: 'Чрезвыча́йный', entries: [{ forms: [], sounds: [] }] }) },
    }
  })
  const result = await createDictionaryDetailsService({ url: BASE_URL })('Чрезвыча́йный')
  assert.equal(calls[0], `${BASE_URL}/v1/ru/word/${encodeURIComponent('Чрезвыча́йный')}?lang=ru`)
  assert.equal(calls.length, 1)
  assert.equal(result.entries.length, 1)
})

test('missing details are empty; malformed details and network failures stay explicit errors', async () => {
  mock.method(undici, 'request', async () => ({ statusCode: 404, body: { dump: async () => {} } }))
  assert.deepEqual(await createDictionaryDetailsService({ url: BASE_URL })('слово'), {
    word: 'слово',
    entries: [],
  })
  mock.restoreAll()
  mock.method(undici, 'request', async () => ({
    statusCode: 200,
    body: { json: async () => ({ entries: 'invalid' }) },
  }))
  await assert.rejects(
    createDictionaryDetailsService({ url: BASE_URL })('слово'),
    (error: unknown) => error instanceof DictionaryError && error.code === 'DICTIONARY_FAILED',
  )
  mock.restoreAll()
  mock.method(undici, 'request', async () => {
    throw Error('private upstream failure')
  })
  await assert.rejects(
    createDictionaryDetailsService({ url: BASE_URL })('слово'),
    (error: unknown) => error instanceof DictionaryError && error.code === 'DICTIONARY_FAILED',
  )
})

test('details deadline aborts stalled requests and the route validates its request boundary', async () => {
  let signal: AbortSignal | undefined
  let calls = 0
  mock.method(undici, 'request', async (_url: string, options: { signal: AbortSignal }) => {
    calls++
    signal = options.signal
    return new Promise(() => {})
  })
  const app = Fastify()
  await dictionaryRoutes(
    app,
    createDictionaryService({ url: BASE_URL }),
    createDictionaryDetailsService({ url: BASE_URL, timeoutMs: 10 }),
  )
  try {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/dictionary/details',
      payload: { word: 'слово', url: 'https://bad.test' },
    })
    assert.equal(invalid.statusCode, 400)
    const blank = await app.inject({
      method: 'POST',
      url: '/api/dictionary/details',
      payload: { word: '  ' },
    })
    assert.equal(blank.statusCode, 400)
    assert.equal(calls, 0)
    const response = await app.inject({
      method: 'POST',
      url: '/api/dictionary/details',
      payload: { word: 'слово' },
    })
    assert.equal(response.statusCode, 504)
    assert.deepEqual(response.json(), { error: { code: 'DICTIONARY_TIMEOUT' } })
    assert.equal(signal?.aborted, true)
    assert.equal(calls, 1)
    assert.equal(response.headers['cache-control'], 'no-store')
  } finally {
    await app.close()
  }
})
