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
unset. Home Lab requires GRAMOTA_ENV=homelab and
OPENROUTER_PROXY_URL=http://10.201.0.2:8888. Missing configuration prevents calls;
proxy failures never trigger a direct retry. Infrastructure VPN behavior still
requires separate verification in Feature 6.

Start `npm run dev:server` and `npm run dev:web` in separate terminals. Fastify uses
port 3000 and Vite proxies relative `/api` requests to it. Restart the server after
changing its environment file. The server can start without a key; the workspace
then reports that correction is not configured.

The development watcher follows only compiled files in `dist`, so database writes
do not restart the API. Storage failures log a safe stage (initialize/begin/finish)
and driver codes, never exception messages, user text, keys or database paths.

The fixed Qwen3.5 Flash model sends only the Strict instruction and current text,
with reasoning disabled, no streaming, automatic retries or application caching.
The maximum is 5,000 Unicode code points with a 30-second upstream deadline.
Copy always uses the complete clean output in both Text and Changes views.

History reads saved corrections through GET /api/history and
GET /api/history/:correctionId, without an OpenRouter key or upstream requests.
Normal server startup migrates schema v1 to v2 transactionally. Existing records,
originals, results and IDs are preserved. New metrics on older records remain
unavailable; there is no network backfill or automatic replay.

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
