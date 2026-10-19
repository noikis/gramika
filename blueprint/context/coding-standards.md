# Coding Standards

## Stack and scope

- Use npm workspaces and the root package-lock.json. Do not introduce pnpm,
  Lerna, Turborepo, or additional services without a concrete requirement.
- Web: React 19, Vite 8, TypeScript, client rendering. No Next.js or Server Actions.
- Server: Node.js, Fastify 5, TypeScript. Keep HTTP adaptation separate from logic.
- Contracts: public Zod schemas and inferred types; no server resources or secrets.
- Reuse existing code and dependencies. Keep changes limited to the active task.
- Commands and available verification gates are listed in AGENTS.md.

## Dependency stability

- Use stable, production-ready dependency releases by default. Prefer maintained
  LTS versions where the package provides an LTS release line.
- Do not recommend or install release candidates, alpha, beta, preview, canary,
  nightly, or other prerelease versions by default, even when an upstream guide
  uses them. Verify that required features exist in the chosen stable release.
- A prerelease is an exception only when a concrete requirement cannot reasonably
  be met by a stable release. Explain the need, stable alternatives, and risks,
  and obtain explicit user approval before recommending installation or changing
  dependencies. Record an approved exception and its reason in docs/decisions.md.

## TypeScript and naming

- Preserve existing compiler settings; strict mode is not an agreed requirement.
- Prefer inference where clear and explicit types at boundaries; avoid any.
- Components and types use PascalCase; functions use camelCase.
- Name boolean variables and internal properties with `is` followed by a
  descriptive word in camelCase, such as `isProduction`, `isDevelopment`, or
  `isAvailable`. Preserve names required by external APIs and public contracts.
- Replace magic numbers with descriptive named constants, even when used only
  once. Include units where relevant; for example, use
  `MAX_RESPONSE_BYTES = 1024 * 1024` for the OpenRouter response-size limit and
  reference `MAX_RESPONSE_BYTES` in the size check.
- Define validated finite value sets once with Zod enums and infer their
  TypeScript types. Reference values through the schema's `.enum` property,
  such as `ErrorCode.enum.INVALID_INPUT`; do not duplicate the set in a
  TypeScript enum. Use named constants for HTTP statuses and typed records for
  mappings between application errors and HTTP statuses.
- Reuse existing definitions and helpers before adding new ones. Keep each
  policy or value in one authoritative place; extract shared code when it
  removes meaningful duplication without adding unnecessary layers.
- Separate independent declarations and logical steps with a blank line. Keep
  tightly related statements together and inferred types beside their schemas.
- Follow the surrounding file's formatting. Both workspaces use Prettier via
  `npm run format -w apps/server` and `npm run format -w apps/web` with matching settings.

## Structure and rendering

- apps/web/src contains the React entry point, App.tsx, and plain CSS.
- apps/server/src/app.ts composes resources and explicitly registers routes/.
  app-resources.ts owns initialization and cleanup. Route modules own HTTP;
  correction/ owns the workflow, prompt and small repository and transport contracts.
  openrouter/ owns Undici and provider response parsing. database/ owns SQLite,
  migrations and repositories/ for correction writes, history queries and model
  preferences. correction/ defines the CorrectionRepository contract required by
  its business logic.
  benchmark/ owns the manual CLI, mocked-testable runner and offline report.
- These backend areas are internal modules, not workspace packages. Import their
  public index.ts from other modules; use direct file imports within a module.
  Correction must not import SQLite, Undici, Fastify, database/ or openrouter/.
  Keep the benchmark CLI out of application startup and all public entry points.
- apps/server/test contains node:test tests using Fastify inject.
- packages/contracts/src contains models.ts, correction.ts and history.ts for
  public Zod contracts, model choices and shared limits. index.ts re-exports the
  public API. docs/architecture.md describes the implemented layout.
- Use functional React components and hooks; keep components focused.

## Repository pattern and database naming

- Always use the repository pattern for database access. Business logic depends
  on repository contracts; repository implementations own queries and transactions.
- Keep connection setup, schema, migrations and database lifecycle in
  apps/server/src/database/. Put repository implementations in its repositories/
  subfolder. Do not name the entire database module repositories/.
- Name repository files <domain>-repository.ts, such as correction-repository.ts,
  history-repository.ts and model-preference-repository.ts. Use Repository rather
  than Store for repository names.
- Name interfaces CorrectionRepository, HistoryRepository and
  ModelPreferenceRepository; name factories createCorrectionRepository(),
  createHistoryRepository() and createModelPreferenceRepository(). Use repository
  for a single injected dependency, or a domain-qualified name such as
  historyRepository when needed to distinguish several repositories.
- Use sqlite-database.ts and SqliteDatabase for initialization, repository
  composition and cleanup. Keep openConnection() and createDrizzleClient() as
  private methods of that class: the former opens and configures the SQLite
  connection, and the latter wraps it with Drizzle. Define DatabaseClient beside
  the class and use type-only imports in repositories and migrations.

## Styling

Styling uses Tailwind CSS and local CSS in App.css, index.css and components/.
Local shadcn-style UI components and Sonner are installed. Preserve the approved
blue-black theme, green accents, local Roboto fonts and English interface.
Preserve accessible controls, keyboard interaction, and mobile usability.

## Data, validation, and errors

- OpenRouter is server-only. Keep keys and server dependencies out of web bundles.
- Validate untrusted requests and upstream responses at runtime. Use the shared
  Zod contracts for public boundaries.
- SQLite uses stable Drizzle ORM with better-sqlite3. Keep the typed schema and
  queries inside database/. Generate migrations with the documented db:generate
  command, review the SQL, and commit SQL plus metadata. Startup applies migrations
  transactionally. Existing tables require one-time baseline registration outside
  the application. Preserve existing data; do not
  use drizzle-kit push against saved databases or enable query/parameter logging.
- Respect docs/environments.md: production requires its configured proxy, with no
  direct fallback. Development uses the user's system VPN configuration.
- Preserve input on request failure. Never show truncated or failed responses as
  successful, or report copying before the clipboard operation succeeds.
- Auth and external access are deferred. Do not introduce Clerk or ownership
  fields as if they were current requirements.

The current contracts, schema, environment validation and tsconfig files are the
implementation reference. Preserve them unless the task requires a change.

## Testing

Server testing is already configured: npm test -w apps/server builds the server,
typechecks tests, and runs node:test through ts-node with c8. The server test gate
applies to server logic changes. Add focused cases for meaningful inputs, errors,
and edge cases; use Fastify inject for routes and stub external LLM calls.
Ordinary tests must not make paid requests or use real personal texts.

Web and contracts have no test command. Do not invent a passing test gate or
install a runner silently; use /tests for explicit setup. Browser automation has
no configured harness; use /tests browser for setup.

When AGENTS.md declares a Verify command, use it as the final automated gate.
Until then, run the relevant documented builds and server tests for affected
code, plus web lint for web changes. Verify and CI setup belong to /ci.
Tests should prove behavior rather than mirror implementation. Keep the existing
server tests in apps/server/test; no Vitest convention is established.

## Browser Verification

For UI and integration behavior, prefer real browser evidence over reading the
code and assuming it works.

- Browser automation is separately opt-in through `/tests browser`. That setup
  reuses a compatible runner or prefers Playwright for supported projects, then
  documents the exact command as `Browser tests` in `AGENTS.md`.
- When `Browser tests` is declared, add focused coverage for stable behavioral
  done-whens when it is proportionate, and run the documented command during
  `/check`. Do not assume it proves visual fidelity, real authenticated-profile
  behavior, browser chrome, or another claim the test does not observe.
- If no Browser tests command is declared, do not add a runner silently in the
  middle of an unrelated feature. Use the available dev server, browser
  screenshots, build output, API output, or manual evidence instead.
- Browser tests are not part of the default Verify command or CI unless the user
  separately chooses that slower gate.
- Browser evidence is especially important for flows that click, type, submit,
  navigate, download files, render complex layouts, or depend on client-side
  state.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
