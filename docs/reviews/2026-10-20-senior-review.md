# Senior Android developer + app designer review of Iron Log (2026-10-20, app at sw v30)

Scope: the live web app as it would ship inside an Android APK/TWA and later on Google Play. Reviewed from the repo (index.html 2.7k lines, the pure modules, sw.js, manifest, firebase.json) and the screenshot harness. **Not tested on a real device or emulator** (none installed yet); every item marked "verify" needs the emulator/phone. Priorities: **P1** do before the APK, **P2** before Google Play, **P3** polish.

## What is already good (keep)
- Clear five-tab model, thin pills, floating bar, swipe; one design system (tokens, accent derivation, light/dark, Arabic/RTL with logical CSS).
- Offline-first done properly (Firestore persistent cache, network-first service worker with a 3 s fallback, self-reload on a new version).
- Real product depth for an Android store: delete-my-account in app, privacy policy and terms, reporting/blocking, data kept private by rules + tests (53 emulator tests), 305 unit tests on all logic modules.
- Reduced-motion respected, visible focus, `aria-pressed` on toggles, `lang`/`dir` set before first paint.

## A. "Feels like a real app" (the owner's main concern)
| # | Pri | Finding | Fix |
|---|---|---|---|
| A1 | P1 | **Android back button/gesture leaves the app from any tab.** Tabs and pills do not add history entries (only sheets do). In a TWA, Back from Progress closes the app. | Treat Today as home: on a non-Today tab, Back goes to Today, from Today it exits. Implement with one `history.pushState({tab})` when leaving Today and a `popstate` handler (the sheets already use the same pattern). |
| A2 | P1 | **No touch polish.** `touch-action: manipulation` is not set anywhere (double-tap zoom and 300 ms delay risk on steppers and buttons), no `-webkit-tap-highlight-color`, no `overscroll-behavior` (pull-to-refresh/overscroll glow in the middle of a workout), no `user-select:none` on controls (long-press selects button text, the most "web" tell). | Global CSS: `button,.chip,.pill,.tile,[data-act]{touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}`, `html{overscroll-behavior-y:contain}`. Keep selection on inputs and text content. |
| A3 | P1 | **Touch targets under 44-48 px.** `.btn.small` is about 30 px tall, `button.chip` about 31 px, stepper buttons 38 px wide, `.infobtn` relies on a pseudo-element. Material minimum is 48 dp; gloved/sweaty hands at the gym make it worse. | Raise `.btn.small` and chips to `min-height:44px` (or expand the hit area with `::after`), steppers to 48 px. |
| A4 | P2 | **Haptics and feedback.** Only the rest-timer end vibrates. Nothing confirms a logged set, a PR, a badge. | `navigator.vibrate` (works in Chrome/TWA): 10 ms on Add set, pattern on PR/badge/celebration; respect a "Vibration" switch in Me. |
| A5 | P2 | **Transitions.** Tap-switching tabs is an instant swap; swipe has a slide. "Loading…" is plain text. | Use the View Transitions API (`document.startViewTransition`, Chrome 111+) for tab changes; skeleton cards instead of "Loading…". |
| A6 | P2 | **Destructive actions use inline confirms and toasts without Undo.** Material pattern is act now + snackbar with Undo. | A toast with an Undo action for delete set/meal/workout (keep confirm only for account/data-wide deletes). |
| A7 | P2 | **Long inline forms on Today** (cardio form, meal form with 3 fields) make the page a long scroll, so the key action (log the next set) is far from the bar. | Move "Add meal" and "Add cardio" into bottom sheets opened from a compact card; keep the set logging card first. |
| A8 | P3 | Pull-to-refresh is not needed (live listeners) but users may expect a manual "sync now" gesture. | Optional. |

## B. Visual design
| # | Pri | Finding | Fix |
|---|---|---|---|
| B1 | P1 | **Tiny text.** Many labels are 10-11 px (`.label`, `.tile .lv`, `.bsub`, table headers, tab labels 11 px) and uppercase + muted. Below the 12 sp readability floor, and fails at larger Android font sizes. | Minimum 12 px; labels 12 px with less letter-spacing; test at 130% font size (verify: fixed-height tab bar 64 px and 22-30 px pills may clip). |
| B2 | P2 | **Manifest and splash mismatch the new look:** `background_color #eef1f5` (old palette), `theme_color` is a fixed blue and not dark-aware. | Use the accent-neutral surface for `background_color`; add `<meta name="theme-color" media="(prefers-color-scheme: dark)">` pair; Android splash is generated from icon + background_color. |
| B3 | P2 | **Icon set:** has maskable PNG; no Android 13 themed (monochrome) icon, no adaptive-icon safe-zone check. | Add `monochrome` icon purpose; verify the mark fits the 66% safe zone. |
| B4 | P2 | **Today is dense:** hero, picker, cardio form, food form in one column; empty states are mostly text. | See A7; add one illustration-style empty state per tab (the badge art already gives you a style). |
| B5 | P3 | Dark theme is tinted-navy; an AMOLED true-black option saves battery in a gym. | Theme choice "Black". |
| B6 | P3 | Celebration card: no sound (by design), no share button. | Optional "Share my badge" (Web Share works in TWA) as a growth feature. |

## C. Accessibility
| # | Pri | Finding | Fix |
|---|---|---|---|
| C1 | P2 | **Toasts are not announced** (`popover` div without `role="status"`/`aria-live`). TalkBack users never hear "Set added", errors, "Couldn't save". | `role="status" aria-live="polite"` on `#toast`; `assertive` for failures. |
| C2 | P2 | Celebration dialog lacks `role="alertdialog"`/`aria-labelledby`, closes only via button/Esc. Hero card is a button whose `aria-label` hides its text. | Add roles/labels; remove the hero's `aria-label`. |
| C3 | P2 | Tabs use `aria-current` (OK) but the pills are `aria-pressed` buttons, not a tab list; no focus move to the new screen heading after a tab change. | Move focus to the screen `<h2>` (tabindex -1) on tab/pill change. |
| C4 | P3 | State shown by colour only in places (done chips, tiers). | Keep the check/lock glyphs (already there for most); audit with TalkBack. |
| C5 | verify | Test with TalkBack, Switch Access, 200% font, and RTL on a real device. | |

## D. Performance (mid-range Android, cold start)
| # | Pri | Finding | Fix |
|---|---|---|---|
| D1 | P2 | **Everything loads up front:** index.html 239 KB, `exercise-info.js` 105 KB (only needed when "!" is tapped), `lang-ar.js` 69 KB for English users, and the full Firebase SDK (auth + firestore) from gstatic. | Lazy-`import()` exercise-info and lang-ar on first use; `modulepreload` the Firebase files; measure with Lighthouse/Chrome tracing on the emulator (verify). |
| D2 | P2 | **Google Fonts: 4 families, render-blocking, third-party request** (also leaks the user IP to Google, a GDPR point for a Play data-safety form). Arabic font is requested for everyone. | Self-host WOFF2 subsets in `/fonts`, `font-display:swap`, Arabic only when `lang=ar`; add to the service worker. |
| D3 | P3 | Every change re-renders a whole screen via `innerHTML`. Fine today; a long history or many exercises on a cheap phone may jank. | Measure first; if needed, patch only the set table instead of the whole card. |
| D4 | P3 | `levelHero()` recomputes badges and XP on every Today redraw. | Cache on `state.dataRev` + date. |

## E. Code and maintainability
| # | Pri | Finding | Fix |
|---|---|---|---|
| E1 | P2 | **One 2.7k-line file with a ~150-case click handler** and render functions that mix data, logic and HTML. Pure logic is well extracted and tested; the UI layer is not. | Extract per-tab view modules (`views/today.js` ...) as plain ES modules (no build step needed; the service worker precaches them). Do it gradually, one tab per change. |
| E2 | P1 | **No UI regression tests.** The screenshot harness already runs the real page with stubbed Firebase. | Add a Playwright smoke suite on the harness: sign-in, each tab opens, log a set, add a meal, swipe, Arabic. Run in CI. High value before store releases. |
| E3 | P2 | **~130 manual `esc()` calls in template strings.** One forgotten escape on user data (usernames, names, exercise names) is an XSS. | Add a lint-style unit test that scans index.html for `${...}` of known user fields without `esc(`; consider a tiny `html` tagged template that escapes by default. |
| E4 | P3 | localStorage flags (journey skip, level, wins) are per device. | Acceptable; document it. |
| E5 | P3 | Dead code and CSS (`.ach*`, old counters) and deferred minors listed in `docs/open-points.md`. | Clean in one pass. |

## F. Security and privacy
| # | Pri | Finding | Fix |
|---|---|---|---|
| F1 | P2 | **No security headers** in `firebase.json` (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`/`X-Frame-Options`). | Add them; a CSP needs `script-src` for gstatic, inline module (use a hash or move the script out) and `fonts` once self-hosted. |
| F2 | P2 | **App Check not enabled;** the Firebase config is public by design, so rules are the only gate. | Enable App Check (Play Integrity for the APK, reCAPTCHA v3 for web) before a public launch; watch the free quota. |
| F3 | P2 | Firestore rules and tests are strong (53 cases). | Keep running them before every rules change; add the TWA origin to nothing (same origin). |

## G. Android APK / Google Play readiness (TWA)
| # | Pri | Finding | Action |
|---|---|---|---|
| G1 | **P1** | **Google sign-in inside a TWA is the biggest unknown.** The code uses `signInWithPopup` with a redirect fallback, and `authDomain` is `gym-logger-85d4c.firebaseapp.com` (a different domain from the app). Redirect/popup flows on a second domain hit storage partitioning in modern Chrome and often fail or loop. | Set `authDomain` to the hosting domain and serve `/__/auth/*` from the same origin (Firebase Hosting supports this), then test sign-in first on the emulator. Fallback plan: Credential Manager / native Google sign-in via a Capacitor-style plugin. |
| G2 | P1 | Digital Asset Links: the TWA needs `/.well-known/assetlinks.json` on the site with the app's signing fingerprint, otherwise the URL bar shows. Hosting currently ignores dot-folders (`**/.*`). | Allow `.well-known` in `firebase.json` ignore; add the file once the keystore exists. |
| G3 | P1 | Tooling: Bubblewrap or PWABuilder needs JDK 17 + Android SDK (cmdline-tools, platform 34/35, build-tools, an emulator image). The owner approved installing them. | I will list each download before installing. |
| G4 | P2 | Manifest additions for installs and Play: `id`, `lang`, `dir`, `categories:["health","fitness"]`, `shortcuts` (Log workout, Add meal), `screenshots`, `display_override`, monochrome icon. | Small PR. |
| G5 | P2 | Google Play requirements: target API level 34+, **Play App Signing** (keep the upload key safe), Data safety form (we collect e-mail, name, health/fitness data; encrypted in transit; user can delete), privacy policy URL (have it), **web URL for account deletion requests** (Play requires one outside the app; add a short page/anchor), content rating, 512 px icon, 1024x500 feature graphic, 2+ phone screenshots, a one-time developer fee. | Prepare a store-listing checklist. |
| G6 | P2 | Health data wording: the app gives fitness guidance; Play health policies expect a medical disclaimer and no medical claims. | The Coach footer already says "not medical advice"; mirror it in the store listing. |
| G7 | P3 | A pure web app can also be offered as a Play listing without code changes; going to Capacitor later only if native notifications or sign-in force it. | Decide after the TWA is tested. |

## Status (sw v31)
Done: A1 back behaviour, A2 touch polish, A3 touch targets, B1 text sizes, E2 UI smoke tests (`tests-ui/`). Still open from P1: G1 (Google sign-in inside the TWA: needs the owner to add the new redirect URI in Google Cloud before `authDomain` can change), G2/G3 (asset links and Android tooling: part of the APK step).

## Recommended order
1. **Before the APK (P1):** A1 back behaviour, A2 touch polish, A3 touch targets, B1 text sizes, E2 smoke tests, G1 auth domain + emulator sign-in test, G2/G3 tooling and asset links.
2. **Before Google Play (P2):** C1-C3 accessibility, F1-F2 headers and App Check, D1-D2 performance and self-hosted fonts, A4-A7 native feel, B2-B4 manifest/splash/icon, G4-G6 store listing and deletion URL.
3. **Polish (P3):** the rest.

Each P1 group can be one small branch with tests and screenshots, deployed on your approval as before.
