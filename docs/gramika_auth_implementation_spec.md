# Gramika — Authentication Implementation Specification

**Status:** Approved requirements; implementation pending  
**Target repository:** https://github.com/noikis/gramika  
**Application:** https://gramika.noikis.ru/  
**Design reference:** https://gramika-login-concept-2026.helenmeja1969.chatgpt.site  
**Scope:** Authentication, account lifecycle, and separation of user-owned application data only.

> Implement this specification in the existing Gramika app. The design reference is a **visual/interaction prototype**, not working authentication code. Inspect the current repository and its actual schema, routes, and persistence mechanisms before making changes. Prefer the project's existing patterns and minimize unrelated refactoring.

## 1. Decisions already made

| Area | Required behavior |
| --- | --- |
| Authentication library | **Better Auth** |
| Login methods | **Google OAuth + email/password** |
| Registration | **Open to everyone**; no invitations, allowlists, or admin approval |
| Entry flow | **Login first**: anonymous visitors see the login screen, not the correction editor |
| User accounts | One private workspace per authenticated user |
| Existing anonymous data | **Start fresh for all users**, including the owner; no existing records assigned to any account |
| Session | **30-day sliding expiration**; separate sessions on multiple devices; sign out of current session |
| Database | Existing **SQLite + Drizzle** stack; do not add PostgreSQL or an external auth server |
| Deployment | Existing Gramika frontend/backend, served behind its existing reverse proxy |
| UI | Match the approved responsive login concept; preserve light/dark appearance and supported translations |

### Explicitly out of scope

- Rate limiting, OpenRouter spending controls, usage quotas, billing, subscriptions.
- Invitations, user allowlists, roles, admin dashboard, organization/team accounts.
- Two-factor authentication, passkeys, additional OAuth providers.
- Account deletion, changing email, profile editing, and managing devices in a UI.
- Reworking the correction algorithm, diff logic, dictionary/translation UX, or broader frontend architecture.
- Importing or merging pre-authentication corrections/history into any new account.

## 2. User journeys

### 2.1 First visit

1. Unauthenticated visitor opens `/` or a protected Gramika route.
2. They see the approved login screen.
3. They may choose Google, sign in with email/password, create an account, or request a password reset.
4. Successful authentication opens the main correction workspace.
5. A new account starts with **empty correction history and no saved examples**.

### 2.2 Google

1. Click **Continue with Google**.
2. Use the normal Google OAuth authorization-code redirect flow via Better Auth.
3. On success, create the Gramika user if needed or reuse the existing linked user.
4. Redirect to the workspace. On cancel, rejection, or callback error, return to a usable login screen with an understandable message.
5. Any Google account supported by the configured consent screen is eligible. Do not restrict email domain.

### 2.3 Email/password registration

1. Click **Create account**.
2. Enter email, password, and confirmation; validate inputs in the UI and on the server.
3. Create a credential-based account with Better Auth.
4. **Require email verification before email/password sign-in.** Show a clear “Check your email” state and a resend-verification action.
5. After verification, the user signs in and enters an empty personal workspace.

The approved mockup contains no name field. If the installed Better Auth version requires `name` during registration, populate a sensible initial non-unique display name server-side or in the auth client (e.g., from the email local part); do not add an unapproved name form field. No name-based authorization.

### 2.4 Email/password sign-in

- Allow verified accounts to sign in with correct credentials.
- Display an error for invalid credentials, pending verification, or auth-service failure without exposing internal details.
- Preserve non-sensitive form state where helpful; never put passwords in logs, URLs, localStorage, or persistent frontend stores.

### 2.5 Forgot/reset password

1. **Forgot password?** opens the request form.
2. User enters email and requests a one-time reset link.
3. Always show a neutral response such as “If an account exists, we'll send a link” to avoid revealing registered email addresses.
4. Email link opens a proper **Set new password** screen with new password + confirmation. This is an additional screen required by the real flow; the design prototype currently ends at the request state.
5. Invalid, expired, already-used tokens show a recoverable error and an option to request another link.
6. On successful reset, revoke **all existing sessions** for that user and return to sign-in with confirmation.

Use Better Auth's built-in verification/reset token generation and password hashing. Do not implement independent token or password storage.

### 2.6 Repeat visits, switching users, and sign-out

- An active valid session skips the login screen and opens the workspace.
- Sessions survive refresh and browser restart, expire after 30 days of inactivity, and extend on activity according to Better Auth's refresh configuration (e.g. `expiresIn: 30 days`, `updateAge: 1 day`).
- The same account can be signed in on desktop and phone simultaneously.
- Add a visible **Sign out** action to the existing app navigation/user menu; it invalidates the current session server-side and returns to login.
- Another Google account or email/password account signing in on the same browser must never see the previous user's editor content, history, cached results, or persisted drafts.
- After session expiry or revocation, private API calls return `401`, and the frontend routes back to sign-in without an endless redirect loop.

## 3. Identity and account linking

The canonical owner identity throughout Gramika is the **stable Better Auth user ID**, not email, display name, Google profile name, browser ID, or IP address.

- A user may eventually have Google and password credentials linked to the same Gramika user.
- Google login for an existing *verified* same-email credential user must resolve to that existing user when Better Auth's verified-email linking rules permit it; never create two data workspaces for the same linked identity.
- Do **not** enable forced linking based on unverified email or configure `trustedProviders` to bypass verification.
- Do not merge existing users or their histories merely because two email strings match.
- For a Google-first user who later wants a password, use an explicitly verified, library-supported credential-link/set-password flow (such as the supported reset/set-password procedure). Do not fabricate a second user or directly create a credential row.
- If the installed Better Auth version cannot safely support an edge-case link, show a safe actionable error rather than silently attaching accounts.

## 4. Backend integration

### 4.1 Better Auth setup

1. Audit installed Node version, module format (CommonJS/ESM), Fastify configuration, Drizzle driver, existing routes, and deployment topology.
2. Install compatible, pinned **Better Auth** and Drizzle adapter dependencies; use the library's official Fastify integration, not a homegrown session/JWT system.
3. Integrate its `/api/auth/*` handlers on the existing backend and expose session lookup to other routes (e.g. `GET /api/me` or the existing equivalent).
4. Prefer a same-origin browser-to-API deployment via Nginx. Use the actual production origin for callback construction; configure trusted origins explicitly. Support the existing development frontend origin.
5. **Do not blindly convert the whole backend between CommonJS and ESM.** If the current runtime is CJS, introduce the smallest well-tested compatible boundary or an appropriately scoped module change.
6. Preserve all `Set-Cookie` headers and correct response status/headers through the Fastify adapter and reverse proxy; do not allow untrusted Host or forwarded-protocol headers to choose OAuth redirect URLs.

### 4.2 Configuration and secrets

Provide documented environment variables, including:

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Strong stable secret; never commit |
| `BETTER_AUTH_URL` | Canonical base URL, e.g. `https://gramika.noikis.ru` |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| Email transport configuration | Sender address and SMTP/provider credentials for verification and reset emails |

Configure Google Cloud Console with the exact **production** redirect URI `https://gramika.noikis.ru/api/auth/callback/google` and corresponding **local-development** callback. Use only the minimum Google scopes needed for sign-in; no Google Drive/Gmail permissions.

Auth cookies must be `HttpOnly`, `Secure` in production, scoped appropriately, and `SameSite` according to Better Auth's same-origin OAuth/callback needs. Do not store session tokens in frontend localStorage. Use the library's CSRF/origin protections and a non-permissive CORS policy if dev cross-origin requests are necessary.

### 4.3 Email sending

- Implement a real configurable transactional-email adapter for **verification** and **password reset**. SMTP is acceptable; no self-hosted mail server required.
- Local development/test must support a fake or local inbox transport; never silently send real emails in automated tests.
- Keep tokens and complete verification/reset URLs out of application logs and error monitoring.
- Do not mark the production flow finished until the operator has configured and verified working outbound mail delivery.
- Provide user-friendly success/failure messages and a resend-verification flow.

## 5. Database and user-data migration

### 5.1 Auth storage

- Generate the Better Auth schema for the **installed version** and integrate migrations into the existing Drizzle migration workflow (typically users, sessions, linked accounts, verification records).
- Use the existing SQLite database and its persistent production volume/path; migrations must not create an unrelated transient SQLite file.
- Never manually invent password-hash columns or store plaintext credentials.

### 5.2 Ownership of app data

Find **every** user-specific table and persistence mechanism: corrections, original/corrected texts, history, explanations, saved examples, future exercises if already present, and any related child records.

- Add a non-null user ownership relationship for all **new** user-owned records (`userId` referencing Better Auth user ID, or the repository's equivalent).
- Queries, updates, deletes, and detail lookups must always be scoped to the authenticated user on the **server**.
- Never accept a client-provided `userId` as authority. Derive it from the validated session.
- Return `401` for no session. Return `404` or a non-leaking forbidden response for another user's record ID.
- Ensure pagination, aggregates, counters, search/history, caching, and child-record joins do not mix users.
- Check browser persistence (localStorage/Zustand/Query caches): namespace or clear user-sensitive state on sign-out and identity change.

### 5.3 Start fresh, safely

The old app contains anonymous/global data. **Do not give it to the first signed-in user, not even the owner.**

1. Before any migration, create and verify a recoverable backup of the existing SQLite DB (including WAL-consistent state where relevant).
2. Migrate to the new user-owned schema without silently attributing old entries to a new identity.
3. Keep legacy records **inaccessible through the new app**. They may remain only in an archived/backup location during initial rollout; do not expose them through old endpoints.
4. Every created account gets an empty history and separate future data.
5. Document how to restore the backup. Do not delete production content or backups as a side effect of a startup migration.

## 6. Route protection and frontend integration

### Public routes

- Login, sign-up, verification landing/result, password-reset request, password-reset completion, and Better Auth callback endpoints.
- Static frontend assets and any existing public health-check endpoint may remain accessible without a user session.

### Authenticated routes

- Main editor, history, correction details, saved results, and user-specific app pages.
- All application APIs that operate on user content, including correction/explanation requests and existing user-specific features, must enforce a valid session **server-side**, not merely by hiding frontend controls.
- Other standalone services (e.g. WiktApi) are not to be redesigned in this task. Protect Gramika's own routes that invoke or expose those services where they form part of the authenticated app.

### Frontend requirements

- Match the approved login preview on desktop and mobile: warm surfaces, existing green accent, one Google button, divider, email/password form, password reveal control, Create account and Forgot password transitions, loading/errors, light/dark variants.
- Implement full reset-password completion and verification feedback states consistent with the same visual language.
- Support the login screen's approved RU/EN/FR labels through existing i18n conventions **without broadening translation scope for unrelated app pages**.
- Centralize session/bootstrap handling and protected routing. Show a loading state while the initial session is checked; never flash private UI to anonymous visitors.
- Keep the intended post-login location only when it is a safe internal app URL; prevent open redirects.
- Auth actions should not accidentally retry a side-effecting operation. Disable buttons while submitting; keep meaningful accessible feedback.

## 7. Implementation sequence (incremental; do not implement as one giant change)

1. **Audit & setup:** map app entry points, all storage tables and client persistence, existing session assumptions; add Better Auth dependencies and environment example.
2. **Auth backend:** Better Auth config, Drizzle auth schema/migration, Google OAuth, email/password with verified signup, email adapter, 30-day sessions, logout.
3. **Data migration & guards:** verified SQLite backup, owner IDs, scoped repositories/queries, protected API endpoints, legacy isolation.
4. **Frontend:** approved login/sign-up/forgot/reset/verify screens, session bootstrap, auth-aware navigation and sign-out, identity-change state clearing.
5. **Tests & release:** automated tests below, production callback/mail configuration checklist, database restore notes, final regression check.

After each step, run the relevant project tests/build, inspect the diff, and keep correction functionality unchanged. No unrelated refactoring. Report any genuine blocker (e.g. missing email credentials) instead of inventing secrets or shipping a false-success auth path.

## 8. Required tests / acceptance criteria

### Authentication

- [ ] Anonymous visitor sees login first; direct protected route and API requests reject anonymous access.
- [ ] Google first sign-in creates one user; repeat sign-in uses the same user ID.
- [ ] Email/password signup requests verification; unverified user cannot sign in with password; verification succeeds.
- [ ] Valid password sign-in works; wrong password and malformed input fail safely.
- [ ] Password reset request shows same neutral result for known and unknown email.
- [ ] Reset link works once; expired or invalid link fails safely; reset revokes existing sessions.
- [ ] Google and email/password for a safely linked verified identity access one workspace; unsafe links are rejected.
- [ ] User can stay signed in after refresh/restart; session refresh respects 30-day sliding expiration; sessions on two devices coexist.
- [ ] Sign out invalidates the current session; subsequent API calls return `401`.
- [ ] Auth errors, canceled OAuth, missing session, and expired session are recoverable; no redirect loops.

### Isolation and privacy

- [ ] Newly registered owner and other accounts start with **zero** visible old corrections/history.
- [ ] User A creates corrections; user B cannot list, fetch by ID, update, delete, or infer A's data.
- [ ] User A's cached history/text never appears when B signs in using the same browser.
- [ ] All user-specific API routes derive the owner from server-verified session, not request data.
- [ ] Existing anonymous records are backed up and inaccessible; documented restore procedure works on a test copy.
- [ ] Passwords, OAuth secrets, session tokens, and reset/verification tokens are absent from logs and client persistence.

### UI and regression

- [ ] Desktop and narrow mobile layouts match the approved concept; keyboard navigation, labels, focus visibility, disabled/loading states, and errors work.
- [ ] Login/signup/reset/verification copy is correct for RU/EN/FR; light and dark themes remain usable.
- [ ] Corrections, correction highlighting/diff, history display, and existing error handling behave as before after authentication.
- [ ] Existing frontend/backend test suites, type checks, and production builds succeed.

## 9. Handoff / deliverables

The implementing agent should provide:

1. Working source changes and committed Drizzle migrations.
2. Updated `.env.example` / deployment instructions, including Google OAuth callback setup and outbound-email configuration (no real secrets in Git).
3. Automated tests for auth lifecycle, protected APIs, and cross-user isolation.
4. Backup/migration and rollback instructions for the existing SQLite deployment.
5. Short verification report: commands run, passing/failing tests, manual OAuth/email checks, and any external configuration still required.

Do not claim the feature is production-ready until Google OAuth callback, sending verification mail, sending/resetting password mail, and persistence across backend restart have been verified in the intended deployment.

## Official implementation references

- [Better Auth — Fastify integration](https://better-auth.com/docs/integrations/fastify)
- [Better Auth — Drizzle SQLite adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth — Google OAuth](https://better-auth.com/docs/authentication/google)
- [Better Auth — Email/password, email verification, password reset](https://better-auth.com/docs/authentication/email-password)
- [Better Auth — Sessions](https://better-auth.com/docs/concepts/session-management)
- [Better Auth — Account linking](https://better-auth.com/docs/concepts/users-accounts)

**Implementation note:** Better Auth options and integration details evolve. Verify the API against the **pinned installed version**; do not assume a generic blog post's code applies unchanged.
