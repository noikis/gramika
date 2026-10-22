# Current Feature

> **Generated file.** Holds the one feature, fix, or rollback being built in this checkout. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
> Build one thing at a time in this checkout; `/complete` archives it under
> `blueprint/history/` and resets this file.

## History and individual explanation metrics

**Type:** Feature
**Branch:** feature/history-explanation-metrics
**Status:** verified

Approved by the user's implementation request on 2026-10-22 following the
discussion of separate correction/rewrite and selected-change explanation metrics.

Keep each correction's existing data and behavior. Record each actual explanation
call separately, with selection identity, status, timestamps, reported token/cost
details and measured request time. Support Strict and Rewrite, both models,
failures and saved reuse. Never store reasoning content. Old saved explanations
remain usable without invented metrics. Use additive Drizzle migrations.

History Details leads with cost, response time and input/output tokens, and shows
individual explanation attempts with their selected fragments and metrics.
Collapse advanced usage and technical fields, retaining all existing data.
Preserve themes, mobile layout, keyboard access, Copy, search and filters.
No dashboard, paid calls, new dependencies, commit, merge, push or deployment.

- [x] Persist individual explanation attempts and expose validated read-only history access.
- [x] Simplify History details and display each explanation's own metrics.
- [x] Verify persistence, failures, reuse and selection identity using mocked tests;
      run server tests/lint and web build/lint. Browser verification requires permission.

Verification: 141 server tests passed (including migration preservation, both
modes/models, failed costs, distinct selections, zero/missing metrics, saved reuse,
reopening and interrupted requests). Web build, web lint and server lint passed.
User-authorized Playwright checks at localhost:5173 used synthetic API fixtures
at 1440px desktop and 390px mobile in light/dark themes. Confirmed individual
metrics, expandable advanced fields, no horizontal overflow, Escape dismissal
and focus return. This is browser fixture evidence plus independent mocked API
tests, not a paid end-to-end model call. No paid requests were made.

Existing findings are closed; no independent review was requested. Configured
audit/check/independent-review gates are manual. Ready for user review and
`/complete`; no commit, merge, push or deployment performed. Pre-existing plan,
overview and Rewrite Explain archive edits were preserved.

User refinement: History detail disclosures use plus when collapsed and minus when expanded. Web build/lint and mobile browser toggle checks passed.

User refinement: Top summary totals cost/input/output tokens across the correction and every explanation attempt. Correction response time stays separate. Original correction values remain in Usage breakdown; individual explanation values remain separate. Missing contributing values or legacy explanations make the affected total unavailable. Browser fixtures verified totals (including failed attempts), unchanged response time, missing/legacy usage and mobile width.
