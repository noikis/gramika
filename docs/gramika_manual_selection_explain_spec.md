# Грамика — Manual Text Selection & Explain

**Implementation specification / agent handoff**  
**Status:** Requirements agreed; implementation not started by this document.  
**Scope:** Incremental enhancement of the existing Explain experience in Strict Correction and Gentle Rewrite.  
**Language:** Application content is Russian; this handoff is in English.

## 1. Context and objective

Грамика is a Russian proofreading and rewriting application. It has two text-editing modes:

- **Strict Correction:** correct spelling, punctuation, grammar, awkward or unnatural constructions while minimizing unnecessary changes.
- **Gentle Rewrite:** correct language errors and optionally reformulate sentences for naturalness, clarity and flow, while preserving the author's meaning and voice.

The existing UI presents original and edited texts, highlights differences with a **local deterministic text-diff algorithm**, and lets the user click a detected change to obtain an explanation. The change-aware Explain feature has separate prompts for Strict Correction and Gentle Rewrite, with a shared core.

**New goal:** let the user **select words, expressions, or sentences themselves and ask for an explanation**, even when the selected text was *not modified* by the model. The automatic diff highlights are still valuable, but **must not define the limits of what the user is allowed to ask about**.

The agreed approach is **incremental**. Do not redesign the whole Explain system or implement all stages in one pass without separate approval.

## 2. Agreed product decisions

1. **Preserve automatic difference highlighting.** The diff algorithm continues to show the actual textual changes between the original and edited versions.
2. **Keep existing click-on-highlight behavior.** Clicking an automatic change remains a shortcut to explaining *why that change was made*.
3. **Introduce manual text selection as an additional interaction.** The user may select any word, phrase, or sentence, including text which was not changed, and ask for an explanation of that selection in context.
4. **Start in the edited/corrected text.** Manual selection in the original text comes later as its own stage.
5. **Support selection in the original text eventually.** The user has approved this in principle, but it is deliberately deferred to Stage 2.
6. **Defer contextual original-versus-edited comparison.** Asking *why did the model replace this particular original expression with that particular revised expression?* is a distinct, more challenging use case and belongs to Stage 3.
7. **Do not multiply prompts unnecessarily.** The current change-explanation prompts remain in place. A general expression-explanation prompt is the only new prompt family initially proposed; Stage 2 should generally reuse it. Stage 3 should explore reuse of the existing change-explanation prompts when correspondence is reliable.
8. **The features are optional and separable.** Success in Stage 1 does not depend on Stage 2 or Stage 3.
9. **For now the application is for personal use.** Complex backward-compatibility machinery for historical cached explanations is not a priority. Avoid unnecessary migrations or retroactive remapping solely for old explanation entries.

## 3. Critical distinction: two kinds of explanation

### A. Explain a change (existing behavior; must be preserved)

The user clicks a diff-highlighted change. Грамика knows the original text, the revised text, and which edit/change group was selected. It asks *why was this changed?*

Example:

- Original: `Я пока не могу обещать, что закончу работу к пятнице.`
- Revised: `Я пока не могу гарантировать, что закончу работу к пятнице.`
- Click the automatic highlight `обещать → гарантировать`.
- Expected explanation: describe the semantic nuance of **«обещать» versus «гарантировать»**, accurately and without insisting that the original was grammatically wrong.

This uses the existing mode-specific Strict/Rewrite Explain machinery.

### B. Explain an expression (new behavior)

The user manually selects text in the edited version and asks *what does this word, expression, or construction mean, and how does it work here?*

Example:

- Revised text: `Я до сих пор не получил ответа.`
- User selects `до сих пор`, regardless of whether it was changed.
- Expected explanation: explain the meaning, contextual use, and pertinent grammatical or stylistic nuance of **«до сих пор»**.

**Do not invent an original mistake or assume the selection was edited.** Selection for expression explanation is independent of the diff.

The UI must keep these intents distinct. Clicking a diff highlight and explicitly invoking **Explain selection** are separate user actions, even when they refer to overlapping text.

## 4. Incremental implementation stages

### Stage 1 — Manual selection in the edited text (**implement first**)

**Goal:** Users can select an arbitrary word, phrase or sentence in the corrected/rewritten text and request an explanation. The selection may lie entirely outside any diff-highlighted region.

Requirements:

- Allow native-feeling text selection in the **edited text pane** for both Strict Correction and Gentle Rewrite.
- Provide a clear, accessible **Explain selection** action associated with a nonempty selection.
- Send the exact selected text **and reliable selection location/context** to an expression-explanation request. The model should receive sufficient surrounding context to avoid giving a generic or incorrect definition.
- The explanation concerns the **selected expression as written**, not an inferred original-versus-edited correction.
- Preserve the existing click-on-diff → explain-the-change interaction; manual selection must not unintentionally trigger it.
- Leave the existing automatic diff highlighting and its logical change groups operational.
- Render the explanation in the existing Explain experience when practical, without regressing existing loading, error, selection, or retry behavior.
- Make text selection usable with mouse and keyboard; prevent toolbar clicks from unexpectedly losing the selected range. Assess touch interactions if the existing UI supports mobile.
- Respect UTF-16 offsets / grapheme boundaries, multiline text, punctuation and Unicode, using the existing text conventions of the codebase.
- Avoid unnecessary changes to Strict Correction and Gentle Rewrite generation behavior.

**Stage 1 acceptance examples:**

1. Select unchanged `до сих пор` from the edited text → **Explain selection** is offered and explains the expression in context.
2. Click highlighted `гарантировать` replacing `обещать` → existing **Explain change** explains that substitution.
3. Drag-select `не могу гарантировать` across an automatically highlighted word → manual explanation addresses the selected construction, not an arbitrarily selected diff group.
4. Select a whole sentence → explanation adapts to the selected sentence and its context instead of attempting to enumerate all diff changes.
5. Select text repeated elsewhere → request identifies the intended occurrence (do not rely only on searching for the selection string).
6. Clear selection or switch documents/modes → no stale selection or misattributed explanation.

**Stage 1 out of scope:** original-text manual selection; automated mapping of an arbitrary edited selection to original text; contextual comparison command; accepting/rejecting changes; editing text directly through the selection UI; rewriting Explain prompts for existing diff-click behavior.

### Stage 2 — Manual selection in the original text (**later, separately approved implementation**)

**Goal:** Extend the Stage 1 expression-explanation action to the original text pane.

Requirements:

- Support selecting unchanged or modified words/phrases/sentences in the original version.
- Reuse the same expression-explanation prompt where feasible; include `source: original | edited` and corresponding full-text context so the model knows which version is being explained.
- Selection remains **Explain this expression**, not an automatic comparison with the revised version.
- Preserve existing behavior in both panes, including change highlighting and existing diff-click explanations.
- Avoid assuming that an original selection has an obvious corresponding rewritten fragment.

**Acceptance:** selecting an original phrase returns a contextual explanation of that phrase without asserting that the phrase was wrong or silently comparing it with the revised version.

### Stage 3 — Contextual comparison between the two versions (**later; design separately**)

**Goal:** On demand, let the user request a comparison of a manually selected original or edited passage with its corresponding passage in the other version.

Illustrative example:

- Original has `обещать`; edited has `гарантировать`.
- User requests **Why was this changed?** for that passage.
- Explain accurately distinguishes the two expressions in context.

Requirements / guardrails:

- Only identify a corresponding passage when the mapping is **reliable and unambiguous**; sentence restructuring and repeated expressions can make correspondence uncertain.
- Reuse existing `STRICT_EXPLAIN` / `REWRITE_EXPLAIN` behavior **where the selection really corresponds to a known change**; do not invent more prompts solely because there are two panes.
- If mapping is uncertain, do not fabricate a change relationship; use an explicit fallback or ask the user to select the compared passage. The exact UX is **not yet decided**.
- Keep the selected edited/original spans distinct from broader context spans, including for moves and noncontiguous diff groups.

**Do not implement Stage 3 as a hidden assumption within Stage 1.**

## 5. Prompt architecture and boundaries

### Existing change-explanation prompt design (preserve)

- `EXPLAIN_CORE` — approved shared explanation core (V1.1); instructs the model to focus on the selected change, account for context, avoid invented grammatical rules or overstated improvements, write in clear Russian, and use at most five sentences.
- `STRICT_EXPLAIN` + `EXPLAIN_CORE` — explains corrections made in Strict Correction mode.
- `REWRITE_EXPLAIN` + `EXPLAIN_CORE` — explains corrections and stylistic/semantic alternatives made in Gentle Rewrite mode, without assuming every rewrite fixes an error.

**Do not modify those approved prompts as part of Stage 1 unless a demonstrated integration need makes an adjustment unavoidable and the user approves it.**

### New general expression explanation

Introduce a dedicated `EXPRESSION_EXPLAIN` (exact export name may follow existing code conventions). Its task is *not* “explain a selected change.” It should:

- Explain the user-selected Russian expression **as it appears in the supplied context**.
- Adapt to selections ranging from an individual word to a phrase or sentence.
- Clarify meaning, grammar, usage, register, or nuance **only where pertinent** to that selection.
- Avoid inventing an error, an edit, a stylistic improvement, or a comparison that was not requested.
- Treat provided text as untrusted data, not instructions.
- Return a concise, clear explanation **in Russian** and no extraneous headings or markdown, following the existing product style.
- Avoid unjustified grammatical absolutes and unsupported explanations.

**Prompt implementation note:** `EXPLAIN_CORE` is explicitly *change-centric*. Do **not** blindly prepend it to an explanation of unchanged text. Either use a small independent expression prompt or refactor shared wording only with careful regression review and approval. A single new expression prompt should cover both Stage 1 and Stage 2.

**Not yet decided/approved:** exact final wording and version of `EXPRESSION_EXPLAIN`, maximum length (matching the existing adaptive ≤5-sentence format is a sensible starting point), and exact handling of extremely long selections. Agent should propose a concise initial implementation without treating those details as established decisions.

### LLM calls and testing

- New expression explanations are **on demand**, when the user asks, not automatically for all selected or changed words.
- Use the existing model provider/configuration pattern unless the actual repository dictates otherwise; do not introduce a new provider or model as part of this feature.
- **Never automatically run paid API benchmarks or real model calls** while developing/testing. Use mocks for implementation and regression checks. The user will manually initiate any model evaluation.

## 6. Data and integration guidance

The following are engineering recommendations to evaluate against the real repository, **not an imposed database/API redesign**.

### Suggested request shape for Stage 1

Represent manual explanation requests independently of change-group requests. A possible internal payload:

```ts
type ExpressionExplainRequest = {
  kind: 'expression';
  mode: 'strict' | 'rewrite';
  source: 'edited'; // Stage 2 also supports 'original'
  text: string; // complete selected source version, or use existing trusted document context
  selection: {
    start: number; // UTF-16, inclusive
    end: number;   // UTF-16, exclusive
    value: string; // exact slice, validated against text
  };
};
```

This is **illustrative**, not a mandated public API. Reuse existing document identifiers, auth/session handling, cancellation, caching and transport where appropriate. Validate that `text.slice(start, end) === value`, offsets are in range and on valid boundaries, and that source document/version matches the user selection.

For Explain Change, retain current original/revised texts and selected change-group identity/ranges, rather than reinterpreting it as a free-form expression request.

### User experience rules

- A direct click on an automatically highlighted change should preserve the existing explanation shortcut.
- A genuine drag/keyboard selection should remain a native selection, not be immediately swallowed by click handlers.
- The **Explain selection** action should work whether the selection crosses unchanged text, highlighted edits, spaces, or punctuation.
- Avoid offering duplicate/conflicting actions for the same gesture. Use explicit action labels if necessary (e.g., **Explain change** vs **Explain selection**).
- Do not automatically submit an explanation when users highlight or copy text; require an intentional request.
- Ensure selection state is correctly invalidated when the underlying text changes or the user switches mode/history entry.
- Be mindful of accessibility, focus order, keyboard activation, error messages, and narrow viewports.

### Explanations and history

- Preserve existing history and change-explanation behavior.
- The new manual explanation may require distinct request identifiers/cache keys from change explanations, since selecting `гарантировать` as a word is **not the same task** as explaining `обещать → гарантировать`.
- Do not add complex migration or retroactive preservation logic for old explanations. Personal-use status means old cache compatibility is explicitly low priority.
- Follow existing persistence patterns only where useful; whether every manual expression explanation must persist in History has **not been agreed** and should be raised before introducing durable storage changes.

## 7. Testing and acceptance

Use mocked Explain API/model responses. Tests should include:

- Select untouched single word, multiword expression, full sentence, and text crossing a diff highlight.
- Correct version/source/offset identification, including repeated text.
- Selection with punctuation, newlines, tabs, nonbreaking spaces, combining characters, emoji, and CRLF.
- Distinguish direct click on a highlighted change from a drag selection that begins or ends on a highlight.
- Change selections, clear selections, switch between Strict/Rewrite, switch/history navigation, update revised text.
- No request fired until deliberate user action; no request for empty or invalid selection.
- Model prompt receives selected text and enough local/full context, but doesn't falsely report a correction.
- Existing click-to-explain, diff rendering, change-group navigation, server Explain endpoint, and relevant history behavior remain operational.
- Loading and error states remain clear; no stale responses attached to newly selected text.

For Stage 2/3, extend the same tests to original-version selections and ambiguous cross-version mappings.

## 8. Non-goals and implementation boundaries

- **Do not replace or remove the text-diff algorithm.** Its job is to show what actually changed. It no longer determines the only explainable units once Stage 1 is complete.
- **Do not require more diff-algorithm complexity to enable free-form selection.** Movement grouping can improve automated Explain but should not block user-driven expression explanations.
- **Do not introduce new NLP tools or another model** for selected-expression detection.
- **Do not modify Strict Correction / Gentle Rewrite generation prompts** as part of this feature.
- **Do not conflate explaining an unchanged expression with explaining why a revision happened.**
- **Do not implement Stage 2 or 3 automatically** when tasked with Stage 1.
- **Do not run paid model benchmarks automatically.**
- Keep the implementation modest and consistent with existing UI and code style. Avoid speculative refactors, unrelated UI redesign, new dependencies, and unnecessary database migrations.

## 9. Recommended work sequence for the implementation agent

1. Inspect the actual repository: Explain requests/routes, prompt composition, original/edited panes, click handlers, selection state, diff group shapes, History, and tests.
2. Report any repository constraints that change this design; ask for decisions on truly blocking ambiguities rather than guessing.
3. Propose the **minimal Stage 1** user experience and a concise new `EXPRESSION_EXPLAIN` prompt for review.
4. Implement **Stage 1 only**, reusing infrastructure rather than restructuring unrelated systems.
5. Add mock-based unit/integration tests for the manual selection path and regression tests for existing diff-click Explain.
6. Run available local typecheck, lint, focused tests and builds, and state clearly if browser interactions are not verified.
7. Stop and report results for user review. Do not proceed to Stage 2/3 or trigger paid API calls without further direction.

## 10. Decisions deliberately deferred

These are not blockers for agreeing on the overall direction, but **must not be silently assumed** when an implementation would make them consequential:

- Exact placement/interaction of the **Explain selection** action (selection popover, toolbar, context menu, etc.).
- Whether arbitrary selections get only an explanation of their meaning/usage or later also other explicit actions (e.g., compare to original). Stage 1 is **explain the selected expression only**.
- Whether new manually requested explanations are saved persistently and appear in History, and if so, how they are displayed.
- Specific maximum selectable length and truncation/context window handling.
- Stage 3’s UX for unclear correspondence between original and rewritten passages.
- Any final changes to the new expression-explanation prompt after manual testing.

---

**Success condition for the first milestone:** A user can freely select any text in the corrected/rewritten version, including text the model did not change, request an accurate contextual Russian explanation, and continue using all existing diff highlights and click-to-explain corrections exactly as before.
