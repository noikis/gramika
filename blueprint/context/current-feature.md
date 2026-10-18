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
