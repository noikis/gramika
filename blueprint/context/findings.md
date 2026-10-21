# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to land while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P3] closed - Unused OpenRouter SDK dependency

**File:** apps/server/package.json:29
**Found:** 2026-10-18 by /audit (scope: application source and manifests; lens: quality, obsolete code only)
**Why it matters:** The SDK is installed but has no application/test imports. Corrections use the Undici transport in apps/server/src/openrouter.ts, as previously agreed. Keeping the unused SDK adds dependency maintenance without serving current behavior.
**Suggested fix:** Remove @openrouter/sdk from the server manifest and update the lockfile during the next user-run dependency install. Existing Undici transport replaces it. Current requirement lost: None.
**Resolution:** Removed at user request on 2026-10-18. Manifest and lockfile updated offline; demo code/tests and three images deleted. Server tests (40), web build and server lint pass; focused root/database tests (3) and test typecheck pass after lint repairs. Re-reviewed on 2026-10-19: removed files and dependencies remain absent, current route registration and source references do not reintroduce them. Closed by this quality audit; no independent review performed.

### F-02 [P3] closed - Fastify demonstration route and support decorator remain active

**File:** apps/server/src/routes/example/index.ts:4; apps/server/src/plugins/support.ts:9
**Found:** 2026-10-18 by /audit (scope: application source and manifests; lens: quality, obsolete code only)
**Why it matters:** Autoload still registers /example, returning 'this is an example', and the someSupport decorator, returning 'hugs'. Only scaffold tests consume these demonstrations; production correction/history code does not. The sensible plugin is also registered without observed product callers of its utilities.
**Suggested fix:** After user approval, remove demonstration route/decorator and their corresponding scaffold tests. Remove sensible and its dependency if no utility is retained. Keep the root route until its intended health-check role is decided. Removing /example changes an exposed endpoint, so this is a cleanup decision rather than an automatic repair. Current product requirement lost: None identified; demonstration endpoint/decorator behavior would be removed.
**Resolution:** Removed at user request on 2026-10-18. Manifest and lockfile updated offline; demo code/tests and three images deleted. Server tests (40), web build and server lint pass; focused root/database tests (3) and test typecheck pass after lint repairs. Re-reviewed on 2026-10-19: removed files and dependencies remain absent, current route registration and source references do not reintroduce them. Closed by this quality audit; no independent review performed.

### F-03 [P3] closed - Unreferenced web scaffold image assets

**File:** apps/web/src/assets/hero.png; apps/web/src/assets/react.svg; apps/web/src/assets/vite.svg
**Found:** 2026-10-18 by /audit (scope: application source and manifests; lens: quality, obsolete code only)
**Why it matters:** No references to these asset names were found in current web source, entry HTML or Vite config. They remain from the starter UI and add repository clutter. No bundle-size impact is claimed without bundle inspection.
**Suggested fix:** Delete these three source assets after approval. Existing app components and styles do not require replacements. Current requirement lost: None identified.
**Resolution:** Removed at user request on 2026-10-18. Manifest and lockfile updated offline; demo code/tests and three images deleted. Server tests (40), web build and server lint pass; focused root/database tests (3) and test typecheck pass after lint repairs. Re-reviewed on 2026-10-19: removed files and dependencies remain absent, current route registration and source references do not reintroduce them. Closed by this quality audit; no independent review performed.


### F-04 [P3] closed - Current documentation retains pre-refactor descriptions

**File:** apps/server/README.md:9; docs/architecture.md:69; docs/status.md:33
**Found:** 2026-10-19 by /audit (scope: current docs and nearby backend; lens: quality)
**Why it matters:** The server README names the removed storage/ module and says no extra packages are needed. Architecture describes search on GET /api/history, although filters use POST /api/history/search. Status repeats superseded verification counts and detailed completion history already retained in the archive.
**Suggested fix:** Update the README and API list, summarize current verification once, and link the existing completion archive for history. Current requirement lost: None.
**Resolution:** Corrected the README/module and migration descriptions, history-search API and current status summary. Local links (20 Markdown files) and diff checks passed. Re-reviewed on 2026-10-20 after the user-approved documentation consolidation: the original files were removed, retained setup/storage instructions match the current implementation, and the overview points to the public route modules. Superseded descriptions and duplicate status counts are absent from active docs. Closed; original file references above are historical.

### F-05 [P3] closed - Diagnostics retain the removed driver's error format

**File:** apps/server/src/database/diagnostics.ts:8
**Found:** 2026-10-19 by /audit (scope: diagnostics and callers/tests; lens: quality)
**Why it matters:** Application database access uses better-sqlite3, whose SqliteError carries a string code. The ERR_SQLITE_ERROR compatibility entries and numeric errcode mapping remain from node:sqlite and are exercised only by old synthetic test errors.
**Suggested fix:** Remove the old-driver code entries and numeric mapping; retain the current driver allowlist, Drizzle cause unwrapping and safe metadata-only logging. Update diagnostic tests to use the current driver format. Current requirement lost: None; public error contracts remain unchanged.
**Resolution:** Removed old-driver entries and numeric mapping; updated current-driver and Drizzle-wrapper safety assertions. All 66 server tests, server lint and targeted formatting passed during implementation. Re-reviewed on 2026-10-20: diagnostics unwrap Drizzle causes and allow only current string driver codes, with no legacy numeric mapping. The focused Repository diagnostics test passed (1 test); private error fields and the fixture's extra numeric errcode are not emitted or interpreted. Closed without changing application code.
