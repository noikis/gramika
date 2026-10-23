# Грамика — Text-Diff Stabilization & Integration Handoff

**Status:** Implementation instructions for a coding agent  
**Scope:** Fix two identified defects in the existing text-diff implementation; preserve its proven behavior and support the separate Manual Text Selection & Explain roadmap.  
**Source reviewed:** `text-diff(1).zip` (`text-diff/src/`, supplied October 2026).  
**Related specification:** `gramika_manual_selection_explain_spec.md` (implement its Stage 1 separately; this document does **not** authorize all three stages at once).

## 1. Objective and changed product priorities

Грамика has Strict Correction and Gentle Rewrite. Both display precise differences between the original and edited Russian text. Users can click an automatically detected change to request an explanation.

A **separate, incremental** feature will allow users to select **any text** and ask about its meaning, grammar, or usage, including unchanged text. The first stage applies to the **edited** text only; selection in the original text and contextual original-versus-rewrite comparisons are later stages.

**Updated responsibility boundary:**

- **Text diff:** Deterministically detect and present changes, maintain exact highlighting, and provide existing click-on-change selections.
- **Manual selection (separate feature):** Let the user decide what expression to explain, whether or not it changed. This must not depend on a diff group.
- **Explain:** Use the appropriate existing change-explanation workflow for clicked diffs and a separate general expression-explanation workflow for manually selected text.

The diff algorithm **still needs the two fixes below**. Manual selection does not correct the movement-detection or performance problems. At the same time, diff grouping **no longer needs to approximate linguistic understanding at all costs**; focus on reliability, readability, and speed rather than expanding heuristics.

## 2. Current architecture — preserve it

The supplied package already has a reasonable layered design:

- `src/tokenize.ts`: Russian-aware segmentation with `Intl.Segmenter`, exact UTF-16 offsets, grapheme-safe boundaries, sentence ranges.
- `src/align.ts`: bounded token alignment with coarse fallbacks.
- `src/word-moves.ts`: movement interpretation with explicit work limits and ambiguity handling.
- `src/text-diff.ts`: `diffText()` orchestration, draft changes, whitespace and punctuation handling, groups, rendering runs and markers.
- `src/diff-types.ts`: types including `ChangeGroup`, `TextDiff`, `originalSpans`, `correctedSpans`, `originalRange`, `correctedRange`, and `ChangeMarker`.

**Keep the distinction between exact changed spans, logical change groups, and wider comparison context.** Preserve noncontiguous spans for an unambiguous movement. Preserve existing API/contracts unless a fix demonstrably requires a narrowly scoped, compatible change.

The earlier isolated review found correct behavior for basic word replacements, punctuation-only edits, splits/joins, separate agreement edits, the simple «пока» relocation, and ambiguous two-word swaps. Randomized invariant checks passed in that review. **Do not interpret these observations as a complete integration test**; validate them again after changes.

## 3. Required fix A — detect local movements despite sentence-count changes

### Observed defect

In the supplied `src/text-diff.ts`, movement detection is guarded by a whole-document condition similar to:

```ts
if (oldSentences.length === newSentences.length) {
  // compare sentences by the same index and search for moves
}
```

If a rewrite adds, deletes, joins, or splits a sentence elsewhere, that guard can disable movement recognition throughout the document. Pairing sentences solely by numeric index is also fragile if sentence boundaries shift.

### Required behavior

- Perform movement analysis within **reliably corresponding local regions** (sentences or bounded subregions), not contingent on the **total** sentence count of the document.
- Use conservative sentence/paragraph alignment or unchanged anchors to identify candidate corresponding regions. Preserve paragraph boundaries; do not freely invent moves between unrelated sentences.
- Preserve the existing movement policy: only classify a move when there is structural evidence and a sufficiently unambiguous pairing. Prefer the **smallest unambiguous relocation** that explains the reordering, rather than mechanically choosing the longest possible phrase.
- If regions cannot be paired reliably, return ordinary insert/delete/replace groups. **Do not mislabel a speculative move.**
- Independent inserted or removed sentences must still be represented completely as edits.
- Do not broaden this task into global semantic movement detection, linguistic parsing, or sentence-rewrite classification.

### Required regression examples

**A1 — movement + unrelated new sentence**

Original:

> Я пока не могу обещать, что закончу работу к пятнице. Мне нужно проверить несколько деталей.

Edited:

> Я не могу пока обещать, что закончу работу к пятнице. Мне нужно проверить несколько деталей. Завтра обсудим сроки.

Expected: recognize **one unambiguous movement of «пока»** within the first sentence; separately represent the new final sentence. The added sentence must not disable local movement detection.

**A2 — movement + another sentence split**

Original:

> Я уже отправил преподавателю документы вчера. Он обещал посмотреть их на этой неделе, но пока ничего не ответил.

Edited:

> Я уже вчера отправил преподавателю документы. Он обещал посмотреть их на этой неделе. Пока он ничего не ответил.

Expected: evaluate **«вчера»** within the corresponding first sentence independently of the split elsewhere. Other changes must remain represented, without invented movement links. If a particular region is ambiguous, fall back conservatively and record why.

**A3 — genuinely ambiguous swap**

Original: `А Б`  
Edited: `Б А`

Expected: no confident claim about which token moved; ordinary changes are acceptable. Ensure deterministic output.

**A4 — repeated words**

Use sentences containing repeated «пока», «уже», or other identical tokens. Do not link the wrong occurrences merely because their strings match.

## 4. Required fix B — strictly bound movement-search cost

### Observed defect

In `src/text-diff.ts`, the move-discovery loop scans candidate windows within sentences before / around calling `resolveWordMoves()`. In `src/word-moves.ts`, the resolution uses a state budget (`MAX_MOVE_STATES`) and a maximum window (`MAX_MOVE_WORDS`). Those inner protections **do not necessarily bound the total cost of finding candidate windows**.

The earlier local review observed seconds-long comparisons for very long, heavily reordered single-sentence inputs; one ~8,000-word synthetic case took approximately **2.8 seconds**. Treat this as a reproduction lead, **not a universal benchmark**.

### Required behavior

- Bound the **entire discovery path**, including candidate enumeration, multiset comparisons, repeated token/window scans, and the number of attempted movement interpretations. A budget only inside `resolveWordMoves()` is insufficient.
- Avoid unnecessary repeated slicing, sorting, and scanning for windows that cannot plausibly represent a move. Choose techniques appropriate to the existing implementation (e.g. candidate caps, cheap prechecks, per-region budgets, or indexed/windowed matching), and **measure** rather than assume improvement.
- Preserve a deterministic, readable, complete fallback once a budget is reached. Fall back to ordinary diffs/coarser changes rather than blocking the UI, dropping edits, or guessing movements.
- Ensure adversarial **repetitive** text and large edits are covered, not only unique-word reorderings.
- Keep the comparison local and deterministic; no LLM requests or network calls.

### Performance verification

Use reproducible tests/measurements on the agent's environment. At minimum:

1. 100–500 words, mostly unchanged with one relocated word.
2. 1,000–3,000 words in one sentence, with a relocated word or short phrase.
3. A substantially larger stress case (such as 8,000 words), verifying bounded fallback.
4. Repeated words and repeated sentences, including a large number of potential but ambiguous matches.
5. Many small independent edits and a large replacement with little common text.

Report **before/after durations, machine/runtime, inputs, and fallback behavior**. Don't invent a universal millisecond SLA unless product requirements establish one. The acceptance goal is that costly pathological input returns promptly and never loses information.

## 5. Existing diff behavior that must not regress

- **Exact reconstruction:** concatenating `originalRuns` and `correctedRuns` reproduces their respective input strings byte-for-byte at the JavaScript string level; no lost whitespace, punctuation, or characters.
- **Complete edit coverage:** every changed region is accounted for; every changed rendering segment belongs to exactly one logical group, and unchanged segments belong to none.
- **Offsets and Unicode:** valid end-exclusive UTF-16 ranges; no split inside grapheme clusters (combining marks, emoji sequences, etc.). Do not normalize or silently convert `е` and `ё`.
- **Whole-word readability:** highlight a changed word as a word; do not highlight unchanged neighboring words simply to make a group look bigger.
- **Separate punctuation:** independent punctuation corrections remain separately selectable (including when a word nearby also changes).
- **Whitespace:** preserve exact tabs, CRLF, multiple spaces, nonbreaking spaces, and blank lines; keep existing visible whitespace/deletion treatment.
- **Split/join:** `по этому → поэтому` remains a coherent selectable change.
- **Conservative adjacent changes:** `Она был готов → Она была готова` should not be automatically fused solely because edits are adjacent or grammatically related. The model can use context when explaining either correction.
- **Phrase substitutions:** retain existing structurally supported grouping; don't aggressively combine nearby replacements just because they can form one English or Russian phrase.
- **Unambiguous moves:** `Я пока не могу точно обещать → Я не могу пока точно обещать` should remain a single understandable movement, with unaffected intervening words unhighlighted.
- **Ambiguity:** repeated tokens and equally plausible alternative movements must not be assigned a falsely confident movement label.
- **Determinism:** equal inputs produce stable change groups/order/IDs in the context of a given comparison.
- **Large-input fallback:** preserve all text and valid spans even if movement classification becomes unavailable.

## 6. Integration boundaries: Explain, manual selection, History

### Keep existing click-on-change Explain

- A user clicking a diff-highlighted word or any linked movement span still selects its logical diff group.
- The existing comparison inspector and Explain request continue to distinguish **exact changed spans** from **wider original/edited passages** supplied for context. Don't represent the complete passage as edited merely to make an explanation possible.
- Check multi-span movement selections against the existing API. If the current representation is misleading, propose the **smallest compatible fix**; do not redesign all prompts or APIs in this task.

### Support manual text selection by leaving it independent

The related manual-selection specification introduces a separate interaction in phases. **Do not force manually selected text to match a diff group.** A user must eventually be able to select unchanged text, which a diff group cannot represent.

- **Stage 1 (approved separate work):** arbitrary selection in edited text, with expression explanation.
- **Stage 2 (deferred):** selection in original text.
- **Stage 3 (deferred):** semantic comparison of selected original and edited expressions.

This diff-fix task must **not** implement Stages 2 or 3, and should not independently implement Stage 1 unless the agent has been explicitly tasked with it. Do not change the diff algorithm primarily to anticipate deferred manual-selection functionality.

### Preserve current application integration

Validate current shared behavior in Workspace, History, keyboard/click navigation, selection markers, and Explain using mocked/server-local tests where the repository permits.

**Old explanation compatibility is not a requirement:** Грамика is currently for personal use. Do not add a database migration, legacy cache migration, elaborate re-keying, or a new persistence layer just to preserve pre-upgrade explanation selections. Still prevent incorrect explanation reuse during normal operation; don't associate an explanation with a different current selection.

## 7. Explicit non-goals / what not to touch

**Do not:**

1. Replace the word-aware diff engine with LLM-generated changes or introduce an API call for diffing.
2. Rewrite `diffText()` and its public contract wholesale when localized fixes suffice.
3. Remove accurate automatic highlighting or the existing click-to-explain shortcut.
4. Add speculative linguistic grouping, Russian NLP, POS tagging, or grammar-dependency classification.
5. Merge adjacent edits solely by distance or perform aggressive phrase-level grouping.
6. Change approved `EXPLAIN_CORE`, `STRICT_EXPLAIN`, or `REWRITE_EXPLAIN` prompts, correction prompts, LLM model settings, or reasoning settings.
7. Implement the deferred original-text selection or contextual-comparison stages.
8. Add new dependencies or a database migration without a demonstrable blocker and user approval.
9. Change unrelated UI layouts, styling, feature behavior, or backend flows.
10. Run paid API benchmarks, automatically call OpenRouter/Gemma/Gemini, or trigger production work during verification.
11. Overwrite unrelated working-tree modifications.
12. Commit, merge, push, or deploy. Stop after implementation, testing, and a review report.

## 8. Implementation sequence

1. **Inspect the current repository** and verify its active diff implementation matches the supplied archive; do not blindly copy the archive over newer code.
2. Capture **failing regression tests before making changes** for the sentence-count and performance issues, plus key existing invariants.
3. Fix sentence/region correspondence and local move recognition while retaining conservative ambiguity handling.
4. Apply an **outer search/work budget** and other targeted performance improvements; verify fallback completeness.
5. Re-run the full diff regression suite and add the edge cases described above.
6. Check existing Workspace/History/Explain integration using available mocked tests. Browser behavior may only be claimed verified if actually exercised.
7. Run focused typechecking, lint/format checks, tests, and relevant builds; do **not** run any paid model benchmark.
8. Provide a concise report containing modified files, why each change was needed, before/after regression results, performance measurements, remaining limitations, and any unverified UI behavior. **Stop for user review.**

## 9. Acceptance checklist

- [ ] Sentence additions/removals/splits elsewhere no longer globally disable an otherwise clear local move.
- [ ] A clear local movement remains one logical change; ambiguous swaps remain conservative.
- [ ] The expensive movement candidate search is demonstrably bounded, including on repetitive large inputs.
- [ ] Fallback reconstructs both texts exactly and retains all changes.
- [ ] Whole-word, punctuation, whitespace, split/join, and independent-correction behavior does not regress.
- [ ] UTF-16 and grapheme boundaries remain valid; noncontiguous movement spans stay precise.
- [ ] Current click-on-highlight Explain functionality still works independently of forthcoming manual text selection.
- [ ] Existing approval-tested Explain prompts and model behavior are untouched.
- [ ] No backward-compatibility migration for old explanation caches was added.
- [ ] No paid benchmarks, new dependencies, unrelated changes, commits, pushes, or deploys occurred.
- [ ] Agent supplies tests, measurements, and a clear summary of any unverified integration behavior.

## 10. Decision rule for unexpected complications

Prefer the **smallest reliable diff and a conservative fallback** over speculative movement labels or broad architecture changes. If a constraint cannot be met without changing public contracts, major UX behavior, or unrelated systems, document the trade-off and ask for approval before broadening scope.
