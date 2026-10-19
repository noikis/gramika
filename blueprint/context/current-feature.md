# Current Feature

## Clean up documentation and obsolete database diagnostics

**Type:** Fix
**Branch:** master
**Status:** verified

Requested in chat: clean up documentation and dead code after the Drizzle refactor.
Continue directly on master under the user's existing branch preference.

### Scope

- Correct current server documentation to use database/ and repository terminology,
  Drizzle migration commands and the real history search route.
- Consolidate current verification status; preserve completion details in the existing
  archive. Leave historical archives, product plans, prototypes and data files intact.
- Remove obsolete node:sqlite error-code/numeric diagnostics from application code.
  Keep better-sqlite3 codes, Drizzle cause unwrapping and safe logging; public API
  error contracts and application behavior stay unchanged.
- Re-examine old cleanup findings and record current findings. No dependency changes,
  new branches, paid calls, benchmark CLI, personal database access or commits.
- User-approved follow-up: move openConnection() and createDrizzleClient() into
  SqliteDatabase as private methods, keep DatabaseClient beside the class with
  type-only imports, remove connection.ts and update the naming standard/docs.

### Build steps

- [x] Inspect current docs, source entry points and diagnostics; record findings F-04/F-05.
- [x] Correct stale docs and consolidate status.
- [x] Remove obsolete diagnostic compatibility and update the existing safety tests.
- [x] Run server tests/lint, targeted formatting, local documentation link and diff checks.
- [x] Encapsulate connection helpers, update references and verify the change.

### Done when

- Current docs name the actual module, dependencies, migration workflow and search route.
- Current status has one concise verification summary and a link to detailed history.
- Safe diagnostics expose only allowed codes, stage and public error category, including
  Drizzle-wrapped errors; messages, paths, parameters and numeric legacy fields stay out.
- Relevant checks pass. Findings and manual review boundaries are preserved.

### Verification

- `npm test -w apps/server`: passed, 66 tests including build and test typecheck.
  Re-run after encapsulating the connection helpers: all 66 tests passed.
- `npm run lint -w apps/server`: passed.
- Targeted Prettier check of diagnostics and changed tests: passed.
- Local file-link scan: 20 Markdown files, no missing targets.
- `git diff --check`: passed.
- F-04 and F-05 repaired and marked fixed, pending review. No P0/P1 blockers or
  independent-review request exists. No application behavior or public API changed.
- No user-facing try guide: internal cleanup with unchanged observable behavior.

Audit covered current documentation and nearby source for quality only;
this is not a full-project security, performance or tests audit. The initial local
link check covered 20 tracked Markdown files with no missing targets. No unused
application module was confirmed. Earlier cleanup findings F-01/F-02/F-03 were
re-reviewed and closed; historical archives were not changed.
