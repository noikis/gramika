# Грамика — Text Diff Improvement Specification

**Version:** 1.0  
**Status:** Ready for incremental implementation  
**Scope:** `packages/text-diff` and the frontend components consuming its output  
**Implementation strategy:** Seven independent, sequential improvements  
**Primary objective:** Make highlighted corrections and comparison cards more accurate, understandable, and useful without replacing the existing diff engine unnecessarily.

---

# 1. Product context

## 1.1 What Грамика does

Грамика is a Russian-language proofreading and rewriting application.

Its primary use cases are short Telegram messages, WhatsApp messages, and brief emails.

Typical input length is approximately 100–400 characters. Around 1,000 characters is relatively uncommon. The application has a maximum text length of 5,000 characters.

The application has two modes:

- **Strict:** Intended primarily for proofreading and relatively conservative corrections.
- **Rewrite:** Allows more substantial rewriting.

However, **Strict can also produce unexpected substantial rewrites**.

Therefore, the diff engine must analyze the actual original and corrected texts. It must not assume that Strict always contains small edits or that Rewrite always contains large ones.

Different presentation strategies may eventually be used for different modes, but only if testing demonstrates a benefit.

## 1.2 What change highlighting is for

The purpose of highlighting is to help users understand what changed.

The application presents:

1. Corrected text with highlighted changes.
2. A navigable collection of change cards.
3. Original and corrected excerpts for individual changes.
4. Optional explanations generated using an LLM.

Highlights are **not** used to accept or reject individual changes.

Users can also manually select arbitrary text and request an explanation. This functionality must remain available.

The explanation LLM receives the complete original text, complete corrected text, and selected change or selection. Therefore, the diff engine does not need to solve every semantic explanation problem itself.

## 1.3 Product principles

All implementation steps must follow these principles.

**P1 — Understandability over minimal edit count.** A mathematically minimal diff is not necessarily a good user-facing diff.

**P2 — Correctness before sophistication.** Fix incorrect or invisible change representations before adding semantic grouping.

**P3 — Separate detection from presentation.** The precise spans that changed are not necessarily the same as the contextual excerpts displayed in cards.

**P4 — Conservative grouping.** Merge changes when there is a clear reason. Do not merge merely because changes are adjacent.

**P5 — Mode independence by default.** Handle actual edit patterns, including unexpected rewrites in Strict.

**P6 — Incremental delivery.** Every step must be independently testable and reversible.

**P7 — No mandatory LLM dependency.** The deterministic diff remains fully functional without another model call.

**P8 — Preserve existing behavior unless intentionally changed.** Word movement, deletion markers, manual selection, and public API compatibility must be protected.

---

# 2. Existing implementation

## 2.1 Source files

The uploaded implementation contains:

| File            | Responsibility                                                                    |
| --------------- | --------------------------------------------------------------------------------- |
| `index.ts`      | Public exports                                                                    |
| `text-diff.ts`  | Main `diffText()` implementation, group construction, whitespace handling, output |
| `tokenize.ts`   | Tokenization, grapheme boundaries, sentence ranges                                |
| `align.ts`      | Matching unchanged tokens                                                         |
| `word-moves.ts` | Detection of certain word reorderings                                             |
| `diff-types.ts` | Public types and Zod schemas                                                      |
| `diff.d.ts`     | Type declaration for the `diff` dependency                                        |

The coding agent must inspect the current repository before making changes, because the implementation may have evolved since these files were provided.

## 2.2 Current processing

The main function is:

`diffText(original: string, corrected: string): TextDiff`

Its approximate pipeline is:

1. Return an empty diff if the texts are identical.
2. Tokenize both texts.
3. Identify certain sentence-local word reorderings.
4. Remove detected moved tokens from ordinary alignment.
5. Align the remaining tokens.
6. Construct change groups for unmatched token regions.
7. Construct whitespace changes from token gaps.
8. Handle moved-word gaps and trailing whitespace.
9. Normalize spans, calculate ordering, assign IDs.
10. Produce `originalRuns`, `correctedRuns`, and markers.

### Tokenization

`tokenize.ts` uses Russian `Intl.Segmenter` instances.

Words are generally treated as whole tokens. Punctuation can become individual grapheme tokens.

Whitespace is not generally emitted as an ordinary token. Instead, each token has a `gap` range representing whitespace preceding that token.

Trailing whitespace is handled separately in `text-diff.ts`.

This design is useful but creates interactions between token changes and whitespace changes.

### Alignment

`align.ts` uses `diffArrays` from the `diff` package for bounded regions.

For larger or more expensive regions, it uses unique-token anchors and recursive comparison.

The current implementation limits fine comparison using `MAX_COMPARISON_TOKENS` and a comparison budget.

### Word movements

`word-moves.ts` detects certain reorderings of exact word sequences.

It has explicit complexity limits, including `MAX_MOVE_WORDS` and `MAX_MOVE_STATES`.

This functionality is specialized and must not be accidentally broken by the proposed improvements.

### Changed regions

The `changed()` function in `text-diff.ts` creates insertions, deletions, and replacements.

When two unmatched regions have equal token counts, the implementation can pair tokens by their positions.

This works for many local corrections but can produce misleading comparisons when a phrase has been substantially rewritten.

### Whitespace

The `spacing()` function processes token gaps separately.

It can create standalone `whitespace` groups or attach whitespace spans to another change group.

This is a key area for improvement.

## 2.3 Existing public data model

The relevant public structures are:

- `TextRange`: `{ start, end }`
- `ChangeGroup`: `id`, `kind`, `originalSpans`, `correctedSpans`, `originalRange`, `correctedRange`
- `TextRun`: `{ range, groupId }`
- `ChangeMarker`: deletion or move-source marker
- `TextDiff`: `groups`, `originalRuns`, `correctedRuns`, `markers`

`ChangeKind` currently supports:

- `insert`
- `delete`
- `replace`
- `move`
- `whitespace`

**Preserve this public contract unless an implementation step explicitly requires a compatible extension.**

## 2.4 Confirmed architectural weaknesses

The following are conclusions from static code review, not runtime test results.

### A. Separator replacements can become multiple changes

Example:

`чат бот` → `чат-бот`

The unchanged words can align while the inserted hyphen and deleted space are processed separately.

The result can be two groups for one understandable separator correction.

### B. Whitespace changes can be visually invisible

Example:

`слово ,` → `слово,`

A whitespace group may have a contextual range containing the comma, while the actual changed span contains only a space.

If the UI trims or collapses whitespace, the card can appear as:

`,` → `,`

The UI source must be inspected to confirm the exact rendering mechanism.

### C. Equal-length unmatched regions are paired positionally

For substantial rewrites, the algorithm may compare words that are not meaningful counterparts.

### D. Word-level replacements are not refined to character-level highlights

The tokenizer uses grapheme segmentation, but ordinary replacements are still generally represented as whole-token changes.

This is not automatically a defect. Whole-word highlighting may be preferable for grammatical corrections.

### E. The whitespace-only helper has narrower semantics than its name suggests

`isWhitespaceOnlyChange()` normalizes whitespace runs to single spaces and trims the ends before comparing strings.

It does not classify every change that modifies only whitespace characters as equivalent. For example, removing the only space before punctuation changes the normalized string.

Do not rely on this helper as a universal classifier for whitespace-only diff groups.

---

# 3. Cross-cutting implementation requirements

These requirements apply to all seven steps.

## 3.1 Preserve offset semantics

All ranges must use the same offset system as the current implementation: JavaScript string offsets, effectively UTF-16 code-unit indices.

Do not silently switch to Unicode code-point indices or grapheme indices.

Test with Cyrillic text, emoji, combining marks, and mixed scripts.

All ranges must remain valid half-open intervals:

`[start, end)`

The following must hold:

- `0 <= start <= end <= text.length`
- Changed spans must not contain invalid ranges.
- Display formatting must never alter source offsets.
- IDs referenced by runs and markers must exist.

## 3.2 Distinguish three concepts

The implementation must distinguish:

**Changed spans:** Exact source ranges associated with a change.

**Comparison context:** Additional unchanged text shown to make a change understandable.

**User-facing groups:** Collections of related changed spans presented as one correction.

These are related but not interchangeable.

Do not highlight an entire contextual range merely because it is shown in a comparison card.

## 3.3 Preserve the deterministic API

Keep `diffText()` synchronous and deterministic.

Do not introduce networking or LLM calls inside `packages/text-diff`.

For identical inputs, the result must still contain no changes.

Preserve the ability to run the package without access to OpenRouter or any external service.

### Explain compatibility for deterministic grouping

For Steps 3–6, the browser and the Explain server must use the same version of the shared `diffText()` implementation and the same grouping settings, including any experimental flags. Keep deterministic grouping rules in the shared package rather than applying additional merges only in the frontend.

The server must retain its existing validation that a submitted selection matches a group recomputed from the stored original and corrected texts. With matching versions and settings, it must recognize the new deterministic groups without an additional LLM call or stored grouping data.

Add integration tests using a mocked explanation transport to verify that lookup and explanation generation accept a new merged group and reject a fabricated selection. Verify matching grouping settings on both consumers when enabling each experimental rule.

## 3.4 Preserve movement semantics

Do not automatically merge `move` groups with ordinary insertions, deletions, or whitespace groups.

Movement markers and source anchors require special handling.

Any change affecting moved spans must have dedicated regression tests.

## 3.5 Avoid destructive normalization

Do not trim, collapse, or rewrite the original and corrected strings for the purposes of constructing source offsets.

Normalization may be used for comparison or similarity scoring, but the public spans must always refer to the unmodified strings.

## 3.6 Prefer small, named functions

Avoid adding all new behavior directly to the existing `diffText()` function.

Prefer helpers such as:

- `normalizeSeparatorChanges()`
- `normalizePunctuationChanges()`
- `assessReplacementConfidence()`
- `formatChangeCard()`
- `validateDiffInvariants()`

These are suggested names, not mandatory APIs.

## 3.7 Regression and rollback

Each behavior-changing step must be covered by tests.

Where a step introduces heuristic behavior, implement it behind an internal feature flag or comparable switch until its quality is established.

Do not introduce mode-specific heuristics without evidence.

---

# 4. Step 1 — Build a regression and evaluation framework

**Priority:** P0  
**Category:** Testing infrastructure  
**Complexity:** Small–medium  
**Dependencies:** None  
**Deliverable:** Repeatable test suite and baseline results

## 4.1 Objective

Create a reliable way to evaluate changes to the diff engine before modifying its behavior.

The test framework must distinguish:

1. Structural correctness.
2. Expected change-group behavior.
3. Presentation quality.
4. Performance.
5. Intentional changes versus regressions.

## 4.2 Implementation tasks

### Task 1.1 — Inspect existing tests

Locate existing tests in `packages/text-diff` and related application packages.

Identify the test runner, assertion conventions, snapshot conventions, and CI configuration.

Reuse the existing stack where practical.

Extend the existing `node:test` suite in `apps/server/test/text-diff.test.ts` and its invariant helper. The diff implementation is pure, framework-independent TypeScript: exercise `diffText(original, corrected)` directly without starting the application, a browser, or a model transport. Do not introduce another test framework or move the suite solely for this work.

### Task 1.2 — Create a fixture corpus

Create a version-controlled collection of original/corrected pairs.

Each fixture should contain:

- Stable case ID.
- Original text.
- Corrected text.
- Category.
- Description of the expected behavior.
- Optional notes about Strict or Rewrite provenance.
- Whether the expectation is confirmed or still under evaluation.

Suggested categories:

- Identical texts.
- Spelling changes.
- Inflection changes.
- Punctuation insertion.
- Punctuation replacement.
- Whitespace insertion/removal.
- Separator replacement.
- Split/join operations.
- Word movements.
- Multiple independent corrections.
- Substantial phrase rewrites.
- Unicode and unusual whitespace.
- Empty strings and boundary cases.

Start with approximately 30–50 examples. Use synthetic, non-personal messages in committed fixtures, reproducing useful edit patterns from application examples without copying personal messages.

Use the same fixture corpus for automated assertions and the readable comparison command below. Keep current baseline expectations distinct from proposed improvements so Step 1 can document existing behavior without requiring future grouping rules to pass prematurely.

### Task 1.3 — Add structural invariant tests

Validate that:

- All ranges are within the corresponding text.
- Changed spans have positive length.
- Group IDs are unique.
- All run and marker references point to existing groups.
- Runs cover the relevant text in order without unintended gaps or overlaps.
- Markers have valid offsets.
- Output is deterministic across repeated calls.
- Empty and identical inputs are handled correctly.

Retain and extend the existing helper's stronger checks:

- Every textual difference is accounted for, using residual-text equality and the existing movement-specific checks; valid ranges alone are insufficient.
- Run ownership agrees with the group's exact changed spans.
- Range boundaries do not split graphemes, including emoji and combining characters.
- Comparison ranges contain their group's changed spans.
- Each group produces a schema-valid Explain selection, including the existing `MAX_CHANGE_SPANS` limit per side.

For normalization and merge operations, check that the union of changed spans on each side is preserved without lost, duplicated, or newly highlighted unchanged content. For example, combining `чат бот` -> `чат-бот` must retain both the removed space and the inserted hyphen while leaving both words unhighlighted. If a proposed merge exceeds Explain's limits, retain the original valid groups; never truncate spans.

If a structural invariant fails on the existing implementation, record the failure before changing behavior. Do not silently modify expected output to conceal it.

### Task 1.4 — Add behavioral assertions

Assert meaningful output properties rather than relying exclusively on complete JSON snapshots.

Examples:

- Number of groups.
- Change kinds.
- Original and corrected substrings covered by spans.
- Whether particular corrections are separate or combined.
- Whether movement markers exist.

Avoid making generated IDs the primary assertion target unless ID stability is itself under test.

### Task 1.5 — Add presentation tests

Find the frontend components that render comparison cards.

Add component or integration tests for:

- Whitespace visibility.
- Empty original or corrected sides.
- Context versus highlighted spans.
- Multiple spans in one group.
- Deleted text.
- Punctuation-only changes.

Use screenshots or visual regression tests if supported by the repository.

### Task 1.6 — Add performance checks

Measure `diffText()` for representative lengths:

- 100 characters.
- 400 characters.
- 1,000 characters.
- 5,000 characters.

Include cases with many repeated words and cases with substantial rewrites.

Record baseline timings in the same runtime used by the application.

Avoid hardcoding an arbitrary performance target before measuring the baseline.

### Task 1.7 — Save test and comparison results to files

Provide a local CLI exposed through an npm script that runs the same synthetic fixtures through the pure diff function and saves results to files. Support the full corpus or a selected case ID. Do not print per-case results, diffs, timing tables, or verbose test logs to the terminal. Normal terminal output should contain only a short completion status and the report directory. If report creation fails, print a concise actionable error and exit unsuccessfully.

Use plain files initially, with one uniquely named directory per run under an ignored local directory such as `test-results/text-diff/`. Keep committed fixture definitions separate from generated results. Preserve earlier runs rather than overwriting them. Do not use the application's SQLite database or introduce a dedicated database for this initial scope.

Each run directory should contain:

- `results.json`: machine-readable results with a schema version, run time, implementation revision and dirty-working-tree indicator, effective diff settings, selected case IDs, summary counts, and per-case results. For each case, include the exact input strings, expected behavior and evaluation status, actual `TextDiff`, assertion outcomes, failure details, and elapsed time. Preserve raw text and UTF-16 offsets exactly.
- `report.md`: a human-readable summary followed by per-case comparisons. Show source and target text, group count, change kinds, exact changed fragments, comparison context, and assertion failures. Display whitespace with visible markers in this report only. Label exploratory cases separately from approved pass/fail assertions. Escape fixture content so punctuation or Markdown syntax in a test case cannot corrupt the report.

The Markdown report must be generated from the same result data as the JSON. Keep successful and failed case results, and save available results even when assertions fail. An interrupted run must not appear as a completed passing run.

Reuse fixture loading and validation logic from the automated tests. Automated assertions determine pass or fail; the readable report supports human assessment of grouping quality. Failed assertions must produce a nonzero exit status. Clearly distinguish exploratory grouping expectations from approved assertions.

Support comparison with a saved baseline `results.json` as later steps are implemented, recording group-boundary and assertion differences in the candidate run's files. Match cases by ID and verify that source and target strings are identical before presenting a direct comparison; label changed, added, or missing fixtures explicitly. Record the chosen command and output location in the implementation handoff. Keep this tool small: no application server, browser, new framework, network access, or paid model calls. Do not use or invoke the existing model benchmark entry points.

## 4.3 Required initial fixtures

| Original        | Corrected                | Expected principle                           |
| --------------- | ------------------------ | -------------------------------------------- |
| `чат бот`       | `чат-бот`                | One separator correction eventually          |
| `чат-бот`       | `чат бот`                | Reverse separator correction                 |
| `слово ,`       | `слово,`                 | Removed space must be visible                |
| `Привет`        | `Привет!`                | Punctuation insertion                        |
| `Привет !`      | `Привет!`                | Whitespace correction near punctuation       |
| `Привет ,мир`   | `Привет, мир`            | Related punctuation spacing                  |
| `Она был готов` | `Она была готова`        | Two understandable local corrections         |
| `превет`        | `привет`                 | Spelling replacement                         |
| `Очень хорошо`  | `Просто отлично`         | Avoid misleading positional word comparisons |
| `Я дома`        | `Я дома`                 | No changes                                   |
| Empty string    | `Привет`                 | Insertion                                    |
| `Привет`        | Empty string             | Deletion                                     |
| `Привет  мир`   | `Привет мир`             | Extra-space correction                       |
| `Привет\nмир`   | `Привет мир`             | Newline/space replacement                    |
| Text with emoji | Modified text with emoji | Correct UTF-16 offsets                       |

These are starting fixtures, not a complete corpus.

## 4.4 Acceptance criteria

Step 1 is complete when:

- The existing implementation can be run against the fixture corpus.
- Structural tests are automated.
- Behavioral tests support both exact and intentionally flexible expectations.
- A baseline report can be produced.
- The comparison command runs the same fixtures as the automated tests, supports selecting a case, and saves both `results.json` and `report.md` in an ignored directory per run.
- Detailed test results and failures are saved to files; terminal output is limited to a short status and report path. Assertion failures still produce a nonzero exit status.
- Coverage, grapheme safety, unchanged-anchor precision, and Explain-selection validity remain checked alongside expected grouping behavior.
- The tests can run in CI.
- No product behavior has been intentionally changed.

## 4.5 Non-goals

Do not redesign the algorithm in this step.

Do not change grouping rules merely to make snapshots pass.

---

# 5. Step 2 — Make whitespace changes understandable

**Priority:** P0  
**Category:** Frontend presentation  
**Complexity:** Small–medium  
**Dependencies:** Step 1  
**Deliverable:** Comparison cards that reveal invisible whitespace changes

## 5.1 Objective

Eliminate cards that appear to show identical original and corrected text when the actual correction is whitespace.

Examples of unacceptable presentation:

- `,` → `,`
- `бот` → `бот`
- Two apparently identical excerpts where the only difference is a space or newline.

This step must improve presentation without changing the underlying diff algorithm.

## 5.2 Product behavior

For the first implementation, **continue showing whitespace-only changes**, but make them understandable.

This is a provisional default, not a final product decision.

Do not silently hide whitespace corrections yet.

Use visible representations of changed whitespace inside comparison cards.

Suggested representations:

| Character          | Card representation           |
| ------------------ | ----------------------------- |
| Ordinary space     | `␠`                           |
| Tab                | `⇥`                           |
| Newline            | `↵`                           |
| Non-breaking space | Distinct labeled space marker |
| Multiple spaces    | Multiple visible markers      |

The exact visual design can follow the existing design system.

The original and corrected texts themselves must remain unchanged.

## 5.3 Implementation tasks

### Task 2.1 — Locate the comparison-card renderer

Find where `ChangeGroup.originalRange` and `ChangeGroup.correctedRange` are converted into displayed text.

Check whether the renderer:

- Calls `trim()`.
- Collapses whitespace.
- Uses CSS that collapses whitespace.
- Displays only context rather than actual changed spans.
- Uses different logic for insertions and deletions.

Document the cause of any misleading cards.

### Task 2.2 — Introduce a display-only representation

Implement a formatter or component that receives:

- The full original and corrected strings.
- The selected `ChangeGroup`.
- The original and corrected contextual ranges.
- The actual changed spans.

It should produce display segments with separate styling for:

- Changed text.
- Unchanged context.
- Changed whitespace.
- Empty-side placeholders.

Do not mutate the source strings.

### Task 2.3 — Highlight changed whitespace explicitly

When a changed span contains whitespace, render it using visible markers.

Prefer making only the **changed whitespace** visible, rather than displaying every ordinary space in the contextual excerpt as a symbol.

The user must be able to distinguish:

`слово␠,` → `слово,`

from:

`слово,` → `слово,`

### Task 2.4 — Handle empty sides

For pure insertions and deletions, show an explicit absence indicator rather than an ambiguous blank field.

The UI may use a localized label such as “Nothing” or “Text removed,” depending on existing conventions.

Do not insert placeholder characters into the actual corrected text.

### Task 2.5 — Accessibility and localization

Ensure whitespace markers have accessible descriptions.

For example, a removed space should be understandable to screen-reader users.

Use the application's localization conventions for labels.

## 5.4 Important implementation detail

Do not use `isWhitespaceOnlyChange()` as the sole way to identify whitespace corrections.

The current helper does not cover every whitespace insertion or deletion.

Prefer inspecting the actual group spans and their substrings.

## 5.5 Acceptance criteria

- `слово ,` → `слово,` visibly identifies the removed space.
- `Привет  мир` → `Привет мир` identifies the extra space.
- Newline and tab corrections are understandable.
- Context remains readable.
- Actual source offsets are unchanged.
- Highlighting in the corrected text is unaffected.
- Manual selection still works.
- No additional LLM call is required.

## 5.6 Non-goals

Do not change which whitespace corrections are shown.

Do not merge whitespace changes with neighboring punctuation yet.

Do not redesign the entire change-card interface.

---

# 6. Step 3 — Normalize separator replacements

**Priority:** P1  
**Category:** Deterministic diff post-processing  
**Complexity:** Medium  
**Dependencies:** Steps 1–2  
**Deliverable:** One coherent group for a space-to-hyphen replacement

## 6.1 Objective

Fix cases where one separator replacement is represented as multiple unrelated changes.

Primary example:

`чат бот` → `чат-бот`

Expected user-facing behavior:

**One change:** Replace the space between the words with a hyphen.

Not:

1. Remove a space.
2. Insert a hyphen.

## 6.2 Root cause

The current alignment can match both unchanged words.

The inserted hyphen is then processed by `changed()`.

The deleted space is processed separately by `spacing()`.

The existing `isJoin` logic does not necessarily resolve this because the matching words may already have been removed from the unmatched region.

## 6.3 Implementation approach

Introduce a deterministic normalization pass after raw change drafts are constructed and before final group IDs, runs, and markers are generated.

Suggested location in `text-diff.ts`:

After ordinary changes, moved-word gaps, and terminal whitespace have been processed, but before the final sorting and ID assignment.

Suggested helper:

`normalizeSeparatorChanges(drafts, original, corrected, tokens)`

The precise signature is up to the agent.

## 6.4 Candidate detection

Identify pairs of draft groups that together represent a separator replacement.

Initial supported cases:

- Space → hyphen.
- Hyphen → space.
- Multiple spaces → hyphen, when unambiguous.
- Hyphen → multiple spaces, when unambiguous.

Initially recognize ordinary hyphen and closely related Unicode hyphen characters already acknowledged by the existing code.

Do not broadly treat every dash as an interchangeable separator.

A merge candidate must satisfy all of the following:

1. The changes occur at the same local boundary between corresponding unchanged words.
2. One component represents the relevant whitespace operation.
3. The other represents the corresponding separator insertion or deletion.
4. No unrelated lexical edit intervenes.
5. The two groups do not overlap other unrelated groups.
6. Neither group is a word movement.
7. The merged group preserves all changed source spans.

Use actual offsets and token correspondence. Do not rely only on the fact that two groups appear consecutively in the output array.

## 6.5 Group construction

Create one replacement group.

For:

`чат бот` → `чат-бот`

The changed spans should represent:

- Original: the space.
- Corrected: the hyphen.

The comparison context should include enough surrounding text to understand the replacement.

Do not highlight unchanged words as if they were edited.

Use `kind: "replace"` for the merged group unless a backward-compatible schema extension is explicitly justified.

Avoid adding a new public `ChangeKind` solely for this feature.

## 6.6 Preserve unrelated edits

Example:

`чат бот` → `чат-бот!`

The separator replacement and added exclamation mark are conceptually distinct.

The normalization pass must not automatically combine both merely because they are close together.

Likewise, avoid confusing a word-joining hyphen with punctuation used as a sentence dash.

## 6.7 Required tests

Positive:

- `чат бот` → `чат-бот`
- `чат-бот` → `чат бот`
- `чат  бот` → `чат-бот`
- `чат-бот` → `чат  бот`

Negative:

- `Привет мир` → `Привет — мир`
- `чат бот` → `чат-бот!` must not swallow the exclamation change.
- A nearby unrelated spelling correction must remain independently represented.
- Word movements must remain intact.

Include Unicode hyphen variants as separate test cases, with expected behavior documented.

## 6.8 Acceptance criteria

- The primary example produces one understandable group.
- The reverse operation also works.
- Exact spans and offsets remain valid.
- The combined card shows a visible separator replacement.
- No unrelated changes are absorbed.
- No new overlap or marker errors occur.
- The deterministic output remains stable.

## 6.9 Non-goals

Do not introduce broad semantic grouping.

Do not merge all adjacent whitespace and punctuation changes.

Do not change the tokenizer to force a particular result.

---

# 7. Step 4 — Improve punctuation and token-replacement handling

**Priority:** P1  
**Category:** Deterministic diff cleanup  
**Complexity:** Medium  
**Dependencies:** Steps 1–3  
**Deliverable:** Fewer artificial insert/delete cards around punctuation

## 7.1 Objective

Improve how the engine represents punctuation corrections and token replacements.

The target is not to minimize the number of cards at any cost.

The target is to avoid splitting one understandable correction into artificial operations.

## 7.2 Problem A — Token-category mismatch

In the equal-length branch of `changed()`, the code treats a word token paired with a non-word token specially.

It can emit a deletion and an insertion instead of a single replacement.

This may be appropriate for some structural changes, but it should not be the unconditional representation of a one-to-one replacement.

## 7.3 Task 4.1 — Review one-to-one replacements

Introduce a narrow rule for one-to-one unmatched token pairs.

When the alignment establishes a single local replacement, prefer one `replace` group instead of an unrelated deletion plus insertion, provided doing so does not conceal a meaningful split/join operation.

The implementation must inspect the surrounding aligned tokens and any associated gaps.

Do not blindly pair tokens from a large rewritten region merely because their indices match. Step 5 addresses that issue.

## 7.4 Problem B — Punctuation plus spacing

Examples:

`Привет !` → `Привет!`

`Привет ,мир` → `Привет, мир`

`Привет .` → `Привет!`

These may contain combinations of punctuation and whitespace operations.

The user should see a comparison that explains the correction, not a sequence of cards that are individually confusing.

## 7.5 Task 4.2 — Add punctuation-aware cleanup

Extend the normalization layer with explicit local rules.

### Rule A — Punctuation replacement with adjacent whitespace correction

When a punctuation token changes and an adjacent whitespace operation is part of the same local correction, the groups may be merged.

Example:

`Привет .` → `Привет!`

A single comparison can explain both the punctuation replacement and removal of the preceding space.

### Rule B — Whitespace moved across unchanged punctuation

Example:

`Привет ,мир` → `Привет, мир`

Two whitespace operations around the same unchanged comma may be presented as one punctuation-spacing correction.

This is a candidate for grouping because the two operations describe one local formatting problem.

### Rule C — Standalone punctuation insertion

Example:

`Привет` → `Привет!`

Keep this as a clear punctuation insertion.

Do not hide it or merge it with unrelated edits.

### Rule D — Independent punctuation changes

Do not merge punctuation changes that occur at separate locations merely because both involve punctuation.

## 7.6 Guardrails

The cleanup must:

- Operate on actual spans and local token relationships.
- Preserve every changed punctuation character.
- Avoid merging across unrelated unchanged words.
- Avoid merging word movements.
- Avoid treating all whitespace as semantically insignificant.
- Preserve valid comparison contexts.
- Be deterministic.

Keep Step 3's separator-specific rule separate and higher priority where necessary.

## 7.7 Required tests

- `Привет` → `Привет!`
- `Привет !` → `Привет!`
- `Привет ,мир` → `Привет, мир`
- `Привет .` → `Привет!`
- `Привет, мир` → `Привет; мир`
- Multiple independent punctuation corrections in one sentence.
- Punctuation adjacent to a word movement.
- Punctuation with non-breaking spaces.
- Punctuation near the beginning or end of text.

## 7.8 Acceptance criteria

- No comparison card conceals the actual punctuation or whitespace difference.
- One-to-one token replacements do not unnecessarily become separate deletion and insertion cards.
- Related local punctuation-spacing corrections can be represented coherently.
- Independent punctuation corrections remain distinguishable.
- Structural invariants and movement tests pass.

## 7.9 Non-goals

Do not build a Russian punctuation grammar checker.

The model already decides what the corrected text should be. This layer only compares the two texts.

Do not attempt to infer whether the model's punctuation correction is linguistically correct.

---

# 8. Step 5 — Improve alignment behavior for unexpected rewrites

**Priority:** P2  
**Category:** Core algorithm improvement  
**Complexity:** Medium–large  
**Dependencies:** Steps 1–4  
**Deliverable:** More intelligible replacements when substantial phrases change

## 8.1 Objective

Prevent misleading word-to-word comparisons when the model substantially rewrites a phrase.

This must work in both Strict and Rewrite.

## 8.2 Root cause

In `changed()`, equal-length unmatched token regions can be paired positionally.

For example, if two adjacent words are replaced with two entirely different words, the algorithm may create two word replacements even when those pairings have no meaningful relationship.

This can produce misleading explanation cards.

## 8.3 Desired behavior

Distinguish between:

**Clear local replacements**

`был готов` → `была готова`

These can reasonably remain two separate changes.

**Ambiguous phrase rewrites**

`Очень хорошо` → `Просто отлично`

A single phrase-level replacement may be more understandable than two arbitrary word comparisons.

**Single-word substitutions**

A single word replaced by a different word can still be one word-level replacement, even when the words are not visually similar.

Low character similarity alone is not enough to declare every replacement ambiguous.

## 8.4 Implementation strategy

Introduce a confidence assessment for the correspondence of tokens inside unmatched regions.

Suggested helper:

`assessReplacementConfidence(oldTokens, newTokens, context)`

Use deterministic signals such as:

- Whether both tokens are word-like.
- Shared grapheme prefix and suffix.
- Character or grapheme similarity.
- Stable surrounding alignment anchors.
- Whether punctuation boundaries match.
- Number of consecutive unmatched tokens.
- Whether a replacement is isolated or part of a larger rewritten phrase.

The current code already contains a grapheme-based similarity heuristic inside `changed()`. Consider extracting and reusing it rather than creating unrelated similarity logic.

## 8.5 Confidence is not semantic equivalence

A character-similarity score is only evidence about likely alignment.

It does not establish that two words mean the same thing.

Russian inflections often share character sequences, but synonyms may not.

The algorithm must not claim linguistic certainty.

## 8.6 Task 5.1 — Detect ambiguous positional pairing

Before pairing an equal-length unmatched region token by token:

1. Check whether the region contains more than one changed lexical token.
2. Assess the confidence of the proposed pairs.
3. Identify high-confidence local correspondences.
4. Identify stretches where the proposed pairings are weak or arbitrary.

Do not apply phrase fallback solely because one isolated replacement has low similarity.

## 8.7 Task 5.2 — Introduce a conservative fallback

When a multi-token region has insufficient evidence for individual pairings, emit a larger replacement group covering that local phrase.

Preserve all original and corrected changed spans.

Avoid extending the fallback across stable punctuation or lexical anchors when a narrower grouping is possible.

The initial fallback may be coarse. Its purpose is to avoid misleading precision.

## 8.8 Task 5.3 — Preserve clear individual corrections

The following should remain independently understandable:

`Она был готов` → `Она была готова`

The two word changes have strong local correspondence.

Do not introduce a blanket rule that groups every adjacent grammatical correction.

This example is a regression fixture, not a universal grouping law.

## 8.9 Task 5.4 — Preserve bounded computation

Maintain practical complexity limits.

Do not introduce an unbounded quadratic or exponential operation on the full 5,000-character input.

Respect the existing alignment and movement budgets unless benchmarks justify changing them.

Use the Step 1 performance suite to compare before and after.

## 8.10 Feature flag

Introduce the confidence-based fallback behind an internal flag initially.

Run the same fixture corpus through:

- Existing alignment behavior.
- New confidence-based behavior.

Generate a comparison report.

Review cases where group count, spans, or card content differ.

## 8.11 Required tests

- Two related Russian inflection changes.
- Two unrelated words replaced by two other words.
- One unrelated word substitution.
- A phrase with one unchanged anchor in the middle.
- Repeated words.
- Mixed punctuation and word rewrites.
- A substantial rewrite produced in Strict.
- A substantial rewrite produced in Rewrite.
- Long inputs near the application limit.
- Word movements mixed with substitutions.

## 8.12 Acceptance criteria

- Clearly related local corrections remain separate where appropriate.
- Ambiguous multi-word rewrites are not routinely represented as arbitrary positional word pairs.
- No changed content is lost.
- No offset or marker regressions occur.
- Performance remains acceptable against the measured baseline.
- The new behavior improves the reviewed fixture corpus before the feature flag is enabled by default.

## 8.13 Non-goals

Do not add Russian morphological analysis as a prerequisite.

Do not replace `align.ts` wholesale.

Do not introduce embeddings or LLM calls.

Do not hardcode separate algorithms for Strict and Rewrite.

---

# 9. Step 6 — Introduce selective meaningful grouping

**Priority:** P3  
**Category:** Experimental deterministic UX improvement  
**Complexity:** Medium–large  
**Dependencies:** Steps 1–5  
**Deliverable:** A tested grouping policy, enabled only if it improves usability

## 9.1 Objective

Group changes when presenting them together is demonstrably easier to understand.

Avoid the opposite failure: merging several independently useful corrections into one large highlight.

## 9.2 Important distinction

This step is not the same as Steps 3 and 4.

Steps 3 and 4 fix specific structural artifacts caused by the diff representation.

Step 6 addresses a more subjective question:

**When should multiple otherwise valid changes be presented as one correction?**

This is not fully determined by edit distance or token adjacency.

## 9.3 Product constraint

The user has not selected a universal grouping policy.

For one example:

`Она был готов` → `Она была готова`

Separate changes were preferred.

That preference must not be generalized into “always separate grammatical dependencies.”

Likewise, adjacency alone is not sufficient justification for grouping.

## 9.4 Task 6.1 — Create a grouping evaluation dataset

Expand the fixture corpus with examples containing two or more nearby changes.

For each example, record the preferred presentation:

- Separate changes.
- One combined change.
- Either acceptable.
- Unclear; requires user testing.

Use the actual original and corrected texts and the rendered cards.

Include examples from both modes.

## 9.5 Task 6.2 — Build candidate generation

Create a deterministic helper that proposes possible merges of nearby groups.

Initially consider only groups that:

- Are local to the same sentence or short phrase.
- Do not involve word movements.
- Do not cross unrelated stable lexical anchors.
- Have valid non-overlapping changed spans.
- Are already individually valid groups.

A candidate is not automatically an approved merge.

## 9.6 Task 6.3 — Implement conservative decision rules

Start with narrow, explainable conditions.

Possible candidates include:

- A weak standalone insertion/deletion that is inseparable from a neighboring replacement.
- Several fragments of a single local phrase rewrite.
- A correction whose existing individual cards would otherwise be misleading or incomplete.

Reject candidates when:

- Each original/corrected pair is already a clear, independent local correction.
- The merge would create an unnecessarily broad highlight.
- An unchanged word separates unrelated edits.
- The grouping would absorb a distinct punctuation correction without justification.
- The grouping would complicate explanation more than it helps.

**Do not implement a generic “merge changes within N characters” rule.**

Distance may help identify candidates, but it must not be the sole decision criterion.

## 9.7 Task 6.4 — Keep grouping explainable

For debugging and evaluation, record an internal reason for each proposed merge.

Examples:

- `separator-replacement`
- `punctuation-spacing`
- `ambiguous-phrase-alignment`
- `dependent-local-edit`

These reasons need not be exposed in the public `ChangeGroup` schema.

They should help reviewers understand why the engine grouped changes.

## 9.8 Task 6.5 — Compare separate versus merged presentations

Build a simple evaluation view or report showing both alternatives for the same input.

Reviewers should be able to assess:

- Which presentation is easier to understand.
- Whether either hides an important correction.
- Whether the comparison text is natural.
- Whether the highlights are too broad.
- Whether the number of cards feels excessive.

A lower group count is not automatically a better result.

## 9.9 Task 6.6 — Gate deployment on results

Keep new heuristic grouping disabled by default until evaluated.

Enable only rules that show a clear benefit on representative examples without substantial regressions.

If no useful general grouping rule emerges, it is acceptable to ship no additional grouping behavior.

Steps 3–5 may already provide most of the practical benefit.

## 9.10 Required tests

- Two independent adjacent inflection corrections.
- An insertion next to a related replacement.
- Multiple unrelated corrections in one short sentence.
- A phrase rewrite split into awkward fragments.
- A correction involving punctuation and a nearby word.
- A word movement adjacent to another change.
- A rewrite with repeated words.
- A sentence containing three or more independent corrections.

## 9.11 Acceptance criteria

- Grouping decisions are deterministic.
- Every enabled merge has a documented rationale.
- No move groups are merged inadvertently.
- No source spans are lost.
- The preferred grouping wins in reviewed examples more often than the baseline.
- The number of changes is not used as the only quality metric.
- The behavior can be disabled independently.

## 9.12 Non-goals

Do not attempt full semantic parsing of Russian sentences.

Do not infer grammatical dependencies using a large hardcoded rule set.

Do not assume every correction should correspond to exactly one grammatical rule.

---

# 10. Step 7 — Evaluate optional LLM-assisted grouping

**Priority:** P4  
**Category:** Optional experiment  
**Complexity:** Medium–large  
**Dependencies:** Steps 1–6  
**Deliverable:** Evidence-based decision to adopt or reject a low-cost grouping model

## 10.1 Objective

Determine whether a small, inexpensive LLM can improve change grouping beyond the deterministic baseline.

This step is optional.

It must not be implemented merely because the problem involves language.

## 10.2 Product constraints

The application already uses an LLM for explanations.

The explanation system receives:

- Full original text.
- Full corrected text.
- Selected change or manual selection.

An additional grouping call is acceptable only if it provides meaningful value at acceptable cost and latency.

The application uses OpenRouter. A low-cost model such as a suitable Gemma model may be evaluated, but the model choice must remain configurable.

Do not assume a specific model is available or optimal without testing.

## 10.3 Architectural requirement

Do not add an LLM call inside `diffText()`.

Keep the deterministic diff package synchronous and usable independently.

Implement the optional LLM stage in an application-level orchestration layer.

Suggested flow:

1. Run deterministic `diffText()`.
2. Produce validated candidate groups.
3. Optionally ask an LLM whether selected groups should be combined.
4. Validate the response.
5. Apply only permitted grouping operations.
6. Fall back to deterministic output if anything fails.

## 10.4 Restrict the LLM's authority

The LLM must not:

- Rewrite the original text.
- Rewrite the corrected text.
- Invent source offsets.
- Delete corrections.
- Create arbitrary highlights.
- Modify movement semantics.
- Return unvalidated final `TextDiff` objects.

Instead, ask it to recommend merges of existing group identifiers.

Suggested response concept:

`{ merges: [{ groupIds: ["change-2", "change-3"] }] }`

This is illustrative; define a proper schema in the implementation.

## 10.5 Task 7.1 — Prepare the evaluation prompt

Provide:

- Original text.
- Corrected text.
- Existing groups.
- Relevant original and corrected excerpts.
- Explicit instruction to prefer no merge when uncertain.

The model should return structured data only.

The prompt must explain that the objective is user comprehension, not minimum group count.

## 10.6 Task 7.2 — Validate every suggestion

Use schema validation.

Reject suggestions that:

- Reference nonexistent groups.
- Contain duplicate or conflicting group IDs.
- Merge nonlocal unrelated groups.
- Merge movement groups.
- Create invalid ranges.
- Produce overlapping group ownership.
- Remove a change.
- Violate the configured grouping constraints.

The application must be able to apply a suggestion deterministically and safely.

## 10.7 Task 7.3 — Implement a pure merge applicator

Create a separate deterministic function to apply approved merge suggestions.

It must preserve source spans and regenerate any affected group IDs, runs, and markers consistently.

Avoid modifying already-rendered frontend data in place.

## 10.8 Task 7.4 — Add fallback behavior

If the model call:

- Times out.
- Fails.
- Returns invalid JSON.
- Produces an invalid merge.
- Exceeds the configured budget.

Use the deterministic diff.

The application must not fail to show corrections because optional grouping is unavailable.

## 10.9 Task 7.5 — Measure quality

Compare:

- Deterministic baseline.
- Deterministic baseline plus LLM grouping.

Use blind human review where practical.

Measure:

- Preference for one presentation over the other.
- Number of confusing or misleading cards.
- Unwanted merges.
- Invalid responses.
- Added latency.
- Token usage.
- Cost per correction.

Do not judge success only by fewer groups.

## 10.10 Task 7.6 — Protect user privacy

The texts may contain private messages or emails.

Before enabling an additional model call:

- Review existing privacy and data-handling requirements.
- Avoid unnecessary logging of message content.
- Respect the application's current consent and retention behavior.
- Do not send text to a new provider without the required product/privacy review.

## 10.11 Acceptance criteria

The experiment is complete when:

- The model's grouping recommendations can be evaluated against a fixed corpus.
- Invalid output cannot corrupt spans or markers.
- The deterministic fallback works.
- Cost and latency are measured.
- Quality improvement is measured through reviewed examples.
- A documented adopt/reject decision is made.

If the improvement is small or inconsistent, reject the additional LLM stage.

## 10.12 Non-goals

Do not replace the deterministic diff with an LLM.

Do not let an LLM generate arbitrary text offsets.

Do not add a mandatory second model call to every correction without evidence.

---

# 11. Recommended internal architecture

The implementation should evolve toward the following separation:

**Layer A — Tokenization**

Existing `tokenize.ts`.

Responsible for source token boundaries and whitespace gaps.

**Layer B — Alignment and movement detection**

Existing `align.ts` and `word-moves.ts`.

Responsible for identifying corresponding unchanged tokens and certain moves.

**Layer C — Raw change detection**

Existing logic in `text-diff.ts`.

Responsible for identifying low-level changed spans.

**Layer D — Deterministic normalization**

New or extracted helpers.

Responsible for:

- Separator replacements.
- Punctuation-related cleanup.
- Confidence-based phrase fallback.
- Approved deterministic grouping rules.

**Layer E — Public diff construction**

Responsible for:

- Final group ordering.
- Group IDs.
- `originalRuns`.
- `correctedRuns`.
- Markers.
- Structural validation.

**Layer F — Presentation**

Frontend components.

Responsible for:

- Visible whitespace.
- Contextual excerpts.
- Empty-side indicators.
- Highlight rendering.
- Change-card navigation.

**Layer G — Optional LLM grouping**

Application orchestration, outside the core package.

Responsible only for validated, optional grouping suggestions.

## 11.1 Important ordering requirement

The deterministic normalization pass should run before final group IDs and text runs are generated.

Otherwise, merging groups requires repairing already-created public references.

For optional asynchronous LLM grouping, use a separate validated reconstruction path rather than modifying public objects inconsistently.

## 11.2 Do not over-refactor initially

The agent should not attempt to implement all seven layers in one large architectural rewrite.

Extract helpers only when needed for the current step.

Keep diffs reviewable and rollback straightforward.

---

# 12. Quality evaluation framework

A successful diff is not necessarily the shortest diff.

Evaluate the following dimensions independently.

| Dimension              | Question                                                   |
| ---------------------- | ---------------------------------------------------------- |
| Structural correctness | Are all ranges, groups, runs, and markers valid?           |
| Coverage               | Is every meaningful correction represented?                |
| Alignment quality      | Are original and corrected fragments genuinely comparable? |
| Card clarity           | Can the user see what changed?                             |
| Grouping quality       | Are changes divided into understandable units?             |
| Highlight precision    | Is unchanged text unnecessarily highlighted?               |
| Performance            | Is processing fast enough for typical and maximum inputs?  |
| Stability              | Does a local improvement avoid unrelated regressions?      |
| Cost                   | Does any optional LLM step justify its expense?            |

## 12.1 Recommended review labels

For each evaluated case, reviewers may classify the output as:

- Correct and clear.
- Correct but unnecessarily fragmented.
- Correct but excessively grouped.
- Misleading alignment.
- Invisible or confusing whitespace.
- Missing or incorrectly represented change.
- Structural bug.

This is more useful than relying exclusively on a single numeric quality score.

## 12.2 Baseline comparison

For every behavior-changing release:

1. Run the complete corpus against the previous implementation.
2. Run it against the candidate implementation.
3. Compare changed group counts and span boundaries.
4. Inspect all cases whose presentation changed.
5. Run structural and performance tests.
6. Record intended improvements and known regressions.

Do not accept a change solely because it improves the example that motivated it.

---

# 13. Release plan

## Release 1 — Reliability and visibility

**Includes:** Steps 1 and 2.

Goal: Eliminate invisible or misleading whitespace presentation and establish reliable regression testing.

Exit criteria:

- Automated test baseline exists.
- Whitespace corrections are visibly understandable.
- No diff-engine behavioral change is required.

## Release 2 — Separator and punctuation cleanup

**Includes:** Steps 3 and 4.

Goal: Reduce artificial change fragmentation caused by tokenization and whitespace handling.

Exit criteria:

- `чат бот` → `чат-бот` is one coherent correction.
- Punctuation-related corrections produce understandable cards.
- Existing word movements remain valid.
- No structural regressions.

**Evaluate user experience after this release before committing to more complex work.**

## Release 3 — Rewrite robustness

**Includes:** Step 5.

Goal: Avoid misleading positional comparisons in substantial phrase rewrites.

Exit criteria:

- Clear local corrections remain understandable.
- Ambiguous phrase rewrites are handled more conservatively.
- Performance remains acceptable.

## Release 4 — Selective grouping

**Includes:** Step 6, if evaluation supports it.

Goal: Improve meaningful grouping beyond structural cleanup.

Exit criteria:

- Documented rules outperform the baseline in representative examples.
- No broad, unjustified merging behavior is introduced.

## Experimental release — LLM grouping

**Includes:** Step 7, only if justified.

Goal: Determine whether an additional model provides sufficient quality improvement.

Exit criteria:

- Validated output.
- Reliable fallback.
- Measured latency and cost.
- Clear quality benefit.

---

# 14. Instructions for the coding agent

For each step, follow this workflow.

## Before implementation

1. Inspect the current repository and relevant tests.
2. Identify the exact functions and frontend components affected.
3. Compare current code with the architecture described in this specification.
4. Note any discrepancies.
5. Confirm that the step's intended behavior is not already implemented.
6. Identify relevant existing tests and regression risks.

## During implementation

1. Keep the change focused on the current step.
2. Add or update tests alongside the implementation.
3. Preserve public API compatibility where possible.
4. Avoid unrelated refactoring.
5. Do not introduce external dependencies without clear justification.
6. Do not change the proofreading or rewriting prompts.
7. Do not change the explanation LLM's input contract unless explicitly required.
8. Do not implement future roadmap steps opportunistically.

## After implementation

Provide a concise report containing:

- Files changed.
- Root cause addressed.
- Implementation approach.
- Before/after examples.
- Tests added.
- Test results.
- Performance impact, if relevant.
- Remaining limitations.
- Any decisions requiring product approval.

Do not claim success for tests that were not executed.

## Definition of done for every step

A step is complete only when:

- Its acceptance criteria are satisfied.
- Relevant automated tests pass.
- No known structural invariants are violated.
- Relevant UI behavior has been verified where applicable.
- The implementation can be reviewed independently.
- Known limitations are documented.

---

# 15. Decisions deliberately left open

The following should not block Steps 1–5.

## Decision A — Should whitespace-only corrections always have cards?

Options:

- Always show.
- Apply silently.
- Group with nearby edits where appropriate.
- Use different policies depending on context.

**Interim decision:** Show them with clear visual representation.

Revisit after gathering feedback from the improved UI.

## Decision B — How aggressively should grammatical changes be grouped?

**Interim decision:** Preserve clear independent local changes; merge only with a specific reason.

Do not impose universal grammatical grouping rules.

Revisit during Step 6.

## Decision C — Should Strict and Rewrite have different grouping policies?

**Interim decision:** Use the same core diff engine and assess the actual differences.

Mode-specific presentation can be tested later, but substantial rewrites must be handled correctly in either mode.

## Decision D — Is an additional LLM grouping call worthwhile?

**Interim decision:** No additional call in production.

Evaluate only after the deterministic improvements have been measured.

---

# 16. Explicit exclusions

This roadmap does not authorize the agent to:

- Replace the entire diff engine.
- Change the corrected text produced by the language model.
- Introduce automatic acceptance/rejection of changes.
- Remove manual text selection.
- Hide punctuation corrections globally.
- Hide all whitespace corrections.
- Merge every adjacent edit.
- Implement full Russian morphological parsing.
- Add mandatory LLM grouping.
- Change public range offsets.
- Rewrite the UI outside the affected comparison and highlighting components.
- Perform all seven steps in one pull request.

Each improvement should remain independently reviewable.

---

# 17. Final implementation priority

The recommended order is:

**1. Regression framework → 2. Visible whitespace → 3. Separator replacement normalization → 4. Punctuation cleanup → 5. Rewrite alignment confidence → 6. Selective grouping evaluation → 7. Optional LLM experiment.**

The first four steps address concrete problems already identified in the implementation and screenshots.

The fifth step addresses a genuine algorithmic limitation.

The sixth and seventh steps are conditional improvements whose value must be demonstrated rather than assumed.

**The overall objective is not to create the most sophisticated diff algorithm. It is to make Грамика's corrections consistently understandable to its users.**
