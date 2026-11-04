# Feature: Separate user workspaces and histories

**From build-plan:** V4.7
**Build attempt:** 1
**Branch:** feat/auth
**Status:** implementing

## Goal

Implement the approved authentication and per-user workspace separation specification in `docs/gramika_auth_implementation_spec.md`, with no SMTP, no email verification, no email reset delivery yet, a pinned stable Better Auth release compatible with Node LTS, a recoverable SQLite backup, and same-origin deployment.

## In scope

- Better Auth on the existing Fastify + SQLite/Drizzle backend.
- Google OAuth and email/password sign-in and registration without email verification.
- 30-day sliding sessions, sign-out, session bootstrap, protected routes, and strict server-derived ownership.
- Backup and legacy-data isolation so new workspaces start empty.
- Responsive login, sign-up, inline forgot-password state, theme and RU/EN/FR support using `prototypes/login_screen.png`.
- Focused auth and isolation tests plus regression builds and lint.

## Out of scope

- SMTP, email verification, email-based password reset delivery, and account recovery implementation.
- Invitations, roles, billing, MFA, passkeys, account deletion, profile editing, and device management.
- Changes to correction, diff, dictionary, translation, or broader frontend behavior.

## Build steps

- [x] Audit current runtime, schema, repositories, routes, client persistence, and deployment configuration.
- [ ] Add pinned Better Auth dependencies, auth schema/migrations, same-origin handlers, Google OAuth, credentials, sessions, and sign-out.
- [ ] Back up the existing SQLite database; add ownership and isolate legacy anonymous data from new workspaces.
- [ ] Protect backend routes and add auth-aware frontend routing, login/sign-up screens, inline forgot-password state, and sign-out.
- [ ] Add focused tests and run server/web builds and lint; document production configuration and restore procedure.

## Testing

Use the repository's declared server tests, web build, server TypeScript build, and web/server lint checks. Do not invoke the manual benchmark command.
