# Correction setup

Use Node 24.16 or later in the Node 24 line and run commands from the repository
root. Install workspace dependencies with the root lockfile.

The server loads `apps/server/.env` at runtime. Agents must not inspect this file.
Set these values yourself:

```dotenv
OPENROUTER_API_KEY=your_key
GRAMOTA_ENV=development
SQLITE_PATH=./data/gramota.sqlite
```

Relative SQLite paths resolve from the server workspace when using the root npm
commands. With SQLITE_PATH omitted, storage defaults to `apps/server/data/gramota.sqlite`.
Database files and sidecars are ignored by Git. Startup applies transactional
migrations and records interrupted pending requests without resubmitting them.

On the development computer, use the system VPN and leave OPENROUTER_PROXY_URL
unset. Production requires GRAMOTA_ENV=production and a valid HTTP(S) proxy URL in
OPENROUTER_PROXY_URL, supplied through private environment configuration.
Missing or invalid configuration prevents calls;
proxy failures never trigger a direct retry. On 2026-10-19 the user reported that OpenRouter access is denied when the VPN
is disconnected. This manual evidence does not verify future container packaging
or storage durability.

Start `npm run dev:server` and `npm run dev:web` in separate terminals. Fastify uses
port 3000 and Vite proxies relative `/api` requests to it. Restart the server after
changing its environment file. The server can start without a key; the workspace
then reports that correction is not configured.

The development watcher follows only compiled files in `dist`, so database writes
do not restart the API. Storage failures log a safe stage (initialize/begin/finish)
and driver codes, never exception messages, user text, keys or database paths.

## Diagnostic logs and health

No additional logging package is needed. Fastify's existing Pino logger writes
through the internal `src/logging/` module: `index.ts` exposes configuration and
enums. Configuration is supplied when the Fastify instance is created; this
module is not a Fastify plugin. Logs use
JSON to stdout in production and readable output with the existing development
command. Both commands load the exported application options with `--options`.
Routine successful requests, corrections and health polls are not logged.
Operational failures include safe codes, request IDs, HTTP method, route template
and operation; correction failures also include duration and an attempt ID when
one exists. Storage failures use the same request ID as their HTTP request.
Exception messages and stack traces are omitted; there is no custom stack parser. Fastify
response/stream/serialization failures remain visible; successful responses and
404s stay quiet. Startup configuration warnings and resource shutdown are logged.
Bodies, original/result text, search phrases, actual URL parameters, headers,
secrets and arbitrary exception messages are excluded. The serializers protect
structured request/error fields; never put private content into log messages or
new arbitrary fields.

GET `/health` returns `200 {"status":"ok"}` when required correction configuration
is valid and the database can be read. Otherwise it returns `503` with
`{"status":"unavailable","reason":"DATABASE_UNAVAILABLE"}` or `NOT_CONFIGURED`.
Database unavailability takes precedence if both checks fail. Responses use
`Cache-Control: no-store`. Checks reuse the startup configuration and read the
model preference through the existing repository without changing saved data.
No OpenRouter/proxy/VPN request is made; a healthy response does not establish
upstream reachability. VPN monitoring is deferred for separate discussion.

With the API already running, inspect health with `curl -i http://localhost:3000/health`.
Inspect logs in the server terminal, or through `docker logs` once container
packaging exists. Container log rotation will be configured with packaging.

## Correction and history

Gemma 4 26B A4B is the default; Gemini 3.1 Flash Lite is the only alternative.
Both send only the strict-v3 instruction and current text,
with reasoning disabled, no streaming, automatic retries or application caching.
The maximum is 5,000 Unicode code points with a 60-second upstream deadline.
Copy always uses the complete clean output in both Text and Changes views.

History reads saved corrections through GET /api/history and
GET /api/history/:correctionId; POST /api/history/search accepts search, filters,
sorting and pagination. None of these routes needs an OpenRouter key or upstream requests.
Storage uses stable Drizzle ORM with better-sqlite3. Normal server startup applies
committed SQL migrations from `apps/server/drizzle/`. An existing database with
the current tables needs its baseline registered once outside the application,
without recreating those tables. Startup only runs Drizzle's migrator; it does
not upgrade earlier schema versions or automatically register existing tables.
Migrations are tracked in __drizzle_migrations.
The user's existing `apps/server/database.sqlite` was registered once on
2026-10-19, with a local backup and no changes to application records. Keep using
the configured path to that file to retain the existing history.
Model preference is persisted; unsupported saved choices reset to Gemma when
configuration is read. Existing records,
originals, results and IDs are preserved. New metrics on older records remain
unavailable; there is no network backfill or automatic replay.

After editing `src/database/schema.ts`, run
`npm run db:generate -w apps/server -- --name=<change>` from the repository root.
Review the generated SQL and commit the SQL and metadata together. Do not edit
already applied migrations or use `drizzle-kit push` against saved history.
The initial baseline includes the original model-preference seed; future model
changes must not rewrite that baseline. Runtime packaging must include the
`apps/server/drizzle/` directory alongside `apps/server/dist/`. Application startup
uses the ORM migrator and does not require Drizzle Kit in production.

Requests opt in with X-OpenRouter-Metadata: enabled. The server records validated
reported token totals, cache reads/writes, charged cost, upstream cost breakdown,
generation time, selected provider and routing fields. It does not estimate missing
metrics or calculate totals. OpenRouter generation time is separate from locally
measured App request time. No raw responses, free-form pipeline details, headers,
credentials or reasoning text are stored. Missing metadata does not fail correction.

`npm test -w apps/server` uses injected environments, isolated SQLite databases
and mocked upstream responses. It does not load the private environment file or
make paid requests. Only the user may run real OpenRouter corrections. Browser
checks by an agent must intercept correction traffic with local mocks before
clicking Correct. Do not inspect personal persisted records for verification.

The application rejects responses containing reasoning fields or positive
reasoning token counts. Manual benchmarks bypass only this guard; the request
still asks for disabled reasoning. Agents must never invoke the benchmark CLI,
including preview. See [benchmark.md](../../docs/benchmark.md).
