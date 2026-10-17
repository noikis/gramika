# Feature: Responsive correction workspace

**From build-plan:** feature 1
**Build attempt:** 1
**Branch:** feature/responsive-correction-workspace
**Archive:** blueprint/history/features/01-responsive-correction-workspace.md
**Status:** verified

## Goal

Replace the Vite demonstration with the approved, responsive Gramota input
workspace. Users can type and paste Russian messages and navigate between the
Correction workspace and an honest History-unavailable view. This feature makes
no correction requests and presents no invented output or stored records.

## Design reference

- [Approved correction prototype](../../prototypes/correction.html)
- [Shared theme](../../prototypes/theme.css)
- [Approved design handoff](../../prototypes/README.md)
- [History prototype](../../prototypes/history.html), for navigation context only;
  its real entries and results belong to Feature 4.

Both prototypes were approved on 2026-10-17. Preserve blue-black surfaces, vivid
emerald primary actions, bundled Roboto and English UI. Original and Result
labels sit outside their text boxes. The textarea is the input box, without an
additional card. Port theme tokens before building the feature UI. Do not carry
sample messages, metrics or Model A/Model B into the application.

## In scope

- Tailwind Vite integration and only the local shadcn components needed now:
  Button and Textarea, adapted to approved tokens and accessible touch targets.
- Correction/History navigation, an initially empty controlled Original textarea,
  Paste, and a Result area with clear unavailable/empty messaging.
- Model placement matching the prototype, with a disabled, accurately labelled
  unavailable state until a real model is configured in Feature 2. Do not show a
  fabricated model name. Interactive switching arrives in Feature 5.
- Correct and Copy remain unavailable, with a concise explanation associated
  with the controls. No nonfunctional Text/Changes switch before Feature 3.
- Desktop, intermediate and narrow-phone layouts; keyboard access, safe text
  rendering and clipboard pending, success, empty and failure states.

## Out of scope

OpenRouter, server changes, public API contracts, SQLite, persistent drafts or
history, request limits, live correction, Copy of real results, diff, model
switching, reasoning controls, authentication, deployment and CI/test-runner setup.
No auto-correction on input or clipboard polling. No added font or icon packages.

## Build loop

After spec approval, create the recorded branch and implement the steps in order.
`workflow.stepReview` is `feature`: present one review packet after all small
steps and checks. `checkpointCommits` is `disabled`; do not create checkpoint
commits. `/complete` owns the final feature commit and landing approval.

The user will install dependencies. Do not run npm installation or package
generators on their behalf. From the repository root, the agreed commands are:

```powershell
npm install -D -w apps/web tailwindcss @tailwindcss/vite
npm install -w apps/web @radix-ui/react-slot class-variance-authority clsx tailwind-merge
```

Before implementation, check those packages in the web manifest and root lockfile
and verify they resolve. If missing or incompatible, report the exact dependency
issue and wait for the user to install or adjust them. Preserve unrelated user
changes. This is the planned UI dependency setup, not permission to expand scope.

## Build steps

- [x] 1. **Integrate the styling foundation.** Verify user-installed dependencies,
  add the Tailwind Vite plugin, port approved tokens into the application CSS
  theme and add local Button/Textarea components plus the small class-name helper.
  Use the documented Radix shadcn component source as the starting point; adapt
  its appearance rather than importing an entire component collection. Copy
  bundled Roboto files and license into the served web assets. Prefer relative
  imports over new alias configuration when aliases are unnecessary.
  **Done when:** the current app still mounts, local fonts resolve without a
  third-party font request, and `npm run build -w apps/web` plus
  `npm run lint -w apps/web` pass with the styling integration.

- [x] 2. **Build the workspace and navigation.** Replace scaffold JSX and styles,
  update the document title, and render the approved shell with English controls.
  Keep the original as React state above the two view bodies so navigating to
  History and back preserves the draft within the mounted session. Use simple
  component view state and accessible navigation buttons; do not add a router or
  claim URL/deep-link contracts in this feature. History says it is not available
  yet, rather than pretending an empty database was queried. Result is empty and
  explains correction is not available yet. Correct, Copy and model selection are
  disabled with associated explanations. Do not render sample output or a
  Text/Changes toggle. No extra mode, tone, language or reasoning selectors.
  **Done when:** typing preserves Russian, emoji and line breaks; navigation keeps
  the draft; no correction/history request is made; keyboard users can identify
  the current view; build and lint pass.

- [x] 3. **Implement user-triggered Paste.** Use the native Clipboard API only
  after clicking Paste. A successful nonempty read replaces the Original value
  with the exact clipboard string and focuses the input, matching the prototype.
  Prevent overlapping reads and announce pending/success accessibly. If clipboard
  text is empty, preserve the existing draft and announce that the clipboard is
  empty. If the draft changes while a read is pending, preserve the newer draft
  and ask the user to paste again. Missing API, insecure context, denial and
  unexpected read failures leave text unchanged and provide concise manual-paste
  guidance associated with Original. Clear stale feedback on a new attempt or
  user edit; never announce success before the read completes. No clipboard data
  in logs, storage, analytics or network requests.
  **Done when:** direct typing and native manual paste work; successful Paste
  preserves content exactly; empty, denied, unavailable, pending and edited-draft
  cases do not lose user text; build and lint pass and clipboard checks are
  recorded using available manual/browser evidence.

- [x] 4. **Verify responsive and accessible behavior.** Compare the real app to
  the approved design at 360px, 720px, 768px and 1280px widths, including a long
  multiline draft and keyboard focus. Wide editors are side by side; at the
  prototype's narrow breakpoint they stack with full-width primary actions,
  consistent mobile margins and no horizontal overflow. Labels, pending/error
  announcements and disabled-control explanations remain readable. Render all
  user content as text; never inject clipboard HTML. Run final web build and lint.
  **Done when:** record viewport and keyboard/clipboard observations, passing
  commands, any unavailable evidence and a short Try it now path. An unavailable
  browser tool is a verification gap, not a passing check.

## Files / areas

- `apps/web/package.json` and root `package-lock.json`: dependency changes made
  by the user; implementation verifies and preserves their intended scope.
- `apps/web/vite.config.ts`: Tailwind plugin alongside the existing React plugin.
- `apps/web/src/index.css`, `App.css`: portable theme, base styling and responsive
  layout; remove scaffold CSS from runtime use without unrelated refactoring.
- `apps/web/src/App.tsx`: reachable shell, navigation state and draft ownership;
  small workspace components may live alongside it under `src/components/`.
- `apps/web/src/components/ui/button.tsx`, `textarea.tsx` and `src/lib/utils.ts`:
  minimal local shadcn components and helper, imported by the real app.
- `apps/web/public/fonts/`: copied Roboto fonts and OFL license; reference them
  through Vite-served URLs rather than reading from `prototypes/` at runtime.
- `apps/web/index.html`: Gramota title, English document language, existing
  viewport metadata. Stop using unrelated scaffold branding.
- `prototypes/`: approved reference, not application code. Preserve until theme
  and needed design references have been handed off under the feature lifecycle.

## Data / contracts

Client memory only: exact draft string, active view, clipboard pending state and
transient feedback. No new persisted data, API, server trust boundary, public URL
shape, text-length limit or validation policy. Empty text is a valid draft.
Browser clipboard access can be denied; it is never assumed or requested before
the user invokes Paste. Treat clipboard contents as untrusted plain text.

Server-side model and mandatory Home Lab proxy rules remain unchanged. This
feature sends no correction text or history anywhere and makes no paid calls.

## Testing

There is no declared combined Verify command, web test command or Browser tests
command. Do not install a runner or add server tests for client-only changes.
The final automated gates are `npm run build -w apps/web` and
`npm run lint -w apps/web`. Use direct browser/manual evidence for layout,
keyboard and clipboard cases in the steps; include Unicode and multiline input.

No dev server or automated checks were run during specification. Playwright MCP
permission in this chat currently covers prototypes only; ask explicitly for the
implementation's target URL/action before using it on the app. Earlier prototype
browser attempts failed because configured Chrome was missing; do not claim that
this proves the production UI. The implementation must obtain actual evidence
or report the precise remaining verification limitation.

## Notes for the AI

- Keep the user-approved look and the feature boundaries. Feature 1 is usable
  text entry, not simulated LLM behavior or a second prototype.
- Preserve current TypeScript settings and npm workspace conventions. No backend,
  contracts or persistent schema changes are needed.
- Do not add UI noise to explain implementation phases. Use short, honest
  unavailable states where functionality has not been implemented.
- The user owns dependency installation. Do not silently install tools or run a
  scaffolder in this repository.
- Branch/archive identity checks found no prior build record, branch collision,
  archive filesystem entry or prior Git use of the archive path. Freeze attempt
  1 and the recorded names; implementation must recheck before branch creation.
- The reasoning-settings storage question belongs to Feature 2 and does not
  block this client-only workspace.

## Verification evidence

Implementation is on `feature/responsive-correction-workspace`. The user
approved continuation after installing the requested dependencies. No commits,
merges, pushes, deployments or agent-started development servers were performed.
User dependency changes in the manifest and root lockfile were preserved.

- `npm ls -w apps/web --depth=0`: requested packages resolve.
- Final `npm run build -w apps/web`: passed (TypeScript and Vite).
- Final `npm run lint -w apps/web`: passed.
- `git diff --check`: passed, with Windows EOL advisories only.
- The user started the server and explicitly approved browser checks at
  `http://localhost:5173`. Playwright MCP could not launch because its configured
  Chrome executable is absent. The available in-app browser supplied live evidence.
- Live DOM/layout measurements at 360, 720, 768 and 1280 CSS-pixel viewport widths:
  no document horizontal overflow; single-column editors through 720 and two
  columns at 768/1280; full-width primary actions on narrow layouts. Temporary
  browser viewport overrides were reset after verification.
- Live checks: initially empty draft; accurate unavailable states; Russian, emoji,
  multiline and literal HTML-like text entry; navigation retained the draft;
  Paste inserted exact multiline clipboard text and focused Original; empty
  clipboard preserved the draft; native keyboard paste worked; editing cleared
  feedback; Shift+Tab focused Paste with a visible emerald ring. A 6,750-character
  multiline draft scrolled within the input without horizontal page overflow.
- In-app console warning/error query returned no entries.
- Focused compiled-hook checks using mocked React state/refs and Clipboard API:
  success, Unicode/plain-text preservation, empty clipboard, denial, missing API,
  insecure context, unexpected sanitized failure, overlapping reads and preservation
  of a newer draft during a pending read all passed. No runner was installed and
  no web test command was invented. These checks do not prove native browser
  permission-denial or phone clipboard behavior.
- Roboto is bundled in served web assets with OFL license; CSS has no remote font
  dependency. The live page reports Roboto and renders the intended typography.

Regular gates: Audit and Check are manual and were not invoked. During Complete,
the `when-sensitive` independent-review gate was selected because clipboard
handling processes user data. The earlier implementation handoff classified this
as ordinary UI; completion corrects that classification. Independent review
must pass against an approved immutable checkpoint before archival. The findings
ledger currently contains no findings; the review request will be prepared after
checkpoint approval. The `when-testable` guide policy selected the safe
input/navigation path below.
Appearance and native clipboard behavior on a physical phone remain a later
manual check; no live correction or persistence evidence is claimed.

## Try it now

Run or do:

Open the running app at [localhost:5173](http://localhost:5173), type a short
message in Original, click History, then click Correction.

Expected:

History says "History is not available yet." Returning to Correction preserves
your message. Correct and Copy remain disabled; no generated result appears.

This proves:

Text entry and navigation preserve the in-memory draft without simulated results.


<!-- blueprint:completion {"schemaVersion":2,"specBytes":14035,"specSha256":"c57fc6179809f6077a7a1112ca1c76033ffe5fd4087030446f876d2e84a386d4","branch":"refs/heads/feature/responsive-correction-workspace","head":"f3c69af78ab1e3418d68ca4f97e2add8ca1c8951","baseRef":"refs/heads/master","baseCommit":"aa06ee440af584ebaa0776d70dae691be175fb9c","sourceTree":"968814d00fa81c02ea7451d8ffab3227bfe26f9b","landing":"local-merge","absentOptional":[]} -->

## Independent review

# Independent Review

**Status:** passed
**Target commit:** f3c69af78ab1e3418d68ca4f97e2add8ca1c8951
**Base commit:** aa06ee440af584ebaa0776d70dae691be175fb9c
**Base ref:** refs/heads/master
**Spec hash:** c57fc6179809f6077a7a1112ca1c76033ffe5fd4087030446f876d2e84a386d4
**Prepared by:** codex
**Builder model:** unknown (runtime did not expose exact model)
**Requested reviewer:** codex
**Requested model:** gpt-6.1-sol
**Requested execution:** automatic
**Requested at:** 2026-10-17T08:41:29.730Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** codex
**Reviewer model:** gpt-6.1-sol
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-17T15:02:23.378Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `git rev-parse HEAD`, `git merge-base refs/heads/master f3c69af78ab1e3418d68ca4f97e2add8ca1c8951`, and `Get-FileHash blueprint/context/current-feature.md -Algorithm SHA256`: pass; exact target, recorded base and spec hash match.
- `git branch --show-current`, `git status --short`, staged/unstaged/untracked listings, and `git diff --exit-code f3c69af78ab1e3418d68ca4f97e2add8ca1c8951 -- . ':!blueprint/context/review.md' ':!blueprint/context/findings.md'`: pass; feature branch, no product differences or untracked files.
- `npm run build -w apps/web`: pass; TypeScript and Vite production build completed.
- `npm run lint -w apps/web`: pass.
- `npm ls -w apps/web --depth=0`: pass; declared UI dependencies resolve.
- `git diff --check aa06ee440af584ebaa0776d70dae691be175fb9c f3c69af78ab1e3418d68ca4f97e2add8ca1c8951`: fail; trailing whitespace only at `apps/web/public/fonts/OFL.txt:21`, preserved verbatim from the approved prototype license; not a product defect or required feature gate.
- Read-only Node comparison of the complete lockfile package records: pass; additions/moves correspond to the approved UI dependencies and their transitive/platform packages; existing package records otherwise unchanged; resolved package URLs use the npm registry.
- PowerShell SHA-256 comparison of served fonts/license against `prototypes/fonts/`: pass; all five files match exactly.
- Targeted source searches: completed with PowerShell `Select-String` after `rg` was unavailable; no reachable text logging, persistence, network request, HTML injection, focused/skipped tests or placeholder tests in the changed application code.
- Web tests and Browser tests: unavailable; no commands configured, per repository policy. No runner installed or command invented.

## Evidence

- Runtime handoff identifies this reviewer as an isolated Codex child using `gpt-6.1-sol`, without the builder transcript. Request, target, base, exact tracked-spec bytes and product working-tree state were verified before review.
- Full `aa06ee440af584ebaa0776d70dae691be175fb9c..f3c69af78ab1e3418d68ca4f97e2add8ca1c8951` delta reviewed from scratch: `apps/web/index.html`, `apps/web/package.json`, `apps/web/vite.config.ts`, `package-lock.json`, all changed/new `apps/web/src/` files, the four bundled fonts and OFL license, and `blueprint/context/current-feature.md`. Nearby entry point, compiler/lint scripts and approved prototype/theme references were inspected. Review/findings records are evidence, not product scope; dependencies, generated dist/cache output and unrelated server/contracts code were excluded.
- Quality: component/hook ownership preserves the draft across view changes; minimal local Button/Textarea components and native view state fit the approved spec. Styling carries approved tokens, bundled fonts, 720px stacking and keyboard focus affordances. Honest unavailable states replace prototype output and model placeholders.
- Security: only a user-triggered Clipboard API read receives user text. Text remains in React memory and a textarea value; no HTML insertion, logging, persistence, correction calls or history calls were introduced. Errors are sanitized, and manual-paste guidance remains associated with Original.
- Performance: no polling, background requests or unbounded accumulating collection; one pending read is guarded by a synchronous ref. Clipboard content is held as the current draft only. Build output is 14.71 kB CSS and 256.68 kB JavaScript before gzip, with local font assets.
- Tests/behavior reasoning: reviewed success, empty clipboard, unsupported/insecure context, denied/unexpected failures, duplicate reads and edits during a pending read. Revision comparison occurs before replacement; failures and empty reads preserve text. Pending/success feedback uses a persistent status region. No configured client test suite exists and no skipped/focused/placeholder client tests were found.
- Applicable standards checked: AGENTS.md, configuration, project overview, coding standards, AI interaction guidelines, build-plan feature boundaries, relevant product/architecture/LLM/environment requirements, and the installed Audit independent-review contract. No server, API, persistence, paid-call or deployment behavior was added.
- Recorded implementation browser observations in the verified spec cover 360/720/768/1280 widths, keyboard focus, Unicode/multiline entry, navigation retention and several clipboard states. These are prior evidence inspected, not browser checks independently reproduced by this reviewer. Check is explicitly not required.

## Findings

- None. No P0/P1/P2/P3 findings confirmed across the complete current feature delta. The empty findings ledger is unchanged; no findings accepted, closed or waived.

## Remaining risk

- No configured web test command or Browser tests command is available. Independent signals are build/lint, static review and inspected prior implementation evidence; native clipboard permission denial and physical-phone behavior were not independently exercised.
- No independent live browser/layout run was performed in this Phase B review. The spec records in-app browser evidence and the unavailable configured Chrome executable for Playwright; physical-phone appearance remains a manual check.
- No configured security or performance scanner/benchmark was run; this receipt does not claim a current dependency-vulnerability scan or runtime profiling.
- `rg` is unavailable in the shell; PowerShell source searching supplied the review signal instead, without reducing the reviewed delta.
