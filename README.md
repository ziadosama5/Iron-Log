# Iron Log

A gym logger you install on your phone. Log workouts set by set, track body weight, measurements and InBody scans, count calories in and out, and get coaching tips and achievements.
Anyone can sign in with Google and log their own data. Each person only ever sees their own.

Live: https://gym-logger-85d4c.web.app · runs free on Firebase's Spark plan · works offline.

## What it does

- **Workout:** pick a training day and log one exercise at a time with big ± buttons. Sets prefill from last session, a rest timer starts after each set, and you can do exercises in any order. Add cardio (treadmill, elliptical, bike) with time and calories.
- **Plan my training:** answer four quick questions (goal, days per week, gym, experience) and get a ready week of training days that fits you; new people get it on first sign-in.
- **My Gym:** tick the equipment your gym has (or start from a preset) and exercise suggestions only offer what you can do.
- **Exercise info:** tap "!" next to an exercise for start/finish drawings, the muscles it works and form tips.
- **Coach:** today's calories eaten vs target, calories burned (everyday + lifting + cardio), protein, quick meal logging, and tips based on your training and body data.
- **Body:** quick weight entry, tape measurements, InBody scans and trend charts.
- **Goals:** target weight with a finish estimate, streaks, 24 badges and levels.
- **More:** edit training days (templates: PPL, Upper/Lower, Full Body, Bro Split), lift progress charts, history, backup/restore, light/dark theme.

## Folders

```
iron-log-firebase/
├── public/              the app (served by Firebase Hosting)
│   ├── index.html       UI, logic and storage layer
│   ├── *.js             pure modules (exercise library, energy, achievements, backup, helpers)
│   ├── exercises/       exercise drawings (CC BY-SA 4.0)
│   ├── sw.js            offline cache — bump VERSION on every deploy
│   └── firebase-config.js  ← your project config
├── tests/               unit tests (npm test)
├── tools/               dev scripts: exercise info + drawings generator
├── brand/               logo source files (not served)
├── docs/                design specs and implementation plans
├── firestore.rules      security: each user can only touch users/{their uid}/...
├── firebase.json        hosting + rules settings (tests run before every deploy)
└── CLAUDE.md            detailed project notes (data model, structure, gotchas)
```

## One-time setup (about 15 minutes)

### 1. Create the Firebase project
1. Go to https://console.firebase.google.com and click **Create a project**. Name it, for example `iron-log`.
   Google Analytics is optional; you can turn it off.
2. The project starts on the free **Spark** plan. No credit card is needed. Don't upgrade to Blaze.

### 2. Turn on Google sign-in
1. Left menu: **Build › Authentication › Get started**.
2. **Sign-in method** tab › **Google** › Enable › choose a support email › **Save**.

### 3. Create the database
1. Left menu: **Build › Firestore Database › Create database**.
2. Pick a location close to your users (for Egypt, `europe-west1` (Belgium) or `me-central1` (Doha) are good). **You can't change this later.**
3. Start in **production mode**. The rules file in this folder replaces the default rules when you deploy.

### 4. Register the web app and copy its config
1. Project settings (gear icon) › **General** › **Your apps** › click the **</>** (Web) icon.
2. Give it a nickname, tick **Also set up Firebase Hosting**, and click **Register app**.
3. Copy the `firebaseConfig` values into `public/firebase-config.js`, replacing every `PASTE_…` value. Keep the `export` keyword.

### 5. Deploy
You need Node.js 18+ (https://nodejs.org) installed once. Then, in a terminal inside this folder:

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pick your project, alias it "default"
firebase deploy               # runs the tests, then uploads the app AND the security rules
```

The deploy prints your app's address, like `https://iron-log-xxxx.web.app`. Share that link with anyone.

On a phone, open the link and choose **Add to Home Screen** so it opens like an app.

## Updating later

```bash
git pull
# edit files, then bump VERSION in public/sw.js so phones get the new files
npm test                      # no packages to install
git add . && git commit -m "..." && git push
firebase deploy --only hosting
```

You can't test by opening `index.html` from disk. Use `firebase serve` (http://localhost:5000) or the deployed link.

## What the free plan covers

These are the Spark (no-cost) quotas at the time of writing. Check https://firebase.google.com/pricing for current numbers.

| Service | Free quota | What it means for Iron Log |
|---|---|---|
| Firestore storage | 1 GiB | Each workout day is roughly 1–3 KB, so hundreds of thousands of workouts |
| Firestore writes | 20,000 / day | Every logged set is one write. About 1,000 people logging a 20-set workout a day |
| Firestore reads | 50,000 / day | Opening the app reads each of your items once, then only changes, thanks to the offline cache |
| Hosting transfer | 360 MB / day | Thousands of app opens a day |
| Sign-ins | 50,000 monthly users | Plenty |

If a daily quota runs out, the app keeps working offline and saves the next day. Nothing is charged on Spark; it just pauses until the quota resets.

## Moving data between accounts
**More › History & backup**: **Download backup** saves everything as a file, and **Restore from file** loads it into any account.

## Sharing and privacy
People can pick a username, share a small progress summary (level, streaks, workout counts) as Private, Friends or Public, and become friends by request and acceptance (a friend sees only that summary next to their own; anyone can block); nothing is shared by default, and body data, meals and individual workouts are never shared. This is enforced by `firestore.rules` (deploy them with `firebase deploy --only firestore:rules`, and run `tests-rules/` first; it needs Java 21+).

## Notes
- **Offline:** the app caches your data on the device. You can log a workout with no signal, and it syncs when you're back online.
- **"This website isn't allowed to sign in yet":** if you host the app on another domain, add it under **Authentication › Settings › Authorized domains**.
- **Security:** the values in `firebase-config.js` are public identifiers, not passwords. `firestore.rules` is what keeps each person's data private. Deploy it with `firebase deploy --only firestore:rules` after changing it.
- **AI review:** **Coach › More from Coach › Copy my summary** copies your data with coaching instructions. Paste it into Claude (or any AI chat) for a written review. Calling an AI directly from the app would need a paid API key, so it's left out to keep the app free.
- **Calories** are estimates: BMR (Mifflin-St Jeor) × 1.2 plus that day's exercise. Machine calories are used as typed when you enter them.

## Exercise drawings

The start/finish drawings in the exercise info panel are adapted from
[Everkinetic](https://github.com/everkinetic/data), licensed
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). They were recolored to follow the
app's light/dark theme; the adapted files in `public/exercises/` are shared under the same license.

Muscles, form tips and which drawing each exercise uses live in `tools/exercise-sources.json`.
After editing it, regenerate the drawings and `public/exercise-info.js`:

```
node tools/import-exercises.mjs          # add --force to re-download every drawing
npm test
```
