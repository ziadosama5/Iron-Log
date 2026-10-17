# Iron Log on Firebase (free Spark plan)

A gym logger with training days, body weight, measurements, InBody tracking and coaching tips.
Anyone can sign in with Google and log their own data. Each person only ever sees their own.

```
iron-log-firebase/
├── public/
│   ├── index.html          the app
│   └── firebase-config.js  ← paste your project config here
├── firestore.rules         security: each user can only touch users/{their uid}/...
├── firebase.json           hosting + rules settings
└── README.md
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
3. Copy the `firebaseConfig` values into `public/firebase-config.js`, replacing every `PASTE_…` value.

### 5. Deploy
You need Node.js (https://nodejs.org) installed once. Then, in a terminal inside this folder:

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pick your project, alias it "default"
firebase deploy               # uploads the app AND the security rules
```

The deploy prints your app's address, like `https://iron-log-xxxx.web.app`. Share that link with anyone.

On a phone, open the link and choose **Add to Home Screen** so it opens like an app.

### Updating later
Edit the files and run `firebase deploy` again.

## What the free plan covers

These are the Spark (no-cost) quotas at the time of writing. Check https://firebase.google.com/pricing for current numbers.

| Service | Free quota | What it means for Iron Log |
|---|---|---|
| Firestore storage | 1 GiB | Each workout day is roughly 1–3 KB, so hundreds of thousands of workouts |
| Firestore writes | 20,000 / day | Every logged set is one write. About 1,000 people logging a 20-set workout a day |
| Firestore reads | 50,000 / day | Opening the app reads each of your items once, then only changes, thanks to the offline cache |
| Hosting transfer | 360 MB / day | The app is about 60 KB, so thousands of opens a day |
| Sign-ins | 50,000 monthly users | Plenty |

If a daily quota runs out, the app keeps working offline and saves the next day. Nothing is charged on Spark; it just pauses until the quota resets.

## Moving data between accounts
On the **History** tab, use **Download backup** to save everything as a file, and **Restore from file** to load it into any account.

## Notes
- **Offline:** the app caches your data on the device. You can log a workout with no signal, and it syncs when you're back online.
- **"This website isn't allowed to sign in yet":** if you later host the app on another domain (for example GitHub Pages), add that domain under **Authentication › Settings › Authorized domains**.
- **Security:** the values in `firebase-config.js` are public identifiers, not passwords. `firestore.rules` is what keeps each person's data private. Always deploy it with `firebase deploy`.
- **AI review:** the Coach tab's **Copy my summary** button copies your data with coaching instructions. Paste it into Claude (or any AI chat) for a written review. Calling an AI directly from the app would need a paid API key, so it's left out to keep the app free.
