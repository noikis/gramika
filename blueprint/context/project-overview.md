# Gramota - Project Overview

<!-- blueprint:source-hash eab216eec677fc6d43a23304152d38fdb680e8a86a81300d6dd749c8f5e4f50a -->

Derived from [project-plan.md](../project-plan.md) and [build-plan.md](../build-plan.md).
Updated 2026-10-19 to reflect completed work and user decisions. Implementation
contracts and history remain in current-feature.md and blueprint/history/.

## Product and scope

Personal writing assistant for short Russian messages and letters. Correct
objective grammar, spelling and punctuation with minimal changes, preserving
meaning, voice, names, numbers, links, emoji and whitespace. Return only complete
corrected text; already-correct input stays unchanged.

One user, primarily on a phone, with production deployment planned. Strict is the
only mode. English/French, explanations, tone controls, document uploads,
authentication and external access remain deferred. There is no monetization.

[Unreviewed ideas](../../docs/ideas.md) are retained for discussion only. They
are not approved requirements, priorities or instructions to implement features.

## Progress

Original roadmap features 1-5 are complete: responsive editor, Strict correction
with request recording, local diff, expandable history, model selection and
repeated corrections. Search/filter/sort/pagination, Sonner notifications and
manual V3 comparison tooling are completed follow-up work.

Feature 6 is split into 6a (minimal diagnostic logging and one local GET /health),
6b (one container serving API/frontend, persistent SQLite and recreation checks),
and 6c (backup/restore). Feature 6a is being implemented; VPN/proxy reachability
monitoring remains a separate open question. Local health does not prove upstream
availability. The user reported on 2026-10-19 that OpenRouter access is
denied with VPN disconnected. This is manual user evidence, not verification of
the future container or a new agent network test.

## Implemented architecture

- npm workspaces: apps/web, apps/server, packages/contracts; root lockfile.
- React/Vite/TypeScript, Tailwind CSS, local shadcn-style components, Sonner.
  App.tsx, components/, use-correction*.ts, use-history.ts and lib/ own the UI.
- Fastify CLI loads app.ts, which composes resources and explicitly registers
  routes/root.ts, corrections.ts, history.ts and model-settings.ts. GET / returns
  a simple root response, not a complete deployment health check. Built frontend
  serving remains unfinished. app-resources.ts owns initialization and cleanup.
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
retry, fallback model or result cache. Ordinary corrections reject reasoning fields
or positive reasoning token counts; manual benchmarks bypass only that guard.

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
newest/oldest sorting and 10-record pages are implemented.

## UI and verification

Blue-black surfaces, green accents, local Roboto, English UI, 720px breakpoint.
Desktop has side-by-side editors; mobile stacks them. Model selection matches the
original editor width, with its label above. Labels: Gemma 4 · Standard and
Gemini 3.1 Flash Lite · Higher cost. Quality helper text appears only for Gemini.

Text/Changes defaults to Changes. Copy always uses clean output and confirms only
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

Development uses system VPN. Production requires GRAMOTA_ENV=production and
a valid HTTP(S) OPENROUTER_PROXY_URL from private environment configuration,
with no direct fallback. Missing or invalid configuration prevents correction. Credentials remain server-only.
Persistent volumes, backup/restore and secure phone access are not established by
local development behavior. See docs/environments.md and docs/status.md.
