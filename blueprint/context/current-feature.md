# Feature: Selected-correction explanations

**From build-plan:** feature V2.4
**Build attempt:** 1
**Status:** verified Gemini minimal-reasoning repair (automated); human evaluation pending
**Branch:** feature/selected-correction-explanations

## Goal

Implement Strict Explain first using the actual approved prompts verbatim.
The approved [requirements handoff](v2.4-explain-handoff.md) is part of this spec.
The user authorized activating it and implementing phase 1 on 2026-10-21.

## In scope

Explicit Explain in the existing selected-change panel, workspace and History.
Full stored original/result context, exact selected fragments and positions,
original correcting model, Russian explanation of up to five sentences.
Persist successful explanations per result and selection and reuse across visits.
Loading, retry after errors, safe navigation and duplicate-request handling.
Preserve correction, copy, diff and history metrics behavior.

## Out of scope

Phase 2 Rewrite Explain awaits user evaluation and approval of Strict Explain.
V2.4 stays unchecked until both phases are complete. No metrics/reporting,
Explain more, chat, free selection, automatic generation or paid agent tests.

## Build loop

One review after implementation. No checkpoint commits, automatic reviewer,
paid calls, benchmark CLI, SSH, browser automation or application servers.

## Build steps

- [x] Add shared selection/response contracts and saved-explanation repository.
  Done when ranges and request identity are validated, migration preserves data,
  saved answers survive reopening and deleted entries are inaccessible.
- [x] Add Strict Explain service/routes with the exact prompt and existing transport.
  Done when mocked tests prove context/model routing, saved reuse, concurrency,
  reasoning rejection, timeouts and failures without correction/metric writes.
- [x] Connect the shared result panel in workspace and History.
  Done when explicit requests, saved lookup, errors and selection identity work
  without altering copy/diff and builds/lint plus existing diff checks pass.
- [x] Run relevant final checks and present manual evaluation handoff.
  Done when server tests/build, web build/lint and formatting checks are reported;
  pre-existing failures and unverified browser/language quality are explicit.

## Data / contracts

Use request UUID plus original and edited half-open UTF-16 ranges (the diff's
native offsets), including zero-length insertion/deletion ranges. Derive context
and fragments from the stored successful Strict result server-side. Validate
bounds, Unicode boundaries and actual text differences. Include display context
for whitespace comparisons by extending the end offsets to the displayed text.
Store one successful answer for each request/range combination; no reuse across
results. Lookup never calls the model. Hide deleted history records on lookup
and generation, including deletion during a pending call. Use a unique DB key
and coalesce identical in-flight calls within the server process. Failed answers
are not saved. Save source association and explanation only; metrics are deferred.

## Files / areas

packages/contracts/src; apps/server/src/{explanation,routes,database}; generated
Drizzle migrations; apps/web/src/components/{result-view,history-request} and
explanation panel; server tests. Keep the shared transport and correction prompts.

## Testing

Mocked server service/routes and isolated SQLite migration/reopen checks.
Existing node diff assertions and documented builds/lint/format checks.
Human evaluation through app after implementation; no new benchmark tooling.

## Notes for the AI

Render explanation as plain text, keep keyboard/mobile controls accessible.
No automatic retry or fallback. Five-sentence language quality is evaluated by
the human; do not truncate by heuristic sentence splitting. Preserve the exact
approved prompt. No requirement to generate a new answer on saved selections.

## Verification evidence

- `npm test -w apps/server`: passed, including build/test typecheck, eight new
  Explain scenarios, existing correction/history tests and mocked benchmark tests.
- `npm run build -w apps/web`: passed.
- `npm run lint -w apps/server` and `npm run lint -w apps/web`: passed.
- `node apps/web/scripts/check-text-diff.mjs`: passed 23 edge cases, 5 grouped
  cases, 12 boundary cases and 200 generated pairs.
- Prompt strings compared directly with the approved handoff: exact match.
- Full format checks report pre-existing issues in 13 unchanged server files
  and 11 unchanged web files. Changed implementation files were formatted.
- No live model calls, benchmark CLI, browser checks, servers, commits or merge.
- No blocking findings or independent review request. Review remains manual.

## Handoff

Test Strict Explain in the running app: select a correction, click Explain,
then reopen the same result/selection in History to see its saved answer.
Confirm Russian explanations are accurate, relevant and no more than five
sentences. Phase 2 remains gated on user approval; V2.4 remains unchecked.

## Approved follow-up: Explain benchmarks from existing runs

User approved 2026-10-22: read an existing correction benchmark and explain
all detected changes, separately, with the model that produced each result.
Use successful Strict results only in this phase; report Rewrite, failed and
not-run results as skipped. Show unchanged results as no changes, with no call.
Preview gives the exact explanation count before the existing human interactive
spending confirmation. Never regenerate corrections or modify the source run.
Use the app's same diff grouping, whitespace context, exact prompts, transport
policy and response guard. Run sequentially, stop on first failure or Ctrl+C
(after saving the current request), no retries. Save a fresh isolated manifest
and offline report with every change, answer, failure/not-run state and reported
usage/cost. These are benchmark-only metrics; app accounting remains deferred.
Only the user invokes the CLI, including preview. Tests inject mocked transport.

- [x] Share existing diff implementation without changing its behavior.
  Done when existing diff assertions and web build pass.
- [x] Implement read-only source validation, exact preview, Explain queue and
  offline report. Done when mocked tests prove all changes are covered, original
  model/context are used, source files remain unchanged, no-change/skipped states
  are visible, and errors/interruption stop further calls.
- [x] Document human commands and run server tests, builds, lint and changed-file
  formatting. Done when checks pass or existing failures are separately reported.

### Follow-up verification (2026-10-22)

- Full `npm test -w apps/server`: 112 passed, including six new benchmark tests.
- Final metadata adjustment: server build/test typecheck and all six focused
  Explain benchmark tests passed again.
- Web build, server/web lint, changed-file formatting and diff assertions pass.
- Shared diff source moved unchanged to the contracts text-diff subpath; the
  existing installed diff dependency is declared there. Web helpers re-export it.
- Source-run bytes are unchanged in mocked tests. Offline report selection,
  every-change rendering and plain-text safety were exercised with a DOM seam.
- Human-only benchmark CLI (including preview) was never invoked. No paid calls,
  browser session, automatic review, commit or merge. Existing staged work kept.
- Human commands and report format are documented in `docs/benchmark.md`.
  Rewrite Explain and full V2.4 completion still await approval of Strict quality.

## Gemini benchmark repair (2026-10-22)

Confirmed from two saved failed runs: Gemini's first Explain answer was rejected
with REASONING_NOT_DISABLED, finish reason stop and reported reasoning tokens 0.
Explain benchmarks incorrectly inherited the app's rejection of reasoning fields.
The existing human benchmark policy accepts otherwise valid responses with
reasoning metadata. Apply that same policy to Explain benchmarks only. Requests
still ask for disabled reasoning. Keep app explanation/correction guards enabled.
Retain reported tokens/cost and record the benchmark response policy. No live
calls, automatic retries or changes to saved runs.

- [x] Make the Explain service reasoning guard configurable internally with a
  default of true; manual benchmark explicitly selects false. Done when mocked
  Gemini reasoning-bearing responses complete, usage is retained, and app/default
  behavior continues to reject the identical response.
- [x] Update docs and run focused checks plus server tests/build/lint/format.
  Done when actual evidence and the user rerun command are reported.

User clarification: remove the guard for Gemini explanations in the app as well.
Gemma app explanations and all correction guards remain unchanged. Every request
still asks for disabled reasoning. The benchmark accepts reasoning-bearing valid
answers for either model, consistent with correction benchmark policy.

- [x] Verify Gemini app explanation acceptance, saved reuse and unchanged Gemma
  rejection with mocked responses. Keep the actual Explain prompts unchanged.

Latest user constraint: Gemini Explain must use minimal reasoning. Send
`reasoning.effort: minimal` explicitly for Gemini app and benchmark explanations,
without a conflicting enabled:false. Keep Gemma and all correction requests
unchanged. Share actual request-parameter creation with benchmark metadata.

- [x] Verify Gemini minimal effort in outgoing app/benchmark payloads and saved
  benchmark metadata, plus unchanged prompts and existing correction behavior.

### Repair verification

- `npm test -w apps/server`: 114 passed, including correction guard regression
  tests and Gemini Explain acceptance/minimal-effort checks.
- Sixteen focused Explain/app benchmark tests pass. Server build and test
  typecheck pass; server lint, changed-file formatting and git diff check pass.
- Gemini payloads and benchmark metadata use effort minimal. Only explanation
  generation changed; actual prompts and correction request settings are intact.
- No live calls, benchmark CLI invocation, retry of saved runs, commit or merge.
