# Less crowded: Today, Progress and Friends

Date: 2026-10-23. Status: written for the owner's review.

## Why
Real users said the pages are crowded and carry a lot of information, and that the Friends pages look flat. Screenshots (harness, sample data) show the cause: Today puts a full cardio form and a full food form on the page even when nobody is logging, and Friends is a stack of plain text cards.

## Decision
Collapse by default, open on demand ("option 1"). Nothing is removed, the data model, Firestore, rules, badges, XP and the workout focus mode do not change. This only changes what is drawn first and where forms live.

Rule for every screen below: **a headline, then at most three things, then "Show more" / a sheet for the rest.** A form is never drawn open unless the person asked for it.

## Today (view `log`)
- **Cardio:** when no workout is open, `renderLog` draws the full `cardioCard()` under the day picker. Replace it with the small "+ Cardio" row that already opens `#cardiosheet` after a day is picked. Logged cardio stays listed. `cardioCard()` is deleted once nothing uses it.
- **Food and energy (`todayCard`):** the card shows only: Eaten / target with the thin bar, one line "Burned · Balance", and a "+ Add meal" button. Today's meals stay listed as short rows (with delete). The meal form (meal chips, kcal, protein, name) and the "Everyday · Lifting · Cardio" line and protein line move into a new bottom sheet `#mealsheet`, opened by "+ Add meal" or by tapping the card. The sheet keeps `state.mealDraft`, so typing is not lost. The "log your weight" hints stay on the card.
- **Level hero:** keep level, XP bar and streak; the "Next badge: …" sentence moves behind a tap on the hero (opens the family sheet that already exists).
- Result on the day-picker screen: hero, date, days, "+ Cardio" row, the food card. About half the height.

## Progress sections
- **Goals:** drop the second level hero (it duplicates Today and is a button with no purpose, already in open-points). Order: Target weight, Streaks, Badges. The badge wall shows the closest family and the count ("Badges · 9 of 24"), with "Show all" opening the existing all-badges page.
- **Coach:** already shows the Today card and the top 3 tips and starts "More from Coach" collapsed (state.coachMore), so nothing changes.
- **Body:** already has one trend chart with a metric dropdown and the measurements form collapsed, so only the recent entries table changes: 5 rows with "Show all".
- **Lifts and History:** lists show the 5 most recent with "Show more".
- The open/closed state of these "more" blocks is kept in `state` for the session (like `state.showAllEx`), never stored.
- Before the plan is written I will render each section with the harness and adjust these numbers to what actually looks crowded; the rule above is fixed, the exact items are not.

## Friends
- **Who's ahead:** a strip at the top of Friends: you and your friends ranked by workouts this week (from the shared summary already fetched, `state.friends.data`), each with an initials avatar and the number. Pure helper `rankWeek(me, friends)` in friends.js, unit-tested (ties share a rank, friends without a summary are listed last).
- **Friend rows:** avatar with initials (colour from the username), name, level chip, "N workouts this week", chevron.
- **Requests:** a highlighted banner card at the top with Accept / Decline; Block moves into the friend page / a small menu.
- **Sent and Blocked:** folded into one collapsed "Manage" card.
- **Empty state:** a friendly "Invite a friend" card with a Find button instead of the grey sentence.
- Challenges and Find keep their content; they get the same card spacing and avatar style.

## Not changing
Firestore data, rules, the shared summary, badges and XP, the focus-mode workout card, navigation and swipe. Arabic and RTL: every new string gets an Arabic entry (`npm test` enforces it); avatars and chips use logical CSS properties.

## Files
`public/index.html` (renderLog, todayCard, renderGoals/Coach/Body/Lifts/History, renderFriends, new `#mealsheet`), `public/friends.js` (rankWeek), `public/lang-ar.js`, `public/sw.js` (VERSION bump), tests for `rankWeek`, `tests-ui` updated for the new tap targets.

## Testing
- Unit: `rankWeek`; `npm test` (Arabic coverage, no glued strings).
- `tests-ui` smoke tests: sheets open and close, Back closes the meal sheet, 44px targets and 12px text, Arabic.
- Harness screenshots before and after in light, dark and Arabic.
- Owner tries it on the phone before any deploy.

## Risks
- Hiding forms adds a tap to logging a meal or cardio. Mitigation: one tap on a large row, the sheet opens with the first field focused, and the draft is kept.
- Users who liked seeing the calorie breakdown now tap for it; it is one line and stays in the sheet.
