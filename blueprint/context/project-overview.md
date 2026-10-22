# Gramota - Project Overview

<!-- blueprint:source-hash 41165cdc61bb3c1cf7d090f83c3dce4c214941277cefebf6d85911c9deecc9a5 -->

Derived from [project-plan.md](../project-plan.md) and [build-plan.md](../build-plan.md).
Updated 2026-10-20 to reflect completed work and user decisions. Implementation
contracts and history remain in current-feature.md and blueprint/history/.

## Product and scope

Personal writing assistant for short Russian messages and letters. Correct
objective grammar, spelling and punctuation with minimal changes, preserving
meaning, voice, names, numbers, links, emoji and whitespace. Return only complete
corrected text; already-correct input stays unchanged.

One user, primarily on a phone, with production running as reported by the user. Strict is the
only mode. English/French, explanations, tone controls, document uploads,
application authentication and further access features remain deferred. There is no monetization.

[Unreviewed ideas](../../docs/ideas.md) are retained for discussion only. They
are not approved requirements, priorities or instructions to implement features.

## Progress

**V1 is finished and accepted as of 2026-10-20**, with the agreed scope complete
and the production deployment working as reported by the user. Deferred work is
outside this release.

Product decisions live in project-plan.md; setup and deployment instructions live
in docs/container.md. Build-plan.md tracks progress; history retains completed work.

Original roadmap features 1-5 are complete: responsive editor, Strict correction
with request recording, local diff, expandable history, model selection and
repeated corrections. Search/filter/sort/pagination, Sonner notifications and
manual V3 comparison tooling are completed follow-up work.

Feature 6 is split into 6a (minimal diagnostic logging and one local GET /health),
6b (one container serving API/frontend, persistent SQLite and recreation checks),
and the now-deferred 6c (backup/restore). Features 6a and 6b are complete, including
disposable recreation checks, and Feature 6 is complete for the agreed scope.
The user deferred 6c on 2026-10-20 because the data is not important enough to
require it; no backup/restore was implemented. VPN/proxy reachability
monitoring remains a separate open question. Local health does not prove upstream
availability. The user reported on 2026-10-19 that OpenRouter access is
denied with VPN disconnected. This is manual user evidence, not verification of
the container's actual routing or a new agent network test.

On 2026-10-20 the user confirmed that the production deployment is running and
working, and accepted feature 6b as complete. This is user-reported evidence;
no remote deployment verification was run.

## Implemented architecture

- V2.8 is implemented and accepted on 2026-10-22. Real phone OS installation
  remains unverified. App/browser/installed branding is Грамика, with the approved italic
  speech-bubble/check icon and Literata Bold Italic wordmark. A root manifest
  enables standalone launch; installation guidance follows the first successful
  correction and remembers dismissal. No service worker or offline loading.
  See [PWA scope and evidence](../../docs/pwa.md).
- npm workspaces: apps/web, apps/server, packages/contracts; root lockfile.
- React/Vite/TypeScript, Tailwind CSS, local shadcn-style components, Sonner.
  App.tsx, components/, use-correction*.ts, use-history.ts and lib/ own the UI.
- Fastify CLI loads app.ts, which composes resources and explicitly registers
  routes/root.ts, corrections.ts, history.ts, model-settings.ts and health.ts.
  Production GET / and assets serve the Vite build through @fastify/static;
  development retains the simple root response. GET /health checks local
  configuration and SQLite. app-resources.ts owns initialization and cleanup.
- correction/ owns attempts, strict-v3, request defaults and small recording and
  transport contracts. openrouter/ owns Undici, response validation and metadata.
  correction-config.ts validates environment and proxy; benchmark/ contains the
  manual CLI, reusable runner and offline reports. CLI is never imported at startup.
- database/ owns stable Drizzle ORM with better-sqlite3, transactional SQL migrations,
  correction writes, history queries and model preferences. SqliteDatabase opens
  one connection, explicitly migrates and recovers interrupted attempts, then
  exposes corrections, history and modelPreferences. Cross-module imports use
  public index.ts entry points; these are internal modules, not new packages.
  schema.ts defines typed tables; apps/server/drizzle/ holds generated SQL and
  metadata. Existing current-schema tables require one-time baseline registration
  outside the application; startup runs only Drizzle migrations. Drizzle's journal
  tracks future migrations. Ship drizzle/ alongside dist/.
  database/repositories/ contains correction-repository.ts, history-repository.ts
  and model-preference-repository.ts; correction/ defines CorrectionRepository.
  Public Zod contracts live in contracts/src/models.ts,
  correction.ts and history.ts; index.ts re-exports the public API.
- Preserve existing tsconfig settings; no Next.js, Prisma, Clerk or extra services.

## Models and request policy

Gemma 4 26B A4B (google/gemma-4-26b-a4b-it) is the default. Gemini 3.1 Flash Lite
(google/gemini-3.1-flash-lite) is the only alternative. The user considers Gemini
more expensive but has not established better quality. Other models are removed
from new selections; saved historical records remain readable. Unsupported saved
preferences reset to Gemma when configuration is loaded.

The user tested multiple phrases and styles and accepted the results. Use the
single strict-v3 prompt; there is no demonstrated need for style-specific prompts.
Send only the fixed system instruction and current user text, never history.
Treat text as proofreading data, not instructions. No automatic requests on edit.

Limit: 5,000 Unicode code points. Timeout: 60 seconds. Request parameters include
reasoning.enabled=false, stream=false, max_tokens=8192,
provider.require_parameters=true and provider.allow_fallbacks=false. No automatic
retry or fallback model. V2.11a reuses successful corrections from non-deleted SQLite history on exact text, model, mode, prompt and settings matches. No expiry; explicit Generate again bypasses reuse. Gemini reuse stays within the displayed Gemma history entry. No browser text storage. Ordinary corrections accept complete valid
output despite reasoning fields or positive reasoning token counts and log the
setting violation only. Internal reasoning is never stored or displayed.

## Data and history

corrections stores UUID, ISO timestamp, exact original, ru and strict.
model_requests stores separate UUID attempts, sent model/parameters/prompt version,
complete output or failure, timings and validated reported usage/cost/routing.
model_preference stores the selected model. No language or reasoning settings UI.
A repeated unchanged original groups attempts under one correction; editing the
original starts a new correction. Interrupted attempts are recorded, never replayed.

Unknown metrics remain null, costs are USD, application durations milliseconds.
Do not store secrets, full raw provider responses or reasoning text. Diff is
computed locally. Search matches phrases in originals or any result; filters,
newest/oldest sorting and 10-record pages are implemented. History sorting, date filtering and list dates use lastUsedAt, updated on cache return or new attempt start; original creation and request timestamps remain unchanged. Reuse keeps original request IDs, costs and saved explanations, without adding attempts.

## UI and verification

Blue-black surfaces, green accents, local Roboto, English UI, 720px breakpoint.
Desktop has side-by-side editors; mobile stacks them. Model selection matches the
original editor width, with its label above. Labels: Gemma 4 · Standard and
Gemini 3.1 Flash Lite · Higher cost. Quality helper text appears only for Gemini.

Submitted text trims leading/trailing whitespace while preserving internal
whitespace; the editor retains the untrimmed draft. Text/Changes defaults to Changes.
Copy always uses clean output and confirms only
actual clipboard success. Preserve input on failures; allow manual clipboard
fallback. Sonner provides transient feedback. Metrics belong in expanded history.
The current React UI supersedes older static prototypes; history-v2 is the newer
history design reference.

Agents use mocked requests and isolated databases. Never read private .env files
or personal records for ordinary verification. Only the human may run benchmark
commands, including preview; no agent paid calls. Benchmark results/cases are in
ignored apps/server/benchmark-data/, separate from application history. Reports
are offline HTML without external calls or automatic scoring. See docs/benchmark.md.

Commands and workflow overrides: AGENTS.md. Server tests use node:test with
Fastify inject and mocks. Web/contracts have no test command; no combined Verify,
CI or browser test harness is configured. Playwright MCP needs explicit permission.
Review belongs to the user; no automatic review subagents. Reuse passing checks
when code is unchanged and keep completion bookkeeping lightweight.

## Environment and remaining work

One private root .env serves local development and Compose; no web env file is
needed. Development uses NODE_ENV=development and system VPN. The Docker image
sets NODE_ENV=production independently of the root file. Production requires
a valid HTTP(S) OPENROUTER_PROXY_URL from private environment configuration,
with no direct fallback. Missing or invalid configuration prevents correction. Credentials remain server-only.
Container SQLite retains server-relative data/gramota.sqlite, using a named volume
mounted at /app/apps/server/data without a SQLITE_PATH override. Synthetic history and
model preference survive local container recreation. GRAMOTA_PORT changes the
published host port, default 3000, on all interfaces. The service joins the existing
nginx-proxy-manager_default network; Nginx Proxy Manager targets http://gramota:3000.
Container logs rotate and restart policy is unless-stopped. Backup/restore is deferred. Actual container VPN routing and
secure phone access remain unverified. See
docs/container.md.

## Approved V2 follow-ups (2026-10-22)

V2.9 history filter correctness and V2.10 complete valid correction output with logging-only reasoning violations are complete. V2.11a correction caching and V2.11b browser persistence are completed and accepted. See project-plan.md and build-plan.md for contracts.


## Browser workspace persistence (V2.11b)

Native localStorage under gramota.workspace stores one validated version-1 snapshot: the untrimmed draft, visible Gemma/Gemini results and IDs, active model, per-result view, theme and pending marker. Selected correction mode is session-only; reopening always starts Strict, including older saved Rewrite preferences. Saved results retain their actual mode. Restore automatically; never replay a model request. New correction clears the workspace but keeps session preferences; immediate Clear local data resets both and retains server history and the separate exchange-rate cache. History deletion in this app removes associated local results and retains the draft. Interrupted requests offer Check history. Tabs remain independent and latest save wins for reopening. Storage failures report a warning without blocking editing. No expiry, local history database, dependencies or offline loading.
