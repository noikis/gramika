# Current Feature

> **Generated file.** Holds the one feature, fix, or rollback being built in this checkout. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
> Build one thing at a time in this checkout; `/complete` archives it under
> `blueprint/history/` and resets this file.

## Manual V3 benchmark with side-by-side comparison

**Type:** Feature
**Branch:** feature/manual-v3-benchmark
**Status:** verified

Approved directly in chat on 2026-10-18. This is bounded tooling outside the product UI.

## Contract

Only the user may invoke benchmark commands, including preview. Agents must never
invoke the entry point; implementation verification calls library functions with
mocked transport only. No real benchmark or paid calls are authorized.

- Standalone npm command; explicit cases and configured model IDs; validate all
  input before requests. Preview is offline by default. Execution requires an
  interactive terminal and explicit confirmation after showing maximum calls.
- Every selected model receives every identical sentence once, sequentially in
  case/model order. Stop all requests on the first failure or timeout, with no
  retries. Ctrl+C stops after saving the current attempt. No automatic resume.
- Reuse strict-v3, production parameters, validation, timeout and proxy policy.
  Refuse a changed prompt version. No new dependencies, endpoints or UI screens.
- User amendment: benchmarks do not reject valid outputs for returned reasoning
  fields or reasoning tokens. Keep requesting disabled reasoning and recording
  usage; ordinary application corrections retain their guard.
- Each run has a fresh ignored folder, isolated SQLite using existing tables,
  manifest, and self-contained offline HTML report updated after every attempt.
- Report selects a sentence and two models, defaults to the first sentence and
  first two models, and shows original, full outputs, status, timings, usage and
  cost. Show failures and not-run slots explicitly; retain unknown metrics.
- User decision on 2026-10-19: application and benchmark choices are Gemma 4
  26B A4B (default) and Gemini 3.1 Flash Lite (alternative). Remove all other
  choices. Unsupported saved preferences reset to Gemma; historical records
  remain readable. Gemini has not been established as better by the user.
- Approved UI follow-up: model selector matches the original text area's width,
  with its label above. Options read “Gemma 4 · Standard” and “Gemini 3.1 Flash
  Lite · Higher cost”; muted helper text explains quality is not established.
- Escape report data, preserve whitespace, summarize known cost separately from
  unavailable cost, and leave quality judgment to the user. No judge models.
- No ordinary history changes, sensitive console output, overwrites,
  automatic execution, migrations, commits, merges or deployment.

## Steps

- [x] Implement validated inputs, isolated sequential runner and persisted outcomes.
- [x] Implement offline side-by-side report and manual-only CLI confirmation.
- [x] Add mocked coverage, documentation and project instructions; run relevant gates.

## Done when

Mocked verification proves identical request inputs/order, single attempts,
stop-on-failure/timeout, cancellation between attempts, isolated records and
parameters, complete report data, escaping, missing metrics and not-run states.
Build and lint pass. The benchmark entry point is never invoked by an agent.

## Verification and handoff

- `npm test -w apps/server`: 54 passing tests, including nine new mocked tooling
  checks, server build and test typecheck. No benchmark entry-point invocation.
- Mocked reasoning-bearing outputs complete benchmark runs and retain usage;
  ordinary corrections still reject them. Server lint and diff checks passed.
- `npm run lint -w apps/server`: passed after removing one redundant CLI variable
  initialization. Focused Prettier checks and `git diff --check` passed.
- `git check-ignore` confirms local cases and reports are ignored.
- Report JSON round-trips hostile text and whitespace; embedded UI JavaScript
  compiles. Responsive report appearance and browser interactions remain for
  manual review. No browser automation or real model requests were performed.
- Manual-only invocation is documented in AGENTS.md and docs/benchmark.md. The
  prompt and ordinary history are unchanged. Application and benchmark choices
  now share the two approved models. Removed-model preferences reset to Gemma
  when configuration is loaded; supported saved selections are preserved.
- Model selection checks, all 54 server tests, server/web lint and the web build
  passed after the model decision. No benchmark or paid requests were invoked.
- Selector UI follow-up: web build, lint, focused formatting and diff checks
  passed. Browser appearance remains for manual review; no browser automation.
- No P0/P1 blockers or requested independent review. Existing P3 findings remain
  untouched. Audit, independent review and runtime Check are manual by policy.
- Automatic Try guide omitted: user cases are not supplied yet, and benchmark
  invocation is human-only. The documented manual workflow is ready for later use.
- No dependencies, migrations, commits, merges or deployment. Ready for user
  review, an implementation walkthrough, requested changes, or `/complete`.

## Completion notes

Completed and accepted by the user on 2026-10-19.

- Delivered manual-only V3 benchmarking, isolated records and offline comparison.
- User selected Gemma 4 26B A4B as default and Gemini 3.1 Flash Lite as the only
  alternative. Removed other choices; preserved history and handled retired
  preferences. Gemini has not been established as better than Gemma.
- Selector matches the original editor width, uses friendly labels, and shows
  the quality explanation only when Gemini is selected.
- User tested multiple phrases and styles and reported that everything works as
  expected, with very good corrections even from Gemma. There is no demonstrated
  need for separate prompts by style; retain the current strict-v3 prompt.
- Reused passing verification: 54 mocked server tests with server build and test
  typecheck, server/web lint, web build, focused formatting and diff checks.
  Latest conditional helper text change passed web build and lint; user accepted
  the resulting UI. No agent invoked benchmarks or made paid model calls.
- This was an ad-hoc unnumbered tooling feature, so no roadmap checkbox changed.
- Existing fixed P3 findings are unrelated and remain in the live ledger.
- Bookkeeping completed locally. No commit, merge, push or deployment performed.
