# Friends — design

Sub-project 2 of 3 of the friends system (1 = profiles, privacy and search, shipped as sw v17; 3 = challenges). This one adds friend requests, a friends list, a friend's progress page (compared with yours) and blocking, and makes the **Friends** visibility real.

## Goal
Two people can become friends by agreement (request, then accept). Friends see each other's shared summary and can compare it with their own. Either can remove the other; anyone can block someone.

## What was agreed
- A friend sees the other's **summary only** (the sub-project 1 summary: level, xp, badges, streaks, workouts week/30/total, weekly volume, PRs, last workout). No workouts, lifts, body data or meals.
- **Anyone who finds my exact username may send me a request, even if I am Private.** Only accepted friends ever see data, and only when my visibility is Friends or Public. Private still means nobody.
- A friendship needs both people to agree. Either can end it at any time.
- Free plan, no Cloud Functions: everything is written by the person who owns it and enforced by `firestore.rules`.

## Non-goals
Challenges (sub-project 3), push notifications (paid plan), friend limits enforced by the server, an activity feed, reporting users, a cooldown after a decline (Block is the remedy), changing the Public rule (a blocked person can still read a Public profile), My Gym, the personal journey.

## Data (two new top-level collections; everything existing is untouched)

### `friendships/{pairId}`
`pairId` = the two uids sorted ascending and joined with `_` (`smaller_larger`), so a pair has exactly one document.
`{ users: [uidA, uidB] (sorted, same order as the id), requester: uid, status: "pending"|"accepted", names: { <uidA>: username, <uidB>: username }, updated: number }`
- `names` lets each side show the other without reading a profile that may be hidden. Each entry is checked by the rules: the writer's own entry equals the `username` in their own `profiles/{uid}`; the other entry must be a `usernames/{name}` doc that points at that uid.
- Both people need a username (and so a profile) to send or accept a request.

### `blocks/{blocker}_{blocked}`
`{ blocker: uid, blocked: uid, updated: number }`. Readable and deletable only by the blocker.

## Rules (all additions; `users/{uid}/items/*` and the sub-project 1 rules keep their meaning)
- **friendships read/list:** only a person in `users` (`request.auth.uid in resource.data.users`). The app queries `where("users","array-contains",uid)`; nobody can read pairs they are not part of.
- **create:** signed in, id is the sorted pair of `users`, I am in `users` and `requester`, status `pending`, no extra keys, names valid (above), `updated` a number, and no `blocks/{other}_{me}` exists (the other person has not blocked me).
- **update (two cases only):**
  - Accept: I am in `users` and not the requester, status `pending` → `accepted`; `users`, `requester`, `names` unchanged.
  - Refresh my name: status, `users`, `requester` and the other person's name unchanged; my entry equals my current profile username.
- **delete:** either person in `users`.
- **blocks:** create with id `me_other` and `blocker == me`; get/list/delete only the blocker; no update.
- **profiles read (changed):** owner, or `visibility == "public"` (any signed-in user), or `visibility == "friends"` and an accepted `friendships/{pair of me and owner}` exists. `private` stays owner-only.
- Blocking is a batch in the app: set the block, delete the friendship (the rules allow it because either person may delete).

## Search changes (extends sub-project 1)
- A username that exists now returns a card even when the profile is hidden: `@username` with the right action, no data. A username that does not exist still shows "No one found". (Existence is already visible through "That username is taken".)
- States on the card: **Send request**; **Request sent** (Cancel); **Accept / Decline** (they already asked me); **Friends**; **Blocked** (Unblock). Searching yourself shows "That's you".
- E-mail search keeps its old behaviour (it finds a person only when their profile is readable), because a hidden profile gives no username for `names`.

## Screens
- **Friends** (More › Friends): sections **Requests** (Accept / Decline), **Friends** (card: name, level, workouts this week, streak; tap opens the friend page), **Sent** (Cancel), **Blocked** (Unblock), and **Find a friend** (moved here from Profile; Profile keeps only your own settings). A dot on the More tab and a count on the More-sheet row show waiting requests. Live: one `onSnapshot` on `friendships` and one on `blocks`.
- **Friend page:** their summary next to mine row by row (level, this week, 30 days, streak, weekly volume, PRs, total workouts), the leader highlighted, "last trained" line, buttons **Remove friend** and **Block**. If their profile cannot be read (they went Private or stopped publishing): "<name> isn't sharing right now"; the friendship stays.
- Friends' summaries are fetched with `getDoc` when the Friends screen or a friend page opens (cached in memory, refresh button), not live.
- Everything that writes needs a connection (like saving sharing settings): offline shows the existing "You're offline" message. Client-side caps: 100 friends, 30 pending sent.
- Names in `names` are refreshed by the app on start when my username changed.
- Arabic for every new string (`AR.ui`); usernames and numbers isolated as in the rest of the app.

## Code layout
- `public/friends.js` (new, pure, unit-tested): `pairId(a,b)`, `planRequest`, `planAccept`, `planRemove`, `planBlock`, `planUnblock` (return `[{op,path,data}]` like `planShare`), `groupFriendships(docs, me, blocks)` → `{requests, friends, sent}`, `relationTo(me, other, docs, blocks)` → `none|sent|received|friends|blocked|self`, `compareSummaries(mine, theirs)` → rows with leader.
- `public/social.js`: `lookupResult` gains the hidden-user card.
- `public/index.html`: FRIENDS section (store methods, `renderFriends`, friend page, search card actions), More-sheet row + dot, wiring.
- `firestore.rules` + `tests-rules/`; `public/sw.js` v18 with `/friends.js` in APP_SHELL; docs.

## Review focus (for the plan)
- Rules: a stranger cannot read or list others' friendships or blocks; a request cannot be forged for someone else, over a block, or with a fake name; only the non-requester can accept; nobody can turn `accepted` back to `pending` or change `users`/`requester`.
- Friends-only profile reads work only for accepted pairs and stop immediately after remove or block.
- Block deletes the friendship in the same batch; the blocked person cannot re-request.
- A hidden/private person reveals nothing beyond `@username` existing.
- Stale clients: accepting a request that was just cancelled fails cleanly; duplicate requests (both people send at once) end as one pair doc (the second create is denied, the UI then shows "they already asked: Accept").

## Testing
Unit tests for `friends.js` and the new `lookupResult` cases; emulator tests for every allow and deny above; the language-coverage test for new strings; headless screenshots of the Friends screen and friend page (English light, Arabic dark) with the existing stub harness extended for friendships.
