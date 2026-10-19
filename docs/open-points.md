# Open points (as of 2026-10-19, app at sw v26, redesign live)

Everything planned in sub-projects 1-15 is shipped. This is what is still open, collected from every review ("deferred minors"), the specs' non-goals and the owner's ideas. Nothing here blocks normal use. The built-in Egyptian food table is a big separate project and is parked for later (see CLAUDE.md "Next step").

## Unfinished projects (the big ones, none started)
1. **Built-in Egyptian + everyday food table** (parked by the owner): pick foods with typical servings instead of typing calories; bundled data, Arabic + English search. Biggest remaining project.
- *Small, optional (idea from a user case, no bug found):* make the calorie target self-explaining and adjustable: show the resting-rate source (InBody scan date or formula) and how the target is built (resting x activity + lifting + cardio + goal), an everyday activity level instead of the fixed x1.2, and a personal daily deficit/surplus. Today the app already uses a recent InBody BMR (120 days) and adds the exercise and cardio estimates, so numbers are correct; this would only remove surprise.
2. **Training depth:** target sets/reps and progression (per day or exercise), warm-up/drop set types, a bodyweight-exercise mode, injuries / exercises to avoid, several gyms (Home + Gym), templates adapted to the gym.
3. **Social growth:** more challenge types (volume, PRs, streaks), rematch, chat/activity feed, notifications (need the paid plan or an alternative).
4. **Running it for many users:** abuse protection (App Check / rate limits), quota monitoring, a report admin screen or e-mail, auto-deploy from GitHub, running rules tests and screenshot checks automatically.
5. **Data and codebase:** CSV export; splitting the single 2,350-line `index.html` into modules.
In progress now: the owner is testing the later features on a real phone; expect a bug-fix batch from that.

## A. Needs the owner (not code)
1. **Read `public/privacy.html` and `public/terms.html`.** They are plain-language drafts, not legal advice. Check every promise matches what you want; consider a legal review (GDPR, Egypt's data protection law). `terms.html` does not mention challenges (the privacy policy does).
2. **Try the later features on real phones** (journey, friends, challenges, My Gym, delete my account on a throwaway Google account, Arabic/RTL). Most of this was checked only in a headless browser with stubbed Firebase and the rules emulator.
3. **Read reports** in the Firebase console (Firestore › `reports`). There is no admin screen and no notification. Names on a report are free text: check them by hand.
4. **Decide on abuse protection:** App Check / rate limiting is not set up. Each user can still write many documents within the free quota (20k writes/day shared by everyone).
5. **Watch the free plan quota** as people join (writes, reads, hosting). Publishers add writes: the summary and each challenge score.

## B. Small known issues (deferred minors)
**Profiles and search**
- A failed profile load at sign-in looks like "no profile" (no retry); saving then says "taken".
- "Delete my shared profile" can get stuck when a username or e-mail document is already gone.
- Changing the Google e-mail leaves the old e-mail lookup document.
- The first summary can be built before the first server sync; the summary goes stale at the Saturday week rollover until the next data change (`maybePublish` is not called from `checkNewDay`).
- Display names may contain bidi or control characters.
- `tests-rules/firestore-debug.log` is tracked in git (should be untracked and ignored).

**Friends**
- Both people sending a request at once shows a generic error to the second one.
- A friend page can fetch the same profile more than once; an in-flight fetch at sign-out can land in the next account's cache.
- No timeout on friend actions on a connection that looks online but is dead.
- A hand-made client can befriend someone it blocked (the app does not offer it); a friend who deletes their profile leaves a stale `@name`.

**My Gym**
- The My Gym screen can redraw under a finger while tapping (values stay correct).
- An Add exercise sheet left open over another tab can go stale after another device changes the gym.
- Restoring a backup without the equipment option turns the gym into bodyweight-only.
- Settings are one document: the last write wins between devices.

**Personal journey**
- Vertical pulls and rows are not separate slots (Upper A can get Pull-up + Lat Pulldown); Pull-up is the first Back pick for beginners.
- Bodyweight-only gyms get very short, repeated days (the library has few bodyweight back/shoulder/biceps exercises).
- The automatic journey can leave a stale back-button entry when the app opened it automatically; the skip flag is per device; focus does not move to the step heading and the dots have no "Step n of m"; a few Arabic phrases could read better.

**Readiness (delete / report)**
- No redirect fallback for re-authentication: iOS home-screen apps with popups blocked cannot delete in-app (they see a "browser blocked" message).
- The Delete button does not re-enable/disable when the connection changes without a redraw.
- After a report, Block is offered only for friends and pending requests.

**Challenges**
- Two invitees accepting at the same instant can make one see "Couldn't save" (whole-array writes; `arrayUnion`/`arrayRemove` would avoid it).
- Finished invitations are not shown, so they cannot be declined.
- The owner's `names` map can carry odd labels for friends (display only).

**Across the app:** writes on a connection that looks online but is dead can hang without a message (timeouts exist only for delete and report).

## C. Ideas not built
- **Training:** bodyweight-exercise mode; set types (warm-up, drop set); target sets/reps per day or per exercise; progression and deloads; injuries / exercises to avoid; cardio scheduling; templates adapted to the gym; several gyms (Home + Gym).
- **Food:** the built-in Egyptian + everyday food table (big; parked); barcode lookup for packaged foods (Open Food Facts barcode API has CORS).
- **Social:** other challenge metrics (volume, PRs, streak weeks), rematch in one tap, owner removing a member, chat, an activity feed, server-side friend limits, cooldown after a decline, notifications (need the paid plan).
- **Data and tooling:** CSV export; GitHub Actions auto-deploy (`firebase init hosting:github`); running the rules tests and screenshot checks in CI; an admin screen or e-mail for reports (needs the paid plan or manual work).

## D. Technical hygiene
- `public/index.html` is ~2,350 lines in one file; fine today, but splitting the screens into modules would make future work safer.
- The rules emulator tests need Java 21 and are not run by `npm test` or `firebase deploy`: run them by hand before deploying rules.
- Accessibility basics beyond the checks done so far (focus management between steps, screen-reader labels for charts and bars).
