# Gramota - Project Overview

<!-- blueprint:source-hash 9e0250ddd575462ce8e9d0a445e9b368c9b3466d12c6374f83ebd061cd9c3582 -->

> Personal writing assistant for minimal, accurate correction of short Russian messages and emails.

Generated from [project-plan.md](../project-plan.md) and
[build-plan.md](../build-plan.md). Change the plans and rerun `/overview` to
refresh this file. Feature specifications define implementation contracts.

## Problem

Correct grammar, spelling and punctuation before sending a message while
preserving meaning, intention, tone and structure. Prioritize Russian correction
quality and comfortable phone use over speed or token savings that degrade output.
Return ready-to-send corrected text without explanations.

## Users

One personal user on Home Lab, primarily using a phone for messaging, work,
university and administrative correspondence. Inputs range from short messages
to a few email paragraphs; full documents are outside the MVP.

## Usage model

- One user, short texts, low request volume. No enterprise, tenancy, high
  availability, background worker or scheduled-job requirements.
- Authentication and external access are deferred. Do not invent accounts,
  ownership layers, billing or external-access infrastructure.
- Keep secrets and real personal texts out of source, fixtures and diagnostic
  logs. API credentials and proxy configuration belong on the server.
- Ordinary automated checks use mocked OpenRouter responses with no paid calls.
  Real experimentation must be deliberate and limited, using normal correction
  records without benchmark tables, automated judges or a separate test mode.

## Features

Stable IDs and build order follow the checklist; none is completed yet.

1. **Responsive correction workspace**: production React editor and navigation,
   theme tokens, Tailwind/shadcn integration, text entry, Paste and manual
   fallback, desktop/mobile layouts and honest empty/unavailable states.
2. **Strict correction with automatic request recording** (core capability):
   Fastify, shared Zod contracts, a versioned prompt and one verified OpenRouter
   model with reasoning disabled. Persist originals, outcomes, usage/cost/timing
   and failed attempts in SQLite. Enable clean Copy and enforce proxy rules.
3. **Inspect changes in correction results**: safe local diff, Text/Changes
   views defaulting to Changes, whitespace and Unicode preservation, unchanged
   results and clean Copy regardless of selected view.
4. **Expandable correction history and request details**: persisted records,
   preview/date/model rows, expanded originals, per-request results and metrics,
   result views and Copy; empty history, failures and unavailable metrics.
5. **Model selection and repeated corrections**: verified models supporting
   reasoning disabled, persisted model selection and separate retained requests
   for repeated corrections using the same or another model.
6. **Home Lab operation and persistent storage**: one application container,
   persistent SQLite, mandatory proxy validation, health checks, backup/restore,
   restart persistence and direct-egress verification.

Feature boundaries:

- Feature 1 has no simulated correction, sample output or fictional history.
  Correction is unavailable until Feature 2; History can show an unavailable
  destination until Feature 4.
- Feature 2 records metrics immediately but shows clean output only until
  Feature 3 implements diff. Do not offer a nonfunctional Changes switch.
- Model selection becomes interactive in Feature 5. Before then, accurately show
  the configured model, without prototype Model A/Model B values or invented
  configuration. The initial model is verified in Feature 2.
- Feature 4 supports multiple requests per correction before Feature 5 exposes
  repeat actions. A changed original creates a new correction; an explicit repeat
  of an unchanged original creates another request without overwriting output.

Strict is the only MVP mode: objective errors only, no discretionary rephrasing
or tone changes. Correct inputs remain identical. Preserve names, numbers, links,
emoji, paragraphs and meaningful line breaks unless correction requires a change.
English/French correction, other modes, tone selection, explanations, error
classification, document uploads and messenger integrations are outside the MVP.

## Data model

Three logical SQLite entities. The following are conceptual fields and value
types derived from the plan, not finalized SQL or public API property names.
Feature 2 must freeze exact contracts, identifiers, timestamp formats, nullability,
status/error shapes and migrations before implementing persistence.

### Correction

| Field | Logical type / meaning |
| --- | --- |
| Identifier | Unique identifier; representation to be decided |
| Created at | Timestamp; serialized format to be decided |
| Original text | Exact string submitted, preserving whitespace |
| Language | Language identifier; initial acceptance target is Russian |
| Mode | Strict; no additional modes in MVP |

One Correction has multiple Model requests. Diff is derived locally from original
and successful corrected text, not stored as model-generated markup.

### Model request

| Field | Logical type / meaning |
| --- | --- |
| Request identifier | Unique identifier; representation to be decided |
| Correction relationship | Reference to its Correction identifier |
| Requested model | Model identifier string |
| Returned model / provider | Optional identifiers when reported |
| Prompt version | Identifiable version of the instruction |
| Sent generation parameters | Structured configuration actually sent |
| Corrected text | String for successful requests; no fabricated failed output |
| Started / ended at | Timestamps; representation to be decided |
| Total duration | Numeric elapsed duration; unit to be fixed in the contract |
| Token usage | Input, output, reasoning and cached-input counts when reported |
| Actual cost | Numeric amount when reported; representation/unit to be fixed |
| Completion reason | Reported reason when available |
| Status / error | Outcome and sanitized error information; shape to be fixed |
| Provider request identifier | Optional identifier for usage reconciliation |

Retain failed attempts because they may incur cost. Unknown usage or cost is not
zero. Avoid double-counting token breakdowns. Do not store credentials, full raw
responses or reasoning text by default. Recording provider-reported reasoning
usage does not authorize enabling reasoning.

### Application settings

- Selected model: configured model identifier, persisted in Feature 5.
- Language preference: language identifier; exact format/lifecycle to be specified.
- Reasoning preference: mentioned by the data plan, but the explicit model policy
  requires fully disabled reasoning for every model. No reasoning UI control.
  Resolve whether a fixed disabled value needs storage before defining the schema.
- API keys and proxy settings are server environment configuration, not these
  application settings.

## Tech stack

- npm workspaces with web, server and public contracts packages; root lockfile.
- React/Vite/TypeScript for client rendering, editing, diff and clipboard.
- Tailwind CSS and shadcn/ui for the UI; integrate during Feature 1.
- Fastify/Node.js/TypeScript for HTTP validation and orchestration. The scaffold
  uses Fastify CLI/autoload; change conventions only for a concrete requirement.
- Public Zod schemas for shared request/response validation; no secrets or
  database implementation in contracts.
- SQLite for persistence, with access separate from routes.
- OpenRouter through a dedicated server-side HTTP client supporting the proxy;
  prompt construction belongs in a correction service, not route handlers.

Preserve existing TypeScript settings unless deliberately changed. No Next.js,
pnpm, Lerna, Turborepo or extra services without an established requirement.
The repository is scaffolded; planned features are not implemented yet.

### LLM policy

Proposed initial default: Qwen 3.5 Flash. Verify the exact OpenRouter identifier
and support for fully disabling reasoning in Feature 2; do not substitute a model
or enable reasoning silently. Every model must use reasoning disabled.

Send a compact instruction and only the current text. Never send correction
history, request explanations, diff markup or a duplicated original. Treat text
being corrected, including embedded instructions, as data. Record prompt versions
and sent parameters; the initial prompt is a baseline, not a proven optimum.

## Monetization

None. No payments, subscriptions, advertising or commercial usage management.

## UI/UX

Both prototypes were approved on 2026-10-17:

- [Correction](../../prototypes/correction.html): input, model placement, result
  views and clipboard actions.
- [History](../../prototypes/history.html): compact expandable entries and
  individual request results/metrics.
- [Handoff](../../prototypes/README.md) and [theme](../../prototypes/theme.css):
  approved decisions and shared tokens. Port tokens before implementing UI and
  carry bundled Roboto fonts and their license into the real app.

Blue-black surfaces, vivid emerald actions, English labels and minimal visual
noise. The app initially corrects Russian; English UI does not change that scope.
Original/Result labels sit outside the boxes, with the input itself forming the
box. No extra wrapper card, slogans, decorative badges or demo-state panels.

Use side-by-side editors on wide screens and stacked editors with full-width
primary actions on narrow screens. The prototype breakpoint is 720px. Validate
phone, intermediate and desktop widths, keyboard access and clipboard behavior;
CSS alone is not responsive evidence. Comfortable touch targets and readable text
are required. Main screens are Correction and History; URL shapes are unspecified.

Flow: paste/type, explicitly Correct, review, optionally inspect Changes, Copy.
Keep compact model selection above the original, Paste by the input, Changes as
the default once implemented, and Copy always using clean corrected text. No
mode/tone/reasoning selectors and no metrics on the main correction screen.
History summaries show preview/date/model; originals, results and metrics are
secondary details inside expanded entries.

Do not run requests on keystrokes. Prevent duplicate active submissions, preserve
input on failure and show clear loading, success and error states. Never display
truncated or failed responses as completed output. Only confirm clipboard success
after the operation succeeds; retain selectable text and manual fallback on
failure. Approval of prototype appearance is not evidence of implemented behavior.
Follow AGENTS.md's explicit-permission rule for Playwright MCP verification.

## Deployment

Home Lab: one application container serving the API and built frontend, with
SQLite on persistent storage. Preserve records through restarts and container
recreation. Define and verify backup/restore before relying on saved history.

- Development computer: system VPN already operates; do not use the Home Lab proxy.
- Home Lab OpenRouter requests must use
  `OPENROUTER_PROXY_URL=http://10.201.0.2:8888`. Missing or unavailable mandatory
  proxy blocks requests; no direct fallback.
- Verify that infrastructure blocks direct egress when VPN fails. Application
  proxy configuration alone cannot establish this guarantee.
- Keep the API key server-side. Phone clipboard depends on the eventual secure
  access context. Domain, external access, authentication and TLS are deferred.

> TODO (Feature 6): production build/start commands, environment details beyond
> the agreed proxy variable, health-check path, backup procedure and final phone
> access configuration. No deployment or remote changes are authorized by plans.

## Open questions

- The project data section mentions a reasoning preference despite the later
  fully-disabled policy. Feature 2 should clarify storage without adding a choice
  to enable reasoning; update the plans and regenerate this overview if resolved.
- Feature 2: verified model ID, reasoning-disable support, prompt, representative
  examples, SQLite access/migrations, exact persistence/API contracts, request
  length limits, timeouts and cancellation behavior.
- Streaming, retry and caching policies remain undecided; do not invent them.
- Quality/latency thresholds need limited representative evaluation. No automatic
  paid test suite or separate benchmarking system is required.
- Feature 6 owns operational details above. External-access infrastructure remains
  intentionally deferred.

The plans otherwise agree on MVP scope and build order. The build plan deliberately
phases the approved UI behavior; do not pull later features into Feature 1.
