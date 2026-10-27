# Feature: Rewrite alignment confidence

**From build-plan:** V4.2.5 — Rewrite alignment confidence
**Status:** Implemented; ready for user review
**Branch:** feature/rewrite-alignment-confidence (managed worktree)

## Goal

Add a deterministic, conservative fallback for local low-confidence multi-token replacement runs. Preserve precise word-level corrections when token correspondence has strong character-level support; otherwise represent the contiguous local rewrite as one `replace` group. No flags, public API changes, semantic models, dictionaries or LLM calls.

## Acceptance cases

- `Очень хорошо` -> `Просто отлично`: one phrase replacement.
- `Новая фраза здесь.` -> `Другая мысль тут.`: one phrase replacement excluding the period.
- `Она был готов` -> `Она была готова`: two independent corrections.
- `Я допустил ашибку` -> `Я допустил ошибку`: one spelling correction.
- Mixed rewrite plus spelling remains two groups; grammar plus vocabulary remains three groups.
- Step 3 separator and Step 4 punctuation behavior remains unchanged.

## Scope

Apply only to local multi-token replacement candidates already produced by the diff pipeline. Preserve exact source text, UTF-16 ranges, grapheme-safe boundaries, runs, markers, moves, selections, and deterministic IDs. Add targeted fixtures and structural assertions. Run the documented evaluator and project checks; do not run manual benchmarks or paid calls. UI verification uses the deterministic presentation bridge; live browser verification waits for explicit user authorization.

## Build steps

- [x] Reproduce current changed-run pairing and establish a fresh pre-Step-5 baseline.
- [x] Implement bounded confidence assessment and phrase fallback in the existing diff flow.
- [x] Add positive, negative, mixed and regression fixtures with exact span assertions.
- [x] Run evaluator, baseline comparison and tests; review every changed case. Lint and web build were attempted but blocked by unavailable workspace dependencies.
- [x] Prepare implementation report and stop for user review.

## Implementation report

- **Root cause:** `changed()` paired equal-length unmatched token runs positionally, so an unrelated rewrite such as `Очень хорошо` -> `Просто отлично` appeared as two precise replacements without evidence for those correspondences.
- **Confidence logic:** For local equal-length runs of 2–8 word tokens, compare each positional pair by grapheme prefix/suffix overlap. A pair is strongly supported only with at least 2 shared graphemes and at least 65% shared of the longer word. A run falls back to one phrase replacement only when every token differs and every pair is below that threshold. Longer runs, punctuation, insertions/deletions and mixed-confidence runs retain the established behavior.
- **Files changed:** `packages/text-diff/src/text-diff.ts` adds the bounded confidence helper and phrase ownership; `apps/server/test/fixtures/text-diff.json` adds ten Step 5 cases; `apps/server/test/text-diff-step5.test.ts` adds exact spans, structural invariants and Step 3/4 regression assertions.
- **Before/after:** `Очень хорошо` -> `Просто отлично` changed from two `replace` groups to one owning `[0,12)` and `[0,14)`. `Новая фраза здесь.` -> `Другая мысль тут.` changed from three groups to one owning the words only, leaving the final period unchanged. `Она был готов` -> `Она была готова` remains two word-level groups.
- **Regression evaluation:** 114/114 cases passed with 7,762 assertions. Against the pre-Step-5 104-case baseline, only the two rewrite fixtures and the four repeated rewrite performance fixtures changed; Step 3/4 and all other prior cases were unchanged. The added Step 5 fixtures all passed.
- **Performance:** The bounded heuristic performs only local comparisons. The 5,000-unit repeated rewrite diagnostic rose from roughly 13.4 ms to 17.6 ms in one baseline run; all performance cases remained finite and passed.
- **UI:** The deterministic presentation bridge and source-level renderer tests pass. Live browser verification remains for the user's authorized Playwright review.
- **Limitations:** The heuristic does not claim semantic equivalence and leaves ambiguous or longer runs at the existing representation. No dictionary, language rule, model call or public API change was added.

