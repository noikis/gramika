---
name: Gramota
description: A calm, mobile-first writing workspace with readable corrections.
colors:
  light-canvas: "#f5f3ec"
  light-paper: "#fffefa"
  light-text: "#24332d"
  light-muted: "#6f7b75"
  light-line: "#dfe3dc"
  light-primary: "#176b4c"
  light-primary-hover: "#0e5038"
  light-on-primary: "#ffffff"
  light-mint: "#e6f1e8"
  light-warm: "#eee9dd"
  light-highlight: "#dbeade"
  light-highlight-soft: "#e4f1e7"
  dark-canvas: "#161819"
  dark-paper: "#222627"
  dark-text: "#eef0ed"
  dark-muted: "#a9b2ad"
  dark-line: "#39423e"
  dark-primary: "#79d3ae"
  dark-on-primary: "#102a20"
  dark-highlight: "#29493d"
typography:
  interface:
    fontFamily: "Manrope, sans-serif"
  writing:
    fontFamily: "Spectral, Georgia, serif"
rounded:
  card-desktop: "22px"
  card-mobile: "17px"
  button-primary: "12px"
  highlight: "5px"
---

# Gramota design direction

## Overview

Recorded on 2026-10-22 for the V2.6 design handoff and subsequent V2.7
implementation. This describes the chosen redesign, not the currently shipped
appearance. It does not mark either roadmap item complete or authorize coding.

The visual reference is the exported [Figma Make app](../prototypes/Redesign%20Gramota%20App/src/App.tsx)
and its [stylesheet](../prototypes/Redesign%20Gramota%20App/src/index.css), inspected
in Playwright on desktop and mobile. The user approved its warm light palette,
larger mobile typography, mode switch, icons, subtle correction highlights, and
correction inspection/explanation presentation.

Use a calm writing workspace: readable text, restrained decoration, generous
spacing, and obvious actions. Preserve the real app's functionality when adapting
the prototype. Its hard-coded corrections, history, metrics, model names and
incomplete controls are demonstrations, not product contracts.

Decision status:

- **Approved:** retain the light palette; use Charcoal & jade for dark mode;
  keep the character counter, both correction behaviors, Text/Changes views,
  existing history controls and separate request results; add the new styling
  and highlighting; provide comfortable labeled Copy/Paste buttons.
- **Approved direction:** request details open in a side sheet on desktop.
- **Proposed for validation:** mobile bottom sheet that can expand for long
  details; precise Copy/Paste placement; a more compact desktop introduction
  and a clearer mobile theme-control position.
- **Deferred naming:** neither Strict nor Gentle is a final mode label. Rename
  later without changing the two behaviors or introducing additional modes.

The palette choice was explicitly Charcoal & jade. A later carousel navigation
to Slate & blue did not change that decision.

## Colors

The frontmatter records the selected baseline colors. Light values come from
the export; dark values come from the Charcoal & jade comparison selected by
the user. Map them to the application's semantic tokens during implementation.

| Role | Light | Dark |
| --- | --- | --- |
| Page background | light-canvas | dark-canvas |
| Cards and writing surfaces | light-paper | dark-paper |
| Main text | light-text | dark-text |
| Secondary text | light-muted | dark-muted |
| Borders and separators | light-line | dark-line |
| Primary action and accents | light-primary | dark-primary |
| Text on primary actions | light-on-primary | dark-on-primary |
| Selected correction | light-highlight | dark-highlight |

Light mode uses warm paper surfaces and deep green actions. Retain its subtle
mint highlights and warm secondary surfaces. Dark mode uses neutral charcoal
surfaces, soft white text, jade actions, and muted green correction highlights.
Use dark text on jade-filled buttons.

The exported brown-black/olive dark palette is rejected. Do not carry its colors
forward merely because they remain in the prototype stylesheet. Slate & blue
and Forest & mint were alternatives, not selected themes.

Support system appearance with an explicit light/dark override. Error, hover,
focus, disabled, notification and overlay colors not specified here must be
derived and checked in context during implementation. Check contrast for normal
and secondary text, controls and focus indicators in both themes; the reference
palette is not a claim that every exported color combination is accessible.

## Typography

Use Manrope for the English interface: navigation, buttons, labels, headings,
model names, filters and request details. Use Spectral for writing content:
original text, corrected text, comparisons, history previews and Russian
explanations. Writing areas keep the same font for mixed-language messages.
The interface remains English. Both families are self-hosted with their SIL
Open Font License notices included alongside the font files.

Observed prototype sizes provide a starting point:

| Role | Desktop | Mobile |
| --- | --- | --- |
| Main introduction | Up to 60px | 40px |
| Input text | 21px, line-height 1.65 | 19px, line-height 1.55 |
| Corrected text | Up to 28px, line-height 1.68 | 22px, line-height 1.7 |
| Result heading | 31px | 27px |
| Supporting text | 14px to 16px | 14px |

These are reference measurements, not a requirement to reproduce the oversized
desktop introduction. Retain readable writing text while reducing unnecessary
travel between input and result. Keep labels and technical details readable.
Following user review, the correction introduction is one short supporting
sentence with a screen-reader heading, not a large visible hero. Keep the Result
label and model name together in a compact interface heading. Original grows
with its content instead of introducing an internal text scrollbar. Its border
stays transparent on focus; use a neutral label cue for keyboard focus.
The export loads fonts remotely; production font packaging remains an
implementation detail, not approval to introduce a new external dependency.

## Layout

Use the export's centered writing column and stacked input/result flow as the
new visual baseline. Its desktop content width is 900px with 20px minimum side
gutters; below 700px it uses 12px gutters and stacks controls. These dimensions
are starting points to validate with the real app's larger history and details.
Above 1440px viewport width, expand the content smoothly from 900px to a 1200px
maximum and the outer shell from 1200px to 1440px. Preserve the existing widths
on smaller screens.

In expanded history on desktop (1024px and wider), put Text/Changes on the left
and Copy, Details and Delete on the right of one toolbar above the result text.
Omit repeated model headings for a single result; show quiet model identifiers
when there are multiple results, with full mode and model information in Details.
Place wide, equal navigation buttons with 24px open chevron icons above two equal,
neutrally styled Original and Corrected comparison columns. Center the counter
and change description between those buttons instead of using a separate
description row. Explanation follows below the comparison; before generation,
Explain is centered and full width at the normal button height.
Navigation labels remain available to assistive technology; the visible counter
uses a small bordered badge with stronger text, separated from the muted description.
Failed requests on desktop use a compact header row with an error icon, Failed
badge and quiet model name. Details stays right-aligned and vertically centered
beside the combined status/model and error-message block. Put the error message directly
below. Hide the redundant standalone status line and mode label only on desktop;
the sheet retains full request details and mobile keeps its existing presentation.
Below the desktop breakpoint keep actions below the result/inspector, with the
existing mobile full-width Explain and stacked comparisons. Mobile navigation
uses accessible arrow buttons; the centered description wraps when needed.

Keep navigation clear between correction and history. Give the mobile theme
control a deliberate position instead of reproducing the tiny switch squeezed
under the header. Preserve comfortable controls at narrow widths without
horizontal scrolling of the page.

Allow enough bottom space for any fixed mobile action bar, device safe areas,
and the on-screen keyboard. A fixed action must not obscure text, explanations,
errors, sheet controls or notifications.

## Elevation & Depth

Use subtle surface separation and borders. The light reference adds a diffuse
card shadow (`0 14px 45px rgba(54, 63, 48, 0.07)`) and a restrained background
wash. Preserve that quiet character. In dark mode, distinguish surfaces primarily
through charcoal tones and separators. Sheets sit above a dimmed backdrop;
their depth must be clear in either theme.

## Shapes

Retain softly rounded cards and controls, following the reference radii in the
frontmatter. Keep correction highlights close to the text rather than turning
each edit into a separate badge. Use consistent stroke icons with labels for
important actions. Icons must not make Copy, Paste or Delete harder to identify.

## Components

### Input and actions

- Keep a character counter, not a word counter. Use the actual application's
  shared limit; the prototype's displayed 2,000 limit is not a product change.
- Retain the segmented two-mode selector. Final labels remain undecided;
  existing mode behavior and default remain intact.
- Provide a visible, labeled Paste action. Placement beside the input heading
  is a proposal to validate, not a fixed decision.
- Provide clear Correct and New correction actions and keyboard submission.
  New correction and failed requests must respect existing draft behavior.
- Use comfortably sized buttons, especially on mobile: target 44px to 48px
  minimum height with sufficient space between actions. Avoid tiny icon-only
  primary actions. Give icon-only secondary actions accessible names.

### Results and correction inspection

- Keep Text and Changes controls in both the editor and history. Do not remove
  them based on the earlier tentative preference. Preserve the existing default.
- Apply subtle inline highlighting in Changes, including a stronger selected
  highlight. Text remains a clean reading view.
- Keep the selected Before/After comparison, Previous/Next navigation and
  existing explanation behavior. Preserve deletion-only, punctuation, whitespace
  and large-edit inspection; the prototype's three sample edits are insufficient
  to define real diff behavior.
- Keep Another opinion explicit and retain each actual request result with its
  own model identity, views and correction inspection state. Preserve current
  availability, cost messaging, saved explanations and failure behavior.
- Copy always copies the active clean result, independent of view. Show success
  only after clipboard success and retain the existing fallback/error handling.
- Proposed placement: Copy beside the desktop result heading and a prominent
  fixed Copy action on mobile. Validate discoverability and keyboard behavior
  with real result states before treating these positions as final.

### History

Preserve current search, all filters (including From/To dates), sorting,
pagination, expansion, separate request results and soft deletion. Use the real
app as the authority for filter options and semantics, not the export's
decorative All/Strict/Gentle pills.

Apply the new typography, cards and action icons. Expanded results retain
Text/Changes, with the editor's highlight and inspection language. Preserve
access to the original and all existing request information. Keep empty, no
matches, loading and failed-request states honest.

### Request details sheets

Add a labeled Request details action alongside Copy and Delete in history;
the action order is not decided. Details must correspond to the selected request
and retain the current metrics, model/routing, timing, diagnostics and sent
parameters, including explicit unavailable values.

Use a side sheet opening from the left on desktop. A bottom sheet that expands to accommodate long
details is the recommended mobile approach, still to validate. Use a short
entrance/exit animation, respect reduced motion, and avoid a separate browser
window. Provide an obvious close button, keyboard dismissal, managed focus and
focus return. Do not require swipe gestures to read or dismiss details.

### Feedback and states

Style existing notifications, loading, unchanged results, clipboard failures,
correction failures and second-opinion failures consistently in both themes.
Preserve input and already available results where the current product does.
Do not copy the prototype's simulated persistence or success feedback.

## Do's and Don'ts

- Do treat this document plus the exported light prototype as the redesign
  reference. Earlier prototypes and coding standards describe the shipped
  blue-black/Roboto appearance; reconcile that older visual guidance when
  preparing the implementation spec rather than blending both designs.
- Do preserve the application's data, contracts, real functionality and
  accessibility while changing presentation.
- Do validate sheets, touch targets, contrast and keyboard/clipboard behavior
  on the implemented UI; browser viewport checks do not prove physical-phone
  behavior.
- Don't reintroduce the rejected olive dark palette or silently select blue.
- Don't remove Text/Changes, history controls or request details for visual
  simplicity.
- Don't treat mode naming, exact button placement or mobile sheet geometry as
  finalized decisions.
- Don't copy mock model names, metrics, hard-coded results, package-manager
  choices or simulated API behavior from the Figma export into production.
