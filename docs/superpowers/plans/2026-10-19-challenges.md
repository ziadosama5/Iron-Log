# Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Friends can start a training-days challenge (1, 2 or 4 weeks, up to 6 people) with a live leaderboard; each phone counts its own days and writes only the total.

**Architecture:** A pure, unit-tested `public/challenges.js` (date math, counting, ranking, write plans). Security rules for `challenges/{cid}` and `challenges/{cid}/progress/{uid}` (emulator-tested). `index.html` gets live listeners, a progress publisher (same pattern as the profile summary), a Challenges view, and a new "Removing challenges…" step in Delete my account.

**Tech Stack:** plain JS ES modules, `node --test`, Firestore rules + emulator (`tests-rules/`, Java 21 on PATH: `/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot/bin`), headless Edge + Firebase-stub harness (`$TEMP/harness`, port 5071; restart `run.cjs` after editing `index.html`).

**Spec:** `docs/superpowers/specs/2026-10-19-challenges-design.md` (binding; it holds the data model, rules, screens and counting rules, which this plan does not repeat).

## Global Constraints

- No new dependency, no build step. New files: `public/challenges.js` (add `/challenges.js` to `APP_SHELL`; bump `iron-log-v25` in the release task only). `npm test` must keep passing with nothing installed.
- `index.html`, `lang-ar.js`, `sw.js` have CRLF endings: edit with Edit or Write-tool scripts (heredocs mangle backslashes and apostrophes; never put backslash-escaped backticks in Write content).
- Dates are `YYYY-MM-DD` strings; week starts on Saturday; all date math in UTC (no `Date` local-time surprises).
- Caps: members 2–6 (owner + 1–5 invitees), challenge lengths 1, 2, 4 weeks, `days` 0..28, at most 5 unfinished challenges per person (client only).
- A training day = `trainedOn(workout)` from `workout-tools.js` (the rule streaks and the shared summary use).
- Existing rules keep their meaning. Rules may use at most 10 `get`/`exists` calls per write: the create rule uses 5 (one per invitee).
- Every new user-visible string goes through `t()`/`tn()` with an Arabic entry; usernames and numbers keep their order (`iso()` helper for `@name` inside sentences).
- Deploy order when the time comes: `firebase deploy --only firestore:rules`, then `--only hosting`. Nothing is deployed before the final review and the user's go-ahead.

## Review Focus

- A stranger or non-friend can never read a challenge or its progress, be added to one, or write someone else's score → Task 2 emulator tests (each case a named test).
- Accept and leave change nothing but the lists; the owner cannot leave or be removed; no second accept → Task 2 tests.
- The 10-`get` limit with 5 invitees → Task 2 test creating a 6-member challenge succeeds.
- Scores at the date edges (last day counts, days before the start do not, finished challenge stops changing, midnight rollover) → Task 1 tests of `countDays`/`statusOf`/`dayNumber`; Task 3 publisher uses `today()` and re-runs on the day rollover.
- Deleting an account or a challenge leaves no readable leftovers and no crash for the other members → Task 5 (wipe step, harness run) and Task 4 (delete removes progress first).
- Leaderboard shows only usernames and day counts → Task 4 (screens render nothing else) and the final review.

---

### Task 1: `public/challenges.js` — pure logic

**Files:**
- Create: `public/challenges.js`, `tests/challenges.test.js`

**Interfaces:**
- Produces (all exported, pure, no DOM/Firebase):
  - `MAX_MEMBERS = 6`, `MAX_INVITEES = 5`, `MAX_OPEN = 5`, `WEEK_CHOICES = [1, 2, 4]`.
  - `addDaysISO(date, n) → string`; `weekStart(date) → string` (the Saturday on or before `date`); `nextSaturday(today) → string` (the Saturday 1–7 days after `today`).
  - `challengeDates({startChoice, weeks, today}) → {start, end}`: `startChoice` `"today"` (start = today) or `"saturday"` (start = `nextSaturday(today)`); `end = addDaysISO(start, weeks*7 - 1)`; throws on another `startChoice` or `weeks` not in `WEEK_CHOICES`.
  - `statusOf(ch, today) → "upcoming"|"active"|"finished"` (`ch` has `start`, `end`).
  - `dayNumber(ch, today) → {day, total} | null`: `total = weeks*7`; `day` 1-based while active, `null` result when not active.
  - `countDays(workouts, start, end, today, isTrained) → number`: distinct `w.date` values in `[start, min(end, today)]` where `isTrained(w)` is true.
  - `rankMembers({members, joined, progress, names}) → [{uid, name, days, rank, joined}]`: joined members first by `days` desc then `name` (case-insensitive) asc, competition ranking (`1,1,3`); members not in `joined` last with `days 0`, `rank null`, `joined false`; `name` from `names[uid]` else `"?"`; `progress[uid].days` (missing → 0).
  - `winners(rows, status) → [uid]`: only when `status === "finished"`: the joined rows with `rank === 1` and `days > 0`, else `[]`.
  - Write plans (shape `{ops:[{op,path,data?}]}` like the other plans): `planCreate({cid, owner, ownerName, invitees:[{uid,name}], weeks, startChoice, today, now})` → one `set challenges/<cid>` with `{owner, members:[owner,...invitee uids], joined:[owner], names:{...}, start, weeks, end, updated:now}` (throws on 0 or more than 5 invitees, duplicate or owner among invitees, bad weeks); `planAccept({cid, me, current, now})` → `update challenges/<cid>` `{joined:[...current.joined, me], updated:now}`; `planLeave({cid, me, current, now})` → `delete challenges/<cid>/progress/<me>` then `update challenges/<cid>` `{members, joined}` without `me`, `updated:now`; `planDelete({cid, memberUids})` → `delete challenges/<cid>/progress/<uid>` for each uid, then `delete challenges/<cid>`; `planProgress({cid, me, days, now})` → `set challenges/<cid>/progress/<me>` `{days, updated:now}`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests** in `tests/challenges.test.js` (Node test runner): `weekStart` for each weekday of one known week (2026-10-17 is a Saturday: Sat→itself, Sun 18→17, Fri 23→17, Sat 24→24); `nextSaturday("2026-10-17")` is `"2026-10-24"` and `nextSaturday("2026-10-20")` is `"2026-10-24"`; month and year rollovers in `addDaysISO`; `challengeDates` for `today` with 1/2/4 weeks (`2026-10-19` + 2 weeks → end `2026-11-01`), the `saturday` choice, invalid inputs throw; `statusOf`/`dayNumber` on the day before start, the first day (day 1), a middle day, the last day (`day === total`), the day after (finished); `countDays` ignores days before `start` and after `end`, ignores future days (after `today`), counts the last day, de-duplicates two workouts on one date, uses `isTrained` (a cardio-only workout counts when `isTrained` says so); `rankMembers` ties (`3,3,1` days → ranks `1,2,2` is wrong: assert `[5,3,3,1]` → ranks `1,2,2,4`), invited-only members last with `rank null`, missing progress → 0, name fallback `"?"`; `winners` empty while active, tie gives two winners, all-zero gives none; every plan's ops and data exactly as listed (`planCreate` builds `end` and `names`, rejects 0/6 invitees, duplicates, the owner as invitee, `weeks: 3`; `planLeave` order progress delete first; `planDelete` order).
- [ ] **Step 2: Run** `node --test tests/challenges.test.js` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `public/challenges.js` (UTC date math via `Date.UTC`).
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `git add public/challenges.js tests/challenges.test.js && git commit -m "feat: challenge logic (dates, counting, ranking, write plans)"`

---

### Task 2: Rules and emulator tests

**Files:**
- Modify: `firestore.rules`, `tests-rules/firestore.rules.test.js`

**Interfaces:**
- Consumes: Task 1 document shapes (the spec "Data" and "Rules" sections are the contract).
- Produces: `match /challenges/{cid}` and `match /challenges/{cid}/progress/{uid}` per the spec.

- [ ] **Step 1: Write the failing tests** (append; reuse `as`, `U1..U3`, `claims`, `ref`, `seed`, `seedPeople`, `seedPair`; add a `ch(o)` builder for a valid challenge by `u1` inviting `u2` and `u3`, with `seedPair("u1","u2","accepted")` and `("u1","u3","accepted")`): create allowed (2 and 6 members: add friends `u4..u6` by seeding pairs; check the `get` limit by creating the 6-member challenge); create denied for: non-friend invitee, pending-only friend, only the owner (1 member), 7 members, `members[0]` not the creator, `joined` not `[owner]`, owner creating as someone else, `weeks: 3`, bad date format, `names` missing an entry or an entry over 20 characters, an extra key, signed out; read/get/list: member allowed (invited or joined), stranger denied, unfiltered list denied, `array-contains` query by a member allowed; accept: invitee adds themselves (allowed), a stranger or the owner-again denied, accepting twice denied, accept that also changes `start` or removes another member denied; leave: invited member removes themselves (allowed), the owner leaving denied, removing someone else denied, leaving that changes other fields denied; delete: only the owner; progress: a joined member writes own `{days, updated}` (allowed, overwrite allowed), not-joined invitee denied, someone else's uid denied, `days` 29 or `weeks*7 + 1` denied, `days` string denied, extra key denied; progress read and list: joined members allowed, an invited-not-joined member and strangers denied; progress delete: self and the owner allowed, another member denied.
- [ ] **Step 2: Run** `cd tests-rules && npm test` (Java 21 on PATH) — Expected: the "allowed" tests FAIL, existing 42 pass.
- [ ] **Step 3: Implement** the two matches in `firestore.rules` per the spec (explicit per-index checks for names and friends, `affectedKeys().hasOnly([...])` for the update cases).
- [ ] **Step 4: Run** `cd tests-rules && npm test` — Expected: all pass; then `git checkout -- tests-rules/firestore-debug.log`.
- [ ] **Step 5: Commit** `git add firestore.rules tests-rules/firestore.rules.test.js && git commit -m "feat: security rules for challenges and progress (+ emulator tests)"`

---

### Task 3: Storage layer, publisher, harness stub

**Files:**
- Modify: `public/index.html`, `$TEMP/harness/stubs/fb.js` (stub only)

**Interfaces:**
- Consumes: Task 1 (`countDays`, `statusOf`, `planProgress`, `MAX_OPEN`), existing `store`, `trainedOn`, `today()`, `maybePublish` pattern, `state.serverSynced`, `store.wiping`.
- Produces:
  - `state.challenges = {loaded, docs: [{id, ...data}], progress: {}, open: null, last: {}, lastAt: {}, form: null, confirm: null}`, reset on sign-out.
  - `store.watchChallenges()` (after sign-in, next to `watchFriends`): `onSnapshot(query(collection("challenges"), where("members","array-contains",uid)))` → `state.challenges.docs`; `store.stopChallenges()`; `store.watchProgress(cid)` / `stopProgress()` for the open challenge (`onSnapshot(collection("challenges",cid,"progress"))` → `state.challenges.progress[uid] = {days, updated}`); both unsubscribe on sign-out and in the wipe's "device" step.
  - `store.challengeAction(plan) → Promise<{ok, reason}>` (same shape/reasons as `friendAction`: offline / denied / error; one `writeBatch`; `set`/`update`/`delete`).
  - `publishProgress()`: for every challenge where I am in `joined`, status upcoming → skip, active → count, finished and `today <= end + 1 day` → count once more; writes `planProgress` when the number differs from `state.challenges.last[cid]`, at most every 20 s per challenge, only after a server snapshot, never while `store.wiping`; called from the `store.init` data callback, right after accepting, and from `checkNewDay`.
  - Stub: `getDocs`/`onSnapshot` for `challenges` and `challenges/<id>/progress` seeded when `?ch=1` (one active challenge with the signed-in user `u1`, friends `u2` joined, `u3` invited).

- [ ] **Step 1: Implement** the state, listeners, `challengeAction`, `publishProgress`, and the sign-out reset; imports (`challenges.js`); stub additions (page must still load).
- [ ] **Step 2: Verify** `node --check` of the page script (slice between `<script type="module">` and the last `</script>` into `$TEMP/page.mjs`); `npm test`; in the harness with `?ch=1` the stub receives a progress write for the active challenge with the count of seeded workouts inside its dates (read `localStorage.__calls` as in earlier runs).
- [ ] **Step 3: Commit** `feat: challenges storage layer and progress publisher`.

---

### Task 4: Challenges screens

**Files:**
- Modify: `public/index.html`, `public/lang-ar.js`

**Interfaces:**
- Consumes: Tasks 1–3, `state.friends` (accepted friends via `groupFriendships`), `frBtn`-style helpers, `iso()`.
- Produces: view `challenges` (`<section id="view-challenges">`, title "Challenges"); More-sheet row "Challenges" (above "Friends") with `#challenges-count` and the More-tab dot extended in `renderFriendsBadge` for waiting invitations; click actions `ch-new`, `ch-weeks`, `ch-start`, `ch-friend` (toggle an invitee), `ch-create`, `ch-open`, `ch-back`, `ch-accept`, `ch-decline`, `ch-leave`, `ch-delete` (inline confirm: `ch-delete-yes`, `ch-no`).
- Screens per the spec: lists (Invitations / Active and upcoming / Finished), New challenge form (length chips 1/2/4, start chips Today / Next Saturday with its date, friends checklist 1–5, Create; with no friends: a line pointing to Friends), challenge page (title "N weeks · dates", "Day D of T" / "Starts …" / "Finished", leaderboard via `rankMembers` with a bar per person, "Invited" for non-joined, winners line when finished, the self-reported note, Leave or Delete with inline confirm). Opening a challenge calls `store.watchProgress`, leaving it `stopProgress`. Create = `planCreate` with `cid` from `doc(collection(fs,"challenges")).id`, then the creator's first progress write; Accept = `planAccept` then `publishProgress()`; Leave = `planLeave`; Delete = `planDelete` (progress documents first). Client checks: at most `MAX_OPEN` unfinished challenges, offline message via `challengeAction`.

- [ ] **Step 1: Register the view** (`SCREEN_TITLES`, `VIEWS`, `inMore`, render map) and the More row.
- [ ] **Step 2: Implement** the lists, form, challenge page and actions as above.
- [ ] **Step 3: Arabic + checks:** `npm test` (add every missing string; add conditional labels to a coverage-test list), `node --check`, restart the harness, screenshots with `?ch=1` of the list, the form, and the challenge page (English light and Arabic dark; no horizontal scroll at 500 px; `@name` and numbers keep order in Arabic); run create / accept / leave / delete against the stub and read `localStorage.__calls` for the expected write order (progress delete before challenge delete).
- [ ] **Step 4: Commit** `feat: Challenges screens`.

---

### Task 5: Delete-my-account step and policy text

**Files:**
- Modify: `public/safety.js`, `tests/safety.test.js`, `public/index.html`, `public/lang-ar.js`, `public/privacy.html`, `tests/pages.test.js`

**Interfaces:**
- Consumes: Task 3 listeners, Task 1 plans.
- Produces: `wipePlan` gains `{id:"challenges", label:"Removing challenges…"}` between `friendships` and `blocks`; `store.wipeAccount` runs it with the same `T(...)` timeout and error handling as the other steps.

- [ ] **Step 1: Write the failing tests:** update the `wipePlan` test in `tests/safety.test.js` (ids `reauth, share, friendships, challenges, blocks, items, device, account`; labels list includes "Removing challenges…"); in `tests/pages.test.js` assert the English privacy text mentions "challenge" and that the Arabic block contains `التحدي` or `تحديات`.
- [ ] **Step 2: Run** `node --test tests/safety.test.js tests/pages.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement:** the `wipePlan` step; in `wipeAccount`, after friendships: list `challenges where members array-contains uid`; for each challenge the owner is me → read its progress documents, delete them in batches (`chunk`), then delete the challenge; otherwise delete my progress document and apply `planLeave`-style update (members/joined without me); the privacy page (English and Arabic) gets one sentence: challenge participation (invited friends' usernames, your training-day count and the challenge dates) is visible to the people in that challenge and is removed when you leave, delete the challenge, or delete your account.
- [ ] **Step 4: Verify:** `npm test`, `node --check`; harness run of the delete flow with `?ch=1&friends=1&go=delete:run` — the call log shows `list:challenges` after the friendships step and before the blocks step, progress deletes before the challenge delete for an owned challenge; add the new label to the delete coverage-test list, add Arabic.
- [ ] **Step 5: Commit** `feat: delete my account removes challenges; policy mentions them`.

---

### Task 6: Docs and release

**Files:**
- Modify: `public/sw.js`, `CLAUDE.md`, `README.md`, `docs/README.md`

- [ ] **Step 1:** `sw.js` → `VERSION = "iron-log-v25"`, add `"/challenges.js"` to `APP_SHELL`.
- [ ] **Step 2:** `CLAUDE.md`: Files list (`challenges.js`), data model rows for `challenges/{cid}` and `challenges/{cid}/progress/{uid}`, a Features bullet (screens, scoring rule, publisher, wipe step), More-sheet list, Planned lines (challenges done; next the food table). `README.md`: one line in "What it does". `docs/README.md`: row 15 ✓ sw v25; next = built-in food table.
- [ ] **Step 3:** Final checks: `npm test`; `cd tests-rules && npm test` (restore the log file); `node --check` of the page script; screenshots still fine.
- [ ] **Step 4: Commit** `feat: challenges, sw v25`.
