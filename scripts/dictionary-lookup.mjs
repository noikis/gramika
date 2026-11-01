import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { RussianWord } from '@gramota/contracts'
import dictionary from '../apps/server/dist/dictionary/index.js'

const { ResolveResponse, DefinitionsResponse, groupMatches, adaptDefinitions } = dictionary
const OUTPUT_DIRECTORY = new URL('../test-results/dictionary/', import.meta.url)
const BASE_URL = 'https://dictionary.noikis.ru'

export async function lookupDictionaryWord(word, rawResponses, fetchTransport = fetch) {
  const query = RussianWord.parse(word)
  const signal = AbortSignal.timeout(15_000)
  const request = async (path, isResolve = false) => {
    const url = `${BASE_URL}${path}?lang=ru`
    const response = await fetchTransport(url, { signal })
    const rawBody = await response.clone().text()
    let body
    try {
      body = JSON.parse(rawBody)
    } catch {
      body = rawBody
    }
    rawResponses.push({
      url: String(url),
      status: response.status,
      body,
    })
    if (!isResolve && response.status === 404) return undefined
    if (!response.ok) throw new Error('Dictionary request failed')
    return body
  }
  const resolved = ResolveResponse.parse(
    await request(`/v1/ru/resolve/${encodeURIComponent(query)}`, true),
  )
  const results = []
  for (const [lemma, matches] of groupMatches(resolved)) {
    const payload = await request(`/v1/ru/word/${encodeURIComponent(lemma)}/definitions`)
    if (payload === undefined) continue
    const entry = DefinitionsResponse.parse(payload)
    if (entry.definitions.length) results.push(adaptDefinitions(entry, matches))
  }
  return { query, results }
}

async function main(words) {
  if (!words.length || words.includes('--help')) {
    console.log('Usage: node scripts/dictionary-lookup.mjs <word> [word ...]')
    return
  }
  try {
    const normalizedWords = words.map((word) => RussianWord.parse(word))
    await mkdir(OUTPUT_DIRECTORY, { recursive: true })
    for (const word of normalizedWords) {
      const rawResponses = []
      try {
        const response = await lookupDictionaryWord(word, rawResponses)
        await writeFile(
          new URL(`${word}.json`, OUTPUT_DIRECTORY),
          JSON.stringify(response, null, 2) + '\n',
          'utf8',
        )
      } finally {
        await writeFile(
          new URL(`${word}.raw.json`, OUTPUT_DIRECTORY),
          JSON.stringify(rawResponses, null, 2) + '\n',
          'utf8',
        )
      }
    }
  } catch {
    console.error(
      'Dictionary lookup failed. Check that each argument is one Russian word and the service is available.',
    )
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2))
}
