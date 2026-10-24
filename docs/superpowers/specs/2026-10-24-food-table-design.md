# Built-in food table, meal builder and barcode scan (design)

Date: 2026-10-24. Sub-project 19. Status: spec awaiting owner review.

## Goal
Logging food today means typing kcal (and optionally protein) by hand. The owner wants to pick foods (aish baladi, koshari, ful, taameya, feteer, molokhia, shawarma, everyday foods) and get kcal and protein for a typical serving without knowing the numbers, build one meal from several foods, and also scan packaged foods by barcode.

Success: a common meal (for example ful + aish baladi + taameya) is logged in a few taps; a scanned packaged food is added in a few taps; every existing way of logging, and everything that reads meals (Coach, XP, badges, shared summary, challenges, backups), keeps working unchanged.

## Decisions already made (owner, 2026-10-24)
- Bundled curated table, **not** a live API (Open Food Facts is patchy for Egyptian dishes; USDA needs a client-side key). First version: **about 120 foods**, each with 1-3 typical servings.
- **Build a meal from several foods**; saving stores the totals **and** the food list so a meal can be reopened and edited.
- Extras in this project: recent foods, **My own foods**, grams entry, **barcode scan** (camera, with typed-number fallback).
- Numbers are **estimates** and shown as such; the portion is always editable.

## Data model
Meal (inside `f-YYYY-MM-DD`, unchanged fields first):
`{id, name|null, kcal, protein|null, items?:[{src, ref, name, serving, amount, grams, kcal, protein}]}`
- `items` is optional. A meal without it behaves exactly as today (hand-typed).
- Each item is a **snapshot**: its own kcal/protein/name are stored, so later edits to the table or to My foods never change past days. `src` = `table | mine | scan`; `ref` = food id (table/mine) or barcode (scan); `serving` = serving id or `"g"`; `amount` = number of servings (or grams when `serving` is `"g"`).
- `kcal`/`protein` of the meal = the sum of its items (rounded). Meal `name` defaults to the first three item names joined with " + ", editable.
- New private document `users/{uid}/items/foods`: `{list:[{id, name, per100:{kcal, protein}|null, servings:[{id, name, grams?, kcal, protein}], barcode?, updated}], updated}`. Max 200 foods. Owner-only through the existing item rules (id <= 40 chars, doc < 200 KB), so **`firestore.rules` does not change**.
- Recent foods are **derived** from the last 14 days of `f-*` items (their `items`), nothing stored.
- Delete my account already deletes every `users/{uid}/items` doc, so `wipePlan` needs no new step; the privacy policy gets the barcode paragraph (below).

## Modules
### `public/food-table.js` (pure, unit-tested)
- `FOODS`: `{id, en, ar, alt:[spellings], group, kcal100, protein100, servings:[{id, en, ar, grams}], def}`. 100 g is always offered.
- `searchFoods(query, {extra, limit})`: matches English and Arabic names and `alt`; Arabic normalised (diacritics removed, أ/إ/آ -> ا, ة -> ه, ى -> ي); ranks prefix matches first; `extra` = My foods.
- `portionTotals(food, {serving, amount, grams})` -> `{grams, kcal, protein}` (rounded; protein null when unknown), `mealTotals(items)`, `defaultMealName(items)`, `recentFoods(foodDocs, today, n)`.
- Data sources: recipes + USDA FoodData Central values (public domain). Dishes with wide real-world variation (koshari, feteer, molokhia, shawarma, mahshi) are flagged in the file. The owner reviews the file before release.

### `public/barcode.js` (pure, unit-tested)
- `validBarcode(digits)`: 8, 12, 13 or 14 digits with a correct check digit (EAN-8, UPC-A, EAN-13, GTIN-14).
- `productUrl(code)`: `https://world.openfoodfacts.org/api/v2/product/<code>.json?fields=product_name,product_name_ar,brands,nutriments,serving_size,serving_quantity`.
- `normalizeProduct(json, code)` -> a food entry or `null` (unknown product, missing kcal, kcal per 100 g outside 0-900, protein outside 0-100, negative or non-numeric values count as no data). Uses the Arabic name when present.
- Camera and network code stay in `index.html`.

### `public/backup.js`
- `cleanBackupItems` learns the `foods` document (validates ids, names, numbers, caps the list at 200) and the optional meal `items` (each field checked, bad items dropped; a meal whose items are all dropped is kept as a plain meal).

### `public/index.html`
- `mealSheetHtml` gets the tray, search, recents, serving card, My food form and the Scan button; `state.mealDraft` grows `items`, `query`, `open` (expanded food), `editId`. The manual kcal/protein/name form stays under "Type kcal yourself".
- `store.saveFoods(list)` (settings-style single document write), loaded from the items snapshot into `state.myFoods`; the snapshot parser, `saveFoods`, backup export and `cleanBackupItems` must all carry `foods` (the same round trip rule as `settings`).
- `store.wiping` already guards writers; `saveFoods` goes through the same guard.

## Picker screen (inside `#mealsheet`)
1. Meal-name chips (Breakfast, Lunch, Dinner, Snack), as today.
2. **This meal** tray: rows (name, amount, kcal) with -/+ steppers and remove; totals (kcal, protein g); the **Add meal** button. Empty: "Pick foods below, or type kcal yourself".
3. Search box + **Scan** button. Up to 6 matches, "Show more (N)". With an empty box, **Recent** chips (one tap adds the food with its last serving and amount).
4. Tapping a result expands it in place: serving chips, amount stepper (0.5 steps for pieces and plates, 1 otherwise), a grams box, live kcal/protein; **Add** puts it in the tray. A common food = tap food, tap Add.
5. **My food**: shown when search finds nothing, and from a "+ My food" link; fields: name, kcal and protein per serving (serving name, optional grams) or per 100 g. Saved foods show in search with a "Mine" tag and can be edited/deleted from their expanded row.
6. If the tray has foods, its totals are used; the manual fields are used only when the tray is empty.
7. **Editing**: a meal with `items` shows a pencil in the Today list; tapping it reopens the sheet with the tray filled, and saving replaces that meal (same id). Meals without `items` keep today's behaviour.
- Standards: targets >= 44 px, text >= 12 px, RTL-safe (steppers and numbers LTR), logical CSS properties, all strings through `t()`.

## Barcode scan
- **Scan** opens a camera view in the meal sheet (own history entry; Back and ✕ stop the camera immediately; the stream also stops when the sheet closes or the page hides).
- Detection: `BarcodeDetector` where available (Chrome on Android, the APK); otherwise a vendored scanner library in `public/vendor/`, loaded only when Scan is tapped and cached by the service worker after first use. Formats limited to EAN-13, EAN-8, UPC-A, UPC-E. The library is chosen and size-checked in the plan (not decided yet).
- A "Type the number" box is always on the camera view and is the only path when permission is denied or there is no camera.
- Lookup: only the digits go to Open Food Facts, 20 s timeout (`withTimeout`). The result opens as a normal food card (serving chips: the package serving when given, plus 100 g). **Save to my foods** is ticked by default, so the same product later works offline with no lookup.
- Failures: not found / no calories on record / implausible data -> a clear message and the My food form pre-filled with the name and barcode; offline or timeout -> the same offline/"Couldn't save"-style messages as other lookups. Scanned figures are labelled as package data from Open Food Facts.
- Privacy: video is processed on the phone and never stored or sent; only the barcode digits leave the phone, to openfoodfacts.org (which sees the IP address like any web request), not linked to the account. `privacy.html` (English + Arabic) says exactly this and `tests/pages.test.js` checks it. The Open Food Facts API calls are never cached by the service worker.

## Arabic
Every food and serving has `ar`; tests fail if any is missing or if an id is duplicated. UI strings use `t()` and `lang-ar.js` (`npm test` lists what is missing). Food names come from the entry's own `en`/`ar` fields (not `nameOf`). Digits 0-9, Latin units.

## Offline, service worker, docs
- `food-table.js` and `barcode.js` go into `APP_SHELL`; `VERSION` is bumped; the scanner library is cached on first use.
- Docs: `CLAUDE.md` (files list, data model rows for `foods` and meal `items`, features), `docs/README.md`, `docs/open-points.md`.

## Testing
- Unit (`npm test`): search (English, Arabic, spellings, ranking), serving math and rounding, meal totals and default name, recents, barcode checksum, product mapping and plausibility, backup cleaning of `foods` and `items`, Arabic coverage, privacy page statements.
- Table sanity tests: ids unique; every food has `ar`, servings with grams, and 100 g; protein <= 100 g per 100 g; where fat/carbs are recorded, kcal is within 15% of 4*carbs + 4*protein + 9*fat.
- UI (`tests-ui`, screenshot harness with stubbed lookup): open the sheet, search in both languages, build a three-food meal, edit a saved meal, create a My food, the typed-number scan path, 44 px and 12 px checks.
- Rules (`tests-rules`): run before deploy (rules unchanged); add a case that `foods` is owner-only.
- By hand on the owner's phone: a real camera scan (the harness has no camera), the Arabic layout, and the Android app.

## Rollout
One branch, test-first tasks, one commit per task; whole-branch review and a fix pass; owner tests on a phone and approves the deploy; deploy hosting (rules unchanged); verify live; merge `--ff-only`, push, delete the branch.

## Out of scope
Meal photos, macros beyond kcal and protein, shared or public foods, meal templates ("my usual breakfast", an easy follow-up since saved meals keep their items), a growing server-side food database.

## Risks and open questions
- **Data accuracy:** the figures are my estimates from recipes and USDA values, not a lab table. The owner reviews the table, and the app labels all figures as estimates.
- **Open Food Facts quality:** user-edited, patchy for Egypt; mitigated by plausibility rules and the My food fallback.
- **Scanner library:** not chosen yet; picked in the plan by size and iOS Safari support. If none fits, iPhone users get the typed-number path only.
- **Single `foods` document:** 200 foods fits the 200 KB item limit; two devices editing at once means the last write wins (same as `settings`).
