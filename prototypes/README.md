# Approved UI prototypes

## V2.3 Another opinion (approved)

- [Correction only](another-opinion.html), using the existing shared `theme.css`,
  local Roboto and current dark/emerald palette. No production code changes.
- Correct uses Gemma; the model selector is removed. Another opinion explicitly
  requests Gemini, with its higher cost identified before the action.
- Preview controls show Gemma only, Gemini loading, both results retained, and Gemini
  failure. Gemma remains available throughout; each completed result has its own
  Text/Changes and Copy controls. Both samples deliberately agree.
- Desktop always has two columns: Original and one active Result. Mobile stacks
  Original above that same result switcher. The centered Result/model heading
  has no arrows until both results exist, then only the available direction:
  right for Gemma, left for Gemini. Its center stays fixed as arrows appear.
  Swipe the heading to switch models. The result text remains selectable. Headers identify the
  role and model, with Text/Changes and Copy grouped below each result.
  Clickable highlights feed one compact correction inspector beneath the active
  result on both desktop and mobile. Each model
  retains its own selected correction, Text/Changes view and result scroll position.
  Previous/Next navigates only the inspected model. Switching models retains
  both results. The sample comparisons are hard-coded.
- User approved the direction and Correction-only scope on 2026-10-21.
  History is not prototyped: it displays only requests actually made. A Gemma-only
  entry has no Gemini result or Another opinion action.
- Open the HTML directly. Controls only switch static views; no model calls.
  Paste, Correct and mode selection are disabled. Copy uses the clean sample
  and reports clipboard failure honestly. The final two-column design and
  available-direction arrows were approved by the user on 2026-10-21.
- Refined with Impeccable on 2026-10-21: aligned editor heights, comfortable
  view controls, explicit retained-result failure/loading feedback, keyboard
  focus on the revealed opinion and collapsed prototype-only controls.
- Browser-reviewed at 390px, 800px and the default desktop width. Verified
  second-opinion reveal, loading/failure previews, Retry, independent Text/Changes
  controls and successful Gemini Copy feedback. No model requests were made.
- Mobile navigation refinement verified at 390px: both arrow directions, pointer
  swipes across the heading, separate remembered correction selections and a
  compact inspector. The subsequent two-column refinement was checked on desktop
  and at 390px: initially no arrows, Gemini with only left, Gemma with only right.
  Physical phone touch behavior remains for human review.

## History redesign (awaiting visual review)

- [History v2](history-v2.html): search, model/result/date filters, newest/oldest
  sorting, pagination, and explicit plus/minus expansion controls.
- [No matching results](history-v2-empty.html): search-empty state and clear action.
- Both use the existing shared theme; `history-v2.css` contains scoped layout rules.
  Original approved prototypes are preserved.
- Revised against the implemented History UI: one model per correction in this
  design. Generation time, input/output tokens and cost stay visible; Request
  details groups the existing model/routing, usage/cost, timing/diagnostics and
  sent-parameter fields. Unknown values remain explicitly unavailable.
- Controls retain comfortable touch height with flatter secondary treatments,
  slightly squarer corners, less padding and unboxed plus/minus affordances.
- Mobile filters expand inline, rows truncate long previews, and pagination stacks
  on narrow screens. Desktop uses a wider filter grid.
- Static UI references with fictional content: search, sorting, filters and page
  navigation do not query data. Native expansion, result-view toggles and existing
  clipboard behavior are available. Production search should cover original and
  corrected text; list counts and pagination refer to corrections.
- Playwright inspected the running app and verified the revised prototype at
  390px and 1440px: no horizontal overflow, working expansion and request-detail
  disclosures, responsive filter/detail grids and preserved touch heights.

**Status: both prototypes approved by the user on 2026-10-17.**

Use these as the design reference when preparing the Blueprint build plan and
specifying the UI features. The approval applies to the current correction and
history designs. Do not restart visual discovery or request approval of these
same designs again unless new requirements materially change them.

- [Correction](correction.html)
- [History](history.html)
- [Shared theme tokens and prototype styles](theme.css)

## Agreed design

- Minimal dark interface inspired by WhatsApp dark mode: blue-black background,
  dark panels, vivid emerald primary buttons.
- Roboto, bundled locally in `fonts/` with its license.
- English UI labels. Russian correction content remains supported; the sample
  messages are fictional Russian text, not UI language requirements.
- Mobile priority, consistent margins and comfortable touch targets.
- Original and Result labels outside the text boxes. The input itself forms the
  box, without an additional surrounding card.
- Compact model selection above the original input. No reasoning labels or
  controls. Reasoning must be fully disabled for all models during implementation.
- Paste fills the original input from the clipboard.
- Changes is the default result view. Copy always uses the clean corrected text,
  never diff markup or deleted text. Confirm clipboard success only after success;
  provide a manual path if clipboard access fails.
- History rows show a text preview, date and model. Expand a row to see original
  text, individual model results and request metrics. Keep secondary information
  out of the collapsed list and main correction screen.
- No slogans, explanatory paragraphs, decorative badges or demo-state panels in
  the normal UI.

## Implementation handoff

These are HTML/CSS design references, not implemented product features. Correction
is disabled, data and metrics are fictional, and clipboard controls are small
prototype scripts. Do not copy prototype data or disabled product controls into
the real application. Preserve the product's loading, failure, unchanged-result
and clipboard-failure requirements even though demonstration panels were removed.

Port the shared theme variables into the real UI stylesheet during the first UI
feature. Keep the prototype files and bundled fonts in version control until that
handoff is complete; follow the Prototype/Feature/Complete lifecycle for retiring
the reference HTML. This approval does not authorize a commit, merge, push or
deployment.

Static checks passed for links, script syntax, identifiers and theme references.
User visual review and approval are recorded above. Automated browser verification
was not completed: Playwright's configured Chrome executable was missing, and the
in-app browser blocked local-file navigation. Product behavior and responsive
layout still need verification during implementation.

## V2 correction review reference

[Readable corrections](clean-correction-example.html) is a standalone interactive
reference for V2.1. Open it directly in a browser. It uses synthetic text and
demonstrates selectable highlights, a comparison without strikethrough, and
Previous/Next navigation on desktop and mobile. Highlight spacing still needs
refinement during implementation; this is not a pixel-perfect design approval.

Store future project HTML mockups and illustrations in this directory and link
them with repository-relative paths in Blueprint documents.
