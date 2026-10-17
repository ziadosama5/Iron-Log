# Faster logging at the gym — design

Date: 2026-10-17
Status: approved in chat, awaiting spec review
Sub-project 1 of 5 in the "improve Iron Log" effort (next: exercise info figures, look & feel, smarter coaching, ready for more users).

## Goal

Make logging during a workout take as few taps as possible on a phone: following the previous session should be "Add set → rest → Add set", with the screen staying on and a rest countdown always visible.

**Success criteria**
- Repeating last session's sets needs only the "Add set" tap per set (no stepper adjustments) when the lifter matches last time.
- A rest countdown starts on every "Add set" and alerts when rest is over while the app is open.
- A wrong set can be corrected in place.
- The phone screen does not dim/lock while a workout is being logged (on browsers that support it).

**Constraints (unchanged from the project)**
- No build step, no framework, plain ES modules. Firebase free Spark plan; no new paid services.
- Mobile-first, offline-capable (Firestore cache + service worker).
- Firestore rejects `undefined`; use `null` or omit fields.

## Scope

In: rest timer (per-exercise remembered length), smarter prefill, edit logged sets, screen wake lock.
Out (later sub-projects or "ideas not built"): set types, bodyweight mode, per-day target sets/reps, background/lock-screen notifications.

## Architecture

New file **`public/workout-tools.js`** (ES module) holding logic that doesn't touch the DOM or Firebase, so it can be unit-tested in Node:

| export | purpose |
|---|---|
| `defaultRest(exName)` | seconds for an exercise with no saved rest: compound lifts → longer, others → 90 |
| `restFor(exName, settings)` | saved rest from `settings.rest[exName]`, else `defaultRest` |
| `remaining(endsAt, now)` | seconds left (≥ 0), from an absolute end timestamp |
| `fmtClock(sec)` | `"1:24"` |
| `prefillFor(entry, last)` | `{w, r}` for the next set (see Smarter prefill) |
| `createWakeLock()` | small wrapper: `want(bool)` acquires/releases, re-acquires on `visibilitychange`; no-op if unsupported |

`index.html` imports these and owns the UI (rest bar, set editing) and storage. `sw.js` adds `/workout-tools.js` to `APP_SHELL` and bumps `VERSION`.

**Compound list for `defaultRest`** (case-insensitive substring match on the exercise name):
- 180 s: squat, deadlift (incl. Romanian/RDL), bench press, overhead press / military press, leg press
- 150 s: barbell row / bent-over row, pull-up / chin-up, dip, hip thrust, incline bench
- 90 s: everything else

(Exact matching uses the names in `LIB`; isolation variants like "Leg Extension" must not match "leg press".)

## Data model change

New Firestore doc **`users/{uid}/items/settings`**:
```
{ rest: { "<exercise name>": <seconds>, ... }, updated: <ms> }
```
- `store.init` snapshot: add an explicit `d.id==="settings"` branch → `state.settings`. (Today any unknown id falls through to workouts, which would create a phantom workout.)
- `store.saveSettings(s)` writes the whole doc. Written only when a rest length is changed via ±15s — never per tick or per set.
- Backup: `exportData` includes `{id:"settings", data: state.settings}`; `importData`'s id whitelist regex accepts `settings`.
- Missing doc → `state.settings = {rest:{}}`, defaults apply.

## Rest timer

**State (in memory + localStorage, not Firestore):** `state.rest = {ex, endsAt, total}` or `null`. Mirrored to `localStorage["ironlog.rest"]` so a reload/tab-switch keeps the countdown. Time is always computed from `endsAt`, never from counting ticks, so it stays correct after the browser throttles a background tab.

**Start:** on "Add set" (not on "Save set" when editing) → `endsAt = now + restFor(ex)*1000`.

**Rest bar:** fixed to the bottom of the viewport (tabs are at the top), padded with `env(safe-area-inset-bottom)`, visible on every tab while `state.rest` is set:
`Rest · Bench Press   1:24   [−15s] [+15s] [Skip]`
- Updated by a 250 ms interval that only touches the bar's text (no full `render()`), so it doesn't fight focused inputs.
- **−15s / +15s:** shifts `endsAt`, and saves the new total (clamped 15–600 s) as that exercise's rest in `settings` (debounced ~1.5 s so several taps = one write).
- **Skip:** clears the timer.
- Page content gets bottom padding while the bar is shown so it never covers the "Add set" button.

**Rest over:** bar switches to a "Go" state (accent color, "Rest over · Bench Press"), `navigator.vibrate([200,100,200])` if available, and a short beep via Web Audio (an `AudioContext` created/resumed on the first "Add set" tap to satisfy autoplay rules). The "Go" state stays until the next "Add set", Skip, or 60 s pass.

**Known limit:** no alert when the phone is locked or the app is backgrounded (web apps can't do this reliably without push). Wake lock covers the normal case. On return, the bar shows the correct state immediately.

## Smarter prefill

Replace `defaults(e, last)` with `prefillFor(entry, last)`:
1. If today has N sets logged and last session has a set at index N → use last session's set N.
2. Else if today has sets → repeat today's last set.
3. Else if last session exists → last session's set 0.
4. Else `{w:"20", r:"8"}`.

The existing `ui[ex]` draft (what the user typed/stepped) still wins until a set is added; after "Add set" the draft is cleared so the next prefill applies.

## Edit logged sets

- Each row in the open exercise's set table becomes tappable (`data-act="edit-set"`, keeps the ✕ delete button).
- Tapping loads that set's `w`/`r` into the steppers, sets `state.editSet = {ex, si}`, highlights the row, and the primary button reads **Save set** with a **Cancel** link.
- Save → replaces `entry.sets[si]`, one `store.save(w)` write, clears `editSet`, does not start/restart the rest timer. PR badges recompute from the table as today.
- Cancel, closing the exercise, or switching exercise clears `editSet`.

## Keep screen awake

`createWakeLock().want(cond)` called after each render, where `cond = state.view==="log" && state.date===today() && workout has ≥1 exercise`. Uses `navigator.wakeLock.request("screen")`; re-requests on `visibilitychange` → visible when still wanted; releases when `cond` turns false. Unsupported or rejected → silently ignored. No settings toggle.

## Error handling

- Vibration/audio unavailable or blocked → visual "Go" state still shows.
- `localStorage` access wrapped in try/catch; failure just means the timer doesn't survive reload.
- Settings write errors go through the existing `store.write` toast handling.
- All written objects are built with explicit values (no `undefined`).

## Testing

- **Unit (Node built-in runner, no deps):** `tests/workout-tools.test.mjs`, run with `node --test tests/`. Covers `defaultRest` (compound vs isolation, "Leg Press" vs "Leg Extension"), `restFor` override, `remaining` (past/future/clamp), `fmtClock`, `prefillFor` (all four branches), wake-lock wrapper with a fake `navigator`.
- **Manual (`firebase serve` + phone on deployed URL):** add set starts timer; ±15s persists for that exercise across reload and on another device; Skip; Go alert (vibrate on Android); timer survives tab switch and reload; prefill follows last session set-by-set; edit set saves without restarting timer; screen stays on during a workout and not on other tabs; backup includes `settings` and restore accepts it; no phantom "settings" workout in History.
- Deploy: bump `sw.js` `VERSION` to `iron-log-v5`; update CLAUDE.md (files list, data model, features).
