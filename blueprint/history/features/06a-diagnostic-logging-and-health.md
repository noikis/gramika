# Feature: Diagnostic logging and health

**From build-plan:** feature 6a
**Build attempt:** 1
**Branch:** feature/diagnostic-logging-and-health
**Status:** verified

## Goal

Provide minimal privacy-safe failure diagnostics and one local health endpoint.
Scope and implementation were approved in chat. Speech-to-text "login" means logging.
The prior verified cleanup spec is preserved in history/fixes/2026-10-19-cleanup-spec-handoff.md.

## In scope

- Existing Fastify/Pino only, JSON production output and existing pretty development output.
- Disable routine request logs. Keep startup/shutdown and configuration/storage failures.
- Log operational correction failures with request ID, safe error code, optional attempt ID and duration.
- Use request-scoped logs for history failures; sanitize unexpected server errors.
- Approved review correction: retain HTTP method, route template and operation while omitting messages and stack traces. Correlate storage failures with the HTTP request. Keep framework response/stream/serialization failures visible without success logs.
- Never log text, search phrases, bodies, headers, credentials, paths, raw provider responses or arbitrary exception messages.
- One GET /health: 200 {status: "ok"}; 503 {status: "unavailable", reason: "DATABASE_UNAVAILABLE" | "NOT_CONFIGURED"}.
- Check database access on each poll and existing configuration validity. Database failure takes precedence. No caching and no polling logs.

## Out of scope

VPN/proxy reachability monitoring, OpenRouter calls, dashboards, new dependencies,
success-event logging, log storage/rotation, containerization, backup/restore and authentication.

## Build loop

One review after implementation, no checkpoint commits. No commit, merge or deployment.

## Build steps

- [x] Configure existing Fastify logging and minimal failure diagnostics. Done when success requests are quiet and captured failure logs omit synthetic private values.
- [x] Register one health route using existing resources and public Zod response contracts. Done when configuration/database cases return the specified status without transport calls or poll logs.
- [x] Document operation and run relevant checks. Done when server tests, server lint, targeted formatting and diff checks pass.
- [x] Simplify the storage failure callback with a named helper; define Zod enums for log operations, log levels and health status; use the existing HTTP status constants as a finite type. Done when the existing behavior/privacy tests and relevant checks pass.
- [x] Retain safe failure context after review. Done when request/route/operation and storage correlation tests pass, framework response failures remain visible, and private values and success events remain absent.

## Files / areas

apps/server/src/{app.ts,app-resources.ts,logging/,http-status.ts,routes/,database/},
apps/server/package.json, apps/server/test/, packages/contracts/src/, apps/server/CORRECTION.md.

## Data / contracts

No persisted changes or migrations. Health is a local configuration/database check,
not evidence of VPN or upstream availability. Existing API error shapes stay intact.

## Testing

Fastify inject, captured JSON logger stream, in-memory SQLite and mocked transports.
Run npm test -w apps/server (includes server/contracts build), server lint and targeted Prettier.
No real network requests, benchmark runs, personal data access or browser automation.

## Notes for the AI

Keep changes small; no logging framework/wrapper or speculative monitoring.
Review belongs to the user. Manual audit/check gates remain manual.

## Current design decisions

- Internal logging/ module with index.ts, options.ts, log-controller.ts and types.ts.
- Named correction storage failure helper stays in routes/correction-errors.ts.
- Zod enums define log operations, log levels and health status; HTTP codes use existing constants.
- User rejected custom stack parsing as overengineering. Remove the extractor and its dedicated tests. Error messages/stacks remain omitted, while method, route template, operation, request/attempt IDs and safe error codes remain available.

## Verification

- npm test -w apps/server: passed, 77 tests, including server/contracts build and test typecheck.
- npm run lint -w apps/server: passed.
- Targeted Prettier and git diff --check: passed.
- Removed the parser-specific test; existing request-context, privacy, storage correlation, framework failure and quiet health tests pass.
- No new dependencies, paid calls, personal data access, commits or live deployment checks.
- Manual audit/independent review remain manual. This internal simplification needs no new try guide.

## Completion notes

Prepared on 2026-10-19 after the user approved the implementation.

- Minimal structured failure logging and one local GET /health endpoint.
- No custom stack parsing, extra service, dependency or VPN probe.
- Reused passing evidence from this chat: npm test -w apps/server (77 tests, including server/contracts builds and test typecheck), npm run lint -w apps/server, targeted Prettier and git diff --check.
- Review was manual. No independent review was requested; no findings were raised for this feature. Pre-existing P3 findings remain in the live ledger.
- Feature 6b owns container packaging, persistent storage and log rotation; 6c owns backup/restore. VPN reachability monitoring remains deferred.
- Completion bookkeeping prepared before commit and local landing approval. Nothing pushed or deployed.
