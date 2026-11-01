# Russian dictionary API

Gramota can use the public dictionary service at
`https://dictionary.noikis.ru`. It is a fork of Wiktapi with Russian
morphology and Wiktionary-derived data. The API is read-only and does not
require an API key in the published contract.

## Contract and documentation

- OpenAPI: `GET /_openapi.json`
- Scalar UI: `GET /_scalar`
- Swagger UI: `GET /_swagger`
- Root route: `GET /`

The OpenAPI document is the source of truth if this guide and the running
service differ.

## Editions and languages

The `{edition}` path segment identifies a Wiktionary edition. Use `ru` for
Russian dictionary data unless a feature explicitly needs another edition.

```text
GET /v1/editions
GET /v1/languages
```

`/v1/editions` returns `{ "editions": string[] }`. `/v1/languages` returns
language records containing `lang_code`, optional display name `lang`, and an
`entry_count`.

## Word data

All word paths require URL-encoding the `{word}` segment. An optional `lang`
query parameter filters entries by language code.

```text
GET /v1/{edition}/word/{word}
GET /v1/{edition}/word/{word}/definitions
GET /v1/{edition}/word/{word}/forms
GET /v1/{edition}/word/{word}/pronunciations
GET /v1/{edition}/word/{word}/translations
```

The full word endpoint returns `{ word, edition, entries }`, where `entries`
contains complete parsed `kaikki.org` entry objects. The specialized endpoints
return the same word and edition plus a focused array:

- `definitions`: parts of speech, language codes, senses, glosses, examples,
  and tags.
- `forms`: inflected forms grouped by part of speech and language.
- `pronunciations`: IPA/audio sounds and tags.
- `translations`: translation lists grouped by part of speech and language.

The OpenAPI schemas intentionally describe these payloads only partially. Code
that consumes nested entry data should tolerate additional fields and missing
optional values.

## Search and morphology

Prefix search returns up to 50 words and supports an optional language filter:

```text
GET /v1/{edition}/search?q={prefix}&lang={lang_code}
```

The required `q` parameter is matched with locale-independent Unicode case
folding. Results contain `word`, `lang_code`, and optional `lang` and `pos`.
Missing `q` returns `400`.

Russian morphology is exposed through reverse lookup of an inflected form:

```text
GET /v1/{edition}/resolve/{word}?lang=ru
```

For Russian, use `/v1/ru/resolve/{form}`. It returns matching lemmas and forms;
the service may return `503` when its reverse index is unavailable.

## Integration notes for agents

- Keep the base URL configurable when adding application integration; do not
  hard-code a private host or credentials.
- URL-encode words and query parameters, especially Cyrillic text and spaces.
- Treat `503` from `resolve` as a temporary dictionary/index failure rather
  than as proof that a word is unknown.
- Do not assume that every endpoint returns a complete or stable nested object;
  preserve unknown fields and handle absent optional fields.
- Do not put personal text, secrets, or large dictionary responses in logs or
  fixtures. Use mocked HTTP responses for automated tests.

## Application backend and inspection script

The application uses `POST /api/dictionary/lookup` with `{ "word": "слово" }`.
Its public Zod contracts live in `packages/contracts/src/dictionary.ts`.
The backend retains all resolve analyses grouped by exact lemma and preserves
definitions and examples verbatim. Examples expose only `text` and the
`wiktionary` source. No-match results have an empty `results` array, without
search or exact-word fallback. See [the V4.4 specification](v4.4-dictionary-spec.md)
for the full contract and [configuration guide](container.md) for deployment.

For manual dictionary inspection, first run `npm run build:ts -w apps/server`,
then `node scripts/dictionary-lookup.mjs слово`. This makes live dictionary
requests and uses the same backend response schemas and adapter. Adapted `<word>.json`
and untouched response bodies in `<word>.raw.json` are written to ignored
`test-results/dictionary/`. Raw files are inspection artifacts only and never
returned by the application API. The script uses the public service URL and
the same overall 15-second deadline per word.

