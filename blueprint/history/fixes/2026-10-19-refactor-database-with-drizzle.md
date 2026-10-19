# Current Feature

> **Generated file.** Holds the one feature, fix, or rollback being built in this checkout. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
> Build one thing at a time in this checkout; `/complete` archives it under
> `blueprint/history/` and resets this file.

## Refactor storage to Drizzle

**Type:** Fix
**Branch:** master
**Status:** verified

Approved in chat: implement the discussed storage refactor and migration management
together, using user-installed stable dependencies, directly on master.

### Scope

- Keep storage's public operations and correction/HTTP contracts unchanged.
- Use stable Drizzle ORM with better-sqlite3 and a typed SQLite schema.
- Convert correction writes, history queries, preferences, and recovery to Drizzle.
- Use Drizzle Kit generated, committed SQL migrations and runtime migration application.
- Preserve the existing current-schema database, exact text, IDs, metrics, constraints, preferences,
  transactions, literal Russian phrase search, sorting, pagination and recovery.
- Preserve safe diagnostics without logging Drizzle query text or parameters.
- User-approved follow-up: trim outer whitespace in the editor submission hook
  before validation and sending; use that same original for result/error matching
  and repeat association. Preserve the draft and all interior whitespace.
- Use database/ for the module, with correction-repository.ts,
  history-repository.ts and model-preference-repository.ts in its repositories/
  subfolder. Use Repository names for the individual persistence operations.
- Register the user's current database baseline once outside application code,
  using only schema metadata and the migration journal. Do not read correction
  texts or change application tables. Remove old schema upgrade machinery.
- Update relevant project documentation. No paid calls, benchmark CLI,
  new branches, commits, pushes, or deployment in implementation.

### Build steps

- [x] Add typed schema and generated Drizzle baseline.
- [x] Convert storage operations and driver; retain public interfaces and safe diagnostics.
- [x] Cover fresh migration, explicit baseline registration, rollback and persistence.
- [x] Update documentation and run server tests, lint and relevant formatting checks.
- [x] Organize database/ infrastructure and its repositories/ subfolder; rename
  individual Store interfaces, factories and dependencies to Repository.
- [x] Clarify connection setup names: connection.ts, openConnection() and
  createDrizzleClient(), approved separately during review.
- [x] Remove automatic old-schema upgrades; verify ordinary Drizzle migration startup.
- [x] Register the user's existing current-schema database baseline once, preserving data.
- [x] Trim submitted editor input consistently and verify the web change.

### Done when

- Fresh databases migrate automatically; the existing current-schema database opens
  after explicit one-time baseline registration, without resets or table changes.
- Reopening does not repeat migrations or overwrite a saved model preference.
- Failed migrations roll back; existing unregistered tables are not silently adopted.
- Existing correction, history, search, preference and mocked benchmark tests pass.
- Constraint enforcement, interrupted recovery, null/zero metrics and safe errors remain.

### Verification

- Input trimming: web build, web lint and targeted Prettier check passed.
  Reviewed submission, result visibility, error feedback and repeat association:
  each uses the same trimmed original. Draft and internal whitespace remain intact.
  No browser verification performed; no web test runner is configured.
- `npm test -w apps/server`: passed, 66 tests, including build and test typecheck.
- `npm run lint -w apps/server`: passed.
- Targeted Prettier check of database/, changed source/tests and drizzle.config.ts: passed.
- Full server format:check reports existing formatting issues in 12 unchanged files;
  those files were left intact. Changed files pass targeted formatting checks.
- `npm run db:generate -w apps/server -- --name=verify-schema`: no schema changes.
- `git diff --check`: passed.
- Fresh migration and explicitly registered current-schema fixture verified;
  failed Drizzle baseline rolls back and resumes on reopen; constraints, exact
  text, null/zero metrics and preference persistence covered. Compatibility with
  earlier schema versions is intentionally removed at the user's request.
- Registered apps/server/database.sqlite after user provided the path and confirmed
  API stopped. Inspected schema metadata only, backed up the file locally, and
  added the Drizzle journal record in one transaction. Application table schemas
  stayed unchanged; running Drizzle's migrator afterward applied no changes.
  Backup: apps/server/database.before-drizzle-baseline-1792400314373.sqlite.
  No correction texts were read or application records modified.
- Audit, independent review and live Check are manual; none requested. No P0/P1
  findings or independent-review request exists. Existing fixed P3 findings retained.
- Automatic try guide skipped: internal refactor with unchanged public behavior.
- Runtime distribution must include apps/server/drizzle/ beside dist/.
- Ready for further user review on master. No commits made.

## Completion

Completed 2026-10-19 directly on master, as requested by the user.

- User reviewed and approved all changes, including the database/repository layout,
  stable dependencies, migration simplification, coding standards and input trimming.
- Reused passing evidence: 66 server tests, server lint, schema consistency,
  web build/lint and targeted formatting. No checks repeated solely for completion.
- Existing database baseline registered once with a local backup; personal texts
  were not inspected and application records were not changed.
- Earlier fixed P3 findings remain in the findings ledger; no P0/P1 blockers or
  independent-review request exists. Review was performed by the user.
- No build-plan checkbox changes: this was an unplanned refactor with a small fix.
- No merge is needed because the approved work is already on master. No push or
  deployment is part of completion.
