# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to land while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P3] fixed - Unused OpenRouter SDK dependency

**File:** apps/server/package.json:29
**Found:** 2026-10-18 by /audit (scope: application source and manifests; lens: quality, obsolete code only)
**Why it matters:** The SDK is installed but has no application/test imports. Corrections use the Undici transport in apps/server/src/openrouter.ts, as previously agreed. Keeping the unused SDK adds dependency maintenance without serving current behavior.
**Suggested fix:** Remove @openrouter/sdk from the server manifest and update the lockfile during the next user-run dependency install. Existing Undici transport replaces it. Current requirement lost: None.
**Resolution:** Removed at user request on 2026-10-18. Manifest and lockfile updated offline; demo code/tests and three images deleted. Server tests (40), web build and server lint pass; focused root/database tests (3) and test typecheck pass after lint repairs. Awaiting manual review; no independent review performed.

### F-02 [P3] fixed - Fastify demonstration route and support decorator remain active

**File:** apps/server/src/routes/example/index.ts:4; apps/server/src/plugins/support.ts:9
**Found:** 2026-10-18 by /audit (scope: application source and manifests; lens: quality, obsolete code only)
**Why it matters:** Autoload still registers /example, returning 'this is an example', and the someSupport decorator, returning 'hugs'. Only scaffold tests consume these demonstrations; production correction/history code does not. The sensible plugin is also registered without observed product callers of its utilities.
**Suggested fix:** After user approval, remove demonstration route/decorator and their corresponding scaffold tests. Remove sensible and its dependency if no utility is retained. Keep the root route until its intended health-check role is decided. Removing /example changes an exposed endpoint, so this is a cleanup decision rather than an automatic repair. Current product requirement lost: None identified; demonstration endpoint/decorator behavior would be removed.
**Resolution:** Removed at user request on 2026-10-18. Manifest and lockfile updated offline; demo code/tests and three images deleted. Server tests (40), web build and server lint pass; focused root/database tests (3) and test typecheck pass after lint repairs. Awaiting manual review; no independent review performed.

### F-03 [P3] fixed - Unreferenced web scaffold image assets

**File:** apps/web/src/assets/hero.png; apps/web/src/assets/react.svg; apps/web/src/assets/vite.svg
**Found:** 2026-10-18 by /audit (scope: application source and manifests; lens: quality, obsolete code only)
**Why it matters:** No references to these asset names were found in current web source, entry HTML or Vite config. They remain from the starter UI and add repository clutter. No bundle-size impact is claimed without bundle inspection.
**Suggested fix:** Delete these three source assets after approval. Existing app components and styles do not require replacements. Current requirement lost: None identified.
**Resolution:** Removed at user request on 2026-10-18. Manifest and lockfile updated offline; demo code/tests and three images deleted. Server tests (40), web build and server lint pass; focused root/database tests (3) and test typecheck pass after lint repairs. Awaiting manual review; no independent review performed.

