# Readiness Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A privacy policy and terms (English + Arabic), a "Delete my account and data" flow, and a "Report a user" button whose reports only the owner can read (Firebase console).

**Architecture:** A pure, unit-tested `public/safety.js` (report ids/documents, batching). Two standalone static pages. `firestore.rules` gets a write-only `reports` collection (emulator-tested). `index.html` gets the sign-in/More links, an inline Report panel on the friend page and search cards, and a full-screen Delete view whose runner removes data step by step and the Google account last.

**Tech Stack:** plain JS ES modules, `node --test`, Firestore rules + emulator (`tests-rules/`, Java 21 on PATH: `/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot/bin`), headless Edge + Firebase-stub harness (`$TEMP/harness`, port 5071; restart `run.cjs` after editing `index.html`).

**Spec:** `docs/superpowers/specs/2026-10-19-readiness-design.md` (binding; it holds the report document, the rules, the deletion order and the policy sections, which this plan does not repeat).

## Global Constraints

- No new dependency, no build step. New files: `public/safety.js`, `public/privacy.html`, `public/terms.html` (all three go into `APP_SHELL`; bump `iron-log-v24` in the release task only). `npm test` must keep passing with nothing installed.
- `index.html`, `lang-ar.js`, `sw.js` have CRLF endings: edit with Edit or Write-tool scripts (heredocs mangle backslashes and apostrophes; do not put backslash-escaped backticks in Write content).
- Contact address in both pages (exact): `ziadosamaabdo@gmail.com`.
- `reports/{reporter}_{reported}` document: exactly `{reporter, reported, reason, username, updated}`; `reason` ∈ `name | harassment | spam | other`; `username` 1–20 characters; no get, list or delete for any client.
- Existing rules (`users/{uid}/items`, `usernames`, `emails`, `profiles`, `friendships`, `blocks`) keep their meaning; the deletion flow needs no rule change.
- Every new user-visible string goes through `t()`/`tn()` with an Arabic entry. The two pages carry their own English and Arabic text (they are standalone HTML).
- Nothing is deployed before the final review and the user's go-ahead; deploy order when it comes: `firebase deploy --only firestore:rules`, then `--only hosting`.

## Review Focus

- Deletion stops safely at a failing step, can be retried, removes the Google account last, and never deletes anything when re-authentication is cancelled or fails → Task 5 (runner order, tested with a pure `wipePlan` description and a harness run with a failing step).
- A report cannot be read back (get/list) by anyone, including the reporter and the reported person, and cannot be written for someone else's id → Task 2 emulator tests (each case a named test).
- The policy and terms say only what the app does; nothing hidden → Task 3 page test checks the required statements; the final reviewer reads both pages against the code.
- A friend's lists stay consistent after deletion → Task 5: friendship documents are deleted, so the other side's live listener drops the pair (harness run shows the friend list updating).
- Report sent twice, offline, or on yourself → Task 1 `buildReport` tests (self and bad input give `null`), Task 4 (offline toast, one document per pair).

---

### Task 1: `public/safety.js` — report helpers and batching

**Files:**
- Create: `public/safety.js`, `tests/safety.test.js`

**Interfaces:**
- Produces (all exported, pure):
  - `REPORT_REASONS: [{id, label}]` in this order: `name` "Inappropriate name or username", `harassment` "Harassment", `spam` "Spam", `other` "Something else".
  - `reportId(reporter, reported) → string` = `reporter + "_" + reported` (throws when either is empty or they are equal).
  - `buildReport({reporter, reported, reason, username, now}) → {id, data} | null`: `data = {reporter, reported, reason, username, updated: now}`; `null` when the reason is not one of the four ids, the uids are empty or equal, `username` is not a string of 1–20 characters after trimming, or `now` is not a finite number.
  - `chunk(list, size) → array[]`: consecutive slices of at most `size` (size ≥ 1; empty list → `[]`).
  - `wipePlan(counts) → [{id, label}]`: the ordered steps the Delete flow shows, `counts = {hasProfile: boolean}`: always `reauth`, then `share` only when `hasProfile`, then `friendships`, `blocks`, `items`, `device`, and `account` last. Labels (English, translated by the screen): "Signing in again…", "Removing your shared profile…", "Removing friendships…", "Removing blocks…", "Removing your data…", "Clearing this device…", "Deleting your account…".
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests** in `tests/safety.test.js`: reasons order and ids; `reportId("a","b") === "a_b"`, throws for equal or empty; `buildReport` happy path (exact data object, `id` `"u1_u2"`), trims the username, `null` for a bad reason, self-report, empty uid, empty or 21-character username, `now` NaN; `chunk([1..7], 3)` → `[[1,2,3],[4,5,6],[7]]`, `chunk([], 3)` → `[]`, `chunk([1], 450)` → `[[1]]`, throws or returns `[]` safely for size 0 (throws `Error`); `wipePlan({hasProfile:true})` ids in order `reauth, share, friendships, blocks, items, device, account` and `wipePlan({hasProfile:false})` without `share`, always ending with `account`.
- [ ] **Step 2: Run** `node --test tests/safety.test.js` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `public/safety.js` as specified.
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `git add public/safety.js tests/safety.test.js && git commit -m "feat: safety helpers (reports, batching, wipe plan)"`

---

### Task 2: Rules for `reports` and emulator tests

**Files:**
- Modify: `firestore.rules`, `tests-rules/firestore.rules.test.js`

**Interfaces:**
- Consumes: Task 1 document shape (spec "Report a user" section is the contract).
- Produces: `match /reports/{reportId}` — `allow create, update` only for the signed-in reporter with exact id, keys and values per the spec; `allow get, list, delete: if false`.

- [ ] **Step 1: Write the failing tests** (append to the existing file; reuse its helpers `as`, `U1`, `U2`, `seed`; add a `report(o)` builder): own pair allowed (`reports/u1_u2` by `u1`); overwrite by `u1` (update) allowed; `u2` writing `reports/u1_u2` denied; `u1` writing `reports/u2_u1` denied (id does not start with own uid); wrong id (`reports/x`) denied; self-report (`reports/u1_u1`) denied; each bad field denied: reason `"bad"`, `reporter` ≠ auth uid, `reported` not matching the id, `username` empty, 21 chars, a number, `updated` a string, an extra key; `get`, `getDocs(collection)`, and `deleteDoc` denied even for the reporter; signed-out denied.
- [ ] **Step 2: Run** `cd tests-rules && npm test` (Java 21 on PATH) — Expected: the new "allowed" tests FAIL, the 37 existing pass.
- [ ] **Step 3: Implement** the `reports` match in `firestore.rules` per the spec (id check `reportId == request.auth.uid + '_' + request.resource.data.reported`, `reported != reporter`, `hasOnly`/`hasAll` the five keys, `reason in ['name','harassment','spam','other']`, `username is string && size() >= 1 && size() <= 20`, `updated is number`).
- [ ] **Step 4: Run** `cd tests-rules && npm test` — Expected: all pass; then `git checkout -- tests-rules/firestore-debug.log` if it shows as modified.
- [ ] **Step 5: Commit** `git add firestore.rules tests-rules/firestore.rules.test.js && git commit -m "feat: write-only reports collection (+ emulator tests)"`

---

### Task 3: Policy and terms pages, links

**Files:**
- Create: `public/privacy.html`, `public/terms.html`, `tests/pages.test.js`
- Modify: `public/sw.js` (APP_SHELL only; version bump is Task 6), `public/index.html`, `public/lang-ar.js`

**Interfaces:**
- Produces: `/privacy.html`, `/terms.html` (standalone; spec "Privacy policy and terms" section lists the required content); sign-in screen links; More sheet rows opening both pages in a new tab (`target="_blank" rel="noopener"`).

- [ ] **Step 1: Write the failing test** `tests/pages.test.js`: both files exist; each contains `<!doctype html>`, a viewport meta, the contact address `ziadosamaabdo@gmail.com`, a block `lang="en"` and a block `lang="ar"` with the same number of `<h2>` in each, a link back to `/`; the privacy page text contains (case-insensitive) "not for children under 13" or "under 13", "delete", "reports", "friends", "Google"; the terms text contains "not medical advice"; each page links to the other; `public/sw.js` APP_SHELL lists `/privacy.html` and `/terms.html`.
- [ ] **Step 2: Run** `node --test tests/pages.test.js` — Expected: FAIL.
- [ ] **Step 3: Write both pages.** Plain-language drafts following the spec's section list, in English and in simple Modern Standard Arabic (same sections, same order), inline CSS in the app's colours (light by default, dark under `prefers-color-scheme: dark`, system font stack, max-width 640px, 16px side gutter), a tiny inline script that shows `lang="en"` or `lang="ar"` content from `localStorage ironlog.lang` (try/catch, fallback `navigator.language` starting with `ar`) and sets `<html lang dir>`, plus a visible English / العربية switch. A short top line: "Last updated: 19 October 2026" (Arabic equivalent). Add both files to `APP_SHELL` in `sw.js`.
- [ ] **Step 4: Links:** sign-in screen: under the Google button a line "By continuing you accept the Terms and Privacy Policy below." and two links "Terms" and "Privacy Policy" (new tab); More sheet: rows "Privacy Policy" and "Terms" above "Sign out" (plain `<a class="more-row" href="/privacy.html" target="_blank" rel="noopener">`).
- [ ] **Step 5: Arabic + checks:** `npm test` (add the missing strings), `node --check` of the page script (slice between `<script type="module">` and the last `</script>` into `$TEMP/page.mjs`), screenshots of both pages (English light, Arabic dark) from the harness server (`/privacy.html` is served from `public/`).
- [ ] **Step 6: Commit** `feat: privacy policy and terms pages with links`.

---

### Task 4: Report a user (UI)

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`

**Interfaces:**
- Consumes: Task 1 (`REPORT_REASONS`, `buildReport`), Task 2 rules, existing `state.friends`, `frClick`, friend page, search card, `store`.
- Produces: `state.friends.report = null | {uid, username, reason}`; `store.sendReport(report) → Promise<{ok, reason}>` (offline → `reason:"offline"`; writes one `setDoc` to `reports/{id}`); click actions `fr-report` (open the panel, `data-uid`, `data-name`), `fr-report-reason` (`data-v`), `fr-report-send`, `fr-report-no`, `fr-report-block` (after a sent report, for a friend or a request: runs the existing block action).

- [ ] **Step 1: Implement the panel** (inline card, like the Remove/Block confirmations): a **Report** button on the friend page (beside Remove friend / Block) and on search cards for people other than you; the panel lists the four reasons as chips, **Send report** (disabled until a reason is chosen) and **Cancel**; after sending it shows "Thanks, your report was sent." and, when the person is a friend or a pending request, a **Block this person** button. The report is built with `buildReport({reporter: me, reported, reason, username, now})`; a `null` result shows the generic toast and nothing is written.
- [ ] **Step 2: Imports and store:** `setDoc` is already imported; add `store.sendReport`.
- [ ] **Step 3: Arabic + checks:** `npm test` (add strings, including the four reason labels via a coverage-test list), `node --check`, restart the harness, screenshots (friend page with the panel open in English light and Arabic dark).
- [ ] **Step 4: Commit** `feat: report a user (inline panel)`.

---

### Task 5: Delete my account and data

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`, `$TEMP/harness/stubs/fb.js` (stub only: `reauthenticateWithPopup`, `deleteUser`, `terminate`, `clearIndexedDbPersistence`, `getDocs` returning seeded friendships/blocks/items)

**Interfaces:**
- Consumes: Task 1 (`chunk`, `wipePlan`), existing `store.deleteShare` batch logic, `exportData`, `store`, auth provider.
- Produces: view `delete` (`<section id="view-delete">`, title "Delete my account", tab bar hidden); More-sheet row "Delete my account" above "Sign out" (`data-act="more-delete"`); `store.wipeAccount(onStep) → Promise<{ok:true} | {ok:false, step, reason}>` where `onStep(stepId)` is called before each step in `wipePlan` order; `reason` ∈ `cancelled` (step `reauth`), `offline`, `error`.
- Runner (exact order, spec "Delete my account and data"): `reauth` = `reauthenticateWithPopup(user, provider)` (cancel/failure → `{ok:false, step:"reauth", reason:"cancelled"}`, nothing deleted); `share` = read `profiles/{uid}` directly, and when it exists delete profile + username (+ e-mail doc when the profile says `findByEmail` and the verified e-mail is known) in one batch; `friendships` = `getDocs(query(collection("friendships"), where("users","array-contains",uid)))` deleted in `chunk(..., 450)` batches; `blocks` = `getDocs(query(collection("blocks"), where("blocker","==",uid)))` likewise; `items` = `getDocs(collection("users", uid, "items"))` likewise; `device` = stop listeners (`store.stopFriends`, unsubscribe the items listener), remove every `localStorage` key starting with `ironlog.`, `terminate(fs)` then `clearIndexedDbPersistence(fs)` (errors ignored); `account` = `deleteUser(auth.currentUser)`. A thrown error at any step returns `{ok:false, step, reason:"error"}` and stops; earlier steps are safe to repeat. Success: set `sessionStorage ironlog.deleted = "1"` and `location.reload()`; `renderSignin` shows "Your account and data were deleted." once when that flag is set and clears it.
- View: explanation list of what is removed and what stays (reports you filed), a **Download backup** button (`exportData`), a red **Delete everything** button that turns into "This cannot be undone." with **Keep** and **Delete**, a progress list from `wipePlan` while running (done / current / pending), and on failure the message "Couldn't delete everything. Nothing else was changed. Try again." (for `cancelled`: "Sign-in was cancelled.") with a Retry button. Offline: "You're offline. Try again when you're back online." and the delete button disabled.

- [ ] **Step 1: Stub the new Firebase functions** in the harness `fb.js` (and `getDocs` over seeded data); confirm the page still loads.
- [ ] **Step 2: Implement** the view, the More row, `store.wipeAccount`, the sign-in note, and the imports (`reauthenticateWithPopup, deleteUser` from firebase-auth; `getDocs, terminate, clearIndexedDbPersistence` from firebase-firestore).
- [ ] **Step 3: Arabic + checks:** `npm test` (add strings; add the progress labels from `wipePlan` to a coverage-test list), `node --check`.
- [ ] **Step 4: Verify in the harness:** screenshots of the view (idle, confirming, running, failed) in English light and Arabic dark; run the full flow against the stub and confirm the step order and that `account` runs last; make the stub's `deleteDoc`/`commit` fail once at `items` and confirm the failure message and that Retry resumes; make `reauthenticateWithPopup` reject and confirm nothing was deleted.
- [ ] **Step 5: Commit** `feat: delete my account and data`.

---

### Task 6: Docs and release

**Files:**
- Modify: `public/sw.js`, `CLAUDE.md`, `README.md`, `docs/README.md`

- [ ] **Step 1:** `sw.js` → `VERSION = "iron-log-v24"`; confirm `/safety.js`, `/privacy.html`, `/terms.html` are in `APP_SHELL` (add `/safety.js` if missing).
- [ ] **Step 2:** `CLAUDE.md`: Files list (`safety.js`, `privacy.html`, `terms.html`), data model row for `reports` (write-only, read in the Firebase console), Features bullets (policy/terms links, Delete my account order, Report), More-sheet list, Planned/Ideas lines (readiness done; challenges remain). `README.md`: privacy/deletion paragraph and "deploy rules before hosting". `docs/README.md`: row 14 ✓ sw v24.
- [ ] **Step 3:** Final checks: `npm test`; `cd tests-rules && npm test` (restore the log file); `node --check` of the page script; screenshots still fine.
- [ ] **Step 4: Commit** `feat: readiness pass (policy pages, delete my data, reports), sw v24`.
