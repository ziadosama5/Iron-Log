# Looks 2.0: design index (frozen for the build once the owner says "design frozen")

Canvas (the approved boards, light/dark, English/Arabic): https://claude.ai/artifact/SSZFbydoQhtnhwbNn9PXPC
Board file prefixes: `Main/CarbonLight/BloomLight/BloomDark` = language; `T2-` Today; `T3-` Plan and Progress; `T4-` Friends, Me, flows. Each board exists as `T?-Carbon-*` and `T?-Bloom-*`.
Approval dates (owner): language 2026-11-01 (with glass), Today 2026-11-01 (with overflow rules), Plan and Progress 2026-11-01, Friends/Me/flows 2026-11-01.
The classic `data-act` list each screen keeps is in the notes file named in the last column; the contract test compares the sets per screen across Classic, Carbon and Bloom.

## SCREENS (the builders Task 6 declares; each lives in `public/looks/carbon.js` and `bloom.js`)
| screen id | what | boards | notes |
|---|---|---|---|
| `chrome.tabbar` | five-tab bar, rest bar slot | every board | language.md |
| `chrome.pills` | section tabs (underline / bubbles) | T3-Plan-Days, Progress, T4-Friends | plan.md |
| `today` | Today root: week strip, glance/plan card, level, deload, food card | T2-Home-Dark/Light/AR | today.md |
| `today.new` | new-user / journey card | T2-Home-New | today.md |
| `workout` | exercise strip, focus card, sets, steppers, Done/Next, + Exercise/+ Cardio | T2-Work-Dark/Light/AR | today.md |
| `workout.done` | finished card | T2-Work-Done | today.md |
| `workout.variants` | bodyweight, hold, deload, avoided | T2-Variants | today.md |
| `rest.bar` | floating rest timer | T2-Work-Dark | today.md |
| `demo.thumb`, `demo.viewer` | GIF thumbnail/banner, full-screen viewer | T2-Work-Dark, T2-Demo | today.md |
| `sheet.addExercise`, `sheet.info`, `sheet.food`, `sheet.cardio`, `sheet.target` | Today sheets | T2-Sheet-* | today.md |
| `plan.days`, `plan.dayEdit`, `plan.gym` | Plan tab | T3-Plan-* | plan.md |
| `sheet.plan`, `sheet.split` | Plan sheets | T3-Sheet-Plan, T3-Sheet-Split | plan.md |
| `progress.overview`, `progress.body`, `progress.bodyForm`, `progress.lifts`, `progress.goals`, `progress.coach`, `progress.history` | Progress tab | T3-Prog-* | progress.md |
| `sheet.family` | badge family ladder | T3-Sheet-Family | progress.md |
| `friends.board`, `friends.page`, `friends.manage`, `friends.find` | Friends tab | T4-Friends-*, Friend-Page/Report, Find | friends.md |
| `challenges.list`, `challenges.open`, `challenges.new` | Challenges | T4-Challenges, Challenge-Open/New | friends.md |
| `me.root`, `me.appearance`, `me.privacy`, `me.delete` | Me tab | T4-Me-* | me.md |
| `flow.lookPicker`, `flow.journey` (steps goal, split, days, experience, gym, about, preview), `flow.celebrate`, `flow.toast`, `flow.signin` | first-run flows, celebration, toasts, sign-in | T4-LookPicker, Journey-*, Celebrate, Signin | flows.md |

## Global rules (apply to every screen; each has a test in Task 6/13)
1. Glass surfaces and the token values in language.md; Carbon dark-first, Bloom light-first, both modes, accent per look.
2. Text never breaks a layout: one-line ellipsis, two-line clamp on card titles, no wrapping on numbers or buttons, Arabic 30% longer; tests render a 70-character name and 7-digit numbers.
3. Targets at least 44 px (steppers 48), text at least 12 px, no horizontal page scroll at 360 px (only the chip and tab rows scroll, with a fade).
4. Steppers are full-width rows, never side by side.
5. No data-act is lost (contract test); features may move, never vanish. Nothing is removed in this design.
6. Arabic mirrors with logical CSS; numbers and units stay LTR; every visible string has an Arabic entry.
7. Pictures: demo box only when a GIF exists; the room (96 px / 150 px banner) is not reserved otherwise.
8. Looks are per device (`ironlog.look`); Classic stays the default and untouched.
