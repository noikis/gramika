# Feature: Improve diff readability

**From build-plan:** feature V2.1
**Build attempt:** 1
**Branch:** feature/improve-diff-readability
**Status:** completed and approved by the user on 2026-10-21. Verification evidence retained below; Git completion/landing has not been performed. V2.1a history cost display is planned next in build-plan.md, not implemented here.

## Goal

Make corrections readable and individually inspectable on desktop and mobile.
Provide the local text mapping needed for later selected-correction explanations,
without implementing explanations in this feature.

## Design reference

Approved direction from the 2026-10-21 discussion: clean corrected text with
selectable word/phrase highlights, a before/after comparison panel without
strikethrough, and Previous/Next navigation with a correction counter.

The [discussion preview](../../prototypes/clean-correction-example.html) is
illustrative, not a pixel-perfect reference. It uses synthetic example text
instead of the user's personal message. The behavior in this spec is authoritative.
Its spacing remains unresolved visually: the user explicitly rejected cramped
highlights and overlapping selection indicators. Do not copy those defects.
The user also rejected the spacing between highlighted words and the lack of
inner space between a selected word and its selection box. The example is only
a behavior reference: do not reproduce its padding, margins or word spacing.

Retain the current app theme and surrounding layout. The broader redesign stays
at V2.6/V2.7 in the build plan.

## In scope

- Changes view displays clean corrected text, highlighting whole changed words
  or short passages instead of individual letter fragments.
- Use the smallest readable correction units. Include connected token changes
  needed to show a word split/join or short replacement; do not merge independent
  edits just because they are nearby. Punctuation and spacing changes must remain
  discoverable, using neighboring text as context when necessary.
- Pure deletions have a small selectable marker at the deletion position. Markers
  are presentation only and never enter the corrected text or copied result.
- Selecting a correction shows labeled Original and Corrected passages with no
  strikethrough. Identify an empty side as no original text or removed text rather
  than leaving an ambiguous blank. Make whitespace-only changes understandable.
- Select the first correction automatically when a changed result appears.
- Provide Previous, Next and a counter on desktop and mobile. Navigate in text
  order, disable controls at the ends, and synchronize direct selection,
  highlight, panel and counter. Keep the selected correction visible by scrolling
  only as needed, without unnecessary page jumps.
- Reset to the first correction when the underlying result changes; retain the
  selection when switching Text/Changes for the same mounted result.
- Preserve the existing Text/Changes switch and initial Changes view. Unchanged
  results show no correction navigation or comparison panel; retain existing
  No changes feedback.
- Apply the same behavior to workspace results and expanded history results.
- Preserve clean Copy behavior and the existing clipboard failure/manual-copy
  path. Copy must never include markers, comparison labels or original passages.
- Highlights need comfortable spacing and line height. Selection must not shift
  text, crowd neighboring words, overlap lines or clip at the container edge.
  Give highlight/selection boxes visible breathing room around their text,
  including inner padding so the selection border does not touch the letters.
  Keep adjacent highlighted words visually distinct while preserving natural
  word spacing and exact underlying text. Validate these details independently
  of the example; its spacing is explicitly not approved.
- Support keyboard activation, visible focus, accessible labels, touch selection
  and announcements of the selected correction. Previous/Next provide comfortably
  sized touch targets even when inline corrections are small or adjacent.

User-approved presentation refinement (2026-10-21): whitespace-only changes use
a muted dotted underline with no green fill, retain visible selection/focus, and
identify themselves with explicit whitespace counts in the comparison and accessible labels.
Word splits/joins, spelling, punctuation and mixed edits remain text changes.

## Out of scope

Explanation requests, prompts, models, persistence or an Explain button;
correction editing and accept/reject; gentle rewriting; second opinions; history
deletion; theme changes and the broader UI redesign; changing roadmap order.
No paid calls, benchmark invocation, new API endpoints or database migrations.

## Build loop

Use the configured feature branch above when implementation begins. Preserve
unrelated staged and unstaged changes already present in this checkout.

Configuration uses feature-level review with checkpoint commits disabled. Build
and verify the small steps below, then present one review packet. Review belongs
to the user; do not start a review sub-agent. Completion and any commit/merge are
separate workflow actions. Do not repeat unchanged passing checks just to finish.

## Build steps

- [x] 1. Build readable correction units from the local diff.
  Keep the installed diff dependency and native segmentation where useful.
  Replace grapheme-level replacement presentation with word/short-passage units;
  preserve exact text and existing bounded computation for large changes.
  Keep original and corrected ranges attached to each unit.
  **Done when:** the comparison representation reconstructs both input strings
  exactly, handles additions/replacements/deletions and Unicode without splitting
  graphemes, and treats separate changes as distinct where alignment allows.
  Verify with synthetic edge cases and the web build.

- [x] 2. Render clean Changes view and the selected comparison.
  Integrate through the shared result component, including deletion markers and
  the unchanged state. Render user text as React text, never HTML.
  **Done when:** workspace and history expose inspectable corrections, retain
  exact corrected text and clean copying, and show before/after values without
  strikethrough. Verify punctuation-only, whitespace-only and deletion cases,
  then run web lint and build for the changed code.

- [x] 3. Complete navigation, accessibility and layout verification.
  Add synchronized Previous/Next, counter, first-selection/reset behavior and
  selection visibility. Handle keyboard focus and phone wrapping deliberately.
  **Done when:** direct selection and navigation produce the same selected unit
  and comparison on both screens; endpoints and unchanged results are correct;
  mobile/desktop checks show comfortable spacing without overlap or layout shift.
  Run the remaining relevant checks and report any unperformed visual checks.

## Files / areas

- `apps/web/src/lib/text-diff.ts`: local segmentation, alignment and unit data.
- `apps/web/src/components/result-view.tsx`: shared Changes view, selection,
  comparison and navigation used by workspace and history.
- `apps/web/src/App.css`: highlight, comparison and navigation styling. Adjust
  callers only if required by the shared component's final interface.

## Data / contracts

Frontend-only representation: unchanged text segments and correction units with
original/corrected passages and their positions. Use UTF-16 offsets consistently
with JavaScript slicing, with boundaries aligned to complete graphemes. Local
unit identity only needs to remain consistent for an unchanged mounted result.
Do not introduce persisted edit IDs, a public Zod contract or a new service.

Selection size and explanation context are separate. Later explanation work can
use surrounding original/corrected sentences from these positions. The diff is
mechanical alignment, not grammatical classification; it must not require an LLM
to group changes. Explanation persistence and compatibility are later decisions.

## Testing

Use synthetic texts, not personal examples copied from the discussion.

- Check spelling replacements, inserted/deleted punctuation, whitespace-only
  changes, split/joined words, phrase replacement and multiple adjacent edits.
- Check pure insertion/deletion, empty original/corrected sides at the diff-helper
  boundary, unchanged text, repeated words, paragraphs, emoji/combining characters
  and large rewrites within the current application's input limit.
- For every diff case, reconstruct original and corrected strings exactly from
  the representation. Include a bounded large-change case that exercises fallback.
- Check first selection, direct selection, Previous/Next boundaries, view toggles,
  result replacement, independent history entries and unchanged results.
- Verify Copy returns the exact corrected result, including whitespace, without
  deletion markers or comparison text. Preserve manual selection after failure.
- Inspect phone and desktop layouts, including narrow widths, wrapped phrases,
  adjacent highlights, visible focus, navigation touch targets and long results.
- Run `npm run build -w apps/web`, `npm run lint -w apps/web`, and
  `npm run format:check -w apps/web`. Reuse passing evidence when code is unchanged.
- Web has no configured test command or browser harness. Do not install a runner
  silently or claim automated logic coverage. Use focused local verification of
  the pure helper where feasible and report the command and actual results.
  Browser/visual evidence remains distinct from build evidence.
- Playwright MCP requires explicit permission naming the URL/action before use.
  Do not connect over SSH or make paid correction/benchmark calls for verification.

## Notes for the AI

### Implementation verification — 2026-10-21

- Local word-level units retain original/corrected UTF-16 ranges, exact text and
  grapheme boundaries. Bounded large rewrites use a single coarse passage.
- Shared ResultView implements selection, deletion markers, explicit empty and
  whitespace passages, navigation, keyboard activation, announcements and
  container-only scrolling. Both workspace and expanded history use it.
- Passed: `npm run build -w apps/web`, `npm run lint -w apps/web`,
  `npm run format:check -w apps/web`, and
  `npx prettier --check apps/web/scripts/check-text-diff.mjs`.
- Passed: `node apps/web/scripts/check-text-diff.mjs` with local Node 24:
  23 synthetic edge cases and 200 deterministic generated pairs; exact
  reconstruction, ranges, grapheme boundaries, independent edits, split/join and
  bounded fallback at the application's 5,000-character limit. This is a focused
  local assertion script, not an installed test runner or a new web test command.
- User-authorized Playwright verification at `http://localhost:5173` passed:
  first selection, direct/keyboard activation, Previous/Next endpoints, view
  toggles, result replacement, unchanged results, independent history entries,
  exact Copy and manual-copy fallback. Clipboard success/failure were simulated.
- Inspected 320px and 1280px layouts, adjacent highlights and a wrapped coarse
  passage. Adjusted initially cramped highlight spacing; final padding is 3.2px
  at the default font size, navigation targets are 48px high, and neither viewport
  has horizontal page overflow. Navigating 30 corrections scrolled the result
  container while keeping page scroll unchanged and the selected unit visible.
- All API replies were local synthetic fixtures; external requests and unmatched
  API routes were blocked. No OpenRouter, benchmark or SSH calls. Browser tab
  closed after verification. Physical-device touch and real clipboard permissions
  remain outside this simulated-browser evidence.
- Audit and independent review remain manual; neither was requested. Existing
  findings are closed, with no P0/P1 blockers or independent-review request.
  Try-guide policy has a safe direct library demonstration, supplied in handoff.
- Existing unrelated changes remain intact. No commits or merges performed.

### User-review revisions — 2026-10-21

- The user's screenshot exposed whitespace-only boxes, distracting deletion
  icons and fragmented punctuation. The original verification examples did not
  adequately represent combined spelling, punctuation and repeated-space edits.
  No personal text from the screenshot was copied into fixtures or documentation.
- Alignment now follows word chunks with punctuation and trailing separators,
  ignoring trailing whitespace for matching. Spacing changes retain their word
  as visible context; unchanged separators stay outside highlights. Bounded
  matching at the ends of an unmatched run separates obvious spelling/case edits
  from adjoining split/join edits, while keeping numeric suffix changes together.
  This remains mechanical alignment, not grammatical classification.
- Replaced large filled backspace icons with small minus marks for genuine
  deletions. Whitespace-only boundary highlights have a visible dot fallback.
  Comparison passages show changed whitespace explicitly and explain only the
  symbols actually present.
- Added synthetic regressions for repeated-space changes, punctuation/case edits,
  word split/join next to typos, a connected punctuation/deletion change, and
  numeric suffixes. The local script passes 23 edge cases, 200 generated pairs
  and focused grouping assertions.
- Repeated final web build, lint, format check, script format check and diff check:
  all passed. Authorized browser checks at localhost:5173 used only mocked API
  replies, with external and unmatched API requests blocked. Verified contextual
  grouping, no blank/artificial markers, whitespace comparison, keyboard and
  retained selection, navigation endpoint, exact text/copy, no selection layout
  shift and no horizontal overflow at 320px. Inspected desktop and mobile layouts;
  expanded history also passed genuine-deletion selection/comparison and exact
  copy checks. Browser tab closed afterward. No OpenRouter or paid calls.

### Latest verification — quieter spacing

Latest verification (2026-10-21, quieter spacing presentation): added nine
classification assertions covering repeated/edge whitespace, line breaks,
tabs/NBSP, unchanged text, case, punctuation and word joins. The full local
assertion script, web build, lint, web/script formatting and diff checks passed.
Authorized mocked-browser checks confirmed two spacing corrections have no fill
and a muted dotted underline, while spelling and word joining stay green.
Confirmed Spacing only label, keyboard selection, navigation endpoint and exact
Copy; inspected 1280px and 320px layouts. External/unmatched API requests blocked;
no OpenRouter calls. No commits or merges. Audit/review policy unchanged.

### Specification-time notes

Latest user-approved revision (2026-10-21): implemented the first three readability
suggestions only. Passages use natural text with no inline whitespace tokens.
Spacing-only edits have a separate short description, e.g. “Removed an extra
space after the period: 2 → 1.” Only spacing edits include following context for
accurate counts. Word joins/splits show minimal natural passages and a mechanical
“Joined two words”/“Split one word into two” label when non-whitespace text is
identical. Removed superseded token formatting and updated its assertions.
Navigation unchanged; no new controls or model explanations. Final web build,
lint, formatting, local assertions and diff check passed. Authorized mocked
browser checks passed for natural passages, descriptions/counts, exact Copy,
navigation and desktop/mobile layouts (1280px/320px). External/unmatched API
requests blocked; no OpenRouter calls, commits or merges. Browser closed.

Whitespace-comparison clarification (2026-10-21): replaced ambiguous dot/arrow
symbols and their legend with explicit `[2 spaces]`, `[1 space]`, `[2 tabs]`, etc.
The comparison includes the common separator and following word, restoring the
full 2-to-1 count instead of displaying only the removed 1-to-0 fragment. The
heading reports `2 spaces → 1 space`; non-spacing edits show `Text change`, which
also avoids a disappearing heading during navigation. Inline corrected text,
diff ranges and Copy remain unchanged. Added helper assertions for full context,
counts, tabs, NBSP and CRLF. Web build, lint, formatting and local assertions
passed. Authorized mocked-browser checks verified the count header, explicit
before/after context, absence of ambiguous dot markers, exact Copy, 1280px/320px
layouts and stable mobile page height/text layout across navigation. No external,
OpenRouter, paid or benchmark calls; no commits or merges.

This is an approved planned feature, not an invitation to redesign the app.
The next implementer should read the current source before editing; no application
checks or browser checks were run while saving this specification.

Preserve the versioned build-plan identity V2.1; it is not shipped V1 feature 2
or feature 3. No prior V2.1 build was found. Planned completion archive:
`blueprint/history/features/V2.1-improve-diff-readability.md` (first build).
The target archive is absent with no prior available Git history; the configured
branch is valid and currently unused. Do not create either during specification.
