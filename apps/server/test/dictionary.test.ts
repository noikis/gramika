import assert from 'node:assert/strict'
import { test, mock, afterEach } from 'node:test'
import undici from 'undici'
import Fastify from 'fastify'
import {
  DictionaryErrorCode,
  DictionaryExampleSource,
  DictionaryGrammar,
  DictionaryMatchSource,
  DictionaryMatch,
  DictionaryResponse,
  RussianWord,
  type DictionaryDefinition,
} from '@gramota/contracts'
import application, { options } from '../src/app'
import { parseConfig } from '../src/config'
import { createDictionaryService, DictionaryError } from '../src/dictionary'
import { dictionaryRoutes } from '../src/routes/dictionary'

const BASE_URL = 'https://dictionary.test'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
type UpstreamMatch = Omit<DictionaryMatch, 'partOfSpeech'> & { pos: string | null }
const match = (lemma: string, overrides: Partial<UpstreamMatch> = {}) => ({
  lemma,
  pos: 'noun',
  form: lemma,
  grammar: {},
  unmappedTags: [],
  sources: [DictionaryMatchSource.enum.inflection],
  ...overrides,
})
type UpstreamSense = Omit<DictionaryDefinition['senses'][number], 'examples'> & {
  examples: { text: string }[]
}
const sense = (glosses: string[] = ['  Синтетическое определение; сокр.  ']): UpstreamSense => ({
  glosses,
  tags: [],
  examples: [],
})
const definition = (pos: string | null = 'noun', senses = [sense()]) => ({
  pos,
  lang_code: 'ru',
  senses,
})
const entry = (word: string, definitions = [definition()]) => ({ word, edition: 'ru', definitions })
const appDefinitions = (definitions: ReturnType<typeof definition>[]) =>
  definitions.map(({ lang_code, ...rest }) => ({ ...rest, language: lang_code }))

afterEach(() => mock.restoreAll())

const upstreamResponse = (response: Response) => ({
  statusCode: response.status,
  body: { json: () => response.json(), dump: () => response.body?.cancel() },
})

function transport(responses: Response[]) {
  const calls: string[] = []
  const signals: AbortSignal[] = []
  const fetch: typeof globalThis.fetch = async (url, init) => {
    calls.push(String(url))
    signals.push(init!.signal!)
    assert.equal(calls.length <= responses.length, true, 'unexpected request or retry')
    return responses[calls.length - 1]
  }
  mock.method(undici, 'request', async (url: string, init: RequestInit) =>
    upstreamResponse(await fetch(url, init)),
  )
  return { fetch, calls, signals }
}

test('dictionary configuration defaults and validates HTTP(S) URLs', () => {
  assert.equal(parseConfig({}).dictionaryBaseUrl, 'https://dictionary.noikis.ru')
  for (const value of ['ftp://dictionary.test', 'not a URL']) {
    assert.equal(parseConfig({ DICTIONARY_BASE_URL: value }).dictionaryBaseUrl, undefined)
  }
  assert.equal(
    parseConfig({ DICTIONARY_BASE_URL: ' http://dictionary.test/base/ ' }).dictionaryBaseUrl,
    'http://dictionary.test/base',
  )
})

test('dictionary uses Undici request with real networking disabled', async (t) => {
  const agent = new undici.MockAgent()
  agent.disableNetConnect()
  const previousDispatcher = undici.getGlobalDispatcher()
  undici.setGlobalDispatcher(agent)
  t.after(async () => {
    undici.setGlobalDispatcher(previousDispatcher)
    await agent.close()
  })
  agent
    .get(BASE_URL)
    .intercept({
      path: `/v1/ru/resolve/${encodeURIComponent('слово')}?lang=ru`,
      method: 'GET',
    })
    .reply(200, { matches: [match('слово')] })
  agent
    .get(BASE_URL)
    .intercept({
      path: `/v1/ru/word/${encodeURIComponent('слово')}/definitions?lang=ru`,
      method: 'GET',
    })
    .reply(200, entry('слово'))
  const result = await createDictionaryService({ url: BASE_URL })('слово')
  assert.equal(result.results[0].word, 'слово')
  agent.assertNoPendingInterceptors()
})

test('shared word validation trims only surrounding punctuation and preserves Russian spelling', () => {
  for (const [input, expected] of [
    [' «Ёлка!» ', 'Ёлка'],
    ['(ёлка)', 'ёлка'],
    ['ко́е-как', 'ко́е-как'],
    ['\n«е́лка»\t', 'е́лка'],
    ['тёмно-зелёный', 'тёмно-зелёный'],
  ])
    assert.equal(RussianWord.parse(input), expected)
  for (const input of [
    '',
    '...',
    'два слова',
    'слово\nслово',
    'ёлка2',
    '2ёлка',
    'cлово',
    'hello',
    'сло_во',
    'слово--слово',
    '\u0301слово',
    'слово🙂',
  ]) {
    assert.equal(RussianWord.safeParse(input).success, false, input)
  }
})

test('grammar preserves optional fields, all alternatives and literal flags', () => {
  assert.deepEqual(DictionaryGrammar.parse({}), {})
  const grammar = {
    cases: ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'prepositional'],
    numbers: ['singular', 'plural'],
    genders: ['masculine', 'feminine', 'neuter'],
    animacies: ['animate', 'inanimate'],
    tenses: ['present', 'past', 'future'],
    persons: ['first-person', 'second-person', 'third-person'],
    moods: ['indicative', 'imperative', 'conditional', 'subjunctive'],
    voices: ['active', 'passive'],
    degrees: ['positive', 'comparative', 'superlative'],
    aspects: ['perfective', 'imperfective'],
    verbForms: ['infinitive', 'participle', 'adverbial'],
    shortForm: true,
    stressed: true,
  }
  assert.deepEqual(DictionaryGrammar.parse(grammar), grammar)
  for (const invalid of [
    { shortForm: false },
    { stressed: false },
    { cases: ['unknown'] },
    { numbers: 'plural' },
  ]) {
    assert.equal(DictionaryGrammar.safeParse(invalid).success, false)
  }
})

test('накопившихся retains three analyses, one request and verbatim participle definition', async () => {
  const matches = ['accusative', 'genitive', 'prepositional'].map((grammaticalCase) =>
    match('накопившийся', {
      pos: 'verb',
      form: 'накопи́вшихся',
      grammar: {
        cases: [grammaticalCase as 'accusative' | 'genitive' | 'prepositional'],
        numbers: ['plural'],
      },
    }),
  )
  const definitions = [
    definition('verb', [
      { glosses: ['действ. прич. прош. вр. от накопиться'], tags: ['participle'], examples: [] },
    ]),
  ]
  const mock = transport([json({ matches }), json(entry('накопившийся', definitions))])
  const result = await createDictionaryService({ url: BASE_URL })('накопившихся')
  assert.deepEqual(result, {
    query: 'накопившихся',
    results: [
      {
        ...entry('накопившийся', definitions),
        definitions: appDefinitions(definitions),
        matches: matches.map((analysis) =>
          DictionaryMatch.parse({ ...analysis, partOfSpeech: analysis.pos }),
        ),
      },
    ],
  })
  assert.deepEqual(mock.calls, [
    `${BASE_URL}/v1/ru/resolve/${encodeURIComponent('накопившихся')}?lang=ru`,
    `${BASE_URL}/v1/ru/word/${encodeURIComponent('накопившийся')}/definitions?lang=ru`,
  ])
  assert.equal(mock.signals[0], mock.signals[1])
})

test('защиты keeps six senses, multiple glosses and examples attached verbatim', async () => {
  const senses = Array.from({ length: 6 }, (_, index) => ({
    glosses: [`  Значение ${index + 1}; сокр.  `, `Второй глосс ${index + 1}.`],
    tags: ['unknown-tag'],
    examples: [
      {
        text: `  Приме́р ${index + 1}.  `,
        ref: 'citation',
        bold_text_offsets: [[0, 2]],
        extra: 'strip',
      },
    ],
  }))
  transport([
    json({ matches: [match('защита')] }),
    json({
      ...entry('защита', [definition('noun', senses)]),
      url: 'https://unused.test',
      headers: {},
    }),
  ])
  const result = await createDictionaryService({ url: BASE_URL })('защиты')
  assert.deepEqual(
    result.results[0].definitions[0].senses,
    senses.map(({ examples, ...rest }) => ({
      ...rest,
      examples: examples.map(({ text }) => ({
        text,
        source: DictionaryExampleSource.enum.wiktionary,
      })),
    })),
  )
  assert.deepEqual(Object.keys(result.results[0]), ['word', 'edition', 'matches', 'definitions'])
})

test('противоречиями preserves two distinct headwords in first-seen order', async () => {
  const mock = transport([
    json({ matches: [match('противоречие'), match('противоречия'), match('противоречие')] }),
    json(entry('противоречие', [definition('noun', [sense(['Первое.'])])])),
    json(entry('противоречия', [definition('noun', [sense(['Второе.'])])])),
  ])
  const result = await createDictionaryService({ url: BASE_URL })('противоречиями')
  assert.deepEqual(
    result.results.map(({ word, matches }) => [word, matches.length]),
    [
      ['противоречие', 2],
      ['противоречия', 1],
    ],
  )
  assert.deepEqual(
    result.results.map(({ definitions }) => definitions[0].senses[0].glosses),
    [['Первое.'], ['Второе.']],
  )
  assert.equal(mock.calls.length, 3)
})

test('обоснованными keeps adjective and verb entries separate, including repeated POS', async () => {
  const definitions = [
    definition('adj'),
    definition('verb', [{ ...sense(), tags: ['participle'] }]),
    definition('verb'),
  ]
  transport([json({ matches: [match('обоснованный')] }), json(entry('обоснованный', definitions))])
  const result = await createDictionaryService({ url: BASE_URL })('обоснованными')
  assert.deepEqual(result.results[0].definitions, appDefinitions(definitions))
})

test('шли preserves multiple headwords, provenance and gender alternatives', async () => {
  const matches = [
    match('идти', {
      pos: null,
      form: 'шли',
      grammar: {
        genders: ['masculine', 'feminine', 'neuter'],
        numbers: ['plural'],
        tenses: ['past'],
      },
      sources: [
        DictionaryMatchSource.enum.headword,
        DictionaryMatchSource.enum.inflection,
        DictionaryMatchSource.enum['form-of'],
      ],
      unmappedTags: ['unknown'],
    }),
    match('шлый'),
  ]
  transport([json({ matches }), json(entry('идти', [definition(null)])), json(entry('шлый'))])
  const result = await createDictionaryService({ url: BASE_URL })('шли')
  assert.deepEqual(
    result.results.map(({ word }) => word),
    ['идти', 'шлый'],
  )
  assert.equal(result.results[0].matches[0].partOfSpeech, null)
  assert.equal(result.results[0].definitions[0].pos, null)
  assert.equal(DictionaryResponse.safeParse(result).success, true)
  assert.deepEqual(result.results[0].matches[0].grammar, matches[0].grammar)
  assert.deepEqual(result.results[0].matches[0].sources, matches[0].sources)
  assert.deepEqual(result.results[0].matches[0].unmappedTags, ['unknown'])
})

test('мной uses resolved я and strips references without following gloss links', async () => {
  const mock = transport([
    json({ matches: [{ ...match('я'), references: ['я#(местоимение)'], extra: 'ignored' }] }),
    json(entry('я', [definition('pron', [sense(['см. я#(местоимение)'])])])),
  ])
  const result = await createDictionaryService({ url: BASE_URL })('мной')
  assert.equal(
    mock.calls[1],
    `${BASE_URL}/v1/ru/word/${encodeURIComponent('я')}/definitions?lang=ru`,
  )
  assert.equal('references' in result.results[0].matches[0], false)
  assert.equal(mock.calls.length, 2)
})

test('exact lemma grouping preserves capitalization and stress and encodes each path', async () => {
  const lemmas = ['Ёлка', 'ёлка', 'ё́лка']
  const mock = transport([
    json({ matches: lemmas.map((lemma) => match(lemma)) }),
    ...lemmas.map((lemma) => json(entry(lemma))),
  ])
  const result = await createDictionaryService({ url: BASE_URL })(' «ё́лкой!» ')
  assert.equal(result.query, 'ё́лкой')
  assert.deepEqual(
    result.results.map(({ word }) => word),
    lemmas,
  )
  assert.equal(mock.calls[0], `${BASE_URL}/v1/ru/resolve/${encodeURIComponent('ё́лкой')}?lang=ru`)
  assert.deepEqual(
    mock.calls.slice(1),
    lemmas.map(
      (lemma) => `${BASE_URL}/v1/ru/word/${encodeURIComponent(lemma)}/definitions?lang=ru`,
    ),
  )
})

test('empty resolve has no fallback; sparse entries and empty arrays remain valid', async () => {
  const mock = transport([json({ matches: [] })])
  assert.deepEqual(await createDictionaryService({ url: BASE_URL })('слово'), {
    query: 'слово',
    results: [],
  })
  assert.equal(mock.calls.length, 1)
  const definitions = [definition(null, []), definition('unknown', [sense([])])]
  transport([json({ matches: [match('слово')] }), json(entry('слово', definitions))])
  const result = await createDictionaryService({ url: BASE_URL })('слово')
  assert.deepEqual(result.results[0].definitions, appDefinitions(definitions))
})

test('404 definitions are omitted, including non-JSON bodies, and other headwords continue', async () => {
  transport([
    json({ matches: [match('один'), match('два')] }),
    new Response('missing', { status: 404 }),
    json(entry('два')),
  ])
  const result = await createDictionaryService({ url: BASE_URL })('слово')
  assert.deepEqual(
    result.results.map(({ word }) => word),
    ['два'],
  )
  transport([
    json({ matches: [match('один'), match('два')] }),
    json({}, 404),
    json(entry('два', [])),
  ])
  assert.deepEqual(await createDictionaryService({ url: BASE_URL })('слово'), {
    query: 'слово',
    results: [],
  })
})

test('malformed responses fail instead of returning partial results', async () => {
  const invalidMatches = [
    {},
    { matches: null },
    { matches: [{ lemma: 'слово' }] },
    { matches: [match('слово', { sources: ['bad-source' as DictionaryMatchSource] })] },
    { matches: [match('слово', { grammar: { shortForm: false as true } })] },
  ]
  const invalidDefinitions = [
    null,
    {},
    { ...entry('слово'), definitions: [{}] },
    entry('слово', [
      definition('noun', [
        { glosses: [], tags: [], examples: [{ text: 12 as unknown as string }] },
      ]),
    ]),
    {
      ...entry('слово'),
      definitions: [{ pos: 'noun', lang_code: 'ru', senses: [{ glosses: [] }] }],
    },
  ]
  for (const payload of invalidMatches) {
    transport([json(payload)])
    await assert.rejects(createDictionaryService({ url: BASE_URL })('слово'), {
      code: DictionaryErrorCode.enum.DICTIONARY_FAILED,
    })
  }
  for (const response of [
    ...invalidDefinitions.map((payload) => json(payload)),
    new Response('{'),
  ]) {
    transport([json({ matches: [match('один'), match('два')] }), json(entry('один')), response])
    await assert.rejects(createDictionaryService({ url: BASE_URL })('слово'), {
      code: DictionaryErrorCode.enum.DICTIONARY_FAILED,
    })
  }
})

test('route reports safe errors for upstream HTTP, JSON and network failures without retries', async (t) => {
  const scenarios = [
    {
      responses: [json({}, 503)],
      status: 503,
      code: DictionaryErrorCode.enum.DICTIONARY_UNAVAILABLE,
    },
    { responses: [json({}, 404)], status: 502, code: DictionaryErrorCode.enum.DICTIONARY_FAILED },
    {
      responses: [new Response('secret upstream body', { status: 500 })],
      status: 502,
      code: DictionaryErrorCode.enum.DICTIONARY_FAILED,
    },
    {
      responses: [new Response('{')],
      status: 502,
      code: DictionaryErrorCode.enum.DICTIONARY_FAILED,
    },
    {
      responses: [json({ matches: [match('слово')] }), json({}, 503)],
      status: 502,
      code: DictionaryErrorCode.enum.DICTIONARY_FAILED,
    },
  ]
  for (const scenario of scenarios) {
    const mock = transport(scenario.responses)
    const app = Fastify()
    t.after(() => app.close())
    await dictionaryRoutes(app, createDictionaryService({ url: BASE_URL }))
    const response = await app.inject({
      method: 'POST',
      url: '/api/dictionary/lookup',
      payload: { word: 'слово' },
    })
    assert.equal(response.statusCode, scenario.status)
    assert.deepEqual(response.json(), { error: { code: scenario.code } })
    assert.equal(mock.calls.length, scenario.responses.length)
  }
  let calls = 0
  mock.method(undici, 'request', async () => {
    calls++
    throw new Error('secret network detail')
  })
  const lookup = createDictionaryService({ url: BASE_URL })
  await assert.rejects(lookup('слово'), { message: DictionaryErrorCode.enum.DICTIONARY_FAILED })
  assert.equal(calls, 1)
})

test('overall deadline includes stalled response bodies, aborts requests and maps to 504', async (t) => {
  let signal: AbortSignal | undefined
  const app = Fastify()
  t.after(() => app.close())
  const fetch: typeof globalThis.fetch = async (_url, init) => {
    signal = init!.signal!
    return new Response(new ReadableStream({ start() {} }))
  }
  mock.method(undici, 'request', async (url: string, init: RequestInit) =>
    upstreamResponse(await fetch(url, init)),
  )
  await dictionaryRoutes(app, createDictionaryService({ url: BASE_URL, timeoutMs: 10 }))
  const response = await app.inject({
    method: 'POST',
    url: '/api/dictionary/lookup',
    payload: { word: 'слово' },
  })
  assert.equal(response.statusCode, 504)
  assert.deepEqual(response.json(), {
    error: { code: DictionaryErrorCode.enum.DICTIONARY_TIMEOUT },
  })
  assert.equal(signal!.aborted, true)
})

test('one deadline covers resolve and all sequential definitions', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const signals: AbortSignal[] = []
  const calls: string[] = []
  mock.method(undici, 'request', async (url: string, init: RequestInit) => {
    calls.push(String(url))
    signals.push(init!.signal!)
    if (calls.length === 1) {
      t.mock.timers.tick(60)
      return upstreamResponse(json({ matches: [match('один'), match('два')] }))
    }
    t.mock.timers.tick(60)
    return upstreamResponse(json(entry('один')))
  })
  const lookup = createDictionaryService({ url: BASE_URL, timeoutMs: 100 })
  await assert.rejects(lookup('слово'), { code: DictionaryErrorCode.enum.DICTIONARY_TIMEOUT })
  assert.equal(calls.length, 2)
  assert.equal(
    signals.every((signal) => signal.aborted),
    true,
  )
})

test('application registers dictionary independently of key, proxy and database; invalid input never calls upstream', async (t) => {
  const mock = transport([json({ matches: [] })])
  const app = Fastify()
  t.after(() => app.close())
  await application(app, {
    correction: {
      environment: { NODE_ENV: 'production', DICTIONARY_BASE_URL: BASE_URL },
      database: null,
    },
  })
  for (const payload of [
    {},
    { word: '' },
    { word: 'два слова' },
    { word: 'cлово' },
    { word: 1 },
    { word: 'слово', url: 'https://untrusted.test' },
  ]) {
    const response = await app.inject({ method: 'POST', url: '/api/dictionary/lookup', payload })
    assert.equal(response.statusCode, 400)
    assert.deepEqual(response.json(), { error: { code: DictionaryErrorCode.enum.INVALID_INPUT } })
  }
  assert.equal(mock.calls.length, 0)
  const response = await app.inject({
    method: 'POST',
    url: '/api/dictionary/lookup',
    payload: { word: ' «слово!» ' },
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.deepEqual(response.json(), { query: 'слово', results: [] })
})

test('service repeats input validation and fails invalid configuration without transport calls', async () => {
  const mock = transport([])
  await assert.rejects(createDictionaryService({ url: BASE_URL })('two words'), {
    code: DictionaryErrorCode.enum.INVALID_INPUT,
  })
  await assert.rejects(createDictionaryService({})('слово'), {
    code: DictionaryErrorCode.enum.DICTIONARY_FAILED,
  })
  assert.equal(mock.calls.length, 0)
  assert.ok(new DictionaryError(DictionaryErrorCode.enum.INVALID_INPUT) instanceof Error)
})

test('inspection script reuses the adapter while retaining original response bodies', async () => {
  const scriptPath = '../../../scripts/dictionary-lookup.mjs'
  const { lookupDictionaryWord } = await import(scriptPath)
  const resolved = { matches: [{ ...match('слово'), references: ['ignored-reference'] }] }
  const examples = [{ text: '  Приме́р  ', ref: 'original-citation' }]
  const definitions = entry('слово', [
    definition('noun', [
      {
        glosses: ['  сокр. глосс  '],
        tags: [],
        examples,
      },
    ]),
  ])
  const mock = transport([json(resolved), json(definitions)])
  const raw: unknown[] = []
  const response = await lookupDictionaryWord('слово', raw, mock.fetch)
  assert.deepEqual(raw, [
    {
      url: `https://dictionary.noikis.ru/v1/ru/resolve/${encodeURIComponent('слово')}?lang=ru`,
      status: 200,
      body: resolved,
    },
    {
      url: `https://dictionary.noikis.ru/v1/ru/word/${encodeURIComponent('слово')}/definitions?lang=ru`,
      status: 200,
      body: definitions,
    },
  ])
  assert.equal(response.results[0].matches.length, 1)
  assert.equal(response.results[0].definitions[0].language, 'ru')
  assert.equal('lang_code' in response.results[0].definitions[0], false)
  assert.equal('references' in response.results[0].matches[0], false)
  assert.deepEqual(response.results[0].definitions[0].senses[0].examples, [
    { text: '  Приме́р  ', source: DictionaryExampleSource.enum.wiktionary },
  ])
  assert.equal(DictionaryResponse.safeParse(response).success, true)
  const missing = transport([json(resolved), new Response('not found', { status: 404 })])
  const missingRaw: unknown[] = []
  assert.deepEqual(await lookupDictionaryWord('слово', missingRaw, missing.fetch), {
    query: 'слово',
    results: [],
  })
  assert.deepEqual(missingRaw[1], {
    url: `https://dictionary.noikis.ru/v1/ru/word/${encodeURIComponent('слово')}/definitions?lang=ru`,
    status: 404,
    body: 'not found',
  })
})

test('dictionary failures keep selected words, URLs and upstream diagnostics out of application logs', async (t) => {
  const lines: string[] = []
  const app = Fastify({
    ...options,
    logger: {
      ...(typeof options.logger === 'object' ? options.logger : {}),
      stream: { write: (line: string) => lines.push(line) },
    },
  })
  t.after(() => app.close())
  mock.method(undici, 'request', async () => {
    throw new Error('private upstream diagnostic')
  })
  await application(app, {
    correction: { environment: { DICTIONARY_BASE_URL: BASE_URL }, database: null },
  })
  const response = await app.inject({
    method: 'POST',
    url: '/api/dictionary/lookup',
    payload: { word: 'фикстура' },
  })
  assert.equal(response.statusCode, 502)
  const logs = lines.join('\n')
  for (const secret of [
    'фикстура',
    encodeURIComponent('фикстура'),
    BASE_URL,
    'private upstream diagnostic',
  ]) {
    assert.equal(logs.includes(secret), false)
    assert.equal(response.body.includes(secret), false)
  }
})

test('a later network failure fails the entire lookup and repeated lookups are not cached', async () => {
  let calls = 0
  mock.method(undici, 'request', async () => {
    calls++
    if (calls % 3 === 1) return upstreamResponse(json({ matches: [match('один'), match('два')] }))
    if (calls % 3 === 2) return upstreamResponse(json(entry('один')))
    throw new Error('network failure')
  })
  const lookup = createDictionaryService({ url: BASE_URL })
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(lookup('слово'), { code: DictionaryErrorCode.enum.DICTIONARY_FAILED })
  }
  assert.equal(calls, 6)
})
