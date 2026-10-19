# Readiness pass: policy pages, delete my data, report a user — design

Part of "getting ready for more users". Before the link is shared widely, strangers sign in with Google and can expose a username and a progress summary. This adds the three things a public app with accounts and a social side needs: a privacy policy and terms, a way to delete your account and all your data, and a way to report a user.

## Goal
A person can read what the app does with their data before and after signing in, can remove their account and everything stored about them from inside the app, and can report another user, with the report reaching the owner. Free plan, no server code: every write is made by the person it concerns and checked by `firestore.rules`.

## What was agreed
- **Contact address in the policy:** `ziadosamaabdo@gmail.com` (published publicly).
- **Reports:** saved in Firestore, read by the owner in the Firebase console. Nothing is emailed.
- The policy text is a plain-language draft for the owner to review; it is not legal advice.

## Non-goals
Admin screens, emailing reports, rate limiting or App Check, age verification, a lawyer's review, consent records (nothing about acceptance is stored), analytics or cookie banners (the app uses none), deleting reports a person filed (they are kept as abuse evidence and the policy says so).

## 1. Privacy policy and terms
- Two static pages: \`public/privacy.html\` and \`public/terms.html\`. Standalone HTML (own \`<!doctype html>\`, charset and viewport metas, inline CSS using the app's colours with light/dark via \`prefers-color-scheme\`), no scripts except one tiny inline script that shows the English or the Arabic block by \`localStorage ironlog.lang\` (falling back to the browser language), with a visible "English / العربية" switch. A "Back to Iron Log" link.
- Each page has an English block and an Arabic block (simple Modern Standard Arabic, same sections in the same order).
- **Privacy** covers: what is collected (Google account name, e-mail and id; everything the person enters: workouts, body measurements and InBody scans, food, training days, settings; and, only if they choose, a username, display name and a progress summary); where it is stored (Google Firebase, Firestore and Authentication); who can see it (only the person; friends or anyone only for the summary they chose; nobody for private data); what the app does not do (no ads, no tracking, no selling, no analytics); how long it is kept (until the person deletes it); how to delete (More › Delete my account, or e-mail the contact address); reports (kept); children (not for people under 13); changes to the policy; the contact address.
- **Terms** cover: acceptable use (real names or invented ones, but no impersonation, offensive names, harassment or spam); usernames and display names may be removed; the owner may remove accounts or content that break the rules; the service is free, offered as is, and may change or stop; **not medical advice** (calorie, body-fat, weight and training suggestions are estimates); the person is responsible for their own training; the contact address.
- **Where they link from:** under the Google button on the sign-in screen ("By continuing you agree to the Terms and the Privacy Policy" with two links, opening in a new tab); two rows in the More sheet (Privacy Policy, Terms) opening in a new tab. Both pages are in the service worker's app shell so they open offline.

## 2. Delete my account and data
- **Entry:** More › Delete my account (a row above Sign out), opening a full-screen view \`delete\` (no tab bar), shown only when signed in and online (offline shows "You're offline. Try again when you're back online." and the button disabled).
- **View:** explains what is removed (everything listed below) and what stays (reports they filed); a **Download backup** button (the existing backup export); a red **Delete everything** button that asks once more inline ("This cannot be undone." with **Keep** and **Delete**).
- **Order of work** (stop at the first failure, show "Couldn't delete everything. Nothing else was changed. Try again." and a Retry; every step is safe to run again):
  1. Re-authenticate with Google (`reauthenticateWithPopup`). A cancelled or failed sign-in stops the flow with "Sign-in was cancelled" and nothing is deleted; there is no redirect fallback.
  2. Shared profile: the existing \`deleteShare\` batch (profile + username + e-mail doc), skipped when there is no profile.
  3. Friendships: query \`friendships where users array-contains me\`, delete each (in batches of up to 450).
  4. Blocks: query \`blocks where blocker == me\`, delete each.
  5. Private data: list \`users/{uid}/items\` and delete every document (batches of up to 450).
  6. This device: stop the Firestore listeners, clear \`ironlog.*\` keys from \`localStorage\`, then \`terminate\` Firestore and \`clearIndexedDbPersistence\` (errors ignored).
  7. \`deleteUser(auth.currentUser)\`; then the app shows the sign-in screen with the message "Your account and data were deleted."
- Reports the person filed are not deleted (the rules give no one delete access); the policy says reports are kept.
- **No rule changes:** each step only deletes things the person may already delete (own items, own profile with its username, friendships they are in, blocks they made).

## 3. Report a user
- **Where:** a **Report** button on the friend page (next to Remove friend and Block) and on search-result cards (not for yourself). It opens a small sheet: the four reasons (**Inappropriate name or username**, **Harassment**, **Spam**, **Something else**), **Send report** and **Cancel**.
- **Stored:** \`reports/{reporterUid}_{reportedUid}\` = \`{reporter, reported, reason, username, updated}\`: \`reason\` one of \`name\`, \`harassment\`, \`spam\`, \`other\`; \`username\` the reported person's username as the reporter saw it (1–20 characters); \`updated\` a number. Reporting the same person again overwrites the document (one report per pair).
- **Rules:** \`allow create, update\` only when signed in, \`reporter == request.auth.uid\`, the document id is exactly \`reporter + "_" + reported\`, \`reported != reporter\`, keys exactly those five, \`reason\` in the list, \`username\` a string of 1–20 characters, \`updated\` a number. **No get, list or delete for anyone** (the owner reads them in the Firebase console, which ignores rules).
- **After sending:** toast "Thanks, your report was sent." and the sheet offers **Block this person** when they are a friend or request (reuses the existing block flow).

## Code layout
- \`public/safety.js\` (new, pure, unit-tested): \`REPORT_REASONS\` (ids and labels), \`reportId(reporter, reported)\`, \`buildReport({reporter, reported, reason, username, now})\` (validates, returns the document or \`null\`), \`chunk(list, size)\` for batching deletes.
- \`public/privacy.html\`, \`public/terms.html\`; \`public/sw.js\` (app shell, v24).
- \`public/index.html\`: Delete view and runner, Report sheet, sign-in links, More rows; imports \`reauthenticateWithPopup\`, \`deleteUser\`, \`terminate\`, \`clearIndexedDbPersistence\`.
- \`firestore.rules\` + \`tests-rules/\` for \`reports\`.
- Arabic for every new string; docs updated.

## Testing
Unit tests for \`safety.js\`; emulator tests for \`reports\` (own pair allowed, overwrite allowed, someone else's pair, wrong id, self-report, bad reason, extra keys, long username all denied; get, list and delete denied even for the reporter); a test that both pages exist, contain the contact address, an English and an Arabic block, and are listed in the service worker's app shell; coverage test for new strings; harness screenshots (English light, Arabic dark) of the Delete view and the Report sheet, and a run of the deletion steps against the stub.

## Review focus (for the plan)
- Deletion stops safely at any failing step and can be retried; the Google account is removed last, so a failure never leaves data without an account.
- Re-authentication cancelled or failing never deletes anything.
- A report cannot be read back through the app or the rules by anyone, including the reporter and the reported person; it cannot be written for another person's id.
- The policy and terms say what the app really does (nothing claimed that the code does not do, nothing hidden that it does).
- A friend's view stays consistent after deletion (friendship docs removed; their lists stop showing the person).
