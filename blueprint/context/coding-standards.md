# Coding Standards

## Stack and scope

- Use npm workspaces and the root package-lock.json. Do not introduce pnpm,
  Lerna, Turborepo, or additional services without a concrete requirement.
- Web: React 19, Vite 8, TypeScript, client rendering. No Next.js or Server Actions.
- Server: Node.js, Fastify 5, TypeScript. Keep HTTP adaptation separate from logic.
- Contracts: public Zod schemas and inferred types; no server resources or secrets.
- Reuse existing code and dependencies. Keep changes limited to the active task.
- Commands and available verification gates are listed in AGENTS.md.

## TypeScript and naming

- Preserve existing compiler settings; strict mode is not an agreed requirement.
- Prefer inference where clear and explicit types at boundaries; avoid any.
- Components and types use PascalCase; functions use camelCase.
- Follow the surrounding file's formatting. No formatter is configured.

## Structure and rendering

- apps/web/src contains the React entry point, App.tsx, and plain CSS.
- apps/server/src contains app.ts, plugins/, and routes/; the scaffold currently
  uses Fastify CLI and autoload.
- apps/server/test contains node:test tests using Fastify inject.
- packages/contracts currently contains a manifest with Zod, with no source yet.
- docs/architecture.md describes the planned feature/module layout and explicit
  plugin registration. It is a target, not evidence those modules exist.
- Use functional React components and hooks; keep components focused.

## Styling

Current styling is plain CSS in App.css and index.css. Tailwind CSS and shadcn/ui
are selected in the product documents but are not installed. Introduce them only
as part of approved implementation; do not assume a theme or design is settled.
Preserve accessible controls, keyboard interaction, and mobile usability.

## Data, validation, and errors

- OpenRouter is server-only. Keep keys and server dependencies out of web bundles.
- Validate untrusted requests and upstream responses at runtime. Use the planned
  shared Zod contracts for public boundaries when implemented.
- SQLite is selected, but no driver, schema, migration command, or repository
  exists yet. Do not prescribe Prisma or invent migration commands.
- Respect docs/environments.md: Home Lab requires its configured proxy, with no
  direct fallback. Development uses the user's system VPN configuration.
- Preserve input on request failure. Never show truncated or failed responses as
  successful, or report copying before the clipboard operation succeeds.
- Auth and external access are deferred. Do not introduce Clerk or ownership
  fields as if they were current requirements.

> TODO: Choose SQLite access/migrations, API contracts, environment validation,
> exact TypeScript settings, and approved UI design during relevant feature work.

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
