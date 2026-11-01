# PASS ON Signature 2.0

2026-11-01. Original UI redesign. Airbnb and Robinhood were quality aspirations, not copied visual identities, endorsements, or a claim of equivalent usability.

## Design
Warm off-white, charcoal, a restrained terracotta action accent, sage reading surfaces. Original layered-paper/forward-arrow symbol and passon. wordmark. Focused capture screen, compact recipient header, typed card gallery, large touch targets, explicit save state, private storage versus delivery distinction, mobile reading sheet, and reduced-motion support. No external fonts, analytics SDKs or added runtime dependencies.

## Behavior
- Remember the last selected recipient, including an explicit unassigned intention; localStorage contains only the user-scoped recipient ID preference.
- The save receipt links to the exact saved record. The archive consumes the entry query when its sheet closes.
- Photos use lazy, short-lived, privately signed thumbnail URLs. Audio tiles show actual stored duration; decorative waveform is not an analysis of the recording.
- Format filters are views only, not new stored record categories.
- Revisit emphasizes one eligible older record while retaining access to the others.
- VisualViewport keyboard handling hides nonessential bottom navigation, without disabling zoom.
- Existing device connection, auth code, record persistence, database schema/RLS and PWA identity remain unchanged.

## Verification before release
TypeScript and 64 unit tests passed. Synthetic-browser workflows passed 43 assertions in Chromium and 43 in WebKit, including unassigned capture, recipient preference, exact record opening, retry/idempotency, offline failure, navigation warning, attachment removal, format filters, keyword search, modal focus, append-only thought behavior and 320/390/1024px layouts. Functional/a11y flows use reduced motion to avoid scanning halfway through transitions. Four rendered screens and the reading sheet were scanned with selected axe WCAG tags; no remaining reported violations after contrast fixes. These scans are not a full accessibility certification.

All writes in browser tests were intercepted against a synthetic backend; no production user records were used as fixtures. The temporary design-lab-test route must be removed before the production build. Final deployment/read-only database checks are separate release gates.

## Limits
No actual external user interviews, A/B results, physical iPhone/installed-PWA test, or real microphone/camera test was performed for this release. No claim of offline sync or recoverable autosave. Existing unsaved-change warnings do not prevent all iOS process termination. Existing home-screen icons must not be deleted to receive this UI update.
