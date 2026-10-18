# Profiles, privacy and search — design

Sub-project 1 of 3 of the friends system (2 = friends: requests, list, a friend's progress page, block; 3 = challenges). This one adds a username, a published "progress summary" with a visibility setting, and exact-match search. Part of "getting ready for more users".

## Goal
A user can pick a username, choose who may see a small summary of their progress (Private / Friends / Public), optionally be found by email, and look other people up by exact username or email. Raw workouts, body data, meals and the private `users/{uid}/items/*` data are never shared.

## What was agreed
- Visibility: **Private** (nobody), **Friends** (accepted friends only, wired up in sub-project 2), **Public** (any signed-in user who finds me). Default for everyone: **Private**. Switching to Private removes the published summary.
- Findability: having a username makes you findable by **exact username**. Finding by **exact email** works only for people who tick "Let people find me by email" (off by default). No listing, no browsing, no partial matches.
- Shared content is a derived summary only (below); never body weight, measurements, InBody, meals or individual workouts.
- Everything shared is computed on the user's phone from their own data and written only by them.

## Non-goals
- Friend requests, friend list, friend-only reads, blocking, reporting, challenges, notifications/push, avatars, partial/fuzzy search, moderation of names. (Sub-projects 2 and 3 and later.)
- Sharing individual lifts or body data.
- Server code (Cloud Functions need the paid plan): everything is client + Firestore rules.

## Data (three new top-level collections; `users/{uid}/items/*` is untouched)
Naming note: `profiles/{uid}` is **what you chose to share**; the existing `users/{uid}/items/profile` is your private body profile (sex, height, goal). Docs and code must keep these two clearly apart.

### `profiles/{uid}`
`{ username: string, displayName: string, visibility: "private"|"friends"|"public", findByEmail: boolean, summary?: Summary, updated: number }`
- `username` is the lower-case claimed name (a matching `usernames/{username}` doc must exist and point at this uid).
- `displayName`: 1–40 characters, defaults to the Google first name; the user can change it.
- `summary` exists only when `visibility` is `friends` or `public`; absent when `private`.
- Whole document < 5 KB.

### `Summary` (all fields required when present; no other keys)
| field | type / range |
|---|---|
| `level` | int 1–500 |
| `xp` | int 0–10,000,000 |
| `title` | string ≤ 20 (Rookie, Regular, Committed, Iron) |
| `badges` | int 0–100 |
| `streakWeeks` | int 0–600 (weekly training streak) |
| `foodDays` | int 0–4000 (daily food-log streak) |
| `workoutsWeek` | int 0–50 (this Saturday–Friday week) |
| `workouts30` | int 0–400 |
| `workoutsTotal` | int 0–50,000 |
| `volumeWeekKg` | number 0–1,000,000 |
| `prs30` | int 0–400 |
| `lastWorkout` | string `YYYY-MM-DD` or null |
| `updated` | number (ms) |

### `usernames/{name}`
`{ uid: string, displayName: string, updated: number }`; the document id is the lower-case username: 3–20 characters of `a-z 0-9 _ .`, not starting or ending with `.` or `_`, no `..`, not reserved (`admin`, `administrator`, `support`, `ironlog`, `iron-log`, `moderator`, `root`, `system`, `help`, `staff`, `official`, `me`, `null`, `undefined`).

### `emails/{email}`
`{ uid: string }`; the document id is the user's own e-mail, lower-case and trimmed (it contains no `/`). Exists only while `findByEmail` is true.

## Security rules (firestore.rules) — the core of this sub-project
All existing rules stay exactly as they are. New rules:
- **No listing anywhere** in the three collections: only `get` of a known id; `list` is denied.
- `usernames/{name}`:
  - `get`: any signed-in user.
  - `create`: signed in; `request.resource.data.uid == auth.uid`; the id passes the username format and is not reserved; keys are exactly `uid, displayName, updated`; `displayName` string 1–40; **the same batch also sets `profiles/{auth.uid}.username == name`** (checked with `getAfter`), which makes one username per user and prevents claiming without a profile; the document must not already exist (a taken name can't be overwritten).
  - `update`: only the owner (`resource.data.uid == auth.uid`), `uid` unchanged, `displayName` valid.
  - `delete`: only the owner.
- `emails/{email}`:
  - `get`: any signed-in user.
  - `create`/`update`: only when `email == auth.token.email.lower()` and `auth.token.email_verified == true`, `uid == auth.uid`, keys exactly `uid`, and `getAfter(profiles/{auth.uid}).data.findByEmail == true`.
  - `delete`: only the owner (`resource.data.uid == auth.uid`).
- `profiles/{uid}`:
  - `get`: the owner; or anyone signed in when `resource.data.visibility == "public"`. (Friend reads are added in sub-project 2; until then "friends" behaves like "private" for everyone but the owner.)
  - `create`/`update`: only the owner; keys ⊆ `username, displayName, visibility, findByEmail, summary, updated`; `visibility` in the three values; `displayName` valid; `username` valid and `get(usernames/{username}).data.uid == auth.uid` (after the write: `getAfter`); `summary` allowed only if visibility is `friends` or `public`, and must match the Summary table exactly (types and ranges, no extra keys); size < 5 KB.
  - `delete`: only the owner.
- A public profile is readable by any signed-in user, so `private` and `friends` documents must never expose `summary` to others (the rules above guarantee it: non-owners can read only `public`).

## Client behavior
New module `public/social.js` (pure, no DOM/Firebase, unit-tested):
- `validUsername(name): {ok: boolean, reason?: "short"|"long"|"chars"|"edges"|"dots"|"reserved"}` and `normalizeUsername(name): string` (trim, lower-case).
- `normalizeEmail(s): string | null` (trim, lower-case; null if it doesn't look like an e-mail).
- `buildSummary(input, now): Summary` using the existing `achievements.js` functions (`badges`, `xpSummary`, `trainingStreak`, `foodStreak`, `startOfWeek` logic) over `{workouts, body, food, days, profile, today}`; `workoutsWeek` counts days trained in the current Saturday–Friday week; `volumeWeekKg` is the summed `w × r` of that week; `prs30` counts PR events in the last 30 days (`prEvents`-style data from `achievements.js`).
- `summaryEqual(a, b): boolean` ignoring `updated` (used to skip no-op writes).
- `shareLabel(visibility)`: the English label for the three visibility values.

In `index.html` (storage layer + screens):
- **Profile and privacy** screen (More › Profile and privacy; not a tab):
  - Username box with "Check" and "Save": claiming/changing runs one write batch (set `usernames/new`, update `profiles/{uid}`, delete `usernames/old`; plus the email doc changes below). If the id is taken the rules reject it: show "That username is taken".
  - Display name, the three visibility choices (radio) with the sentence "Friends and public viewers see only: level, streaks, workout counts, volume and personal records this month, last workout date", and a live preview of the exact summary.
  - "Let people find me by email" switch (writes/deletes `emails/{myemail}` in the same batch as the profile; disabled when the Google account has no verified e-mail).
  - "Stop sharing and delete my profile": deletes `profiles/{uid}`, `usernames/{name}`, `emails/{email}` (confirm first).
  - Nothing is published until a username exists; with no username the screen shows only the username step.
- **Summary publishing:** when visibility is `friends` or `public`, after the data snapshot settles (server data only, like badges) compute `buildSummary`; if it differs (`summaryEqual`) from the last published one (kept in memory and loaded with the profile), write it 20 s after the last change (debounced), merged into `profiles/{uid}` with a new `updated`. Switching to Private writes the profile with the `summary` field deleted (`deleteField()`).
- **Find a friend** box on the same screen: one input; if it looks like an e-mail: `get(emails/{email})` → uid → `get(profiles/{uid})`; otherwise: `get(usernames/{normalized})` → uid → `get(profiles/{uid})`. Result card: display name, `@username` and, when the profile is readable (public), the summary; otherwise "This person shares their progress with friends only" (or nothing for private). A not-found, unfindable or no-permission result all show the same neutral "No one found" message, so a probe can't tell "exists but hidden" from "doesn't exist".
- Offline: username/email/visibility changes need a connection ("You're offline. Try again when you're back online.").
- Arabic: every new string goes in `AR.ui`; usernames/emails are never translated; the visibility labels are translated.

## Files
- Create: `public/social.js`, `tests/social.test.js`, `tests-rules/` (own `package.json` with `@firebase/rules-unit-testing` + `firebase` as **dev-only** dependencies, `firestore.rules.test.js`, a short README; not run by `npm test`).
- Modify: `firestore.rules`, `firebase.json` (emulator ports for the rules tests), `public/index.html`, `public/lang-ar.js`, `public/sw.js` (add `/social.js`, v17), `CLAUDE.md`, `README.md` (Firestore rules note), `docs/README.md`.

## Testing
- `tests/social.test.js` (runs in `npm test`): username rules (length 3/20, characters, edges, `..`, reserved words, normalization), e-mail normalization, `buildSummary` against fixtures (week boundaries Saturday–Friday, volume, PR counting, streaks, empty data), `summaryEqual`, ranges stay inside the rules' limits for extreme inputs.
- `tests-rules/` (needs the Firebase emulator, i.e. Java): signed-out access denied everywhere; owner reads/writes own `users/.../items`; another user can't read or write them; `list` denied on all three new collections; `usernames`: claim ok with matching profile batch, claim denied without profile, taken name denied, reserved/invalid names denied, someone else can't update/delete my name, delete own ok; `emails`: only my own verified e-mail id, not someone else's, not an unverified account, requires `findByEmail`; `profiles`: public readable by any signed-in user, private/friends not readable by others, owner can read all, summary rejected when private, extra keys / out-of-range numbers / wrong types rejected, someone else can't write my profile, `username` must be claimed by me.
- Visual: screenshots of the Profile and privacy screen and a search result card (English and Arabic) with the Firebase-stub harness.

## Review focus
- Any rule that lets a signed-in user read a non-public profile/summary, list users, overwrite someone's username or e-mail entry, or claim a username without a profile.
- Abuse limits: a malicious client writing garbage within the rules (ranges) or creating many usernames: each user can hold exactly one username (profile.username) — verify no path leaves orphan `usernames`/`emails` docs that block others.
- The "no one found" neutral message really is identical for missing / hidden / private.
- Email privacy: no way to learn whether an e-mail uses the app without that person's opt-in; the e-mail is used as a document id and is only reachable by `get`.
- Summary correctness (week boundaries, time zones), no write storms (debounce, no-op skipping), and no body/meal data in the summary.
- Existing data and rules for `users/{uid}/items` unchanged; backup/restore unaffected.

## Rollout
Rules first (backward compatible: new paths only), then hosting. After the final review: `firebase deploy --only firestore:rules` and `--only hosting` (sw v17). Existing users see a new "Profile and privacy" row in More; nothing is published until they pick a username and a visibility.
