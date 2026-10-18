# Fix: Refine history navigation and action feedback

**Type:** Fix
**Branch:** fix/history-v2-ui
**Status:** completed
**Completed:** 2026-10-18

## Scope

- Recreate the history-v2 design in React: responsive search/filter controls,
  pagination, plus/minus expansion, grouped request details, and Copy text actions.
- Support case-insensitive literal phrase search across full original text and
  successful corrected results, including Russian. Search after a 300 ms pause.
- Combine model and result filters against the same saved request; any matching
  request qualifies a correction. Expanded entries retain all attempts.
- Distinguish corrected, unchanged, failed and pending results. Unchanged means
  exact equality with the original text.
- Filter inclusive browser-local creation dates with UTC start-inclusive and
  end-exclusive boundaries. Sort by creation time with stable ID ordering.
- Return 10 corrections per page, matching totals, and model choices from the
  entire history. Clamp pages when results shrink and cancel stale requests.
- Validate public contracts and keep search phrases out of request URL logs with
  `POST /api/history/search`. Keep detail reads unchanged; the GET listing uses
  the same bounded response format.
- Replace outer focus rings on inputs, selects, buttons and Text/Changes controls
  with control-border feedback while retaining visible keyboard focus.
- Use the user-installed Sonner dependency for one compact, dark bottom-center
  notification. Replace previous messages; dismiss successes after 2 seconds and
  clipboard warnings after 5 seconds. Cover paste, copy and correction success.
- Keep validation, correction errors and actionable configuration errors inline.
  Preserve selectable text and the clipboard manual fallback.
- Retain prototype references, ignore local Playwright output, and include the
  staged root lint/format shortcuts alongside the UI work.

## Finished steps

- [x] Port the history prototype into React and group request diagnostics.
- [x] Add shared search contracts, SQLite filtering and pagination, and API tests.
- [x] Wire React filters, debounced search and request cancellation.
- [x] Refine control focus borders and replace persistent action feedback with Sonner.
- [x] Complete relevant automated checks and user review.

## Verification

- `npm test -w apps/server`: 45 tests passed, including server build and test
  typecheck. Covers Russian phrase matching, literal wildcard characters,
  repeated requests, combined filters, date boundaries, stable pagination,
  validation, safe storage errors and search-text log privacy.
- `npm run build -w apps/web`: passed after the final Sonner integration.
- `npm run lint -w apps/web`: passed after the final Sonner integration.
- `npm run lint -w apps/server`: passed after the backend implementation.
- Formatting and `git diff --check`: passed for the affected source files.
- User confirmed the UI and notifications work and accepted this branch as one
  completed fix on 2026-10-18.

## Completion notes

Reused passing checks under the project's lightweight completion policy. No
automatic review, extra builds, paid requests, migrations or deployment occurred.
The Sonner development-cache error was resolved by restarting Vite with `--force`;
the user confirmed everything works. Existing unrelated P3 findings remain in the
live ledger. No independent review was requested. The user authorized committing
all branch changes and merging into local master on 2026-10-18. Pushing remains
the user's responsibility. Model benchmarking is deferred to a later planning
session after the user supplies correction texts.
