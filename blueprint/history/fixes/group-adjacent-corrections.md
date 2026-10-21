# Fix: Group adjacent corrections

**Type:** Fix
**Status:** verified (automated checks; browser review pending)
**Branch:** fix/group-adjacent-corrections

## The problem

Adjacent changed words are separate selectable corrections, even when separated
only by unchanged spaces. The approved example is synthetic:
`никого подтверждение` -> `никакого подтверждения`.

## The fix

Mechanically group adjacent word corrections across unchanged horizontal spaces
in shared display logic, giving one highlight, comparison and navigation item in
both workspace and history. Keep unchanged words, punctuation and line/paragraph
breaks as boundaries. Preserve exact strings and ranges, Unicode, deletion
markers, clean copying and bounded diff performance. No grammatical analysis,
explanations, persistence, model calls, dependencies or redesign.

The user explicitly authorized this spec and implementation together.

## Build steps

- [x] Group adjacent word edits in the shared diff, before assigning ranges.
  Done when the approved example is one correction and separated changes retain
  independent units with exact original/corrected reconstruction.
- [x] Run focused synthetic checks and configured web checks.
  Done when adjacent grouping, unchanged words, punctuation, line boundaries,
  whitespace, Unicode, deletion and bounded fallback cases pass; web build,
  lint and changed-file formatting pass. Report full formatting and browser
  verification separately.

## Verify

Use installed TypeScript to run synthetic assertions against the diff without
adding a test runner. Run web build, lint and formatting check. No paid calls,
benchmark invocation, SSH or Playwright. Manual review remains with the user;
no commits or landing are authorized.

## Evidence and limitations

- `node apps/web/scripts/check-text-diff.mjs`: 23 edge cases, 5 grouped cases,
  12 boundary cases and 200 generated pairs pass, including exact ranges,
  reconstruction, graphemes, deletion markers and large coarse fallback.
- Web build and lint pass; changed code files pass Prettier and `git diff --check`.
- Full web format check fails on 12 unchanged files. Left outside this fix.
- Shared ResultView consumes grouped segments for highlights, comparison,
  keyboard selection and Previous/Next in workspace and history. Copy still
  consumes clean corrected text. Browser behavior has not been exercised.
- Standalone insertion/deletion markers and the existing bounded coarse fallback
  remain intact. Grouping requires word edges on both before/after sides and
  identical Unicode space separators; tabs and line separators do not join units.
- No blocking findings or independent-review request; manual gates unchanged.

## Completion

Archived with user approval on 2026-10-21. Already committed on master as
`cd70d74`. Existing automated evidence retained; browser review was not run.
