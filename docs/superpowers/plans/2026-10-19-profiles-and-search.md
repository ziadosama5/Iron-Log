# Profiles, Privacy and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user claim a username, choose Private / Friends / Public for a small published progress summary, optionally be found by exact e-mail, and look others up by exact username or e-mail.

**Architecture:** A pure `public/social.js` (validation, summary builder, a function that plans the exact Firestore write batch) is unit-tested in `npm test`. The security rules are the core: three new top-level collections (`profiles`, `usernames`, `emails`) with no listing, validated by emulator tests in a separate `tests-rules/` folder (dev-only dependencies, not part of `npm test`). `index.html` gets a storage layer, a summary publisher and a "Profile and privacy" screen.

**Tech Stack:** plain JS ES modules, `node --test`, Firestore rules, Firebase emulator + `@firebase/rules-unit-testing` (dev only, needs Java), headless Edge with the Firebase-stub harness for screenshots.

**Spec:** `docs/superpowers/specs/2026-10-19-profiles-and-search-design.md` (binding; it holds the data model, the Summary table and the rules, which this plan does not repeat).

## Global Constraints

- No new runtime dependency and no build step. `tests-rules/` has its own `package.json`; `package.json` at the repo root stays as it is, and `npm test` must keep working with nothing installed.
- `index.html`, `lang-ar.js`, `sw.js` have CRLF endings: edit with the Edit tool or Write-tool scripts (heredocs mangle backslashes and apostrophes).
- Existing rules for `users/{uid}/items/{itemId}` and all existing data stay unchanged; the new rules only add paths.
- Visibility values exactly `private`, `friends`, `public`; default (no profile yet) = nothing published. Friends-only reads are NOT implemented here: `friends` behaves like `private` for everyone except the owner.
- The summary contains only the 13 fields of the spec's Summary table; never body, meal, per-workout or per-lift data. `summary` exists only when visibility is `friends` or `public`.
- Username: 3–20 of `a-z 0-9 _ .`, no leading/trailing `.` or `_`, no `..`, not in the reserved list (`admin, administrator, support, ironlog, iron-log, moderator, root, system, help, staff, official, me, null, undefined`). E-mail document id: lower-case trimmed e-mail.
- Every new user-visible string goes through `t()`/`tn()` with an Arabic entry; usernames and e-mails are never translated.
- Bump `iron-log-v17` and add `/social.js` to `APP_SHELL` in the release task only; nothing is deployed before the final review and the user's go-ahead.

## Review Focus

- A signed-in user reading a non-public profile/summary, listing users, overwriting someone's username/e-mail entry, or claiming a username without a profile → Task 2 emulator tests (each case is a named test).
- Orphan `usernames`/`emails` documents blocking other people after a rename or "delete my profile" → Task 1 test of `planShare` (rename deletes the old name; e-mail toggle off deletes the e-mail doc) + Task 2 test that a second user can claim a freed name.
- A hidden/missing result leaking existence → Task 4 test of the pure `lookupResult` helper (same message for missing, unfindable, denied).
- Summary wrong around the Saturday–Friday week boundary or with extreme data (writes rejected by the rules' ranges) → Task 1 fixtures + a test that clamps every field into the rules' ranges.
- Write storms / publishing while private → Task 3 test of `shouldPublish` (skips equal summaries, never publishes when private, debounce window).

---

### Task 1: `public/social.js` — validation, summary and write planning

**Files:**
- Create: `public/social.js`, `tests/social.test.js`

**Interfaces:**
- Produces (all exported):
  - `RESERVED_USERNAMES: string[]`; `SUMMARY_LIMITS: Record<string,[number,number]>` (min/max per numeric Summary field, exactly the spec's ranges).
  - `normalizeUsername(s: unknown): string` — `String(s ?? "")`, trim, strip one leading `@`, lower-case.
  - `validUsername(name: string): { ok: boolean, reason?: "short"|"long"|"chars"|"edges"|"dots"|"reserved" }` — expects an already normalized name.
  - `normalizeEmail(s: unknown): string | null` — trim, lower-case; `null` unless it has one `@`, a dot in the domain, no spaces/slashes.
  - `buildSummary(input: {workouts, body, food, days, profile, today: string}, now: number): Summary` — uses `badges`, `xpSummary`, `trainingStreak`, `foodStreak`, `weekKey`, `prEvents` from `achievements.js` and `trainedOn` from `workout-tools.js`. `workoutsWeek` = trained days with `weekKey(date) === weekKey(today)`; `workouts30` = trained days in the 30 days up to `today`; `workoutsTotal` all trained days; `volumeWeekKg` = Σ `w × r` over that week's sets (rounded to 1 decimal); `prs30` = PR events dated within 30 days; `lastWorkout` = latest trained date or `null`; `updated = now`. Every number is clamped into `SUMMARY_LIMITS`.
  - `summaryEqual(a: Summary | null, b: Summary | null): boolean` — equal ignoring `updated`; two nulls are equal.
  - `shareLabel(v: string): string` — `"Private"`, `"Friends"`, `"Public"` (anything else → `"Private"`).
  - `planShare({ uid, current, next, email, summary, now }): { ops: Op[] } | { error: "email-needed" }` where `current` is the saved profile or `null`, `next = {username, displayName, visibility, findByEmail}`, `email` the user's verified normalized e-mail or `null`, `summary` a Summary or `null`, `Op = { op: "set"|"update"|"delete", path: string[], data?: object }`. Rules: a new username → `set usernames/<new> {uid, displayName, updated}` first, then `delete usernames/<old>` when there was one; same username with a changed `displayName` → `update usernames/<name> {displayName, updated}`; always `set profiles/<uid> {username, displayName, visibility, findByEmail, updated}` plus `summary` only when visibility is `friends` or `public` and `summary` is given; `findByEmail` true → `set emails/<email> {uid}` (error `"email-needed"` when `email` is null); `findByEmail` turned off (was true, now false) with an `email` → `delete emails/<email>`. The profile op is listed before the e-mail op and after the username ops.

- [ ] **Step 1: Write failing tests** in `tests/social.test.js`:
  - `normalizeUsername("  @Ziad_99 ")` → `"ziad_99"`; `validUsername` → ok for `"ziad"`, `"a_b.c9"`, `"abc"`, a 20-char name; `short` for `"ab"`, `long` for 21 chars, `chars` for `"zi ad"`, `"zi-ad"`, `"زياد"`, `edges` for `".abc"`, `"abc_"`, `dots` for `"a..b"`, `reserved` for every entry of `RESERVED_USERNAMES`.
  - `normalizeEmail(" Ziad@Example.COM ")` → `"ziad@example.com"`; `null` for `"a@b"`, `"a b@c.d"`, `"a/b@c.de"`, `""`, `null`, `"x@@y.zz"`.
  - `buildSummary` fixtures: empty data → all counts 0, `lastWorkout: null`, `level: 1`; a 2026-10-17 (Saturday) `today` with workouts on Sat 2026-10-17, Fri 2026-10-16 and Wed 2026-10-14 → `workoutsWeek` counts only 2026-10-17 (week starts Saturday) while `workouts30` counts all three; `volumeWeekKg` sums that week's `w×r` only; an old PR (40 days ago) is not in `prs30` but a recent one is; cardio-only days are not "trained"; extreme input (60,000 workouts or volume 1e9) is clamped inside `SUMMARY_LIMITS`; `buildSummary(x, 123).updated === 123`.
  - `summaryEqual`: same fields different `updated` → true; one field different → false; `(null, null)` true; `(null, s)` false.
  - `shareLabel("friends")` → `"Friends"`, unknown → `"Private"`.
  - `planShare`: first claim (`current: null`) → ops in this order: `set usernames/ziad`, `set profiles/u1`; rename `ziad → zed` → `set usernames/zed`, `delete usernames/ziad`, `set profiles/u1`; same name + new display name → `update usernames/ziad {displayName, updated}` then profile; visibility `private` → the profile `data` has no `summary` key even when a summary is passed; `public` with a summary → `data.summary` present; `findByEmail: true` with `email: null` → `{ error: "email-needed" }`; turning e-mail search on → `set emails/<email> {uid}` last; turning it off → `delete emails/<email>`; `updated` equals `now` on every written document.
  - A sync test that reads `firestore.rules` and asserts (once Task 2 has written it) that every key of `SUMMARY_LIMITS` appears in the file; mark it `skip` until Task 2 and enable it there.
- [ ] **Step 2: Run** `node --test tests/social.test.js` → Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `public/social.js` (pure: no DOM, no Firebase).
- [ ] **Step 4: Run** `npm test` → Expected: PASS.
- [ ] **Step 5: Commit** `git add public/social.js tests/social.test.js && git commit -m "feat: social helpers (usernames, summary, write plan)"`

---

### Task 2: Security rules and emulator tests

**Files:**
- Modify: `firestore.rules`, `firebase.json` (add an `emulators` block: `firestore` port 8080, `ui` disabled), `tests/social.test.js` (enable the rules-sync test)
- Create: `tests-rules/package.json` (`"type":"module"`, devDependencies `@firebase/rules-unit-testing` ^3 and `firebase` ^10.12.2, script `test` = `firebase emulators:exec --only firestore --project demo-iron-log "node --test"` run from the repo root with `--config firebase.json`), `tests-rules/firestore.rules.test.js`, `tests-rules/README.md` (how to run, needs Java)

**Interfaces:**
- Produces: the collections and rules from the spec. Test helpers inside the test file: `ctx(uid, {email, email_verified})` returning an authenticated Firestore, `anon()`.

- [ ] **Step 0: Check Java** — run `java -version`. If Java is missing, **STOP and ask the user** for permission to install a JDK (for example `winget install EclipseAdoptium.Temurin.17.JDK`), because it installs software outside the project. If the user says no, ledger the decision, write the tests anyway, and test the rules by deploying them to the project **only after** the user agrees to that instead; do not continue to Task 5 without a tested ruleset.
- [ ] **Step 1: Write the failing emulator tests** (each a named `test`, using the pre-change rules so they fail): 
  - existing paths: owner reads/writes own `users/u1/items/profile`; u2 cannot read or write it; signed-out cannot.
  - `list` (collection query) is denied on `usernames`, `emails`, `profiles` for a signed-in user.
  - `usernames`: u1 claims `ziad` with a batch that also sets `profiles/u1.username = "ziad"` → allowed; the same claim without the profile write → denied; claiming a name already taken by u2 → denied; reserved (`admin`) and invalid (`ab`, `a..b`, `.abc`, uppercase) → denied; a doc with extra keys or `uid` of another user → denied; u2 cannot update or delete u1's name; u1 can update `displayName` and delete; after u1 deletes `ziad`, u2 can claim it; any signed-in user can `get` `usernames/ziad`; signed-out cannot.
  - `emails`: u1 (verified, e-mail `u1@x.com`) can create `emails/u1@x.com {uid:"u1"}` when the same batch sets `profiles/u1.findByEmail = true`; denied without `findByEmail`; denied for `emails/other@x.com`; denied when `email_verified` is false; denied with another uid; u2 cannot delete it; u1 can delete it; `get` allowed for signed-in users, `list` denied.
  - `profiles`: owner can create/update with `visibility: "private"` and no summary; owner can read; u2 **cannot** read a `private` or `friends` profile (nor its `summary`); u2 **can** read a `public` one; signed-out cannot; owner cannot set a `summary` while `private`; `visibility: "everyone"` denied; unknown extra key denied; each Summary field out of range, wrong type, missing, or extra key → denied (one test iterating all 13 fields); `username` not claimed by me → denied (and when claimed by someone else); u2 cannot write or delete u1's profile; owner can delete; document over 5 KB denied.
- [ ] **Step 2: Run** the rules tests → Expected: FAIL.
- [ ] **Step 3: Implement** the new rules in `firestore.rules` exactly as the spec's "Security rules" section describes (helper functions for username format/reserved, Summary validation, `getAfter` cross-checks, no `list`); keep the existing `users/{uid}/items` rule and the final catch-all deny. Add the emulator block to `firebase.json`. Enable the rules-sync unit test.
- [ ] **Step 4: Run** the rules tests → Expected: PASS (every test above); then `npm test` → PASS.
- [ ] **Step 5: Commit** `git add firestore.rules firebase.json tests tests-rules && git commit -m "feat: security rules for profiles, usernames and e-mail lookup (+ emulator tests)"`

---

### Task 3: Storage layer and summary publisher

**Files:**
- Modify: `public/social.js` (add `shouldPublish`), `tests/social.test.js`, `public/index.html`

**Interfaces:**
- Consumes: `planShare`, `buildSummary`, `summaryEqual`, `normalizeUsername`, `normalizeEmail` (Task 1); the Firestore handle and `store` object already in `index.html`.
- Produces:
  - In `social.js`: `shouldPublish({ visibility, last, next, lastAt, now, minGapMs = 20000 }): boolean` — false when `visibility` is not `friends`/`public`; false when `summaryEqual(last, next)`; false when `now - lastAt < minGapMs`; otherwise true.
  - In `index.html`: `state.share = { loaded: false, profile: null, busy: false, last: null, lastAt: 0 }`; `store.loadShare(): Promise<void>` (reads `profiles/{uid}` once, sets `state.share.profile` / `loaded`); `store.saveShare(next): Promise<{ok: true} | {ok: false, reason: "taken"|"offline"|"email-needed"|"error"}>` (builds the batch with `planShare`, commits with `writeBatch`; a rules rejection on the username create → `"taken"`; `navigator.onLine === false` → `"offline"` without writing); `store.deleteShare(): Promise<boolean>` (batch-deletes `profiles/{uid}`, `usernames/{name}`, `emails/{email}`); `store.lookup(query: string): Promise<{status:"found", profile, uid} | {status:"none"}>`; `maybePublish()` (called after each server snapshot, debounced).

- [ ] **Step 1: Write failing tests** for `shouldPublish`: private → false; public with equal summaries → false; public with a changed field and `now - lastAt = 5000` → false; same with 25,000 → true; `friends` behaves like `public`; `last = null` (never published) with a summary → true once the gap has passed.
- [ ] **Step 2: Run** `node --test tests/social.test.js` → Expected: FAIL.
- [ ] **Step 3: Implement** `shouldPublish`, then the storage functions and `maybePublish` in `index.html`: load the profile after sign-in (`loadShare`), clear `state.share` on sign-out; `maybePublish` runs only after a server (non-cache) snapshot, builds the summary with `buildSummary(goalsInput-like object, Date.now())`, and when `shouldPublish` is true writes `profiles/{uid}` through `planShare` (profile op only) and updates `state.share.last/lastAt`; a setTimeout of 20 s coalesces rapid changes. `lookup` follows the spec: normalize; e-mail → `emails/{email}` doc → uid; else `usernames/{name}` doc → uid; then `getDoc(profiles/{uid})`; **any** failure (missing doc, permission denied, not readable) returns `{status:"none"}`. Add `getDoc` and `deleteField`-free imports to the Firestore import line as needed.
- [ ] **Step 4: Run** `npm test` → Expected: PASS. Syntax check: extract the module script and run `node --check`.
- [ ] **Step 5: Commit** `git add public tests && git commit -m "feat: profile storage layer and debounced summary publishing"`

---

### Task 4: Pure lookup result helper

**Files:**
- Modify: `public/social.js`, `tests/social.test.js`

**Interfaces:**
- Produces: `lookupResult(input: string, outcome: { status: "found" | "none", profile?: object } | null): { kind: "empty" | "invalid" | "none" | "card", card?: { displayName: string, username: string, summary: Summary | null } }` — `empty` for blank input; `invalid` for input that is neither a valid username (after `normalizeUsername`) nor a valid e-mail; `none` for `{status:"none"}` and for `outcome === null` (the same value, nothing else distinguishes them); `card` for found profiles, with `summary` only when present on the profile.

- [ ] **Step 1: Write failing tests:** `lookupResult("", null).kind === "empty"`; `lookupResult("a", null).kind === "invalid"`; `lookupResult("zed", {status:"none"})` and `lookupResult("zed", null)` deep-equal each other (same object shape); found public profile → `card` with `displayName`, `username`, the summary; found profile without a summary → `card.summary === null`; an e-mail input is accepted as valid.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `lookupResult`. **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `git add public/social.js tests/social.test.js && git commit -m "feat: lookup result helper (same answer for missing and hidden)"`

---

### Task 5: Profile and privacy screen, Find a friend, Arabic

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`, `tests/lang-coverage.test.js` (nothing to edit if the scanner covers it; run it)

**Interfaces:**
- Consumes: `store.loadShare/saveShare/deleteShare/lookup` (Task 3), `lookupResult`, `validUsername`, `normalizeUsername`, `shareLabel`, `buildSummary` (Tasks 1, 4), `esc`, `t`/`tn`, `go`, existing view/sheet patterns.
- Produces: view `profile` (`#view-profile`, `renderProfile()`), More row `Profile and privacy` (`data-act="more-go" data-view="profile"`), `SCREEN_TITLES.profile = "Profile"`, `VIEWS` and the `inMore` list include `"profile"`.

- [ ] **Step 1: Screen layout and behaviour** (all text through `t()`; forms use the existing `.card` / `.btn` / `.seg` / `.chip` blocks):
  - No username yet: only a card "Choose a username" (input, rules hint "3–20 letters, numbers, _ and .", Save). `validUsername` errors map to short messages; a "taken" result shows "That username is taken".
  - With a username: cards for **Display name** (input + Save), **Who can see my progress** (three radio-style buttons Private / Friends / Public using `shareLabel`, the sentence "Friends and public viewers see only: level, streaks, workout counts, volume and personal records this month, last workout date", and a live preview of the exact summary values from `buildSummary`), **Find me by e-mail** (switch; disabled with a hint when the Google account has no verified e-mail), **Find a friend** (`<form id="find-form">`, one input, "Find"; result via `lookupResult`: `none` → "No one found"; `card` → display name, `@username`, and the summary rows when present, otherwise the line "Progress isn't shared with you"), and **Stop sharing and delete my profile** (inline confirm).
  - Offline → toast "You're offline. Try again when you're back online." and no write. While `state.share.busy` buttons are disabled.
  - Changing visibility to Private writes a profile without `summary` (via `planShare`); switching to Friends/Public writes the profile including the current summary.
- [ ] **Step 2: Wire it in:** More-sheet row, `SCREEN_TITLES`, `VIEWS`, `inMore`, `render()` map, delegated `submit`/`click` handlers (`share-username-save`, `share-name-save`, `share-vis`, `share-email`, `share-delete`, `find-go`), `loadShare()` when the screen opens and after sign-in.
- [ ] **Step 3: Arabic and tests:** add every new string to `AR.ui`; run `npm test` → Expected: PASS (the coverage test lists any missing Arabic or glued text).
- [ ] **Step 4: Visual check** with the Firebase-stub harness (extend its stubs with `getDoc`, in-memory `profiles`/`usernames`/`emails`): screenshots of the no-username step, the full screen with a public profile, a search card and the "No one found" state, in English and Arabic, light and dark; fix what looks wrong.
- [ ] **Step 5: Commit** `git add public tests && git commit -m "feat: Profile and privacy screen with Find a friend"`

---

### Task 6: Docs and release

**Files:**
- Modify: `public/sw.js` (VERSION `iron-log-v17`, APP_SHELL `/social.js`), `CLAUDE.md`, `README.md`, `docs/README.md`

- [ ] **Step 1: Docs:** `CLAUDE.md` — Files list (`social.js`, `tests-rules/`), Data model (the three new collections, the Summary fields, the "profiles vs users/{uid}/items/profile" naming note, rules summary, "friends visibility behaves like private until sub-project 2"), Deploy section (`firebase deploy --only firestore:rules` before hosting when rules change; rules tests in `tests-rules/`, need Java); `README.md` — a short note that the rules now cover sharing; `docs/README.md` — row 10.
- [ ] **Step 2: Final checks:** `npm test` green; rules tests green; `node --check` on the page script; the English and Arabic screenshots from Task 5 still look right.
- [ ] **Step 3: Commit** `git add . && git commit -m "feat: profiles, privacy and search, sw v17"`
