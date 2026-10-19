# Fix: Organize contracts and backend modules

**Type:** Fix
**Branch:** fix/organize-contracts
**Status:** verified

Approved in chat. Organize contracts and backend modules, separate Node SQLite
responsibilities, and improve naming, spacing and reuse. Preserve public HTTP
behavior, saved data and benchmark restrictions. Leave all changes uncommitted.

## Steps

- [x] Extract models.ts, correction.ts and history.ts; retain index.ts re-exports.
  Done when existing consumers build and mocked server tests pass.
- [x] Separate declarations and logical steps with blank lines; keep inferred
  types beside their schemas and update the coding standards.
  Done when focused formatting and diff checks pass.

- [x] Rename the default model constants to DEFAULT_MODEL_ID and
  DEFAULT_MODEL_NAME and update imports, default selection and existing tests.
  Done when server tests, web build and focused lint/format checks pass.

- [x] Move resource setup and cleanup into app-resources.ts; register root,
  correction, history and model-settings routes explicitly from app.ts.
  Done when application routes retain their public responses and error scopes,
  and resources close once, including when transport shutdown fails.
- [x] Extract correction-prompt.ts and openrouter-response.ts, update consumers
  and documentation, and improve spacing throughout touched code.
  Done when mocked tests, server build/typecheck, lint and formatting pass.

Approved backend continuation: database.ts, SQL, migrations and the storage API
are outside this refactor. Preserve prompt text, request parameters, reasoning
policy, mandatory proxy behavior and benchmark restrictions.

- [x] Finish production terminology cleanup and remove private proxy endpoint
  from tracked source, tests and documentation. Validate the configured HTTP(S)
  proxy URL instead of requiring one hardcoded address.
  Done when missing/invalid production proxy configuration blocks requests, a
  configured proxy works with mocks, and proxy failure never uses direct access.

User approved prior refactors and explicitly prohibited commits. Production
proxy settings belong in private environment configuration; documentation and
fixtures use a fictional endpoint. Database refactoring is now approved by the user as part of the module reorganization.

- [x] Record and apply schema enum references and shared HTTP status constants
  in backend HTTP, correction and transport code. Name request/response size
  limits in the touched code. Preserve public error values and status mapping.
  Done when builds, mocked tests, lint and formatting pass.

- [x] Group correction, OpenRouter, storage and benchmark into internal modules
  with explicit public entry points. Keep routes and composition at server level.
  Done when imports/builds resolve, CLI stays separate, and configuration/data
  paths remain unchanged after moves. No new workspace package or dependency.
- [x] Separate SQLite initialization, transactional migrations, correction writes,
  history queries/mapping and model preferences. Use object input for beginning
  attempts and named SQL parameters for writes; extract history helpers.
  Done when existing migration, transaction, exact-text, search, metrics and
  restart/recovery tests pass with unchanged schema version 3.
- [x] Give correction small storage/transport contracts; keep provider response
  parsing in OpenRouter and SQLite details in storage. Update mocks, focused
  behavior tests, docs and conventions. Done when server/web builds, existing
  mocked suite, lint and formatting pass. No private data inspection or CLI run.

Approved continuation: keep Node SQLite, preserve all public HTTP contracts,
proxy rules and benchmark policy, and leave all changes uncommitted. Prior
statements deferring database work describe earlier phases and are superseded
by this explicit approval.

- [x] Improve correction/service.ts local names: requestParameters,
  correctionPromise, timeoutPromise, responseDetails, errorCode and startedAtMs.
  Keep deps, control flow, injected interfaces and user extraction unchanged;
  separate response assignment from its error check with a blank line.
  Done when server tests, lint and focused formatting checks pass.

- [x] Define MessageRole once as a Zod enum for system, user and assistant in
  correction/types.ts. Reuse its .enum values in request messages and the strict
  assistant response validator. Preserve all user comments and wire values.
  Done when server builds/tests, lint and focused formatting pass.

## Verification

MessageRole enum: all 61 server test entries, server/contracts builds, test
typecheck, server lint, focused Prettier and diff checks pass. Request role values
remain system/user; response validation still requires assistant. User comments
retained. No benchmark CLI, paid request, commit or merge.


Correction service naming: 61 server test entries, server/contracts builds,
test typecheck, server lint, focused Prettier and diff checks pass. Kept deps,
controller, timer, response, user extraction, interfaces and control flow.
No commit or merge.


Backend modules and storage refactor:

- npm test -w apps/server: all 61 node:test entries pass, including mocked
  provider tests and temporary SQLite migrations, exact texts, transactions,
  history search, preferences, metrics and interrupted-attempt recovery. Added
  a failed-migration rollback test preserving both schema and existing records.
  Includes contracts/server builds and test typecheck.
- npm run build -w apps/web: passed.
- npm run lint -w apps/server: passed.
- npm run format:check -w apps/server: passed.
- git diff --check: passed.
- Node SQLite and schema version 3 retained; no dependency added.
- Correction depends on small recording/transport contracts. Provider parsing
  stays in openrouter/; SQLite stays in storage/. Public module entry points
  exclude benchmark/cli.ts; npm benchmark resolves the relocated CLI, while its
  local data directory and user-only invocation restriction remain unchanged.
- Existing findings are P3 only; no independent review requested. Manual audit
  and runtime Check were not invoked; try guide skipped for an internal refactor.
- No private environment/database inspection, benchmark CLI execution, paid
  model request, commit, merge or deployment.


Named-value cleanup:

- Existing mocked server suite: 59 tests pass; server/contracts builds and test
  typecheck pass. Web build, server lint, server formatting, focused contracts
  formatting and diff checks pass.
- Application/history error values remain defined by Zod schemas. HTTP statuses
  are centralized in http-status.ts; request/response byte limits are named.
- Database refactoring remains deferred; no database edits in this cleanup.
- No added dependency, benchmark invocation, paid call, commit or merge.


Production configuration cleanup:

- All 59 mocked server tests pass, including environment/proxy URL validation,
  invalid configuration preventing transport calls, and no direct fallback.
- Server/contracts builds, test typecheck, server lint, formatting and diff
  checks pass. No paid calls or benchmark CLI invocation.
- Tracked files contain no private proxy address or old environment terminology.
- Documentation uses fictional proxy examples; actual settings stay private.
- Prior changes approved by the user; no commit or merge authorized or performed.


Backend continuation:

- npm test -w apps/server: all 58 mocked tests pass, including route error
  isolation and resource shutdown in both normal and transport-failure cases.
  Includes contracts/server builds and test typecheck.
- npm run lint -w apps/server: passed.
- npm run format:check -w apps/server: passed.
- git diff --check: passed.
- Removed unused @fastify/autoload offline; no dependency additions.
- No further edits to database.ts, SQL, migrations or storage interfaces.
- Previous passing web build is reused; frontend/contracts are unchanged by
  the backend continuation. No browser or paid model verification performed.
- Manual audit/review gates remain manual; try guide skipped for an internal
  refactor with no new user-visible behavior.


Default-model rename: 54 mocked server tests, server build/test typecheck,
web/contracts builds, server lint, focused Prettier and diff checks passed.


- npm run build -w packages/contracts: passed.
- npm test -w apps/server: 54 passing mocked tests, server build and test typecheck.
- npm run build -w apps/web: passed.
- Focused Prettier check of all four contracts source files: passed.
- git diff --check: passed.
- Audit, independent review and runtime Check are manual and were not run.
- Try guide skipped: internal refactor has no new user-visible behavior.
- Existing findings are P3 only; no independent-review request is pending.
No benchmark invocation, paid calls, dependency additions, commit or merge.

## Previous verified work (preserved)

The preceding verified work packet is retained below without completing or
archiving it as part of this refactor.

# Current Feature

## Refresh project context and remove obsolete model validation

**Type:** Fix
**Branch:** fix/refresh-project-context
**Status:** verified

Approved directly by the user's documentation and dead-code cleanup request.
Preserve the existing unreviewed ideas file and its discovery link.

## Scope

- Update AGENTS, current docs, workspace READMEs and Blueprint context to match
  implemented correction/history/model selection and manual-only benchmarks.
- Record the user's VPN-off denial test without claiming deployment is complete.
- Preserve approved roadmap scope and unreviewed status of docs/ideas.md.
- Remove the obsolete model allowlist override and duplicate benchmark model
  schema now that application and benchmark use the same registry.
- Preserve model request parameters, guards, history and personal local data.
- No benchmark invocation, paid calls, dependency changes, commit or merge.

## Steps

- [x] Refresh current documentation and replace stale scaffold instructions.
- [x] Simplify model validation and verify with the existing mocked server suite.
- [x] Check documentation links, build, lint and report remaining limitations.

## Verification

- npm test -w apps/server: 54 passing mocked tests, server build and test typecheck.
- npm run lint -w apps/server and npm run build -w apps/web: passed.
- Focused source Prettier check and git diff --check: passed.
- Current documentation local Markdown targets exist; overview source fingerprint
  matches the updated plans. Historical archives were left unchanged.
- No benchmark entry point, paid call, private environment file or personal
  database inspection. docs/ideas.md remains unreviewed and unchanged.
- No dependency changes, commit, merge, deployment or automatic review.


## Completion notes

- Closed the organization fix at the user's request on 2026-10-19. Scope includes
  contracts, backend internal modules, storage separation, production proxy
  configuration, naming, enum references and readability conventions.
- User reviewed the code except SQL and approved ending this fix. SQL has not
  received the user's manual review; no SQL acceptance is implied.
- Reused passing evidence: npm test -w apps/server (61 test entries, builds and
  test typecheck), npm run build -w apps/web, npm run lint -w apps/server,
  npm run format:check -w apps/server and focused formatting checks.
  git diff --check also passed during completion. No checks repeated solely
  for completion. No independent review or audit was requested.
- Preserved unresolved fixed P3 findings in the live findings ledger, along with
  unrelated worktree edits and the user's personal comments.
- Drizzle adoption is the next separate task. No ORM/migration tool was installed
  and the proposed numbered-migration split was not implemented.
- Bookkeeping archived and active context reset. All source and bookkeeping
  remain uncommitted on fix/organize-contracts under the user's standing
  no-commit instruction. No commit, merge, push or deployment performed.
