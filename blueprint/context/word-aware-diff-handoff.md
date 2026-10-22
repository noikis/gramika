# Word-aware diff with conservative grouping — implementation handoff

**Recorded:** 2026-10-22.
**Status:** Implemented locally on the approved feature branch. The sections below
are the implementation specification; current verification evidence and remaining
limitations are recorded in `current-feature.md`. Migration was exercised only
against synthetic test databases; no production migration was performed.
**Start condition:** Wait until the other agent's active work is finished and the
user says this checkout is ready. Use the ordinary repository checkout, not the
managed worktree created earlier in this chat. Do not replace another feature's
`current-feature.md`. Promote this handoff to the active spec only at that point.
**Proposed branch:** `feature/word-aware-diff-with-conservative-grouping`, following
the repository's configured feature prefix. Resolve against the actual completed
branch/history before starting; do not change branches during planning.

## 1. Outcome and binding decisions

Improve locally computed differences for both Strict and Gentle Rewrite, in the
workspace and History. A logical change can own several disconnected spans.
Highlight whole changed words, but never unchanged neighboring words merely to
connect a group. Punctuation and whitespace remain independently representable.

- `отправел → отправил`: highlight the whole changed word, not just its letter.
- `Я отправел письмо вчера → Я отправил письмо вчера.`: two changes, spelling and
  the final period.
- `Я пока не могу точно обещать. → Я не могу пока точно обещать.`: one movement
  of `пока`. Context may include `пока не могу → не могу пока`; `не могу` must not
  be colored as edited merely to create that context.
- `Я не получил никакого подтверждение. → Я не получил никакого подтверждения.`:
  highlight the noun; `никакого` is context, not an edited word.
- `Она был готов → Она была готова`: keep the two word corrections separately
  selectable. Their grammatical relationship is not sufficient structural
  evidence for the local diff to merge them.
- Clear splits/joins and unmatched phrase replacements can be one logical change.
  Adjacency alone is not grounds for merging changes.
- The examples are regression cases, not special-case matching rules. Add broad
  synthetic coverage; do not copy personal messages into tracked fixtures.
- The algorithm is deterministic, bounded and local. No NLP dependency, model
  call, linguistic error classification or network service is added to diffing.
- Existing correction generation and approved Explain system/mode prompt text
  remain unchanged. Explain's structured user payload will change to identify
  exact selected spans explicitly.
- Old saved explanation content need not be reusable. Soft-delete it once using
  `deleted_at = migration time`; do not hard-delete it, convert it into new
  selections, or fall back to it. Keep correction history and recorded usage.

This supersedes the earlier proposals to preserve the range-only Explain API and
avoid a database migration. Exact selection identity requires both to change.

## 2. Current implementation and ownership

The existing shared `packages/contracts/src/text-diff.ts` already uses
`Intl.Segmenter('ru')` and jsdiff `diffArrays`. It has grapheme handling, a
comparison budget, a coarse fallback, and UTF-16 ranges. Its present limitations
are word/punctuation coupling, automatic adjacent-edit merging and one continuous
range per correction. Extend this module rather than add a second algorithm.

The frontend imports the shared algorithm through `apps/web/src/lib/text-diff.ts`.
`result-view.tsx` currently treats each correction segment as one selectable item.
The benchmark's `explain-run.ts` independently turns those segments into Explain
selections. Replace that duplicated selection construction with one shared helper.

Responsibilities:

1. Shared pure module: tokenize, align, resolve groups/moves, produce exact spans,
   comparison context and deterministic selection identity.
2. Frontend: calculate the diff locally, render it, navigate groups and submit an
   explicit Explain selection. Computing or selecting a diff makes no model call.
3. Backend: validate the selection against saved texts, obtain canonical fragments,
   look up the exact saved explanation, and call/save Explain only on request.
4. Manual benchmark helper: use the same groups and selection helper. Agents may
   test it with injected mock transport, never invoke its CLI, including preview.

Re-read the finished explanation-metrics implementation before coding. During
planning it was active in this checkout and already added `explanation_attempts`,
per-attempt selections, history presentation and usage aggregation. Preserve that
feature and extend its selection handling; do not overwrite it with an older copy.

## 3. Shared result model

Use zero-based, end-exclusive UTF-16 offsets everywhere. Every nonempty span starts
and ends on grapheme boundaries. Derive displayed text by slicing the original
strings; do not store normalized text as the source of truth.

Conceptual public types to implement:

```ts
type TextRange = { start: number; end: number }
type ChangeKind = 'insert' | 'delete' | 'replace' | 'move' | 'whitespace'
type ChangeGroup = {
  id: string
  kind: ChangeKind
  originalSpans: TextRange[]
  correctedSpans: TextRange[]
  originalRange: TextRange // enclosing comparison context, not highlight extent
  correctedRange: TextRange
}
type TextRun = { range: TextRange; groupId: string | null }
type ChangeMarker = {
  correctedOffset: number
  groupId: string
  kind: 'deletion' | 'move-source'
}
type TextDiff = {
  groups: ChangeGroup[]
  originalRuns: TextRun[]
  correctedRuns: TextRun[]
  markers: ChangeMarker[]
}
```

Use the project's Zod/inferred-type convention for public finite values and wire
types; the sketch describes the contract, not a requirement to duplicate types.

- Runs partition each string completely, in source order, with no overlap or gap.
  A null group means unchanged text. Reconstructing runs must reproduce the input.
- Highlight spans are sorted and nonoverlapping within each version. Different
  groups cannot own the same edited text. Context ranges may overlap.
- Empty span arrays represent the absent side of an insertion/deletion. Do not put
  zero-width ranges into highlight arrays; store a marker/anchor separately.
- A move has nonempty spans on both sides. Equal selected text is valid for moves:
  the change is its position relative to retained words.
- Runs on opposite sides are separate projections. Do not require move spans to
  fit a monotonic paired-segment model; their correspondences can cross.
- Order navigation by the earliest corrected span or marker, then original
  position. Assign `change-1`, etc. after ordering. These IDs are local UI IDs,
  never persistent cache identity.
- Build comparison ranges from the smallest enclosing aligned passage containing
  the group's operation. For a move this includes the words crossed, not merely
  the identical moved word at its two positions. For whitespace, include adjacent
  visible context in the inspector while leaving that context unhighlighted.

Expose one result-producing function and a shared `explanationSelection` helper.
Update all consumers together; a compatibility wrapper for the old segment API
is unnecessary unless an actual remaining consumer needs it.

## 4. Algorithm pipeline

### 4.1 Lossless tokenization

- Retain words, punctuation, whitespace and paragraph/sentence boundaries as
  distinct pieces with raw offsets. Use the installed `Intl.Segmenter` facilities.
- Preserve case, accents, `е/ё`, numbers, CRLF, tabs, nonbreaking spaces, combining
  marks and emoji sequences. No lowercasing or normalization for exact matching.
- Word boundaries must also be grapheme boundaries. Punctuation never becomes
  attached to a word solely for alignment or highlighting.
- Sentence boundaries limit movement inference, not text reconstruction. Explicit
  paragraph and line boundaries also prevent speculative movement grouping.

### 4.2 Initial alignment

- Reuse jsdiff over meaningful token keys to identify equal anchors and unmatched
  regions. Do not let spaces alone become anchors between unrelated words.
- Retain raw separators separately and compare them after token correspondence is
  established. Identical spacing must not be colored just because words moved.
- Trim common edges before expensive work, reuse the existing comparison budget,
  and preserve matching islands when subdividing a long comparison.
- Initial alignment is evidence, not a final decision about what moved. Its equal
  tokens may be reconsidered by the movement pass.

### 4.3 Basic changes and conservative grouping

- A changed word is one whole-word correction. Distinct word substitutions remain
  separate even when adjacent or grammatically related.
- Separate punctuation from neighboring word edits. A punctuation-only change
  must not color the unchanged word next to it.
- Recognize a split/join when the lexical sequence is conserved and only token
  boundaries/separators change, such as `по этому → поэтому` or
  `Кто то → Кто-то`. Account for actual punctuation/spacing changes in that group.
- An unmatched phrase with no reliable internal correspondence is one replacement;
  preserve any confidently unchanged internal islands as unhighlighted spans.
- Treat separate insertions/deletions as such. Do not invent a replacement pairing
  across an unchanged phrase solely because the edits are nearby.
- Every whitespace edit stays represented, including whitespace-only input and
  leading/trailing changes. Context is a display aid, not an edited span.
- Do not infer agreement, stylistic improvement or semantic equivalence. Explain
  can discuss relationships using context after a specific change is selected.

### 4.4 Movement candidates and competing interpretations

Use a separate bounded word-order pass. Search the local before/after ordering,
including tokens initially aligned as equal. Matching deletion/insertion pairs
alone is insufficient.

The initial implementation should use bounded candidate enumeration in local
reorder windows rather than introduce a general linguistic or global optimization
engine:

1. Start with affected regions and expand through adjacent equal tokens within
   confidently paired sentences/paragraphs. Consider both sides of the apparent
   move; do not freeze a potentially moved word as an anchor.
2. Identify pure reorder windows: the same exact lexical material exists on both
   sides in a different order. Independent surrounding edits can remain outside
   the window. Mixed regions that cannot be isolated reliably retain ordinary
   edits; they must not acquire a guessed move label.
3. Enumerate exact contiguous word/phrase occurrences in those windows. Prefer
   unique occurrences. A repeated word can be resolved only by unique surrounding
   context or a uniquely matched larger phrase; leftmost occurrence is not proof.
4. For each candidate set, remove its paired source/destination sequences and
   verify that the remaining lexical material preserves order. Replay proposed
   relocations to check the observed ordering. At least one relative ordering
   relationship with retained words must actually change.
5. Consider only nonoverlapping source/destination candidates. Among complete
   valid interpretations of a window, minimize moved word count first, then the
   number of movement operations. Keep a phrase together once its identity is
   established; longest phrase is not the primary movement criterion.
6. Compare all best-scoring interpretations examined. If they disagree about a
   movement, do not label that disputed movement as certain. A deterministic
   rendering tie-break must never be presented as linguistic certainty.
7. Rebuild affected correspondences/render runs using the accepted movement.
   Relabeling an arbitrary original diff without realignment is insufficient.
8. Compare residual punctuation and separators exactly. They may be independent
   corrections. Never swallow them into a word move or lose them during replay.

For `пока не могу → не могу пока`, moving `пока` costs one word; moving `не могу`
costs two. Select `пока` regardless of the initial sequence alignment. For
`А Б → Б А`, both one-word explanations tie: retain ordinary edits, with no claim
that one particular word definitively moved.

Multiple disjoint clear movements can produce separate groups. Overlapping or
equally plausible interpretations stay ordinary edits. Moves crossing sentence or
paragraph boundaries, or words that are both changed and moved without a clear
exact match, are conservatively represented as replacements/insertions/deletions.

Internal initial limits: retain the existing 256-token alignment limit and 65,536
comparison budget; bound movement windows to 64 lexical tokens and candidate
search to 4,096 visited states per comparison. Implement named constants and
count work deterministically. If a search is incomplete, do not declare its
provisional winner unambiguous. Fall back to ordinary edits for that window.
These are internal safety defaults, not UI settings; tune only with deterministic
performance/regression evidence and preserve the same acceptance behavior.

### 4.5 Fallback and invariants

Budget exhaustion can reduce grouping precision, never text coverage. Keep known
equal anchors unhighlighted and emit coarse word/grapheme-boundary replacements
for unresolved regions. Do not highlight a whole sentence just to join known
separate changes. Preserve paragraphs and all original/result bytes as JS strings.

## 5. Rendering and interaction

- Render corrected runs in the existing Changes view. Whole changed words get the
  current correction treatment; unchanged words between spans stay ordinary text.
- Render deletion markers at their mapped corrected positions. A move has a
  source marker and highlighted destination linked to one group. Map a source
  marker through the nearest surviving ordered anchor, with document end as the
  trailing fallback. Markers are UI, never part of copied text.
- Clicking either move location selects the same group. All its visible spans
  activate together. Previous/Next and counters count groups, not span fragments.
- On explicit click, preserve the clicked location in view. On navigation, scroll
  the first visible member/marker into view; do not oscillate between move spans.
- Retain Enter/Space activation, focus visibility, accessible descriptions and
  accurate `aria-pressed` state for linked highlights. Label movement source and
  destination, rather than describing a moved word as a substitution for itself.
- Inspector: show the actual selected word/phrase and the original/corrected
  contextual passages. A `Moved` description makes `пока → пока` intelligible.
  Other edited words in the contextual passage do not become selected highlights.
- Whitespace markers and inspector summaries must distinguish spaces, tabs and
  line breaks. Punctuation-only insertions/deletions remain easy to select.
- Keep workspace and History behavior identical through the shared result view.
  Preserve Text view, clean Copy, theme/mobile layout and existing request errors.
- Selection resets safely when the result changes. Explanation response identity
  must match the complete current selection, not just its enclosing ranges.

## 6. Explain request, validation and model payload

Replace the generation/lookup input with one versioned format. Old clients do not
need compatibility; frontend and server ship together. Keep the existing endpoint
paths and response/error envelope.

```ts
type ExplanationInputV2 = {
  version: 2
  requestId: string
  kind: ChangeKind
  originalSpans: TextRange[]
  correctedSpans: TextRange[]
  originalRange: TextRange
  correctedRange: TextRange
}
```

The request contains offsets, not client-supplied fragment text. Its ranges mean
comparison context; span arrays mean the selected edits. These meanings must be
consistent in UI, API, storage, metrics and benchmarks.

Validation on the server:

- Strict Zod shape, finite nonnegative integer positions, valid request UUID and
  supported version/kind. Both span arrays cannot be empty.
- Bounds and grapheme boundaries against the saved texts; sorted nonempty spans,
  no overlaps, and every span contained by its corresponding context range.
- Recompute the shared diff from the saved successful result and require the
  selection to match a canonical group. This validates movement relationships and
  prevents arbitrary client labels/context from becoming the explanation target.
- Preserve parent-record existence/deletion checks before lookup, generation and
  saving. Validation failure makes no upstream call and creates no paid attempt.
- Remove the blanket `originalFragment === correctedFragment` rejection for moves.
  Canonical movement validation supplies the required evidence of a real change.
- Use a 64 KiB body limit for the new arrays, with a maximum of 256 spans per side.
  Split an oversized coarse replacement at known equal anchors rather than
  truncate spans. Movement bounds keep move groups well below this limit.

Build the model's user JSON on the server from saved texts:

- Keep `mode`, full `originalText`, full `editedText`, and explicit UTF-16 encoding.
- `selectedChange` contains `kind`, plus `originalFragments` and `editedFragments`
  arrays of `{ range, text }`. Each is the exact slice at a selected span.
- A separate `comparisonContext` contains the enclosing original/edited ranges
  and their text. Never present this larger passage as the selected substitution.
- For the `пока` example the selected fragments identify `пока` on both sides,
  `kind` is `move`, positions differ, and context displays the changed word order.
- Do not join disconnected fragments into an invented contiguous quotation.
- Preserve the approved system and mode prompt strings, model selection, reasoning
  policy and maximum explanation length. Version 2 selection/payload identity is
  recorded in the selection; do not mislabel a changed system prompt version.

Acceptance is two-layered: mocked tests must prove that the request unambiguously
identifies the selected operation. Human model evaluation must separately assess
whether the returned Russian explanation follows it. Never claim model quality
based on payload tests alone or run paid evaluation automatically.

## 7. Identity, persistence and migration

### Canonical selection identity

Provide one shared canonical serializer. Serialize a fixed-order tuple containing
version, kind, both ordered span arrays and both context ranges. Exclude UI group
IDs and duplicated text. Pair this key with `requestId` for lookup, saving and
in-flight deduplication. Echo the same canonical selection in responses.

Two groups sharing context but differing in selected spans must have different
keys. The same group reopened in workspace or History must have the same key.
Never reuse an explanation merely because the enclosing ranges match.

### Saved explanations

Extend `explanations` with:

- `deleted_at`: nullable ISO UTC timestamp; null for new active explanations.
- `selection_key`: canonical selection identity for new rows, a reserved legacy
  value for old rows.
- `selection_json`: the full V2 selection for new rows; null for old content.

Retain the existing request/range/content columns to preserve records. Extend the
existing compound primary key with `selection_key`, so different exact selections
with the same context can coexist, and old rows cannot prevent new saves. New
canonical keys include the context ranges, so request/key identifies one selection.
Update conflict handling and queries together; always filter `deleted_at IS NULL`
for reusable content and require the new selection version/key.

Generate an ordinary Drizzle migration after the other agent's final migration;
do not edit or renumber that agent's `0005` migration. Review the generated table
rebuild required by the primary-key change and preserve all existing rows and
constraints transactionally.

In that one migration, mark all pre-existing saved explanation rows deleted at
the migration timestamp. SQLite's equivalent of the user's `now()` is an ISO UTC
expression such as `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`. Apply it only once via
the migration journal, never at each startup. New saves use `deleted_at = NULL`.
Do not hard-delete content, change correction texts, or clear user history.

### Explanation metrics and historical records

- Keep every existing explanation-attempt record, cost, token count and status.
  Soft-deleting reusable explanation content does not undo a paid request.
- New attempts store the full V2 selection. Adapt history fragments so movements
  show the actual selected fragments and their context separately.
- Existing attempt JSON contains the old range-only selection. Retain a small
  read-only historical selection type for displaying those metrics; do not accept
  it on generation/lookup routes and do not synthesize multi-span identities.
- Preserve the metrics feature's unknown-usage handling for old explanations that
  predate attempt recording. Excluding soft-deleted content from reuse must not
  make historical totals falsely appear complete or zero. Keep those records as
  historical usage evidence; label them as previous explanations where necessary.
- Use the V2 canonical key when matching new attempts to saved content. Do not
  compare only context ranges or rely on arbitrary JSON property order.

This historical metrics reader is required to preserve recorded usage, not a
legacy explanation-reuse path.

## 8. Tests and acceptance cases

Use the installed Node test infrastructure and focused diff script. No new runner,
browser harness or runtime dependency. Put shared algorithm tests under the
existing server test command so they run routinely; update the existing focused
web diff check rather than retain assertions for intentionally removed grouping.

### Algorithm behavior

- All four supplied examples, both directions of the `пока` move, movement to
  sentence start/end, a multiword move and two independent unambiguous moves.
- Force an initial alignment that anchors the moved word; the order-analysis
  helper must still select the same minimal movement. This is a dedicated test
  seam, not dependence on jsdiff currently making a particular choice.
- Competing one-word/two-word movements choose fewer moved words; equal-cost swaps
  and unresolved repeated words do not receive an arbitrary move label.
- Repeated words resolved by unique context, repeated phrases without such
  context, overlapping move candidates and search-budget exhaustion.
- Spelling plus final punctuation, adjacent independent spelling corrections,
  punctuation-only edits, punctuation around moves, whole-word replacements,
  splits/joins and multiword replacements with unchanged islands.
- Related grammatical corrections remain independently selectable; context does
  not become highlighted. Include sentence splitting/combining and multiline
  restructuring, even where movement inference deliberately falls back.
- Empty/equal inputs, complete insertion/deletion, repeated spaces, tabs, NBSP,
  CRLF, blank lines, line separators, leading/trailing whitespace, emoji,
  combining marks, numbers and mixed-script text.
- Large similar texts and large unrelated rewrites exercise deterministic bounds.

### Invariants and generated cases

Assert exact reconstruction of both strings; valid/sorted ranges; complete,
nonoverlapping run coverage; grapheme boundaries; every modified part represented;
no unchanged anchor highlighted solely for grouping; deterministic output; every
marker/group reference valid; and every group has an actual edit or verified move.
Use deterministic generated token sequences, including repeated and Unicode tokens.
Check edit coverage/replay against operations independently of the rendered spans,
so a missing change cannot pass merely because the full text is still displayed.

### Explain and storage

- Capture mocked transport JSON: `пока` is the selected movement, with exact
  original/result offsets; `не могу` appears only as context.
- Two selections sharing context have distinct lookup, save and pending identities.
  Reopening the identical selection reuses content without another model call.
- Reject wrong versions, unknown fields, stale/noncanonical groups, malformed
  spans, split graphemes, wrong move labels and deleted/missing parent records.
- Preserve failure/retry/timeout, in-flight deduplication and deletion-during-call
  behavior. Failed attempts still retain reported usage under the metrics policy.
- Migrate a synthetic pre-change database: all old explanation content remains
  stored but marked deleted; correction history and attempts remain intact.
  New explanation content with identical context saves and reuses successfully.
- Reopening/restarting does not soft-delete new rows. Fresh database startup and
  old attempt/unknown-metrics history remain valid after migration.
- Mocked benchmark preparation returns one selection per group and uses the same
  identity/payload helpers as the application for both modes and models.

### User-facing checks

Workspace and History: linked move selection, group counters, keyboard activation,
scroll/focus behavior, exact inspector context, punctuation/whitespace markers,
unchanged Copy output, mobile layout and both themes. Browser evidence requires
explicit permission in this chat for the target URL/action. Other agents' browser
permission is not permission for this task. Build success alone is not visual QA.

## 9. Implementation sequence and handoff

1. **Preflight after the other feature completes.** Re-read status, completed
   metrics contracts and migration journal. Preserve unrelated changes. Activate
   this spec on its dedicated branch in the ordinary checkout. Do not start a
   second work item in an occupied checkout.
2. **Shared algorithm and tests.** Add the group/projection model, lossless
   punctuation-aware alignment, conservative grouping, movement pass and fallback.
   Done when the behavior/invariant tests pass, including the alignment trap.
3. **Explain contract, storage and service.** Introduce V2 selections, canonical
   identity, exact server validation/model payload and soft-delete migration.
   Done when mocked selection/cache/migration/metrics preservation tests pass.
4. **UI and benchmark consumers.** Render/navigate groups, preserve exact visual
   spans, distinguish selected fragments from context, update metric presentation
   and use the shared selection helper everywhere. Done when builds and focused
   tests pass; record actual browser evidence separately if authorized.
5. **Final verification and manual review handoff.** Inspect the integrated diff
   against every decision here. Run the declared relevant checks once, report
   gaps honestly and leave commit/merge/push/deployment to separately authorized
   completion. No automatic review subagent.

Final automated checks, from repository root:

```text
npm test -w apps/server
npm run lint -w apps/server
npm run build -w apps/web
npm run lint -w apps/web
npm run format:check -w apps/server
npm run format:check -w apps/web
node apps/web/scripts/check-text-diff.mjs
```

Server tests build the contracts/server; the web build also builds contracts.
Reuse unchanged passing evidence rather than rerun it for bookkeeping. Report
unrelated existing formatting failures without reformatting another feature.
If the focused diff script's existing Node TypeScript invocation needs adjustment,
keep it compatible with the installed runtime; do not install a runner.

No paid model calls, manual benchmark CLI runs, SSH, deployment, push, automatic
commit, speculative architecture or worktree-based implementation is authorized by
this document. Writing this handoff does not itself start implementation.
