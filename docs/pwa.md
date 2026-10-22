# Грамика installation and branding

V2.8 implemented and accepted in chat on 2026-10-22. Real Android/Brave and
iPhone/Safari OS installation remains unverified; automated browser checks do
not replace those device checks.

- The app title and installed name are Грамика. The navbar combines the approved
  italic Cyrillic Г/check speech-bubble image with рамика in locally bundled
  Literata Bold Italic, with tight spacing. Keep the icon colors in both themes.
- The manifest uses a stable root identity, root launch URL and standalone display.
  PNG icons are 192 and 512 pixels, with a 180-pixel Apple touch icon and favicon.
  The original approved artwork is `apps/web/public/gramika-icon-approved.png`.
  The user requested background removal: deployed icons are derived from
  `apps/web/public/gramika-icon-transparent.png`, with a transparent exterior
  and opaque ivory lettering/check inside the green bubble.
  Literata is distributed under the bundled SIL Open Font License.
- On Android and iOS, offer installation after the first successful correction
  in the open session, including a reused correction. Do not offer it after a
  failed request or solely because a saved workspace was restored. Wait while
  the workspace is busy. No model request is made for installation.
- When the browser supplies its native install event, the Install button opens
  that prompt. Otherwise Android shows browser-menu instructions; iPhone shows
  Safari Share / Add to Home Screen instructions. Availability of the browser's
  native installation prompt is outside the application's control.
- On every platform, keep the dialog compact: Install Грамика as the short
  heading, one sentence of platform guidance or home-screen benefit, and the
  existing dismissal/install actions. No internet note or redundant instructions.
- Not now, Close and Escape dismiss the offer. Store only the boolean dismissal
  under `gramika.install-dismissed`, with no expiry. Install in the header
  reopens the instructions. Mobile also retains
  the automatic offer. Install is not a Settings action. Suppress installation UI in standalone mode
  and after an appinstalled event. Browser tabs cannot reliably detect every
  installation made elsewhere.
- Storage failures do not break installation guidance or the editing session.
  If dismissal cannot be saved, it lasts only for the open session. The separate
  Clear local data workspace control leaves this installation preference alone.
- Serve over HTTPS. There is no service worker, offline loading, background
  synchronization, API response cache or automatic request replay. Workspace
  persistence remains V2.11b. Browser chrome color follows system/manual theme.

## Verification

- `npm run lint -w apps/web` passed.
- `npm run build -w apps/web` passed, including contracts and TypeScript.
- The production static route returned HTTP 200 and the expected MIME types for
  the entry page, manifest, both install icons, Apple icon and italic font.
- `git diff --check` passed. The whole-web formatting check found existing
  differences in history-page.tsx and use-history.ts outside this work.
  The PWA/branding source files pass their focused format check.
- Isolated Chromium loaded the built assets at a mocked HTTPS origin, with
  external requests blocked and synthetic correction responses. Verified Android
  and iPhone instructions, first-success timing, reload/dismissal, manual reopen,
  Escape, the native prompt event path, appinstalled suppression, failed-request
  behavior, blocked browser storage, title, manifest, icon dimensions and phone
  width. No page errors or paid calls. Light desktop and dark phone branding and
  the iPhone instructions dialog were visually inspected.
- Browser tests emulate mobile user agents; they do not prove OS installation.
  On each real phone, open the HTTPS app, install it, launch from the home screen
  and check the name, icon, standalone window, keyboard, scrolling and Copy.

Both layouts use one Settings control for System / Light / Dark and Clear local
data. Both layouts keep Install and Settings in the header. Mobile uses adjacent
44px download and Settings icon controls after the logo and Correction / History.
The download control has a subtle background and border to show it is clickable.
All five mobile header items use equal gaps. Desktop Settings includes its text
label. The tagline alone uses Literata Italic, 16px desktop and 14px mobile.
New is in the input toolbar beside
Paste in both layouts. Original remains a screen-reader label only; keyboard
focus outlines the input card. Neither layout has a footer. The header keeps the
logo, navigation and actions on one row. On the narrowest phones navigation icons
sit above their labels to keep readable labels and full touch targets. The panel
closes on Escape or an outside click. Theme and clearing use the existing browser
persistence behavior. Verified theme switching, Escape and immediate clearing in
the desktop panel, plus mobile install and persistence scenarios. Mobile header
and Settings fit at 320, 390 and 430 pixels without horizontal overflow. Verified
single-row alignment and workspace New clearing/focus, retaining preferences and
making no correction requests.

Mobile shell bottom padding is 12px plus safe area by default. Extra clearance
is added only when the fixed Copy bar is present. No permanent 112px bottom reservation.

Correction and History use separate icon-and-text navigation actions in both
layouts, with a thin active underline and stronger text. No grouped pill or filled
active background. Correction uses a writing icon; History uses the existing clock.

For a safe local preview, use the Install Грамика action to inspect the
installation dialog without sending a correction request.
