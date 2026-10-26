# Feature: Manual selection in original text

**Status:** verified
**From build-plan:** feature 3.4
**Build attempt:** 1
**Branch:** master

## Goal

Extend the V3.3 expression-explanation flow so users can select any nonempty word, phrase, sentence, punctuation, whitespace, or Unicode passage in the current Original text and request a contextual Russian explanation. Original selection is an expression explanation only; it must not infer or compare a correction.

## Design reference

- `docs/gramika_manual_selection_explain_spec.md`, Stage 2
- V3.3 implementation and archive: `blueprint/history/features/V3.3-manual-selection-in-edited-text.md`

## In scope

- Native-feeling mouse and keyboard selection in the editable Original textarea while a current successful result is available.
- An accessible **Explain selection** action below the Original pane for a valid nonempty selection.
- Exact UTF-16, end-exclusive `originalRange` and selected `value`, validated against the current correction request's original text and request ID before generation.
- A discriminated expression request with `source: original`, reusing the V3.3 expression prompt and the current Strict/Gentle Rewrite mode and model configuration.
- Full original text as model context; the selected expression is explained as written, without claiming it was wrong and without silently comparing it to the edited result.
- Separate cache identity from edited selections and existing diff explanations; persist successful explanations through the existing explanation storage and show them in History as original selections.
- Clear or invalidate the selection when the draft, request, mode, or active correction changes; do not expose an action for empty, stale, or invalid selections.
- Preserve existing correction submission, edited-text selection, diff highlighting, diff-click explanations, retry/error/loading behavior, and soft-delete behavior.

## Out of scope

- Stage 3 original-versus-edited comparison or automatic correspondence mapping.
- Editing the Original text through the explanation action, accepting/rejecting changes, new NLP tooling, new models, benchmark calls, or unrelated UI redesign.
- Changes to the approved Strict Explain, Rewrite Explain, or expression prompt wording unless a demonstrated contract issue requires it.

## Build loop

Implement one small step at a time on the current checkout. Run focused server tests after logic changes and the documented contracts, server, and web lint/build checks after all steps. Browser verification uses local mocked API responses only; do not make paid model calls or run benchmarks.

## Build steps

- [x] **1. Extend the expression contract and server validation for original selections.** Add the `source: original` variant with an exact original UTF-16 range/value, validate source ownership, mode, range boundaries, surrogate boundaries, and value equality against the server-owned original text, and preserve the existing edited and diff request contracts byte-for-byte.
  **Done when:** contracts build; invalid, stale, empty, surrogate-splitting, mismatched-value, and wrong-source inputs are rejected; mocked prompt tests confirm original context is supplied as data without comparison instructions.

- [x] **2. Extend persistence and lookup identity.** Store and retrieve original expression selections distinctly from edited expressions and diff groups, preserve request metrics and deletion behavior, and keep saved records readable in History without inventing corrected ranges or a comparison.
  **Done when:** mocked server tests cover lookup reuse, one generation, concurrent duplicate requests, failure/retry, metrics, parent deletion, coexistence with edited and diff explanations, and exact source/range identity.

- [x] **3. Add Original-pane selection UI.** Capture native textarea selections without disrupting editing or correction submission, retain the exact range when the action is activated, show **Explain selection** only for a valid current selection, and render loading, success, retry, error, and stale-selection behavior using the existing expression panel.
  **Done when:** component/browser checks cover unchanged and changed originals, repeated text, punctuation, whitespace, multiline text, Unicode/emoji/combining characters, clearing, draft edits, mode changes, and direct diff-click behavior; no request is sent before deliberate activation.

- [x] **4. Show original expression explanations in History and finish regression checks.** Display saved original selections with source labeling and no fabricated edited fragment, preserve edited expression and diff explanation behavior, and complete the documented verification gates.
  **Done when:** history fixtures show original selections, metrics, reuse, and retry states correctly; contracts build, server tests, server lint, web lint, web build, and diff checks pass; manual browser verification uses mocks only.

## Files / areas

- `packages/contracts/src/explanation.ts`
- `apps/server/src/explanation/prompt.ts`, `service.ts`, `types.ts`
- `apps/server/src/routes/explanations.ts`
- `apps/server/src/database/repositories/explanation-repository.ts`, `schema.ts` only if required
- `apps/server/test/explanation.test.ts`
- `apps/web/src/components/correction-workspace.tsx`
- `apps/web/src/components/explanation-panel.tsx`, `explanation-request-metrics.tsx`, related styles
- existing History and selection tests/components

## Data / contracts

An original expression request is a distinct discriminated request carrying the correction `requestId`, current `mode`, `kind: expression`, `source: original`, `originalRange` (UTF-16, inclusive start/exclusive end), and `value` equal to the server-owned original text slice. The client does not submit replacement text as authoritative context. The server resolves the full original and corrected texts from `requestId`; the expression prompt receives the full original text and selected original expression context, while the edited text is not used as a comparison target.

The selection key includes source, request ID, mode, range, and value, so the same text/range in original and edited panes never shares a cache entry. Saved attempts retain source and selection data; History labels the selected expression as original text and does not fabricate an edited range or change relationship.

## Testing

Use mocked transport and API responses only. Cover contract validation, prompt construction, persistence, cache identity, concurrent de-duplication, errors, metrics, deletion, and UI selection state. Preserve V3.3 edited-selection, existing diff-click, correction, History filtering/detail, and V3.1 text-diff regression coverage. Do not invoke `npm run benchmark`, the benchmark entry point, or any paid model request.

## Notes for the AI

Reuse the V3.3 expression flow and the existing editable textarea. The action must be below the Original pane and must not replace the correction controls. Selection state is tied to the current successful request: if the draft changes, clear it and require a new correction before explaining. Keep the source distinction explicit in server validation, persistence, metrics, and History.

## Open questions

None blocking. Stage 2 reuses V3.3's approved action placement, History persistence, character limit, prompt family, and local-mock verification boundary.
