# Feature: Word-aware diff with conservative grouping

**Type:** Feature
**Branch:** feature/word-aware-diff-with-conservative-grouping
**Status:** implemented; automated behavior checks passed; repository-wide formatting has pre-existing failures

Approved implementation from `word-aware-diff-handoff.md` on 2026-10-22.
That document is the full behavior, contract, migration and verification spec.
Use the ordinary checkout; preserve pre-existing UI refinements.

- [x] Shared algorithm, exact spans and conservative movement tests.
- [x] Explain V2 identity, validation, payload, migration and metrics preservation.
- [x] Workspace/History rendering and shared benchmark selections.
- [x] Final checks and manual review handoff; no commit, merge, push or deployment.

## Verification and review handoff

151 server tests pass, including generated Unicode/repeated-token cases, ambiguous
movement, minimal relocation, exact multi-span Explain payloads, cache separation,
soft-delete migration with foreign keys enabled, and historical metrics.

Passed: server tests (including contracts/server builds and test typecheck), web
build, server lint, web lint, shared diff smoke check, targeted formatting for all
feature code, and actual React static rendering fixtures for workspace/History.
React fixtures verify linked source/destination selection and untouched context;
they are not browser interaction, visual/mobile or paid-model quality evidence.

Full workspace formatting checks fail in 37 server and 21 web files outside this
feature's changes. Those files were not reformatted. This debt remains reported,
not waived. Browser checks require permission and were not run.

Audit/check/independent-review gates are manual; none requested. Existing findings
are closed and no independent review is pending. No paid calls, benchmark CLI,
SSH, production migration, commit, merge, push or deployment. Existing UI changes
in App.css, correction-workspace.tsx and ui/icon.tsx were preserved.

## Try it now

From the repository root, run this local library example (no network/model call):

```text
node -e "const {diffText}=require('./packages/contracts/dist/text-diff.js'); console.log(diffText('Я пока не могу.', 'Я не могу пока.').groups)"
```

Expected: one group with kind move; exact spans select пока, while comparison
ranges include the surrounding word order. Unchanged не могу is not a highlight.

## Previous verified feature context (preserved)
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

User refinement: In workspace result actions, Copy is centered and Generate again is on the right on desktop. Generate again has a sparkles icon and a New paid request hover tooltip instead of inline cost text, retaining the accessible paid-request label. Web build/lint passed; synthetic browser checks verified desktop centering and mobile fit without model calls.
