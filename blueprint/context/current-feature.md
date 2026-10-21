# Feature: Soft-delete history

**From build-plan:** V2.5
**Branch:** master
**Status:** implemented; automated checks pass; existing workspace formatting failures and live UI review pending

## Scope

User requested implementation in E:/Code/gramota after V2.2 completed.
Delete hides a whole correction group and every attempt from normal history,
search, filters, totals, pagination and detail reads. Retain all SQLite data.
The user confirmed whole-entry deletion with no Trash/restore screen.
Use a nullable deletion timestamp and generated transactional migration.
An expanded entry offers Delete, then an inline confirmation explaining scope.
Show pending and recoverable failure states; refresh the current filtered page
only after success. Clamp empty last pages using existing pagination behavior.
Reject repeat requests referring to hidden groups before transport. Clear the
active editor association after deleting its group so the next correction
creates a new group. In-flight outcomes may finish but must not restore visibility.

No hard deletion, bulk deletion, restore API/UI, paid calls, benchmark invocation,
SSH, browser automation, commits, merges, push or deployment.
Keep V2.2 mode labels, prompts, diff and kopeck behavior unchanged.

## Build steps

- [x] Add timestamp, migration, repository filtering and validated DELETE endpoint.
- [x] Add confirmed deletion UI, refresh and active-association cleanup.
- [x] Verify migration retention, endpoints, filtering/pagination, repeat rejection,
  in-flight completion and persistence with isolated databases; run server tests,
  web build, both lints, touched-file formatting and diff checks.

## Review

One review handoff, manual review, no subagents. Live UI evidence requires
separate permission; automated checks do not establish visual behavior.
The preceding V2.2 spec and evidence remain in committed history (7f7b3b8).

## Implementation evidence (2026-10-21)

- Added deleted_at with generated 0002_soft-delete-history.sql and Drizzle metadata.
  Migration is a single additive ALTER TABLE; populated V2.2 records retain text,
  modes, relations and request fields, with existing entries visible by default.
- DELETE /api/history/:correctionId validates UUIDs and returns 204, 400, 404 or
  safe 503 errors. Repeat deletion returns 404; UI treats already-missing as removed.
- Normal list/search/detail, counts, pages and model choices exclude hidden groups.
  New attempts cannot reference hidden groups; already-pending attempts can finish
  without restoring visibility. SQLite reopen retains the deletion and all data.
- Added an expanded-entry Delete entry / Confirm delete / Cancel flow with pending
  protection and retryable errors. Success refreshes the current filters and page.
  Editor association is cleared for the deleted entry; revision invalidation also
  prevents an in-flight response from attaching the editor to that hidden group.
- npm test -w apps/server: PASS, 98 tests (six new soft-delete tests).
  Includes server/contracts builds, test typecheck, and all mocked benchmark tests.
- npm run build -w apps/web: PASS. Both workspace lint commands: PASS.
- Touched-file Prettier checks in each workspace: PASS. git diff --check: PASS.
- Full workspace formatting checks still fail on unrelated existing files:
  server check reported 22 untouched files after correcting the touched route;
  web check reported 10 untouched files. No unrelated formatting cleanup performed.
- Initial test type errors and old migration-count assertions were corrected;
  the subsequent complete server test gate passed.
- No open P0/P1 findings or independent review request. Configured audit,
  independent-review and live Check gates remain manual. No subagent used.
- Browser interaction/layout, clipboard and live UI failure states were not
  exercised. No paid calls, benchmark CLI, SSH, Playwright, commits, merges,
  push, deployment or changes to actual history databases.

## Try it now

In the running app, open History and expand an entry you are willing to hide.
Choose Delete entry, then Cancel: the entry stays. Choose Delete entry again and
Confirm delete: the entry disappears and the count updates. Search for its text
and reload History: it stays hidden. All attempts remain stored in SQLite;
there is no Trash or restore screen. If you delete the last entry on a page,
the previous valid page appears. Correcting the same editor text again creates
a new visible entry rather than appending to the hidden group.

Next workflow command: /complete after human review. Completion/landing remain
separate; no commit permission was inferred from implementation authorization.
