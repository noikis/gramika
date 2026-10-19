# Feature: Single-container packaging and persistent SQLite

**From build-plan:** feature 6b
**Build attempt:** 1
**Status:** verified
**Branch:** feature/single-container-packaging-and-persistent-sqlite
**Archive:** blueprint/history/features/06b-single-container-packaging-and-persistent-sqlite.md

## Goal

Run the existing Fastify API and built React frontend in one local production
container, retaining SQLite history and model preference across container
recreation. Preserve the mandatory production proxy policy without paid calls.

## In scope

- Serve the Vite build and existing API from one Fastify process and origin.
- A multi-stage Dockerfile, explicit build-context exclusions and a Compose
  service with a named SQLite volume, local port binding and bounded logs.
- Ship compiled server/contracts, production dependencies and Drizzle migrations.
- Reuse GET /health for the container health check without upstream probes.
- Document local build/start/recreate operations, private runtime configuration,
  storage lifecycle and observed verification limits.

## Out of scope

- Backup/restore and moving the user's existing database into a volume (6c).
- Deployment, push, publishing, auth, TLS, domains or external-access setup.
- VPN/proxy infrastructure, monitoring, new health endpoints or paid model tests.
- Database schema changes, new UI behavior, benchmark execution and CI setup.

## Build loop

Approve this spec before `/implement`. Review the completed feature once after
all small steps (`stepReview: feature`); do not create checkpoint commits.
Review belongs to the user; no automatic review subagent. Run relevant checks
during implementation and reuse unchanged passing evidence at completion.
`/complete` owns the final commit and bookkeeping; this spec authorizes neither.

## Build steps

1. [x] Serve the built frontend through Fastify.
   - Replace the placeholder root response in packaged production mode with the
     Vite index and serve its assets, including bundled fonts, from a fixed build
     directory. Keep separate Vite/API development usable.
   - Use a stable Fastify-compatible static plugin if no suitable dependency is
     already installed; verify compatibility before adding it. Avoid a bespoke
     file server or another serving process.
   - Enable packaged serving with `NODE_ENV=production`; resolve the build path
     relative to server artifacts, independent of the shell working directory.
     Missing required production frontend artifacts must cause a clear startup
     failure without disclosing paths or secrets in public responses.
   - The UI uses in-memory navigation, so no new SPA catch-all is required.
     Unknown API routes and missing assets remain 404; static serving must not
     expose server sources, environment files, databases or parent directories.
   - **Done when:** focused Fastify inject tests demonstrate index/asset content
     and content types, missing-file behavior, path confinement, unchanged API
     and /health routing, and usable API-only development. Server tests, server
     lint and the web build pass.

2. [x] Package one production service with durable storage.
   - Build from the root lockfile with npm workspaces and a compatible stable
     Node LTS Linux image. Build native better-sqlite3 for that runtime/platform;
     never copy host node_modules. Preserve existing TypeScript settings.
   - Copy built web/server/contracts, workspace manifests and runtime dependencies
     into the final image. Include apps/server/drizzle SQL and metadata at the
     location expected by compiled migrations. Do not compile at container start.
   - Run as a non-root user with a writable server-relative `data` directory;
     retain default `data/gramota.sqlite` without a `SQLITE_PATH` override. Set
     `GRAMOTA_ENV=production` and `NODE_ENV=production`. Mount
     `/app/apps/server/data` as a named volume
     so SQLite database and journal sidecars share the same persistent filesystem.
   - Supply API key and proxy only at runtime through private environment values;
     never pass them as image build arguments. Compose must retain production
     mode and the volume path rather than importing development defaults.
   - Exclude .env files, local databases and sidecars, benchmark-data, logs,
     node_modules, Git metadata and unrelated private/local artifacts from the
     build context. Use narrow image copies; no secrets or personal data in layers.
   - Bind Fastify to `0.0.0.0:3000` inside the container; publish only
     `127.0.0.1:${GRAMOTA_PORT:-3000}:3000` for local verification, allowing the
     user to change the published host port through `GRAMOTA_PORT`. Use existing shutdown hooks
     so container stop closes transport and SQLite cleanly.
   - Configure a local GET /health health check using the included Node runtime;
     retain existing 200/503 semantics. Configure Docker log rotation with
     `json-file`, `max-size: 10m`, `max-file: 3`, preserving privacy-safe logging.
   - **Done when:** image build and Compose configuration validation pass, the
     container serves index/assets and API from one port, fresh storage migrates
     successfully, non-root SQLite writes work, health reports the existing
     readiness state, and stopping the container exits cleanly. No real secrets
     are required for these checks.

3. [x] Verify recreation and production proxy failures; document operation.
   - Use only an explicitly named disposable verification volume and synthetic
     records. Seed a completed correction/request through the existing database
     repositories in the image and change the model preference through the API.
     Do not add a production seed endpoint or change the OpenRouter target.
   - Record IDs and expected values, stop/remove only the verification container,
     recreate it using the same volume and compare history details and selected
     model through the API. Repeat startup must not reset preference or duplicate
     migrations. Remove disposable resources only after verifying their identity;
     never use volume-deleting commands against the user's storage.
   - Exercise missing/invalid production proxy with a fake key: correction stays
     unavailable and /health returns 503. With a syntactically valid unreachable
     local proxy and fake key, correction fails without a successful result or
     lost original. Run this case with external networking disabled.
   - Reuse or extend existing mocked transport tests to prove zero direct
     dispatcher selection and no retry after proxy failure. Container failures
     alone do not prove absence of a direct fallback. No real OpenRouter calls,
     public IP probes, private .env reads or benchmark commands.
   - Add concise container instructions and update architecture/environment/status
     documentation. Explain volume retention, destructive volume removal, runtime
     secrets, proxy reachability from containers and log rotation. A persistent
     volume is not a backup. Record actual container evidence separately from
     the user's earlier VPN-off observation and deferred infrastructure checks.
   - **Done when:** recreation preserves exact synthetic history/results and
     model preference, the container proxy failure cases and mocked no-fallback
     assertions pass, and server tests/lint plus the web build pass for changed
     code. Report missing Docker daemon/image/network prerequisites immediately;
     leave container acceptance incomplete if it cannot actually be run.

## Files / areas

- Root Dockerfile, .dockerignore, compose.yaml and root lockfile if needed.
- apps/server/package.json, src/app.ts, src/routes/root.ts and focused static
  serving code/tests; existing app-resources shutdown and logging behavior.
- apps/server/drizzle/, compiled server/contracts and apps/web/dist artifact layout.
- Existing correction-config and transport tests; database repositories for
  disposable verification only, without application schema changes.
- docs/architecture.md, docs/environments.md, docs/status.md and container operation
  instructions. Change other context only when necessary to remove stale claims.

## Data / contracts

Keep existing API/Zod contracts, model registry, strict-v3 request policy,
transactional migrations and interrupted-attempt recovery. Only production GET /
changes from placeholder JSON to frontend HTML. SQLite history, request records,
metrics and model preference retain their existing schema. Production uses only
the configured HTTP(S) proxy; missing/invalid configuration blocks correction,
and proxy errors never select direct transport. Credentials stay server-only;
logs and verification artifacts contain no personal text, SQL parameters or keys.

## Testing

No combined Verify command is configured, so none was run for this planning pass.
Use `npm test -w apps/server`, `npm run lint -w apps/server` and
`npm run build -w apps/web` during implementation; server tests already build
server/contracts. Check formatting for changed files. Run web lint if web source
changes. Container evidence must use the actual final image and disposable data.
Verification on 2026-10-19:

- `npm test -w apps/server`: 80 passed, including static routes and existing
  mandatory-proxy/no-direct-dispatch assertions; server/contracts built and test
  TypeScript checked by that command.
- `npm run lint -w apps/server` and `npm run build -w apps/web`: passed.
- Targeted Prettier checks, `node --check scripts/verify-container.mjs` and
  `git diff --check`: passed.
- `docker build -t gramota:6b-check .`: passed with Linux native SQLite runtime.
- Compose validation with `--env-file NUL` and fake values: passed, including
  `GRAMOTA_PORT=38173`, loopback binding and log rotation options.
  Revised storage validation confirms the volume targets `/app/apps/server/data`
  and Compose does not set `SQLITE_PATH`, preserving the server-relative default.
- `node scripts/verify-container.mjs`: passed on the built image. Verified
  packaged HTML/assets/API, non-root SQLite writes, fresh/stable migrations,
  exact history and preference through recreation, graceful exit, image file
  exclusions, health-check command exits, and proxy failures without external
  networking. Disposable labelled resources were removed.

Manual Audit/Check/independent-review gates were not selected by configuration;
no independent review was requested. Existing findings F-04 and F-05 remain
fixed P3 awaiting manual review; no P0/P1 blocker is recorded. Check guide was
generated for the configurable-port frontend path; it is not acceptance evidence.
Real container VPN routing, backup/restore and phone clipboard remain unverified.

No browser harness is configured. Any Playwright MCP action requires prior
explicit user approval naming its target URL or browser action.

## Notes for the AI

This is a first build; no prior feature 6b archive was found. The planned branch
and archive path are available. Start from the clean master checkout inspected
during planning; do not reuse another work item's branch.
6a is checked complete and its health/logging code is present. Overview/status
contain older progress wording; use current code and the build-plan checkbox for
that boundary. Do not turn this feature into backup tooling or VPN setup.

## Completion notes

Completed and accepted by the user on 2026-10-19. The final implementation
includes these user-approved amendments to the original spec:

- Use only NODE_ENV. The image sets production once; Compose does not forward
  the development NODE_ENV from the root file.
- One private root .env and root .env.example serve development and Compose;
  the web needs no env file. Root env loading is independent of working directory.
- Retain server-relative data/gramota.sqlite with the named volume mounted at
  /app/apps/server/data. No image or Compose SQLITE_PATH override.
- GRAMOTA_PORT selects the loopback host port. Compose uses restart:
  unless-stopped and bounded Docker logs.
- The temporary verify-container helper was removed at the user's request.
  No permanent verification script remains.

Passing evidence from this chat was reused without repeating unchanged gates:
server tests (including the final root env loader tests), server lint, targeted
formatting, web build, Docker image builds, Compose validation, and disposable
container checks for migrations, non-root writes, history/preference retention,
shutdown and offline proxy failures. Final root env loading was verified through
mocked loader tests and Compose validation after the prior image checks.
The user observed the expected NOT_CONFIGURED warning in a local production
container without a proxy; this is intentional production policy.

No independent review was requested. No blocking code issue remained after the
restart policy was added. Existing fixed P3 findings remain in the live ledger.
Backup/restore is still feature 6c. Actual production proxy/VPN routing and phone
clipboard behavior remain unverified. The user owns pushing and deployment;
completion does not authorize SSH, push, remote changes or deployment.
