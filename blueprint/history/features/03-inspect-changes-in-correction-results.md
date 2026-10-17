# Feature: Inspect changes in correction results

**From build-plan:** feature 3
**Build attempt:** 1
**Branch:** feature/inspect-changes-in-correction-results

## Goal

Inspect changes between the exact submitted original and its successful result
without another model request. Changes is the default; Copy always copies the
complete clean corrected text. Approved by the user on 2026-10-18.

## Design reference

Use the approved `prototypes/correction.html`, `prototypes/theme.css` and
`prototypes/README.md`. Preserve English labels, local Roboto, blue-black surfaces,
emerald actions, labels outside the editors and the existing 720px breakpoint.
Port the prototype's insertion/deletion colors and compact Text/Changes control.
Avoid extra explanatory clutter in normal use.

## In scope

- A pure local diff helper consuming original/result strings without trimming,
  Unicode normalization or newline conversion.
- Actual Text and Changes views, defaulting to Changes for every new result.
- Safe insertion/deletion markup, unchanged-result feedback, accessible controls,
  responsive rendering and exact clean Copy in either view.
- Preservation of Feature 2's loading, error, empty, draft association and
  in-memory navigation behavior.

## Out of scope

History, database/schema/API changes, model selection or repeated requests,
benchmark infrastructure, prompt changes, paid evaluations and new browser-test
tooling. No agent-initiated OpenRouter requests or private environment-file reads.

## Build loop

After approval create the recorded branch. Implement the small steps in order,
then present one review packet. Checkpoint commits are disabled and review is
manual; no automatic sub-agent review. The user installs dependencies and performs
live browser testing unless they explicitly authorize agent browser actions.
Complete reuses passing unchanged evidence and performs lightweight bookkeeping
and already-authorized local Git operations. Never push.

## Build steps

- [x] 1. Build deterministic local change segments.
  Add a browser-only pure helper returning ordered equal/removed/added strings.
  Use the small `diff` package for sequence comparison, with native
  `Intl.Segmenter` to keep words and Unicode grapheme clusters intact. Refine
  changed word runs at grapheme boundaries so punctuation and small spelling
  corrections remain easy to inspect. Declare the dependency in the web workspace;
  ask the user to install it before dependent work. Bound expensive comparisons
  and fall back to one coarse replacement between common grapheme-safe prefix and
  suffix when the comparison budget is exceeded; do not truncate either text or
  reject a successful correction. The cap is an internal work budget, not a new
  input limit or user setting.
  Done when focused fictional fixture checks prove that removing added segments
  reconstructs the exact original and removing deleted segments reconstructs the
  exact result. Include unchanged/empty helper inputs, punctuation, repeated words,
  multiline text, whitespace-only changes, Russian, combining marks, emoji and a
  deliberately large replacement. Use installed Node/TypeScript for focused checks;
  do not install a test runner or claim build output proves diff correctness.

- [x] 2. Add the approved result-view control and safe rendering.
  Extract a reusable result-view component for later History reuse. Only show
  Text/Changes for a visible successful result. New request results start in
  Changes; switching views is local and causes no HTTP request. Use React text
  children inside semantic `ins`/`del`, never parsed HTML or dangerouslySetInnerHTML.
  Done when insertions/deletions use the approved colors plus non-color cues,
  whitespace and line breaks survive, literal HTML-like strings stay literal,
  unchanged results show the original text with a short No changes status, and
  keyboard users can identify and operate the selected view. Preserve visible
  focus, accessible labels and status announcements. Web build and lint pass.

- [x] 3. Verify copy, state and responsive behavior.
  Keep the existing Copy handler bound to correctedText, independent of the diff
  DOM and selected view. Text remains selectable for manual clipboard fallback.
  Retain the chosen view while navigating away/back to the same in-memory result;
  reset to Changes when its requestId changes. Continue hiding stale results when
  the current draft differs from the submitted original. Do not expose controls
  for empty, pending or failed requests.
  Done when clean Copy, manual fallback, switching views, draft edits, navigation,
  unchanged output and phone/intermediate/desktop layout have explicit verification
  evidence or the user's acceptance. Use fictional fixtures/local mocks for agent
  checks; the user alone may make paid corrections. Do not add a mock mode to the
  shipped interface. Record manual versus automated evidence distinctly.

## Files / areas

- `apps/web/src/components/correction-workspace.tsx`: integrate result display.
- A focused result-view component and pure diff helper under `apps/web/src`.
- `apps/web/src/App.css` and existing tokens in `apps/web/src/index.css`.
- `apps/web/src/use-correction.ts` only if result-scoped view persistence requires
  it; preserve transport, draft and clipboard contracts.
- `apps/web/package.json` and root lockfile for the diff dependency.
- Approved prototype files are references and stay unchanged.

## Data / contracts

- Inputs: exact successful `CorrectionResult.originalText` and `correctedText`.
  `requestId` identifies the result for view reset; never compare against a later
  edited draft. No history or additional model data enters the comparison.
- Output: an ordered array of `{kind: 'equal'|'removed'|'added', text: string}`.
  Omit empty segments and coalesce adjacent segments of the same kind.
- The original reconstruction excludes added segments; corrected reconstruction
  excludes removed segments. Both must match byte-for-byte JS string values.
  Never split a grapheme cluster across highlight boundaries or normalize text.
- View selection is ephemeral UI state, scoped to the current request. No setting,
  diff markup or derived diff is persisted or sent to the API.
- Copy always receives the stored corrected string. Failed clipboard operations
  preserve output and provide the existing manual-copy guidance.

## Testing

Run focused diff reconstruction/Unicode fixtures with existing Node/TypeScript,
then `npm run build -w apps/web` and `npm run lint -w apps/web`. No root Verify,
web unit-test runner or browser-test command is configured. Do not add one silently.
Server logic is unchanged, so do not rerun the server suite for this feature.
Verify visual/keyboard/clipboard behavior at phone, intermediate and desktop
widths through user testing or separately approved mocked browser checks. Agent
checks must never make real OpenRouter calls or inspect saved personal text.

## Notes for the AI

Self-critique preserved exact whitespace/Unicode reconstruction and clean Copy,
and added a bounded local-comparison path so large upstream results cannot cause
unbounded diff work. Use one helper and one result component; no generic diff
framework, new service, worker or speculative configuration. User-reviewed history
and model comparison are next in the plan, not part of this branch.

## Implementation evidence

- Implemented the local diff helper, result-view component, keyboard-native radio
  control, prototype highlight tokens and view state above navigable views.
- New successful results reset to Changes. Switching views makes no request.
  Copy remains bound to the exact corrected string; clipboard failure switches
  to selectable Text for safe manual copying.
- The user-installed diff 4.0.4 has no bundled types or comparison-budget option.
  Added a narrow typed declaration for diffArrays and bound comparison size before
  calling it: at most 256 changed tokens and a shared 65,536-unit work budget.
  Grapheme-safe common-edge fallback retains both complete strings.
- 416 fictional fixture checks passed using the installed TypeScript compiler and
  Node, without creating a new test runner. They cover exact reconstruction,
  grapheme boundaries, punctuation refinement, whitespace/newlines, Russian,
  combining marks, emoji, HTML-like text, large fallback cases and seeded pairs.
- Server-rendered component checks proved escaped text, ins/del markup, selected
  Changes and clean Text rendering. Mocked hook checks proved view retention,
  new-result reset, stale-result hiding, clean Copy and clipboard-denial fallback.
  These checks are not live browser or native clipboard evidence.
- `npm run build -w apps/web` and `npm run lint -w apps/web` passed.
  No server source changed, so its suite was not repeated.
- Step 3's implementation and mocked checks are complete; live responsive,
  keyboard and clipboard review was assigned to the user. The user tested the
  feature and reported "tested. it works" on 2026-10-18, accepting step 3.
  No agent-initiated
  OpenRouter requests, private environment-file reads, browser actions, automatic
  audits, review sub-agents or commits were performed.
- Findings and independent-review ledgers remain empty. User-owned environment
  example remains untouched and outside feature work.

## Completion

Completed 2026-10-18 following the user's successful test and acceptance.
Existing passing evidence was reused; no repeated checks, automatic review,
OpenRouter calls or environment-file inspection. Landed locally; no push.
