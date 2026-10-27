# Gramika - Project Overview

<!-- d9eec2f5fac3d544b44b7d721a9c0240bd9c0c7d1a45b0b0c3a6e38e2522074fn.md](../project-plan.md) and
[build-plan.md](../build-plan.md). The Build Plan is the concise status index;
completion history contains detailed specifications and evidence.

## Product

Gramika is a personal writing assistant for short Russian messages and letters.
It corrects spelling, grammar and punctuation with minimal edits, preserving
meaning, voice, names, numbers, links, emoji and meaningful whitespace. Strict is
the default; Gentle Rewrite and selected-change Explain are implemented. The
app is used primarily on phones.

The current production system is a single-user application. V4 now contains an
approved roadmap for sharing with relatives, multilingual UI, translation,
dictionary definitions, speech, UX improvements and separate histories. Those
V4 decisions are newer than the current project-plan narrative and need detailed
feature specifications before implementation.

## Delivery status

- V1 is complete and accepted, including the responsive workspace, correction
  requests, local diff, history, model selection, health checks, packaging and
  persistent SQLite.
- V2 is complete except for deferred explanation metrics. V2.1a history costs in kopecks are implemented and complete in commit d6d8de0. V2.8 PWA installation is implemented, but real phone OS
  installation remains unverified.
- V3.0, V3.1, V3.3 and V3.4 are complete.
- V3.2 Export and V3.5 contextual comparison were rejected or deferred and are
  not implemented.
- V4 is the current active roadmap in build-plan.md. The chosen order starts
  with diff-grouping research, translation, dictionary definitions, read aloud
  and multilingual infrastructure. The planning-heavy separate-user work comes
  next, followed by installation UX, History UX and general UX improvement.

## Active V4 scope

V4.1 research-only meaningful text-diff grouping; V4.2 self-hosted
LibreTranslate translation; V4.3 Russian dictionary definitions; V4.4 read
aloud; V4.5 French/Russian/English interface internationalization with
browser-language detection and explicit override; V4.6 separate user
workspaces and histories; V4.7 installation UX; V4.8 History UX redesign; and
V4.9 general UX improvement. The last three items are deliberately kept at the
end because they are UX-focused. See build-plan.md for the full contracts and
boundaries.

Authentication, invitations, account creation, session handling and migration
are intentionally unresolved. APK and React Native are out of scope. Diff
grouping research must not implement changes, edit prompts or make paid model
calls.

## Architecture

The repository uses npm workspaces with React/Vite/TypeScript, Fastify,
Tailwind CSS, local shadcn-style components, Sonner, Zod contracts, Drizzle
ORM and better-sqlite3. It is not Next.js, Prisma or Clerk.

The frontend owns editing, local diff, result presentation and clipboard
interaction. The server owns validated routes, correction orchestration,
OpenRouter transport and database access. OpenRouter calls remain server-side
and use the mandatory configured proxy in production, with no direct fallback.
The shared contracts package defines public request and response schemas.
Gemma 4 is the default model and Gemini 3.1 Flash Lite is the alternative.

## Data and privacy

Corrections store exact originals, mode, results and individual request metrics.
History supports search, filters, sorting, pagination, soft deletion, saved
explanations and correction caching. Browser persistence stores one local
workspace; it is not offline history. Do not store secrets, full provider
responses or internal reasoning. Manual benchmarks are human-only and use
mocked transports for agent verification.

The current data model is single-user. Separate ownership and authentication
must be designed before V4 user sharing is implemented.

## UI and deployment

The current UI uses the approved Грамика branding, light/dark/system themes,
desktop and mobile layouts, result diff views, Copy, Explain and History.
Current interface copy is English; V4 adds locale detection and French/Russian/
English catalogs. The app is served from one container with persistent SQLite,
health checks and Nginx Proxy Manager in production. Mobile PWA installation
requires a suitable HTTPS deployment; no service worker or offline behavior is
currently promised.

## Workflow

Use one current feature or fix at a time. Start from the active Build Plan item,
write its specification, implement and run relevant local checks. Preserve
completion history and user decisions. Playwright MCP requires explicit user
permission. Agents must not run paid benchmarks, connect over SSH, deploy,
push, merge or perform destructive data operations without separate
authorization.

## References

- [Project plan](../project-plan.md)
- [Build plan](../build-plan.md)
- [Completion history](../history/)
- [Container operations](../../docs/container.md)
- [PWA scope](../../docs/pwa.md)
