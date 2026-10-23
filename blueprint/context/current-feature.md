# Feature: Text-diff stabilization

**From build-plan:** feature 3.1
**Build attempt:** 1
**Branch:** master (managed checkout does not permit creating a feature ref)

## Goal

Make word movement detection reliable when unrelated sentences are added,
removed, joined, or split, and bound the complete movement discovery path for
large or repetitive inputs. Preserve exact text reconstruction, conservative
groups, Unicode and whitespace handling, and existing Explain selection data.

## In scope

- Pair reliable local sentence regions independently of total document sentence
  counts, using deterministic word signatures and occurrence order.
- Continue movement analysis only for balanced, structurally supported regions.
- Bound candidate-window enumeration and retain the existing resolver state
  budget, with ordinary diff fallback when either budget is exhausted.
- Replace repeated sorting in candidate checks with a bounded multiset check.
- Add regression coverage for sentence additions, sentence splits, ambiguous
  swaps, repeated words, exact reconstruction, and large repetitive inputs.
- Record reproducible performance measurements for medium, large, and stress
  inputs.

## Out of scope

- Global semantic movement detection, NLP, linguistic parsing, or LLM calls.
- Changes to public diff contracts, Explain prompts, correction behavior,
  History, UI layout, persistence, dependencies, or database schema.
- Manual text-selection Stages 1-3 and paid benchmark execution.

## Build loop

Implement the focused diff changes, run the text-diff and server checks after
each meaningful step, then run the documented server build/test gate and the
contracts build. Browser verification is not required for this library change.

## Build steps

- [x] **1. Add reliable local movement regions.** Pair sentence ranges by their
      word signatures, preserving duplicate occurrence order, and run the existing
      conservative movement resolver inside those pairs even when document
      sentence counts differ.
      **Done when:** the A1/A2 handoff cases detect clear local moves, inserted or
      split sentences remain complete edits, repeated signatures are deterministic,
      and ambiguous swaps remain ordinary changes.

- [x] **2. Bound movement discovery.** Add a document-level candidate-window
      budget and a cheap multiset precheck; exhaustive window discovery must stop
      and fall back without dropping text or spans.
      **Done when:** 8,000-word and repetitive stress inputs return with complete
      reconstruction, no speculative movement, and measured bounded runtime.

- [x] **3. Run regression and integration checks.** Keep existing movement,
      split/join, punctuation, whitespace, Unicode, Explain selection, and server
      behavior passing while adding the new cases and measurements.
      **Done when:** focused text-diff tests, server tests, contracts build, and
      relevant lint/build checks pass, with any pre-existing failures reported.

## Files / areas

- `packages/text-diff/src/text-diff.ts`
- `packages/text-diff/src/word-moves.ts` only if the resolver budget seam needs
  a compatible adjustment
- `apps/server/test/text-diff.test.ts`
- `blueprint/build-plan.md` and this current feature record

## Data / contracts

No persisted data, network requests, public types, or external formats change.
All offsets remain end-exclusive JavaScript UTF-16 ranges, and all public runs
must reconstruct their original input strings exactly.

## Testing

Use the existing `apps/server/test/text-diff.test.ts` suite and add focused
cases for the handoff examples. Measure deterministic inputs locally with the
same test process or a small test helper; do not run benchmarks or real model
requests. Run `npm test -w apps/server`, `npm run build -w packages/contracts`,
and affected lint/build commands documented in `AGENTS.md`.

## Notes for the AI

Prefer the smallest reliable local pairing and a conservative ordinary-diff
fallback. Do not broaden movement heuristics to compensate for uncertain
sentence correspondence. Preserve existing uncommitted user files and the
approved V3 roadmap edits.

## Verification and review handoff

Implemented in `packages/text-diff/src/text-diff.ts` with focused regressions
in `apps/server/test/text-diff.test.ts`. Sentence regions are paired by sorted
word multisets within paragraph boundaries, with duplicate signatures consumed
in source order. Candidate movement windows use a 4,096-window document budget
in addition to the resolver state budget; exhausted discovery falls through to
the ordinary alignment and coarse diff path.

Passed: `npm run build -w packages/text-diff`, `npm run build -w
packages/contracts`, `npm run lint -w apps/server`, and the complete server test
gate. The server suite reports 152 passing tests, including A1/A2 local moves,
ambiguous and repeated-word cases, exact reconstruction, Unicode and whitespace
coverage, and the 8,000-word stress fallback.

Measured on the local Node runtime after the change: 500 words with a local
move 9 ms, 2,000 words with a local move 17 ms, and 8,000 repetitive words
with an ambiguous reversal 60 ms in a direct run. The server stress test measured
the same 8,000-word case at 457-468 ms while running the full invariant checks.

No paid model calls, benchmark CLI, network request, database change,
dependency change, commit, merge, push, or deployment was performed. The
managed checkout could not create a feature branch because `.git` ref locking
is unavailable; work remains in the ordinary `master` checkout. Ready for user
review and the separate completion bookkeeping step.
