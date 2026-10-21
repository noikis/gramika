# Feature: History costs in Russian kopecks

**From build-plan:** feature V2.1a
**Build attempt:** 1
**Branch:** feature/history-costs-in-russian-kopecks
**Status:** implemented; targeted checks pass, repository-wide formatting has pre-existing failures

## Goal

Display approximate history costs in Russian kopecks using a public USD/RUB rate.
The user approved this implementation plan on 2026-10-21.

## In scope

- Fetch https://open.er-api.com/v6/latest/USD once per History visit when no valid cache exists, sharing the request across entries. Validate success, USD base and a finite positive RUB rate. Timeout after 5 seconds; no retries or polling.
- Cache only rate and fetch timestamp in localStorage for 24 hours. Reject malformed, expired and future-dated cache entries. Use memory when storage is unavailable. Expired rates are not used; refresh on the next History visit.
- Display USD while loading or on failure. Convert all four request/upstream cost fields using USD times RUB per USD times 100. Preserve null as Unavailable and true zero.
- Russian formatting with three significant digits and appropriate kopeck declension based on the displayed number. Below 0.000001 kopecks use scientific notation to preserve nonzero values.
- Add an Approximate costs note and required provider attribution. Apply the current rate to older requests too.

## Out of scope

React Query, backend/API changes, database changes, historical exchange rates, paid calls, commits, merges, push and deployment.

## Build loop

One review packet after implementation. No checkpoint commits or automatic review agents. Preserve unrelated changes.

## Build steps

- [x] Add validated rate loading with timeout and persistent/memory caching. Done when mocked cache, failure, concurrency and timeout assertions pass.
- [x] Integrate conversion in all four history fields and add attribution. Done when formatting and rendered-metrics assertions pass and web builds.
- [ ] Run final web checks and record evidence. Done when assertions, build, lint, formatting and diff checks pass; explicitly distinguish CORS headers from browser evidence.

## Files / areas

Frontend exchange-rate loader, hooks in apps/web/src/hooks/, history cost formatting and components, focused Node verification script. User-approved follow-up: move all four existing frontend hooks into the hooks directory and update imports without behavior changes.

## Data / contracts

No public contract changes. Stored/provider costs remain USD. Rate cache key gramota.usd-rub-rate holds { rate, fetchedAt } with a millisecond timestamp. No correction text/history is sent to the provider.

## Testing

node apps/web/scripts/check-exchange-rate.mjs; npm run build -w apps/web; npm run lint -w apps/web; npm run format:check -w apps/web; git diff --check.
Mock fetch, clock and storage; cover conversion, Russian plurals, fractions/tiny values, zero/null, all four rendered fields, cache reuse/expiry, unavailable storage, malformed responses, timeout and invalid rates.

## Notes for the AI

The completed committed V2.1 spec is preserved unchanged at blueprint/history/features/V2.1-improve-diff-readability.md. Its old completion notes are historical.
API header check returned HTTP 200 and access-control-allow-origin: * on 2026-10-21. This permits cross-origin browser requests but is not browser execution evidence. Playwright requires separate explicit permission.

## Implementation evidence (2026-10-21)

- Exchange-rate assertion script passed, including fake-timer timeout and React rendering of all four cost metrics for conversion and USD fallback.
- Web build (including contracts/TypeScript) and web lint passed. Changed source files and the new assertion script pass Prettier; git diff --check passed.
- Full npm run format:check -w apps/web fails on unchanged pre-existing files: src/App.css, src/components/result-view.tsx, src/lib/text-diff.ts and src/lib/whitespace-display.ts. Left untouched. Final verification step remains open for this repository formatting gate; no waiver assumed.
- No browser execution or visual verification performed. No independent review requested or required by configured gates; no P0/P1 findings recorded in the current ledger.
- No backend/database changes, paid/benchmark calls, commits, merges, push or deployment.

Manual review path: in the running app, open History, expand an existing correction and Request details. With a usable rate all four costs show Russian kopeck units; null costs remain Unavailable. While loading or without a usable rate, costs retain the USD label. Reload within 24 hours to reuse the cached rate.
