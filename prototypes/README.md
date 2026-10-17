# Approved UI prototypes

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
