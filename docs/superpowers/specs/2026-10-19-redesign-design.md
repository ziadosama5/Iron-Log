# Redesign: five tabs, "Bold Block" look, levelling badges (design)

Date: 2026-10-19. Status: written for the owner's review.

## Why
The app grew to 13 screens behind five tabs, and "More" became a long list. The owner asked for a reshape of the whole app that keeps today's flow, looks modern and full of energy, and makes achievements, badges and challenges more attractive (logos, stars, medals). Decisions made with the owner in the brainstorm (mockups shown as private pages):

- **Navigation:** five purpose tabs, Today / Plan / Progress / Friends / Me; sub-sections inside a tab use a top switcher.
- **Look:** option F "Bold Block" (flat colour blocks, big numbers, dark floating tab bar) with a page background gradient made from the accent colour, in light and dark.
- **Rewards:** celebration level B (full-screen card with a short confetti burst, one tap to dismiss, queued); badges **progress** through levels (stars, bronze/silver/gold) instead of being single on/off medals.

## Goals
1. Every existing feature stays reachable in at most two taps, with fewer things on each screen's first view.
2. One consistent look built from tokens, correct in light and dark, with any accent (8 presets + custom) and in Arabic/RTL.
3. Achievements, challenges and the friend page look rewarding: badge art, level ring, streak flame, podium, celebration card.
4. **No change to stored data, Firestore documents, security rules, publishers or the Delete-my-account steps.** Existing users keep everything.

## Non-goals
Backend or rules changes; new badge metrics or XP rules; sounds or vibration; real server-side notifications; the Egyptian food table (parked); splitting `index.html` into modules (stays open in docs/open-points.md); changing the logo or app icon.

## 1. Navigation

### Tabs and sections
| Tab | Sections (switcher) | Existing screens that move in |
|---|---|---|
| Today | none (one page) | `log` (workout, cardio) + the Coach "Today" card (date, eaten/target/burned, meals, protein) |
| Plan | Days · My Gym | `days`, `gym`; "Plan my training" card on top opens `journey` |
| Progress | Body · Lifts · Goals · Coach · History | `body`, `progress` (Lifts), `goals`, `coach` (tips, sets per muscle, review, copy summary), `history` (+ backup/restore) |
| Friends | Friends · Challenges · Find | `friends` (the Find a friend card becomes its own section), `challenges` |
| Me | none (one scrolling page of cards) | `profile` (profile and privacy), language, accent, theme, backup shortcut, Privacy Policy, Terms, Delete my account, Sign out |

`journey` and `delete` stay full-screen with the tab bar hidden and are never restored as the last view (as today).

### Mechanics (keep the existing view model)
- `state.view` stays the id of a **screen** (`log`, `days`, `body`, ...). Every existing `go("friends")`, `renderX()` and `#view-*` section keeps working. A new pure module `public/nav.js` holds the registry:
  - `TABS = [{id:"today", views:["today"]}, {id:"plan", views:["days","gym"]}, {id:"progress", views:["body","progress","goals","coach","history"]}, {id:"friends", views:["friends","challenges","find"]}, {id:"me", views:["me"]}]`
  - `tabOf(view)` → tab id or `null` (journey, delete); `sectionsOf(tab)`; `migrateView(saved)` maps any value saved in `ironlog.view` before this release (`log`→`today`, `coach`→`coach`, `profile`→`me`, others unchanged; unknown → `today`).
- The switcher is one shared component drawn at the top of a tab's views (pills, scrolls sideways if narrow, `aria-pressed`, arrow keys not required). Changing a pill calls `go(view)`. The selected section per tab is remembered through `ironlog.view` only (last view), as today.
- Today is a **new view id `today`** that composes `renderLog()` output and the Coach Today card renderer (extracted from `renderCoach` into its own function). The two dates unify: one date strip drives workout and food; `state.cdate` follows `state.date` (the food card keeps reading `cdate`, which is set whenever `date` changes). `rolloverDate` keeps both in step.
- `find` is a new view that renders the existing Find a friend card on its own (the code moves out of `renderFriends`; `store.lookup` and its state are untouched).
- Tab bar: a floating pill, five buttons (icon + label), `aria-current="page"` on the active tab, a dot on Friends for waiting friend requests plus challenge invites (today's `renderFriendsBadge` logic, retargeted from More to Friends), counts shown on the Friends and Challenges pills. Hidden for `journey`/`delete` and when signed out. The pinned rest-timer bar sits above it as now.
- The More sheet, `more-open`/`more-go` handlers and the long row list are removed; the language, accent and theme controls and the policy links move into the Me page unchanged (same ids/handlers where possible, so applyLang/applyAccent/theme code is untouched).
- Header: logo, screen title (the current section's name), sync status, as now.
- Entry points updated: hint cards and "Plan my training" buttons keep their `data-act`s; any code that did `go("friends")` for invites still lands on the right section; "Open Days" links and the gym hint go to Plan.

### Back button
Pill and tab changes do not add history entries (same as today's `go`). Sheets keep their own entries.

## 2. Look and feel ("Bold Block")
- **Tokens** (extend the existing set, keep `--accent`, `--accent-ink`, `--accent-soft`, `--good`, `--danger`): `--bg-grad` (background gradient), `--surf`, `--hero`, `--hero-ink`, `--track`, `--bar` (floating tab bar), `--reward-gold/-mint/-coral/-silver/-bronze`, radii 22 (hero), 20 (card), 14 (button), pill 99.
- **Background gradient:** `linear-gradient(165deg, color-mix(in srgb, var(--accent) 24%, #fff) 0%, color-mix(in srgb, var(--accent) 9%, #f4f5f8) 55%, color-mix(in srgb, var(--accent) 16%, #fff) 100%)` in light; the dark version mixes 30% / 8% / 18% into `#0c0d10`. It is applied on `body` with `background-attachment: fixed`. No JS change to `deriveAccent`; the head script that paints the cached accent first still works because the gradient is pure CSS over `--accent`. Plate blue (the default) gives a faint blue tint, so the default look is calm.
- **Surfaces:** cards white (light) or lifted dark grey (dark); the Today level card and the "hero" blocks are `--hero` (black in light, a lifted dark in dark) with a ring in the accent; primary buttons use the accent; numbers use JetBrains Mono / Barlow Condensed at large sizes as now.
- **Icons:** the SVG sprite gains `today, plan, progress, friends, me, flame, trophy, bolt, lock, star, crown, scale, food, cardio, calendar` (line style, 24 px grid, `currentColor`). Old tab icons that are no longer used are removed.
- **Rewards colours** (gold, mint, coral, silver, bronze) are fixed tokens like `--good`/`--danger`; they never follow the accent, and text on them is near-black.
- **Accessibility:** all contrast rules stay (accent has >= 4.5:1 against the card and the gradient's lightest/darkest stops; reward tiles use near-black ink); focus rings stay; pills and tabs are real buttons with names; `prefers-reduced-motion` turns off all new animation.
- **RTL:** logical properties only; the tab order and switcher mirror; chevrons flip; ring and bars stay LTR; podium order stays 2-1-3 left-to-right in both languages (it is a chart).

## 3. Rewards

### Badge families (derived, no stored data)
`public/badge-art.js` (pure, unit-tested) defines `FAMILIES` over the existing 24 `BADGES` ids, in this order of levels:

| Family id | Name | Levels (badge ids) | Icon |
|---|---|---|---|
| workouts | Workouts | workouts-1, -10, -50, -100, -250 | dumbbell |
| kcal | Calories burned | kcal-10k, -50k, -100k | flame |
| cardio | Cardio minutes | cardio-1000, -5000 | bolt |
| goal | Goal weight | goal-first-kg, goal-reached | scale |
| streak | Training streak | streak-4, -12, -26 | calendar |
| food | Food streak | food-7, -30 | food |
| pr | Personal records | pr-1, pr-10 | trophy |
| strength | Strength club | bench-bw, squat-1.5, deadlift-2 | crown |
| volume | Volume lifted | volume-100t, volume-1000t | dumbbell (heavy) |

- `familyState(family, badgeList)` → `{level, of, next: badge|null, pct, tier, earnedDates[]}`: `level` = number of earned levels counted from the first (a later level earned without an earlier one still counts the earned ones: level = count of earned); `tier` = `locked` (0 earned), `bronze` (level 1), `silver` (middle), `gold` (all levels earned); for a 2-level family 1 = silver, 2 = gold; for 3+ levels: 1 = bronze, last = gold, in between silver. `pct` = progress to the next level from its `value/target` (clamped 0..1).
- Every one of the 24 badge ids belongs to exactly one family (test). Family and level names need Arabic (`AR.names.family` plus existing `AR.names.badge`).
- XP, `badges()`, `seenBadges`, the shared summary's `badges` count, challenge scoring and backups are **unchanged**: families are only a way to show the same 24 badges.

### Where it shows
- **Progress › Goals:** level card (ring + title + XP bar), target-weight card, streaks (with a flame), then the **wall of 9 family tiles**: icon, tier colour, stars (one per level, lit when reached), "Level 3 of 5", a progress bar to the next level with the existing `badgeProgress` text ("62 / 100"). Tapping a tile opens a sheet with the whole ladder and earned dates.
- **Today:** a level card (ring, title, XP to next) and a "Closest badge" line (the family with the highest `pct` that is not finished).
- **Friend page:** their level ring and badge count next to yours (existing comparison, restyled with the ring/flame).
- **Challenges:** the challenge page gets a **podium** (rank 1-3, crown on rank 1, avatars with initials, day counts), remaining members as rows with bars (existing `rankMembers` ranks and ties; a tie shares a podium step); a finished challenge shows a winner banner with a trophy (existing `winners`). Lists keep Active/Finished/Invitations, restyled.

### Celebration (level B)
- A full-screen card (`dialog`, `role="alertdialog"`, focus on the Close button, Escape/tap dismisses) with the family tile or level ring, a title ("Workouts · Level 3", "Level 8", "You won the challenge"), the line ("50 workouts"), and a short confetti burst drawn on a canvas (about 1.2 s, 60 pieces, accent + reward colours; skipped under reduced motion).
- Triggers: a newly earned badge (one card per badge, queued, sorted by family level), a level-up (the XP level changes), a finished challenge you won (once per challenge; remembered locally in `localStorage ironlog.seenWins`, no Firestore field).
- Badge triggers keep today's rules: only after a server (non-cache) snapshot, `seenBadges` first-run marks existing badges silently, `store.saveSettings({seenBadges})` as today. The level-up trigger compares with `localStorage ironlog.level` (set silently on first run). The old toast is replaced by the card; if the card is already open, new ones queue.

## 4. Files
| File | Change |
|---|---|
| `public/nav.js` (new, pure) | `TABS`, `tabOf`, `sectionsOf`, `migrateView`, `pillsFor` |
| `public/badge-art.js` (new, pure) | `FAMILIES`, `familyState`, `tierOf`, `ICONS` (path data per icon id, no DOM) |
| `public/index.html` | tab bar + removal of More sheet, switcher component, `today`/`find`/`me` views, extracted Coach Today card, Goals wall, podium, celebration dialog, new CSS tokens and sprite |
| `public/lang-ar.js` | Arabic for every new string, family names |
| `public/sw.js` | `VERSION` bump (v26), `nav.js` and `badge-art.js` in `APP_SHELL` |
| `tests/` | `nav.test.js`, `badge-art.test.js`, updated `lang-coverage` lists, `pages` unchanged |
| `tools/screenshot-harness/` | driver `go=` values for new views; screenshots of every tab in light/dark/Arabic and 3 accents |
| `CLAUDE.md`, `README.md`, `docs/README.md`, `docs/open-points.md`, memory | Navigation, files and design-rule sections updated |

## 5. Data flow and safety
No new reads or writes. The sign-in -> store.init -> listeners -> state -> render chain is unchanged: `render()` maps `state.view` to the same renderers (plus `renderToday`, `renderFind`, `renderMe`), then draws the shared tab bar/switcher. The snapshot "skip re-render while typing" rule, `renderSoon`, `store.wiping` guards, the pinned rest bar and Wake Lock (`shouldWake` checks `state.view==="today"` instead of `"log"`) keep working. The privacy and terms pages are unchanged because nothing about data changes.

## 6. Error handling and edge cases
- Old saved `ironlog.view` values (`log`, `more`, anything unknown) never produce a blank page (`migrateView`).
- Offline or empty data: tiles show 0 progress and "Locked"; podium with one joined member shows a single step; no division by zero in `pct` (target 0 never occurs).
- Many badges unlocking at once (first server sync on a new device): first-run marking stays silent, so no queue storm; a normal session queues at most the new ones.
- Narrow screens (320 px): switcher scrolls sideways inside its own container (page never scrolls sideways); five tab labels may use a shorter size, never wrap.
- A custom accent that is very light/dark: contrast derivation is unchanged and the gradient only mixes 9-30% accent, so text on cards (not on the gradient) stays readable; text placed directly on the gradient uses `--fg`.

## 7. Testing
- **Unit:** `nav.test.js` (every view id in exactly one tab or null; `migrateView` for each old value and garbage; pills for each tab), `badge-art.test.js` (all 24 ids covered once; tier rules for 2/3/5-level families; `pct` clamping; later level without earlier; families never invent badge ids), existing 279 tests stay green; the language coverage test is extended (new strings, family names).
- **Screenshot harness:** every tab and section in light/dark, English/Arabic, accent blue/orange/purple; Friends dot with `friends=1&ch=1`; fresh account (`fresh=1`), a celebration card via a `go=celebrate:` driver; checks no horizontal scroll at 500 px and visually checks RTL.
- **Manual (owner):** one pass on a phone after deploy: sign in, log a set, add a meal, open each tab, change accent/theme/language, trigger a badge (the harness cannot prove Firebase behaviour).
- **Rules tests:** not needed (no rules change); run anyway before deploy to confirm nothing moved.

## 8. Rollout
One branch, test-first tasks, one opus whole-branch review, one fix pass, then the owner approves the deploy; hosting only (no rules), sw `VERSION` v26. Rollback = redeploy the previous commit (no data migration to undo).

## 9. Rulings made in this spec (please veto any)
1. `state.view` stays a screen id and a thin registry maps it to tabs (smallest change; keeps every renderer and link).
2. One date for Today: the food card follows the workout date strip (the two dates were separate before).
3. Progression is **derived** from the 24 existing badges (9 families); no new stored tiers, no XP change.
4. Challenge-win celebration is remembered per device only (no new Firestore field).
5. The celebration replaces the badge toast; there are no sounds or vibration.
