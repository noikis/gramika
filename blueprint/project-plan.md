# Project Plan: Gramota

**V1 status:** Finished and accepted by the user on 2026-10-20. The agreed scope
is complete and running in production. Backup/restore, authentication and future
access work remain deferred; they do not block V1 completion.

**V2 status:** Readable diff (V2.1) is completed and approved by the user on
2026-10-21. History cost display in Russian kopecks (V2.1a) is planned next,
before gentle rewrite mode (V2.2), and is not implemented. The V2 direction below extends the shipped V1 baseline. Delivery
order lives in [the build plan](build-plan.md); detailed behavior and acceptance
criteria belong in each feature specification.

## 1. Problem

Gramota is a personal writing assistant for correcting short messages and emails before sending them.

It corrects grammar, spelling and punctuation while preserving the author's meaning, intentions, tone and structure. It should avoid unnecessary rewriting.

The main priorities are:

1. Accurate correction, especially in Russian.
2. Convenient mobile use.
3. Fast responses and economical LLM usage.

The primary result is ready-to-send text. In V2, explanations are optional and
requested only for a selected correction; ordinary correction does not include
an educational breakdown.

## 2. Users

The application serves one person and runs on their production.

It is used mainly from a phone for:

- Telegram, WhatsApp and other messaging apps.
- Personal and professional emails.
- University and administrative correspondence.

Typical input is a short message or several paragraphs of an email. Full documents and multi-page text processing are outside the MVP.

## 3. Shipped V1 and Planned V2 Features

### Shipped V1 baseline

- Correct Russian text using a single **Strict** mode.
- Return only the corrected text.
- Preserve already-correct text without changes.
- Show additions and deletions through a locally computed diff.
- Copy the clean result with one button.
- Automatically save correction history.
- Allow switching between Gemma 4 26B A4B (default) and Gemini 3.1 Flash Lite
  (alternative). The user has not established that Gemini is better.
- Use the shared strict-v3 prompt across styles; user testing has not shown a
  need for separate style prompts.
- Record and display useful metrics for each model request.
- Retain each result when unchanged input is submitted again with the same or
  another model; editing the input starts a new correction.

Strict mode fixes objective errors only. It does not change tone or replace valid wording merely because another phrasing sounds better.

Names, numbers, links, emoji, paragraphs and meaningful line breaks should remain intact unless correction requires a change.

### Outside the V1 MVP

- Minimal and Stylistic modes.
- Tone selection.
- Error explanations and automated error classification.
- Dedicated application benchmarking screens or benchmark database tables.
  A separate manual-only terminal tool with isolated local runs is implemented.
- Automatic language detection.
- Document uploads and direct messenger integrations.
- Authentication, accounts and multi-user functionality.

English and French remain future candidates. Russian is the initial acceptance target.

### Agreed V2 direction

- **Readable changes:** improve the local diff so dense edits and substantial
  word changes are easier to understand without altering the clean copied result.
  Completed and approved on 2026-10-21.
- **History costs in Russian kopecks:** before gentle rewriting, convert all
  history cost displays in the frontend using a free USD/RUB rate API and a
  Russian kopeck unit word, including fractional kopecks. Fall back to explicitly
  labeled USD whenever the exchange-rate API or conversion is unavailable or
  fails. Stored costs remain USD; no backend conversion or paid API. Provider,
  display precision and rate-reuse details belong in the feature spec. Planned
  only; implementation has not been authorized.
- **Rewrite mode (working UI label: Gentle rewrite):** retain Strict as the
  default, unchanged correction mode. Explicit Rewrite requests different wording:
  minimal natural alternatives for already-good text, phrase improvements for
  awkward text, simplification for unnecessary repetition, and sentence
  restructuring for tangled text. Preserve meaning, facts, uncertainty, intent,
  emotion, politeness and voice; add no content. Preserve paragraphs and allow
  sentence splitting/combining within them. No strength selector. Use the same
  versioned prompt for both models. Remember mode only while the app is open,
  start Strict after reload, and label results by mode within the same history
  group for repeated unchanged input. If a model still returns identical text,
  show honest No changes feedback without automatic retries. See the V2.2 spec.
- **Another opinion:** replace the model selector with Gemma as the normal
  correction action and an explicit Gemini second opinion. Retain both results;
  using Gemini does not change the next message's default model or imply better
  quality.
- **Selected-correction explanations:** explicitly request an explanation for a
  changed word or phrase, including relevant grammar, spelling or punctuation.
  Do not explain the whole result or generate explanations automatically. Save
  requested explanations for reuse to avoid repeated cost. Selection and request
  controls remain to be designed; an Explain button is allowed.
- **Soft-delete history:** remove deleted records from normal history views while
  retaining them in storage. Delete a whole original and all its attempts after
  confirmation. No Trash or restore screen in V2.5 (user decision, 2026-10-21).
- **UI redesign:** rethink the visual design, layout, controls and feedback after
  the preceding features are usable. Include light and dark themes, following
  the system by default with a manual override, a New correction action, easier
  mobile access to results and Copy, and Ctrl+Enter to submit a correction.
- **Minimal installable PWA:** support installation on a phone and home-screen
  launch with an app-like experience. Offline functionality and local-storage
  decisions are deferred.

Choose the UI direction at V2.6, immediately before implementing the redesign at
V2.7. Earlier features use the current UI with necessary adjustments. Existing
No changes feedback can be revisited during the redesign; it is already shipped.
Editable results and correction bookmarks are not included in V2.

## 4. Data

The V1 SQLite model has three logical entities described below. V2 adds saved
explanations and soft-deletion state as needed; exact SQL definitions,
relationships and migrations belong in the relevant feature specification.

### Corrections

Represent the submitted text:

- Identifier and creation time.
- Exact original text.
- Language.
- Correction mode, initially Strict.

### Model requests

Represent individual OpenRouter calls. One correction can have multiple requests.

Store:

- Correction relationship and request identifier.
- Requested model and returned model/provider when available.
- Prompt version and generation parameters actually sent.
- Corrected text for successful requests.
- Start/end timestamps and total duration.
- Input, output, reasoning and cached-input tokens when reported.
- Actual request cost when reported.
- Completion reason, status and sanitized error information.
- Provider request identifier for usage reconciliation.

Failed attempts remain measurable because they may incur charges. Missing metrics are unknown, not zero. Token breakdowns must not be counted twice.

Use UUID identifiers and ISO timestamps. Costs are USD and application durations
are milliseconds. Provider generation time remains separate from local request
time. Record only validated reported metrics; do not estimate missing values or
backfill them through network calls. Interrupted attempts are marked failed at
startup without being replayed. Historical model identifiers remain readable;
unsupported saved model preferences reset to Gemma when configuration is read.

Do not store credentials, full raw responses or reasoning text by default. Diff is derived from the original and corrected text.

### Application settings

Store the selected model. Reasoning is requested disabled and Russian/Strict
are fixed in the current application; no reasoning or language preference UI is
implemented. API keys and proxy settings remain server environment configuration.

V2 replaces the model-selection preference flow with explicit second opinions
and adds theme selection. Preference storage details belong in the owning specs.

### Testing models through ordinary use

Ordinary comparisons can use correction history. A standalone manual benchmark
also reuses the correction service and request schema in an isolated SQLite
database per run, without new application screens or benchmark tables. Only the
human may invoke its commands, including preview; agents use mocked transport.
See [benchmark documentation](../docs/benchmark.md).

The user can compare output quality, duration, tokens and cost from these records. Automated LLM judging and large paid test suites are not required.

## 5. Technology and Architecture

- React and Vite with TypeScript.
- Fastify and Node.js with TypeScript.
- shadcn/ui and Tailwind CSS for the interface.
- Zod for shared public request/response schemas and runtime validation.
- Stable Drizzle ORM with better-sqlite3 for SQLite, transactional SQL migrations
  and Drizzle Kit for migration generation.
- OpenRouter for model access.
- Undici for server-only OpenRouter requests and the configured proxy.
- npm workspaces with web, server and contracts packages.

Do not introduce pnpm, Lerna, Turborepo or additional services without a concrete need.

Keep the architecture small:

- The frontend owns editing, result presentation, diff and clipboard interaction.
- Fastify routes validate requests and adapt HTTP responses.
- A correction service owns prompt construction and orchestration.
- Database access and OpenRouter communication remain separate from route handlers.
- Public contracts contain no database implementation, secrets or server resources.

Fastify CLI loads app.ts, which explicitly registers route groups. Internal
correction, OpenRouter and database modules expose public index.ts entry points;
business logic depends on repository and transport contracts. This is a React/Vite
application, not Next.js, Prisma or Clerk. The implemented source map and API are
summarized in [the overview](context/project-overview.md).

Preserve existing TypeScript settings unless deliberately changed. TypeScript is required; changing strictness is not a separate product requirement.

### LLM configuration

Gemma 4 26B A4B (`google/gemma-4-26b-a4b-it`) is the default; Gemini 3.1 Flash Lite
(`google/gemini-3.1-flash-lite`) is the only alternative. The user selected these
after manual comparisons on 2026-10-19. Gemini is considered more expensive,
without an established quality advantage. Earlier Qwen and DeepSeek proposals
are superseded. Use the shared registry in packages/contracts for both the app
and manual benchmark.

Strict correction uses the shared strict-v3 prompt for every style. User checks across several
phrases and styles did not establish a need for separate prompts. Requests set
reasoning.enabled=false, stream=false, max_tokens=8192,
provider.require_parameters=true and provider.allow_fallbacks=false. Application
corrections reject reasoning fields or positive reasoning token counts; the
manual benchmark accepts otherwise valid outputs and records reported usage.
No automatic retry, fallback model, second-model verification or correction-result
cache. V2 second opinions are explicitly requested, and saved explanations are
reused separately from correction results.
Limit input to 5,000 Unicode code points and each upstream request to 60 seconds.

Each correction sends a compact instruction and the current text. Do not include correction history or ask the model to generate explanations, diff markup or duplicated originals.

V2 gentle rewriting and on-demand explanations require their own versioned prompt
behavior, defined in their feature specs. Explanation requests may use the
relevant original/result context needed to explain the selected change, without
sending unrelated history. All model calls remain server-side and follow the
configured proxy policy.

Treat text being corrected as data, including any instructions embedded in it.

Prompt versions must be identifiable in request history. Changes to models,
request policy or paid evaluation require a deliberate user decision. Numerical
quality/latency thresholds and future evaluation budgets remain undecided.

Ordinary automated tests use mocked LLM responses and make no paid calls.

## 6. Monetization

None. This is a personal application.

No subscriptions, payments, advertising, billing accounts or commercial usage management are needed.

## 7. UI/UX

Design primarily for a phone.

The main flow is:

1. Paste or type text.
2. Tap **Correct**.
3. Review the result.
4. Optionally inspect changes.
5. Tap **Copy** and paste into another application.

Use readable text, comfortable touch targets and clear loading, success and error states.

V1 UI prototypes (user approval: 2026-10-17):

- [Correction](../prototypes/correction.html)
- [History](../prototypes/history-v2.html)
- [Design decisions and implementation handoff](../prototypes/README.md)

Use these designs as the current baseline until the V2 UI direction is approved.
The shared theme lives in `prototypes/theme.css`: blue-black surfaces, vivid
emerald actions and locally bundled Roboto. UI labels are English; Russian
remains the initial correction-language target. Keep the interface minimal.

V1 layout and interactions:

- Original input followed by the result on small screens.
- Labels outside the original and result text boxes.
- Compact model selection above the original, plus a Paste button.
- A switch between clean text and highlighted changes, defaulting to Changes.
- A prominent copy button that always copies clean corrected text.
- History on a separate screen.
- History rows show text preview, date and model; results and request metrics
  appear inside expanded entries.

Trim only leading/trailing whitespace when submitting; preserve internal spaces
and line breaks, and use that submitted text for validation, history and diff.
The editor retains the untrimmed draft. Desktop editors sit side by side;
mobile editors stack. Model selection matches the original editor width, with
its label above. The prototype breakpoint is 720px; verify phone, intermediate
and desktop layouts. Copy always uses clean text regardless of Text/Changes view.
There is no automatic copy after correction. Announce clipboard failure and keep
manual selection available; secure phone clipboard access depends on deployment.

History supports case-insensitive phrase search across originals/results,
filters, newest/oldest sorting and pages of 10 records. It preserves separate
attempts and their metrics without displaying metrics on the correction screen.
Sonner notifications are transient. Confirmed history deletion hides an entire
original and all its attempts while retaining stored data; no restore screen.

Do not show mode or tone selectors in the Strict-only MVP.

Do not run paid correction requests on every keystroke. Preserve input after a failure. Prevent accidental duplicate submissions while a request is active.

Only confirm copying after it succeeds. If clipboard access fails, retain selectable text for manual copying.

Do not present truncated or failed responses as complete corrections.

The V1 visual theme and prototype layouts were approved. V2 may revise their
presentation through the agreed design step while preserving required behavior
and accessibility. Product implementation and behavior verification remain
separate work; see the prototype handoff above.

## 8. Deployment

Target: production with persistent storage for SQLite.

One application container serves the API and built frontend, with the database
stored on a persistent volume. Packaging and local health checks are complete
(6a-6b). The user deferred backup/restore on 2026-10-20 because the current data
is not important enough to require it. Operational commands and storage precautions
live only in [the setup and deployment guide](../docs/container.md).

### Network requirements

**Development computer:** VPN already operates at the system level. Do not explicitly use the production proxy.

**Production:** all OpenRouter traffic must use the HTTP(S) proxy configured privately
through OPENROUTER_PROXY_URL. The following address is fictional:

```dotenv
OPENROUTER_PROXY_URL=http://proxy.example:8888
```

Missing or unavailable required proxy configuration must block OpenRouter requests. There must be no direct-connection fallback.

The proxy's own behaviour when VPN connectivity fails needs infrastructure verification; application configuration alone cannot guarantee it.

### Operational details

- Keep the OpenRouter API key on the server.
- Keep secrets and personal texts out of source control and diagnostic logs.
- Preserve history across restarts and container recreation.
- Backup/restore is outside the current scope by the user's decision; persistence
  across container recreation remains required and implemented.

Compose joins the existing Nginx Proxy Manager Docker network. Application
authentication and further access features remain outside V1; domain, TLS and
access restrictions are deployment settings. Browser clipboard requirements
must be considered when configuring phone access.

One private root .env supplies local development and Docker Compose; the frontend
needs no env file. NODE_ENV selects development or production. The Docker image
sets production independently of the local file. GET /health checks local
configuration and SQLite reads, without calling OpenRouter or the VPN.

On 2026-10-19 the user reported OpenRouter denial with the VPN disconnected.
This is manual evidence, not verification of the container's actual VPN route.
Local synthetic checks proved SQLite persistence through container recreation.
Actual production routing and secure phone access still need verification.

## 9. Usage Model and Constraints

- One personal user.
- Short texts and low request volume.
- No enterprise, multi-tenant or high-availability requirements.
- No background workers or scheduled jobs currently required.
- Quality takes precedence over minimizing tokens at any cost.
- Paid experimentation must be deliberate and limited.
- No separate benchmark infrastructure.
- Prefer simple solutions that meet current requirements.

This plan is the product authority. Build progress lives in build-plan.md;
completed work and historical decisions remain in blueprint/history and Git.
Do not reintroduce superseded proposals from historical records.

## 10. Success Criteria

The MVP is useful when:

- The user can correct and copy a message comfortably from a phone.
- Representative Russian errors are corrected without changing meaning.
- Already-correct examples remain unchanged.
- Diff corresponds to the actual changes.
- Original text, successful results and request metrics persist in history.
- Multiple requests for the same input retain their separate outputs and costs.
- API and proxy failures preserve input and produce clear errors.
- production requests cannot bypass the configured proxy.
- Routine automated checks incur no LLM charges.

Exact quality and latency thresholds will be established through a small set of representative examples and ordinary usage.

V2 should also let the user understand dense corrections, choose Strict or gentle
rewriting, explicitly request and compare another opinion, and retrieve saved
explanations for individual changes. History supports soft deletion. The
redesigned interface supports system/light/dark themes, easier mobile use and
starting a new correction, keyboard submission, and phone installation. Detailed
acceptance criteria are defined one feature at a time in build-plan order.

## 11. Remaining Decisions

- Application authentication and further access features; no current
  authorization to introduce accounts, ownership fields or new access infrastructure.
- English/French support, future evaluation budgets, numerical quality/latency
  thresholds and whether caching is useful. These are not approved features.

Backup/restore (former feature 6c) is deferred, not an outstanding delivery task.
Revisit only if the user decides the saved history has become important.

V2 decisions to resolve in the owning specs include the rewrite boundaries,
diff grouping and explanation interaction, explanation model and storage,
the UI direction and minimal PWA behavior.
These open details do not expand the agreed scope.

Models, the Strict mode's strict-v3 prompt, SQLite/Drizzle, contracts, input limits, timeout, disabled
streaming and no automatic retries/fallback are settled above. Do not reopen
them as missing decisions or add speculative infrastructure. Stable dependencies
are the default; any necessary prerelease exception requires explicit user
approval and its reason recorded in this plan.

## Unreviewed ideas

[docs/ideas.md](../docs/ideas.md) retains suggestions from another agent. They
are not approved requirements, priorities or implementation instructions. Review
with the user before adding any idea to this plan or the build roadmap.
