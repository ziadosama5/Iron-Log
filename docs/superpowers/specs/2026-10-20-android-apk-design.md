# Android app (TWA) design

Date: 2026-10-20. Status: written for the owner's review; a build spike already ran (see "What the spike showed").

## Decision
Ship Iron Log on Android as a **Trusted Web Activity (TWA)**: a thin Android shell that opens the live site full screen (no browser bar) with its own icon and splash. Same web code, every hosting deploy updates every installed app instantly. First an APK people can download; later the same project produces the Google Play bundle (`.aab`). Capacitor or a native rewrite are not needed now (Capacitor only if push notifications or native sign-in force it later).

- Package id: **`app.ironlog`** (owner's choice; permanent once on Google Play). App name "Iron Log".
- Host: `gym-logger-85d4c.web.app`, start URL `/`, portrait, standalone, theme `#1f5fd1` (dark `#0f1319`), splash = the app icon on `#f3f5f9`, minSdk 24 (Android 7+; the browser-helper library needs it), fallback = Chrome custom tab.
- Tooling (installed in `C:\Android`): JDK 17, Android SDK 35/36, Bubblewrap CLI (project generated with `@bubblewrap/core`, no prompts), emulator `pixel34` (Android 14, Chrome 113, WHPX accelerated).
- Signing key: `C:\Android\keys\ironlog.keystore` (alias `ironlog`, password in `ironlog-keystore-password.txt` next to it). **Never in the repo. The owner must back this folder up: a lost key means no more updates under this package id** (Google Play App Signing softens this once on Play).
- Repo: `android/` holds the generated project (`twa-manifest.json`, gradle files). Build outputs, APK/AAB and `.idsig` are git-ignored.

## What the spike showed (emulator, unverified build)
1. The APK builds (1.2 MB) and installs; Android 7 to 15 supported by minSdk 24.
2. Launch shows the icon splash, then the site inside Chrome with a **URL bar** (the "this is a website" look). Cause: Digital Asset Links are not published yet, so the shell cannot prove it owns the site.
3. **Google sign-in** (the app tries a popup, then falls back to `signInWithRedirect`) was sent to `gym-logger-85d4c.firebaseapp.com`, a different domain from the app. Opening that handler directly shows Firebase's own message that redirect sign-in breaks in a storage-partitioned browser. So sign-in will very likely fail or loop in the APK until the auth domain equals the app's domain.
4. I did not sign in on the emulator (it needs a real Google account; I will not type the owner's credentials).

## Changes
1. **Asset links (needs a hosting deploy):** `public/well-known/assetlinks.json` with package `app.ironlog` and the SHA-256 of the signing key; `firebase.json` rewrites `/.well-known/assetlinks.json` to it with `Content-Type: application/json` (hosting ignores dot-folders, so a rewrite is used). Once live and the app is reinstalled, the URL bar disappears.
2. **Same-origin Google sign-in (needs an owner action first):** set `authDomain` in `public/firebase-config.js` to `gym-logger-85d4c.web.app` (Firebase Hosting already serves `/__/auth/handler` there, confirmed 200). **Before that change is deployed, the owner adds `https://gym-logger-85d4c.web.app/__/auth/handler` to the Authorized redirect URIs of the project's OAuth web client in Google Cloud Console (APIs & Services > Credentials), otherwise sign-in breaks for everyone.** Then deploy, test sign-in on the owner's phone (popup and redirect paths), and on the emulator with a throwaway Google account if the owner wants one tested there.
3. **Manifest and icons (small):** `id`, `lang`, `categories:["health","fitness"]`, `shortcuts` (Log workout, Add meal), a monochrome icon for Android 13 themed icons, `background_color` matching the new look.
4. **Download for people:** the signed APK is served from hosting at `/download/iron-log.apk` (content type `application/vnd.android.package-archive`) with a short install page (`/app.html`, English + Arabic: download, allow "install unknown apps", open). The privacy policy gets one sentence about the app. Version name/code bumped in `twa-manifest.json` for every release.
5. **Google Play later (not now):** upload the `.aab` with Play App Signing (add Play's fingerprint to `assetlinks.json` as a second entry), Data safety form, a web page for account-deletion requests, store graphics and screenshots, a one-time $25 developer fee.

## Testing
- Build: `bubblewrap build` in `android/` (JDK and SDK from `C:\Android`; passwords from the key folder through environment variables).
- Emulator: install with `adb install -r`, screenshots with `adb exec-out screencap`. Checks: icon, splash, no URL bar after asset links, Back button behaviour (Today first), swipe, rotation locked to portrait, offline open, sign-out and sign-in on a real phone.
- Existing suites stay: `npm test`, `tests-rules/`, `tests-ui/`.

## Rulings and risks
- The signing key lives only on this PC. Back it up (USB stick or private cloud) before the first user installs the APK.
- A self-distributed APK shows Android's "install unknown apps" prompt and Play Protect may warn about an unknown developer; both go away on Google Play.
- Apps installed from the APK update through the website automatically (it is the live site); only shell changes (icon, name, package) need a new APK.
