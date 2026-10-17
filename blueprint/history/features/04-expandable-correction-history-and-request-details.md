# Feature: Expandable correction history and request details

**From build-plan:** feature 4
**Build attempt:** 1
**Branch:** feature/expandable-correction-history-and-request-details

## Goal

Browse saved corrections, inspect every recorded request and its result, and
compare provider-reported usage, cost and generation time. Approved for implementation
by the user on 2026-10-18.

## Design reference

Use the approved `prototypes/history.html`, `prototypes/theme.css` and prototype
handoff. Preserve the existing dark theme, local Roboto, English labels, compact
preview/date/model summaries and expandable details. Keep metrics inside expanded
History entries, not on the Correction screen. Match the existing 720px responsive
breakpoint and reuse the implemented Text/Changes rendering with Changes default.

## In scope

- Transactional migration and validated extraction of additional metrics from the
  existing correction response, with `X-OpenRouter-Metadata: enabled` retained.
- Read-only History list/detail API backed by SQLite and shared Zod contracts.
- Expandable saved entries with original, individual request results, safe diff,
  clean Copy, request status and truthful metrics.
- Old records, multiple requests per correction, empty/loading/error states,
  failures, interruptions, pending requests and missing metadata.

## Out of scope

Model selection, repeat actions, benchmark dashboards or scoring, request deletion,
search/filtering, exports, pagination, settings, auth and deployment. Do not add
OpenRouter generation-metadata lookups, enrichment jobs or paid evaluations.
Agent-initiated OpenRouter calls and private environment/database inspection are
forbidden. Test only isolated fictional records and mocked upstream responses.

## Build loop

After approval create the recorded branch. Implement the steps in order and
present one final review packet. No checkpoint commits or automatic review
sub-agents. The user installs dependencies if an established requirement needs
one; none is anticipated. The user performs live UI testing unless separately
authorizing browser checks. Complete reuses passing evidence and ordinary local
Git operations under AGENTS.md; no push.

## Build steps

- [x] 1. Preserve reported metadata and migrate existing records.
  Extend the validated upstream parser and database outcome write. Add a forward,
  transactional schema-v2 migration retaining existing rows and identifiers.
  Rename the misleading provider_request_id column to openrouter_generation_id.
  Add the nullable fields below; never backfill missing metrics with estimates.
  Done when mocked responses preserve provider-reported totals, generation time,
  selected provider and cost breakdown; absent or malformed individual fields
  remain unknown without discarding other valid metrics. Migration/reopen tests
  preserve original/result/status data and reject unsupported newer versions.

- [x] 2. Expose saved History through public contracts.
  Add database reads and the two GET routes below, reusing the existing database
  lifecycle. History must work without an OpenRouter key and never call upstream.
  Done when Fastify inject tests prove deterministic ordering, empty list, older
  records, multiple requests, pending/failed/successful outcomes, invalid/missing
  IDs and sanitized storage errors. Validate responses against shared Zod schemas.

- [x] 3. Implement the approved expandable History list.
  Replace the unavailable view in App with a History component. Fetch summaries
  on entry, fetch full details when an entry is first expanded, and retain fetched
  detail while that History view stays mounted. No background polling. Re-entering
  History refreshes its list; Retry is available after a fetch failure.
  Done when summaries show only preview/date/models, native keyboard-operable
  disclosure controls reveal the exact original and every request, and
  loading/empty/error states have clear accessible feedback. Correction draft and
  its current result survive navigation. Web build and lint pass.

- [x] 4. Integrate result views, metrics and clean Copy per request.
  Reuse ResultView and local diff, adapting its labels/types for saved results from
  any recorded model and making feedback IDs unique. Each successful request
  starts in Changes, has independent view/copy feedback, and copies only its own
  clean correctedText. Clipboard failure switches that request to selectable Text.
  Failed/pending requests show their actual status and safe error where present,
  without fabricated results or Copy controls.
  Done when fictional fixtures prove per-request isolation, exact clean Copy,
  unchanged/Unicode/HTML-like text handling and truthful metric formatting. Server
  tests, web build and lint pass. Desktop/phone/intermediate layout, keyboard,
  disclosure and clipboard behavior require live evidence or user acceptance.

## Files / areas

- `apps/server/src/database.ts`, `correction-service.ts`, `correction-api.ts` and
  focused History routes/read functions registered through the existing app.
- `apps/server/test` using existing node:test, temporary SQLite and Fastify inject.
- `packages/contracts/src/index.ts`: History DTOs, response and error schemas.
- `apps/web/src/App.tsx`, new focused History components/state, existing
  `components/result-view.tsx`, clipboard logic and `App.css` as needed.
- `apps/server/CORRECTION.md` for metadata and migration behavior. Keep approved
  prototypes, prompt, environment files and unrelated files unchanged.

## Data / contracts

### Provider data and migration

The user explicitly prefers reported metrics over locally calculated substitutes.
Keep existing input/output/reasoning/cache-read token fields and charged cost.
Extend model_requests with these nullable, validated fields:

| SQL column | Response source | Type |
| --- | --- | --- |
| total_tokens | usage.total_tokens | Nonnegative safe INTEGER |
| cache_write_tokens | usage.prompt_tokens_details.cache_write_tokens | Nonnegative safe INTEGER |
| generation_time_ms | openrouter_metadata.generation_time | Finite nonnegative REAL, milliseconds |
| upstream_inference_cost_usd | usage.cost_details.upstream_inference_cost | Finite nonnegative REAL |
| upstream_prompt_cost_usd | usage.cost_details.upstream_inference_prompt_cost | Finite nonnegative REAL |
| upstream_completion_cost_usd | usage.cost_details.upstream_inference_completions_cost | Finite nonnegative REAL |
| routing_strategy | openrouter_metadata.strategy | TEXT |
| routing_region | openrouter_metadata.region | TEXT |
| routing_attempt | openrouter_metadata.attempt | Nonnegative safe INTEGER |
| is_byok | usage.is_byok, otherwise openrouter_metadata.is_byok | Nullable INTEGER boolean 0/1 |

- Keep OpenRouter generation ID from top-level id, renamed accurately in SQL and
  code. Do not relabel it as an upstream-provider request ID.
- Prefer the provider string from exactly one selected endpoint in
  openrouter_metadata.endpoints.available. If unavailable, retain a valid reported
  top-level provider value; otherwise NULL. Do not infer provider from model name
  or parse the human-readable metadata summary.
- Preserve the existing local duration_ms as separately labeled App request time.
  It includes application overhead and is not provider generation time.
- Keep requested model and actual returned model distinct, plus the locally known
  prompt version, sent parameters and recording timestamps. No token estimates,
  calculated totals, inferred costs, calculated throughput or fabricated zeros.
- SQL NULL/public null means unavailable. Reported zero is a real zero. Old rows
  gain NULL fields; there is no authenticated backfill call or automatic replay.
  Retain valid metrics returned with failures. Routing attempt can be zero when
  routing failed before provider dispatch.
- Store only these whitelisted metadata fields, not whole responses, free-form
  pipeline payloads, reasoning text, keys or request headers. Keep proxy/no-fallback
  rules and server-only OpenRouter transport unchanged.

Sources checked 2026-10-18: [usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting),
[chat response reference](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion)
and [router metadata](https://openrouter.ai/docs/guides/features/router-metadata).
The installed SDK's OpenRouterMetadata definition explicitly describes generation
time as milliseconds from upstream dispatch through response-body completion.
Router metadata can be absent, including cache replays; do not require it for
correction success. No live OpenRouter response was fetched by the agent.

### History API

- `GET /api/history` returns `{items: HistorySummary[]}`. Each summary is
  `{id, createdAt, preview, models: string[]}`. IDs remain server-generated UUIDs;
  timestamps retain UTC ISO 8601 milliseconds. Preview is a grapheme-safe prefix of
  at most 120 graphemes, preserving full original text for the detail endpoint.
  Models are distinct requested model IDs in recorded request order. List order
  is newest correction first by created_at DESC, id DESC. No full original/result
  payloads are sent for collapsed list entries.
- `GET /api/history/:correctionId` returns
  `{id, createdAt, originalText, language, mode, requests: HistoryRequest[]}`.
  Read requests oldest first by started_at ASC, id ASC, including all statuses.
- HistoryRequest uses explicit camelCase fields: id, requestedModel, returnedModel,
  provider, openrouterGenerationId, promptVersion, parameters, correctedText,
  startedAt, endedAt, appRequestTimeMs, inputTokens, outputTokens, totalTokens,
  reasoningTokens, cachedInputTokens, cacheWriteTokens, costUsd, generationTimeMs,
  upstreamInferenceCostUsd, upstreamPromptCostUsd, upstreamCompletionCostUsd,
  routingStrategy, routingRegion, routingAttempt, isByok, finishReason, status,
  errorCode, errorMessage. Nullable stored fields stay null; parameters is the
  parsed public generation-parameter object, never secrets or headers.
- Status remains pending/succeeded/failed, with correctedText only for success.
  Pending has no invented terminal time/error. Interrupted attempts retain their
  saved failure. Copy/diff require actual successful output.
- History errors use `{error:{code,message}}`, with fixed safe English messages:
  INVALID_HISTORY_ID (400), HISTORY_NOT_FOUND (404), HISTORY_UNAVAILABLE (503).
  Do not leak SQL exceptions, paths or personal content. These new errors do not
  change correction endpoint response contracts.
- This is the existing local single-user database. Do not invent tenant/owner
  scope or authentication. No delete/write/repeat endpoint is introduced.

### History presentation

- Compact summaries show original preview, local-formatted date and recorded
  model names/IDs. Never show prototype Model A/Model B placeholders. Long text
  and model names wrap or ellipsize without horizontal page overflow.
- Expanded content shows exact original once, then every saved request's model,
  status, result and metrics. Keep provider-reported generation time, input/output
  tokens and charged cost prominent, matching the prototype. Secondary details
  include reported total/reasoning/cache tokens, provider, returned model, cost
  breakdown, OpenRouter ID, routing, prompt version, parameters and timestamps.
  App request time is explicitly separate and secondary.
- Missing metrics display Unavailable. Formatting must not turn a tiny positive
  cost into zero. Cost breakdowns remain separate from total charged cost; token
  breakdowns are never added again. No automatic quality score or winning model.
- All text uses React text nodes/read-only textareas. Keyboard focus, disclosure
  state, loading/errors and copy feedback remain accessible, with unique labels
  across multiple entries. Copy feedback belongs only to the clicked request.

## Testing

Use `npm test -w apps/server` for migrations, old-record preservation, unknown
metrics, reported values (including zero and non-derived total), metadata on
failures, selected-provider ambiguity, no upstream calls from History, all request
statuses and GET/error contracts. Use isolated fictional databases only; never
inspect or migrate the user's real database through agent diagnostic commands.
Normal user-run server startup applies the approved migration.

Run `npm run build -w apps/web` and `npm run lint -w apps/web`. No combined Verify
or browser-test command is configured. Focused mocked/SSR checks may use existing
Node/TypeScript; do not install another runner. User tests live History and mobile
behavior. Agent browser access needs explicit target/action permission and local
API interception before touching any correction control. Never call OpenRouter.

## Notes for the AI

Self-critique clarified reported versus local timing, the generation-ID naming,
old nullable metrics, per-request state/Copy and metadata absence. Keep the first
History implementation proportional: existing SQLite and shared contracts, one
summary read plus detail on demand, reusable result rendering and no new service,
pagination framework or metadata-reconciliation machinery.

## Implementation evidence

- Steps 1-2 implemented and verified with isolated test databases. The user reviewed
  the UI and accepted steps 3-4 as adequate for the MVP on 2026-10-18, while noting
  further UI improvements for separate future work. No agent-observed live browser
  verification is claimed.
- `npm test -w apps/server`: 35 passing tests. New cases cover v1 migration and
  reopen without text/ID/outcome loss, exact reported totals/timing/cost, zero and
  unknown values, invalid/failed metadata, ambiguous provider selection, grapheme
  previews, ordering, multiple request statuses, keyless History reads, no upstream
  calls and safe list/detail error responses.
- `npm run build -w apps/web` and `npm run lint -w apps/web` passed.
  `git diff --check` reported no whitespace errors.
- Fictional SSR and mocked checks passed for escaped HTML-like text, unique
  result/feedback IDs across requests, pending/failed presentation, clean per-request
  Copy, denied clipboard fallback, exact reported values and tiny nonzero costs.
  These are not live mobile/keyboard/native clipboard evidence.
- The ResultView component now accepts arbitrary saved model results and unique
  feedback IDs. History entries load details on demand. Both screens share the
  same clipboard helper, preserving clean Copy and selectable Text fallback.
- No OpenRouter calls, private environment-file reads, personal database inspection,
  dev-server starts, browser actions, automatic audits, sub-agent reviews or commits.
  The user's environment example remains untouched. Findings/review ledgers are empty.
- User testing: restart the API normally to apply schema v2, then open History
  at the existing web URL. Review existing records, multiple details, Text/Changes,
  Copy, unavailable old metrics and phone/desktop layout. No new paid correction
  is needed just to inspect previously saved records.

## Completion

Completed 2026-10-18 following the user's MVP acceptance. Reused existing passing
checks under the lightweight completion policy. No repeated checks, automatic
reviews, environment inspection or OpenRouter requests. Local landing only;
no push. Further UI polish remains future work, without inventing requirements.
