# Challenges — design

Sub-project 3 of the friends system (1 = profiles and search, 2 = friends, shipped). Friends can start a consistency challenge: who trains on more days over 1, 2 or 4 weeks, with a live leaderboard. Free plan, no server code: each person's phone counts their own training days and writes only the total; `firestore.rules` decides who can read and write.

## Goal
A person invites up to five accepted friends to a challenge, everyone who accepts sees the same leaderboard of training days for the challenge dates, and the winner is clear when it ends. Nobody ever sees another person's workouts, only their day count.

## What was agreed
- **Compare:** training days (consistency). A training day is a date with sets or cardio, the same rule the streaks and the shared summary use (`trainedOn`).
- **Who:** a small group, up to 6 people including the creator (also works 1-on-1 with a single invite). Invitees must be accepted friends of the creator at creation.
- **How long:** 1, 2 or 4 weeks, starting today or at the next Saturday (the app's week starts on Saturday). It runs to the end of its last day.
- Everything is computed on the phones and written by the person it concerns.

## Non-goals
Other metrics (volume, PRs, streak weeks), chat, prizes, push notifications, anti-cheat (scores are self-reported by friends), one-tap rematch, editing a challenge after creating it, letting the owner remove a member, changing what a blocked person can still see in a challenge they already joined.

## Data (two new collection paths; everything existing is untouched)

### `challenges/{cid}` (cid = Firestore auto id)
`{ owner: uid, members: [uid] (owner first, 2–6, everyone invited or joined), joined: [uid] (starts as [owner]), names: {uid: username} (1–20 chars each, display only), start: "YYYY-MM-DD", weeks: 1|2|4, end: "YYYY-MM-DD", updated: number }`
- `end` = `start` + `weeks`×7 − 1 days (the last day, inclusive).
- Status is derived on the phone: **upcoming** (today < start), **active** (start ≤ today ≤ end), **finished** (today > end).

### `challenges/{cid}/progress/{uid}`
`{ days: int 0..28, updated: number }` — only the person themselves writes their own.

## Rules (additions; every existing rule keeps its meaning)
- **challenges read / list:** `request.auth.uid in resource.data.members`. The app queries `where("members","array-contains",me)`; nobody can list other people's challenges.
- **challenges create:** signed in; exactly the eight keys; `owner == auth.uid`; `members` a list of 2–6 with `members[0] == auth.uid`; `joined == [auth.uid]`; `weeks in [1,2,4]`; `start` and `end` match `YYYY-MM-DD`; `names` has an entry of 1–20 characters for each member (checked by index); every other member is an accepted friend of the owner (`get(friendships pair).data.status == 'accepted'`, one check per index 1–5, at most 5 `get` calls).
- **challenges update (two cases only, nothing else may change):**
  - **Accept:** I am in `members` and not yet in `joined`; the new `joined` is the old one plus me; only `joined` and `updated` change.
  - **Decline or leave:** I am in `members` and not the owner; `members` and `joined` are the old lists without me; only `members`, `joined` and `updated` change.
- **challenges delete:** only the owner.
- **progress read / list:** only people in the challenge's `joined` list (`get` of the parent challenge).
- **progress create / update:** only my own document (`uid == auth.uid`), only while I am in `joined`, exactly `{days, updated}`, `days` an integer from 0 to `weeks * 7` of the parent.
- **progress delete:** me, or the challenge owner.
- No list access to `progress` across challenges.

## Counting and publishing (phone)
- `countDays(workouts, start, end, today)` = the number of distinct dates in `[start, min(end, today)]` on which `trainedOn(workout)` is true.
- For every challenge where I am in `joined` and the status is upcoming → nothing, active → count, finished → count once more (so the final day is included), the phone writes `challenges/{cid}/progress/{me}` when the number differs from the last one written, at most once every 20 seconds, only after a server snapshot (same pattern as the profile summary publisher). The first write after joining also happens right after accepting.
- The app keeps publishing for a challenge until the day after its `end`; after that the number is final.
- A person who does not open the app after their last training day leaves their last published number as their final score (stated in the screen).

## Screens
- **More › Challenges** (new view `challenges`, a dot on the More tab and a count on the row while an invitation waits). Sections: **Invitations** (Accept / Decline), **Active** (and upcoming), **Finished**, and a **New challenge** button. A person can be in at most 5 challenges that are not finished (client check).
- **New challenge:** length chips (1, 2, 4 weeks), start chips (**Today**, **Next Saturday (date)**), a checklist of accepted friends (at least one, at most five), **Create**. Needs at least one friend; with none it says to add friends first and links to the Friends screen.
- **Challenge page:** title line "N weeks · 19 Oct – 1 Nov" and "Day 6 of 14" (or "Starts Sat 25 Oct" / "Finished"), the leaderboard (rank, name, a bar and the number of days; ties share a rank; people who have not accepted yet are listed as "Invited"), "Winner: <name>" (or "Winners") when finished, a line "Scores are self-reported. A final score is whatever each person last published.", and **Leave** (members) or **Delete challenge** (owner, inline confirm). The leaderboard listens live to the progress documents of the open challenge only.
- Offline: creating, accepting, declining, leaving and deleting need a connection (existing offline message); reading works from cache.
- Arabic for every new string; usernames and numbers keep their order.

## Related changes
- **Delete my account:** a new step **Removing challenges…** (id \`challenges\`, between friendships and blocks) in \`wipePlan\`: for every challenge where I am in \`members\`: if I am the owner, delete all its progress documents and then the challenge; otherwise delete my progress document and remove me from \`members\` and \`joined\`.
- **Privacy policy and terms** (English and Arabic): a sentence that challenge participation (the invited friends' usernames, your training-day count and the challenge dates) is visible to the people in that challenge, and is removed when you delete your account or leave.
- Deleting a challenge deletes its progress documents first (the owner's phone), then the challenge, because subcollections are not removed automatically.

## Code layout
- \`public/challenges.js\` (new, pure, unit-tested): \`weekStart(date)\`, \`challengeDates({startChoice, weeks, today})\` → \`{start, end}\` (\`startChoice\` \`"today"\` or \`"saturday"\`), \`statusOf(ch, today)\`, \`dayNumber(ch, today)\`, \`countDays(workouts, start, end, today, isTrained)\`, \`rankMembers({joined, members, progress, names})\` → \`[{uid, name, days, rank, joined}]\` (joined by days desc then name; ties share a rank; invited-only last), \`winners(rows)\`, and write plans \`planCreate\`, \`planAccept\`, \`planLeave\` with the same \`{op, path, data}\` shape as the other plans.
- \`public/index.html\`: CHALLENGES section (listeners, publisher, screens, wiring), More row, wipe step.
- \`public/safety.js\`: \`wipePlan\` gains the \`challenges\` step (tests updated).
- \`firestore.rules\` + \`tests-rules/\`; \`public/sw.js\` v25 with \`/challenges.js\`; docs; both policy pages.

## Testing
Unit tests for \`challenges.js\` (week start on every weekday, both start choices, 1/2/4-week ends, status and day number at the boundaries, counting with duplicate dates, cardio-only days and days outside the range, ranking with ties and not-yet-joined people, winners, write plans). Emulator tests for every allow and deny above (including a non-friend invitee, 7 members, duplicate owner, accept by someone not invited, accept twice, changing other fields in an accept, leave by the owner, progress by a non-member, progress over the cap, progress for someone else, list without the array-contains filter). Pages test for the new policy sentences, language-coverage test, a harness run of create → accept → publish → leaderboard → leave/delete against the stub, and screenshots (English light, Arabic dark).

## Review focus (for the plan)
- A stranger or a non-friend can never read a challenge or its progress, be added to one, or write someone else's score.
- Accepting and leaving can change nothing but the lists; the owner cannot be removed or leave; no second accept.
- The 10-`get` limit on the create rule is respected with 5 invitees.
- Scores near the dates' edges: the last day counts, days before the start do not, a finished challenge stops changing, rollover at midnight.
- Deleting an account or a challenge leaves no readable leftovers and no crash for the other members.
- Privacy: the leaderboard shows only usernames and day counts.
