# Food table, meal builder and barcode scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people build a meal from a bundled table of about 120 Egyptian and everyday foods (and their own foods and scanned packaged foods), saving totals plus the food list into the existing meal model.

**Architecture:** Two new pure modules (`food-table.js`, `barcode.js`) hold all data and logic and are unit-tested; `index.html` only draws the picker inside the existing `#mealsheet` and wires events. A meal keeps `{id,name,kcal,protein}` and gains an optional `items` snapshot array; My own foods live in one new private document `users/{uid}/items/foods`, so Firestore rules do not change.

**Tech Stack:** Plain ES modules (no build), Node built-in test runner (`npm test`), Playwright UI tests (`tests-ui`), Firestore rules emulator (`tests-rules`, Java 21), Open Food Facts product API, `BarcodeDetector` with one vendored scanner library as fallback.

**Spec:** `docs/superpowers/specs/2026-10-24-food-table-design.md`

## Global Constraints

- No build step, no framework; every new `public/*.js` goes into `APP_SHELL` in `public/sw.js`, and `VERSION` is bumped on each deploy (currently `iron-log-v40`).
- Every visible string has an Arabic entry in `public/lang-ar.js` (`npm test` fails otherwise); strings with numbers or names use `t("... {n}",{n})` / `tn()`; never glue strings. Local variables named `t` shadow the imported `t()`.
- Firestore rejects `undefined`: use `null` or omit. Writes go through `store.write`, and every background writer is guarded by `store.wiping`.
- Meal validity rule already in the app: `kcal` is an integer 1-5000, `protein` is null or a number 0-500, `name` is at most 40 characters.
- Item ids must be 40 characters or fewer; one item document must stay under 200,000 bytes (rules). `foods` holds at most 200 foods.
- Touch targets at least 44 px, text at least 12 px, RTL-safe (logical CSS properties; steppers and numbers stay LTR), digits 0-9 and Latin units (kcal, g).
- Open Food Facts calls use a 20 s `withTimeout` and are never cached by the service worker; only the barcode digits are sent. Camera video is never stored or sent.
- All figures are labelled as estimates.
- Work on branch `food-table`, test first, one commit per task. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not deploy: the owner approves the deploy explicitly after testing on a phone.

## Review Focus

1. **Bad amounts:** amount 0, negative, `NaN`, empty or huge grams must be rejected or clamped; a tray whose total is under 1 kcal or over 5000 kcal cannot be saved and says why (Task 1, Task 6).
2. **Old and odd data:** meals without `items`, items whose food was later renamed or deleted, and backups made before `foods` existed must still display, edit and restore (Task 4, Task 5, Task 8).
3. **Empty and unusual search text:** empty, whitespace-only, Arabic with diacritics, `أ/إ/ا` and `ة/ه` variants, and regex characters must never throw and must match as the owner expects (Task 1).
4. **Odd barcodes and products:** pasted spaces or letters, a 12-digit UPC-A, a wrong check digit, a product with kcal but no protein (protein becomes null), a product with only kJ (treated as no calorie data), kcal over 900 per 100 g (Task 3, Task 9).
5. **Camera lifecycle:** Back, close, sheet close, tab hidden and sign-out all stop the stream; the same code detected repeatedly adds one food; permission denied or offline still leaves typed entry working (Task 9).

---

## File Structure

- Create `public/food-table.js` - food data (`FOODS`), search, serving math, meal totals, recents, My-food adapter. Pure.
- Create `public/barcode.js` - barcode validation, Open Food Facts URL, product normalisation. Pure.
- Create `public/vendor/<scanner>.min.js` (+ licence file) - fallback barcode scanner, loaded on first Scan.
- Modify `public/backup.js` - clean `foods` and meal `items`.
- Modify `public/ui-helpers.js` only if a shared helper fits there; otherwise nothing.
- Modify `public/index.html` - state, store, meal sheet UI, scan view, backup export.
- Modify `public/lang-ar.js`, `public/sw.js`, `public/privacy.html`, `CLAUDE.md`, `docs/README.md`, `docs/open-points.md`.
- Tests: `tests/food-table.test.js`, `tests/food-data.test.js`, `tests/barcode.test.js`, additions to `tests/backup.test.js` and `tests/pages.test.js`, `tests-ui/smoke.test.mjs` additions, one case in `tests-rules/firestore.rules.test.js`.

---

### Task 1: Food logic in `food-table.js`

**Files:**
- Create: `public/food-table.js`
- Test: `tests/food-table.test.js`

**Interfaces:**
- Produces (all exported):
  - `FOODS` (empty array here; filled in Tasks 2-3) and the entry shape `{id, en, ar, alt:string[], group, kcal100, protein100, servings:[{id, en, ar, grams?, kcal?, protein?}], def}`. A serving has either `grams` (kcal/protein computed from the per-100 g values) or fixed `kcal` and `protein` (used by My foods and scanned products without per-100 g data). `def` = default serving id.
  - `normalizeText(s: string): string` - lower-case, trimmed, diacritics removed, `أ إ آ` -> `ا`, `ة` -> `ه`, `ى` -> `ي`, repeated spaces collapsed.
  - `searchFoods(query: string, opts?: {foods?: Entry[], extra?: Entry[], limit?: number}): Entry[]` - empty/whitespace query returns `[]`; matches `en`, `ar` and `alt`; prefix matches rank before word matches before substring matches; `extra` (My foods) is searched too and wins ties; `limit` defaults to 50.
  - `portionTotals(food: Entry, sel: {serving: string, amount: number, grams?: number}): {grams: number|null, kcal: number, protein: number|null} | null` - returns `null` for amount/grams that are not finite numbers greater than 0, and for amounts above 100 servings or 5000 g; kcal rounded to an integer, protein rounded to 1 decimal. `serving: "g"` uses `sel.grams` with the per-100 g values (null when the food has no per-100 g values).
  - `mealTotals(items: Item[]): {kcal: number, protein: number|null}` - kcal sum rounded; protein sum rounded to 1 decimal, `null` when no item has protein.
  - `defaultMealName(items: Item[]): string` - first three item names joined with `" + "`, cut to 40 characters.
  - `recentFoods(foodDocs: {date:string, meals:{items?:Item[]}[]}[], today: string, n: number): Item[]` - newest first, one per `src+ref`, only the last 14 days, at most `n`.
  - `asEntry(mine): Entry` - converts a stored My-food `{id,name,per100:{kcal,protein}|null,servings:[{id,name,grams?,kcal?,protein?}],barcode?}` into an entry (`en` = `ar` = name, `group:"mine"`, `def` = first serving id).
- Item shape used everywhere: `{src:"table"|"mine"|"scan", ref:string, name:string, serving:string, amount:number, grams:number|null, kcal:number, protein:number|null}`.

- [ ] **Step 1: Write failing tests** in `tests/food-table.test.js` using a three-food fixture (an English/Arabic bread with a 100 g serving and a "piece" of 40 g, an Arabic-named food with an `alt` spelling, a My-food with a fixed-kcal serving). Assertions: `normalizeText("  أَرُزٌ  ") === "ارز"` and `normalizeText("مَدرسة") === "مدرسه"`; `searchFoods("")` and `searchFoods("   ")` return `[]`; `searchFoods("(")` and `searchFoods(".*")` do not throw; an Arabic query with diacritics finds the Arabic-named food; an `alt` spelling finds its food; a prefix match ranks above a substring match; `extra` entries are found. `portionTotals(bread,{serving:"piece",amount:2})` equals `{grams:80,kcal:<80/100*kcal100 rounded>,protein:<...>}`; `{serving:"g",grams:150}` works; amount `0`, `-1`, `NaN`, `Infinity`, `101`, grams `5001` all return `null`; a fixed-kcal serving gives `kcal = serving.kcal*amount` with `grams:null`; protein is `null` when the entry has none. `mealTotals([])` is `{kcal:0,protein:null}`; mixing an item with and without protein sums only the known protein. `defaultMealName` joins three names and cuts at 40 characters. `recentFoods` skips meals older than 14 days, de-duplicates by `src+ref`, orders newest first, and ignores meals without `items`.
- [ ] **Step 2: Run** `node --test tests/food-table.test.js`; expected FAIL (module missing).
- [ ] **Step 3: Implement** the exports above in `public/food-table.js`. Use plain string operations for matching (no `RegExp` built from user text).
- [ ] **Step 4: Run** `node --test tests/food-table.test.js`; expected PASS. Then `npm test`; expected all pass.
- [ ] **Step 5: Commit** `feat: food-table logic (search, serving math, meal totals, recents)`.

---

### Task 2: Food data, part 1 (staples and Egyptian dishes)

**Files:**
- Modify: `public/food-table.js` (fill `FOODS`)
- Test: `tests/food-data.test.js`

**Interfaces:**
- Consumes: the `Entry` shape from Task 1.
- Produces: about 60 entries in `FOODS` in these groups: `bread` (aish baladi, aish shami, aish fino, toast, feteer meshaltet, plain and with honey), `legumes` (ful medames, taameya/falafel, lentil soup, hummus, foul sandwich), `mains` (koshari, mahshi, molokhia, fatta, hawawshi, kofta, kebab, shawarma sandwich, grilled chicken, fried chicken, fish grilled/fried, liver), `rice` (white rice, vermicelli rice, macarona bechamel, pasta), `eggs-dairy` (egg boiled/fried, omelette, gebna beida, rumi cheese, milk, yoghurt, labneh). Each food has `en`, `ar`, `alt` spellings (for example "koshary", "kushari", "ta3meya"), `kcal100`, `protein100`, optional `fat100` and `carbs100` (used by the sanity test), 1-3 servings with grams and Arabic names, and `def`.
- Source: recipes plus USDA FoodData Central public-domain values; foods with wide real-world variation (koshari, feteer, molokhia, shawarma, mahshi, hawawshi) carry `varies:true`.

- [ ] **Step 1: Write failing data tests** in `tests/food-data.test.js` (they cover the whole table, so they also guard Task 3): ids are unique and match `/^[a-z0-9-]{2,30}$/`; every entry has non-empty `en` and `ar`, a `group`, a `def` that names one of its servings, at least one serving with `grams > 0`, Arabic names for every serving; `0 <= kcal100 <= 900`, `0 <= protein100 <= 100`; where `fat100` and `carbs100` exist, `kcal100` is within 15% of `4*carbs + 4*protein + 9*fat`; there are at least 60 foods after this task (the Task 3 test raises it to 110).
- [ ] **Step 2: Run** `node --test tests/food-data.test.js`; expected FAIL (no data).
- [ ] **Step 3: Write the 60 entries** with realistic typical servings (for example aish baladi "1 loaf" about 90-100 g, ful "1 plate" about 250 g cooked, taameya "1 piece" about 35 g, koshari "1 plate" about 400 g).
- [ ] **Step 4: Run** `node --test tests/food-data.test.js`; expected PASS.
- [ ] **Step 5: Commit** `feat: food table part 1 (staples and Egyptian dishes)`.

---

### Task 3: Food data, part 2 (everyday foods)

**Files:**
- Modify: `public/food-table.js`
- Test: `tests/food-data.test.js` (raise the minimum count to 110 and add the check below)

**Interfaces:**
- Produces: about 60 more entries in groups `veg`, `fruit`, `meat`, `sweets` (basbousa, konafa, baklava, om ali, chocolate, biscuits), `drinks` (tea with sugar, Turkish coffee, juice, soda, sahlab, karkade), `snacks` (nuts, chips, dates), `fastfood` (burger, pizza slice, fries, chicken sandwich, hot dog), `fats` (oil, butter, tahini, ghee). Same entry shape and rules as Task 2.

- [ ] **Step 1: Update the data test:** minimum 110 foods in total; at least one food in every group named above; at least 15 foods carry `alt` spellings; every `varies:true` food is listed in the spec's flagged set or documented in a comment above its entry.
- [ ] **Step 2: Run** `node --test tests/food-data.test.js`; expected FAIL on the count.
- [ ] **Step 3: Add the entries.**
- [ ] **Step 4: Run** `npm test`; expected PASS (including `lang-coverage`).
- [ ] **Step 5: Commit** `feat: food table part 2 (everyday foods)`.
- [ ] **Step 6: Ask the owner to review `public/food-table.js`** (list the `varies:true` foods) before release; this is a release gate, not a code step.

---

### Task 4: Backup cleaning for `foods` and meal `items`

**Files:**
- Modify: `public/backup.js` (`cleanFood`, `cleanBackupItems`)
- Test: `tests/backup.test.js`

**Interfaces:**
- Consumes: Item shape from Task 1; My-food shape from the spec (`{id,name,per100,servings,barcode?}`).
- Produces: `cleanBackupItems` accepts the item id `foods` and returns a cleaned `{list:[...], updated}`; `cleanFood` keeps a meal's `items` when valid.
- Rules: item `src` must be `table|mine|scan`; `ref` text up to 40; `name` text up to 60; `amount` finite > 0 and <= 5000; `grams` null or finite > 0 and <= 5000; `kcal` integer 0-5000; `protein` null or 0-500; `serving` text up to 40; at most 20 items per meal; invalid items are dropped; if every item is dropped the meal is kept without `items`. For `foods`: at most 200 foods, each with a text id (<= 40) and name (<= 60), `per100` null or `{kcal 0-900, protein 0-100}`, 1-5 servings each with text id/name and numbers in range (`grams` 1-5000 or fixed `kcal`/`protein`), `barcode` null or 8-14 digits.

- [ ] **Step 1: Write failing tests:** a meal with two valid items and one with `amount:-1` keeps two; a meal whose items are all invalid is kept without `items`; a meal with 25 items keeps 20; a backup with no `foods` entry restores as before; a `foods` document with one valid and one invalid food keeps the valid one; 250 foods are cut to 200; `per100.kcal: 1200` drops that food.
- [ ] **Step 2: Run** `node --test tests/backup.test.js`; expected FAIL.
- [ ] **Step 3: Implement** inside `cleanFood` and a new `cleanFoods(data)` called from `cleanBackupItems` for `it.id === "foods"`, reusing the file's `isObj`, `text`, `num`, `withUpdated` helpers.
- [ ] **Step 4: Run** `npm test`; expected PASS.
- [ ] **Step 5: Commit** `feat: backup cleans foods and meal items`.

---

### Task 5: Storage for My own foods

**Files:**
- Modify: `public/index.html` (state, snapshot parser, `store.saveFoods`, sign-out reset, backup export)
- Modify: `public/food-table.js` (add `makeMyFood`)
- Test: `tests/food-table.test.js`

**Interfaces:**
- Produces: `makeMyFood({name: string, kcal: number, protein: number|null, servingName: string, grams?: number|null, barcode?: string|null, id?: string}): MyFood | null` in `food-table.js` - null for an empty name, kcal not in 0-5000, protein out of 0-500, or grams out of 1-5000 when given; name cut to 60; one serving `{id:"s1", name: servingName||"1 serving", ...}`: with `grams` it stores `per100` computed from kcal/protein and `grams` on the serving, otherwise `per100:null` and fixed `kcal`/`protein` on the serving.
- Produces in `index.html`: `state.myFoods: MyFood[]` (default `[]`, reset on sign-out), `store.saveFoods(list: MyFood[]): void` (rejects more than 200, writes document `foods` as `{list, updated}` through `this.write`, honours `store.wiping`), and the snapshot parser reads `d.id==="foods"` into `state.myFoods` (array check, so a bad document gives `[]`).
- The backup export list (the array that already holds `{id:"settings",...}`) includes `{id:"foods",data:{list:state.myFoods,updated:Date.now()}}` only when `state.myFoods.length`.

- [ ] **Step 1: Write failing tests** for `makeMyFood`: fixed-serving food keeps kcal/protein on the serving and `per100:null`; grams form computes `per100`; empty name, kcal `-1`, kcal `5001`, protein `501` return `null`; a 70-character name is cut to 60.
- [ ] **Step 2: Run** `node --test tests/food-table.test.js`; expected FAIL.
- [ ] **Step 3: Implement** `makeMyFood`, then wire `state.myFoods`, the parser branch, `store.saveFoods`, the reset in the signed-out branch of `onAuthStateChanged`, and the export entry. This follows the same round-trip rule as `settings` (parser, save, export, backup cleaning from Task 4).
- [ ] **Step 4: Run** `npm test`; expected PASS.
- [ ] **Step 5: Verify in the harness** (see `tools/screenshot-harness/README.md`): restart `run.cjs`, load the page; no console errors and `state` unaffected when there is no `foods` document.
- [ ] **Step 6: Commit** `feat: store My own foods (foods document, backup round trip)`.

---

### Task 6: Picker UI - search, tray and saving a built meal

**Files:**
- Modify: `public/index.html` (`mealSheetHtml`, the `meal-form` submit branch near `if(f.id==="meal-form")`, the click `switch`, the input handler, CSS)
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `searchFoods`, `portionTotals`, `mealTotals`, `defaultMealName`, `asEntry` (Task 1); `state.myFoods` (Task 5).
- Produces: `state.mealDraft` grows to `{kcal, protein, name, items: Item[], query: string, open: {src,ref}|null, serving: string, amount: number, grams: string, showAll: boolean, manual: boolean}`; new click actions `food-open`, `food-serving`, `food-amount`, `food-add`, `tray-step`, `tray-remove`, `food-more`, `manual-toggle`; the input handler updates `query` (and redraws only the results, not the text box) and `grams`.
- Behaviour (spec "Picker screen"): meal-name chips; **This meal** tray (rows with -/+ steppers, remove, totals, empty text "Pick foods below, or type kcal yourself"); search box; at most 6 results with "Show more (N)"; tapping a result expands it in place with serving chips, amount stepper (0.5 steps for pieces and plates, 1 otherwise), a grams box and live kcal/protein; **Add** moves it to the tray (tray limit 20 items, with a message at the limit); the manual kcal/protein/name form sits under a "Type kcal yourself" toggle and is used only when the tray is empty. Submitting with tray items saves one meal `{id:uid(), name: typed name or defaultMealName(items), kcal, protein, items}`; a total under 1 or over 5000 kcal shows the existing message `Enter 1–5000 kcal (protein 0–500 g)` and saves nothing. Editing the search box never loses the tray, and snapshots do not wipe the draft (use the same "skip redraw while typing" rule as the other sheets).
- The Today meal list (`todayCard`) shows the item names as a second line for meals with `items`.

- [ ] **Step 1: Write failing UI tests** in `tests-ui/smoke.test.mjs` (follow the file's existing style): open the meal sheet, type "ful" and see a result; tap it, tap Add, see one tray row and a non-zero total; search "كشري" (Arabic) finds koshari; add a second food, press **Add meal**, and the Today list shows one meal named with " + " whose kcal equals the tray total; a food with amount stepped to 0 cannot be added; a tray over 5000 kcal shows the error and saves nothing; the manual form still saves a plain meal when the tray is empty.
- [ ] **Step 2: Run** `cd tests-ui && npm test`; expected FAIL.
- [ ] **Step 3: Implement** as described. Keep markup in `mealSheetHtml` split into small helpers (`trayHtml`, `foodResultsHtml`, `foodCardHtml`) in the same file; use existing building blocks (`.chip`, `.bigstep`, `.btn`, `.cardio-list`). New strings go through `t()`.
- [ ] **Step 4: Run** `cd tests-ui && npm test`, then `npm test`; expected PASS except `lang-coverage` listing the new strings (fixed in Task 10).
- [ ] **Step 5: Commit** `feat: meal sheet builds a meal from the food table`.

---

### Task 7: Recents, grams entry and My foods in the picker

**Files:**
- Modify: `public/index.html`
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Consumes: `recentFoods`, `makeMyFood`, `asEntry`, `store.saveFoods`.
- Produces: new actions `recent-add`, `myfood-new`, `myfood-save`, `myfood-edit`, `myfood-delete`, `myfood-cancel`; `state.mealDraft.myForm: null | {id?, name, kcal, protein, serving, grams, barcode}`.
- Behaviour: with an empty search box the sheet shows up to 8 **Recent** chips (from `state.food`), one tap adds the food with its last serving and amount; the grams box in the expanded card works for every food that has per-100 g values (a grams entry replaces the serving selection); **My food** form (name, kcal, protein, serving name, optional grams) opens from "+ My food" and from an empty search result, validates with `makeMyFood` (error toast `Check the numbers and try again` for `null`), saves through `store.saveFoods`, and the new food appears in search with a "Mine" tag and can be edited or deleted from its expanded card (delete asks no confirmation but shows an undo-free toast "Food deleted"; existing meals keep their item snapshots).

- [ ] **Step 1: Write failing UI tests:** after logging a meal with taameya, reopening the sheet shows a Recent chip for it and one tap adds it; typing 150 in the grams box of a food changes the preview to the 150 g values; creating a My food "Protein bar" (210 kcal, 20 g protein) makes it searchable with a "Mine" tag and addable; invalid numbers show the toast; deleting it removes it from search but a meal already saved with it still shows its items.
- [ ] **Step 2: Run** `cd tests-ui && npm test`; expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cd tests-ui && npm test`; expected PASS.
- [ ] **Step 5: Commit** `feat: recent foods, grams entry and My foods`.

---

### Task 8: Edit a saved meal

**Files:**
- Modify: `public/index.html` (`todayCard` meal rows, new `meal-edit` action, `meal-form` submit branch)
- Test: `tests-ui/smoke.test.mjs`

**Interfaces:**
- Produces: `state.mealDraft.editId: string|null`; action `meal-edit` (data `id`) opens the sheet with the tray filled from the meal's `items` and name set; saving with `editId` replaces that meal in place (same id, same position) instead of appending; closing the sheet clears `editId`. A pencil button (44 px target, `aria-label` "Edit {name}") appears only on meals that have `items`; hand-typed meals keep only the delete button.
- A meal whose items reference a food that no longer exists still opens (items are snapshots; the card for an item uses its stored name, kcal and protein and offers only amount stepping and remove).

- [ ] **Step 1: Write failing UI tests:** a meal built from two foods shows a pencil; editing opens the tray with both rows; changing one amount and saving updates the same meal (still one meal, new kcal); a hand-typed meal shows no pencil; cancel (Back/close) leaves the meal unchanged; a meal whose item references a missing food id still opens.
- [ ] **Step 2: Run** `cd tests-ui && npm test`; expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cd tests-ui && npm test` and `npm test`; expected PASS.
- [ ] **Step 5: Commit** `feat: reopen and edit a saved meal`.

---

### Task 9: Barcode - pure module, then scan view

**Files:**
- Create: `public/barcode.js`, `tests/barcode.test.js`
- Create: `public/vendor/<scanner>.min.js` and its licence file
- Modify: `public/index.html` (Scan button, scan view, lookup)
- Test: `tests/barcode.test.js`, `tests-ui/smoke.test.mjs`

**Interfaces (`barcode.js`, all exported):**
- `cleanDigits(s: string): string` - removes spaces and dashes; returns `""` if any other non-digit remains.
- `validBarcode(digits: string): boolean` - 8, 12, 13 or 14 digits with a correct GS1 check digit.
- `productUrl(digits: string): string` - `https://world.openfoodfacts.org/api/v2/product/<digits>.json?fields=product_name,product_name_ar,brands,nutriments,serving_size,serving_quantity`.
- `normalizeProduct(json: unknown, digits: string): MyFood-like entry | null` - `null` when `status !== 1`, no product, no usable name, no `nutriments["energy-kcal_100g"]` (a kJ-only product counts as no data), kcal outside 0-900, protein outside 0-100 (protein missing becomes `null`); name = Arabic name if present, else product name, with brand appended in parentheses, cut to 60; servings: the package serving when `serving_quantity` is a number 1-5000, plus 100 g; returns `{id:"scan-"+digits, name, per100:{kcal,protein}, servings, barcode:digits}` in the My-food shape from Task 4.

**Scan view (`index.html`):**
- A **Scan** button beside the search box opens a camera view in the meal sheet with its own history entry (same push/pop pattern as `#mealsheet`), a "Type the number" box + Find button, and a Close button.
- Detector: `BarcodeDetector` with formats `ean_13, ean_8, upc_a, upc_e` when `window.BarcodeDetector` exists; otherwise dynamically `import()` the vendored scanner on first use. Choose the library for size and iPhone Safari support (candidate: ZXing UMD build, Apache-2.0; record its version, size and licence in the commit message; if larger than 600 KB, say so and ask before continuing). Detection runs on `requestAnimationFrame`/interval and ignores a repeated identical code for 3 s.
- The stream stops on: Close, Back, sheet close, `visibilitychange` to hidden, sign-out, and after a successful detection.
- Lookup: validate with `validBarcode`; invalid digits show "That number isn't a valid barcode"; otherwise `withTimeout(fetch(productUrl(d)),20000)`; success opens the food card (same card as Task 6, labelled "Package data from Open Food Facts") with "Save to my foods" ticked by default - on Add it calls `store.saveFoods` with the new food (skipped if a food with that barcode already exists, which is also searched first before any network call); `null`/not found/no calories opens the My food form pre-filled with name and barcode and the message "No calories on record. Type them once and it is saved."; offline shows the existing `You're offline. Try again when you're back online.`; timeout and other errors show the new string `Couldn't look that up. Check your connection.`
- Permission denied or no camera: the view shows the typed box only with the message "Camera not available. Type the number instead."

- [ ] **Step 1: Write failing tests** in `tests/barcode.test.js`: `cleanDigits("5 449000 000996")` is `"5449000000996"`, `cleanDigits("12a")` is `""`; `validBarcode` accepts `"5449000000996"`, `"96385074"` (EAN-8) and `"036000291452"` (UPC-A), rejects a changed last digit, a 11-digit string and `""`; `productUrl` contains the digits and the `fields=` list; `normalizeProduct` with a full product returns per-100 g values, the package serving and a 100 g serving; with kcal but no protein returns `protein:null`; with only `energy_100g` (kJ) returns `null`; with `energy-kcal_100g: 950` returns `null`; with `status:0` returns `null`; prefers `product_name_ar`; non-object input returns `null`.
- [ ] **Step 2: Run** `node --test tests/barcode.test.js`; expected FAIL.
- [ ] **Step 3: Implement `barcode.js`**, then run it to PASS.
- [ ] **Step 4: Write failing UI tests** (the harness stubs `fetch` for the Open Food Facts host; extend `tools/screenshot-harness/stubs` to answer a known barcode with a product, `0000000000017`-style invalid ones with nothing, and one unknown code with `status:0`): typing a valid known code shows the product card and Add puts it in the tray and saves it to My foods (second lookup of the same code makes no network call); an invalid number shows the invalid message; an unknown code opens the pre-filled My food form; the camera view closes with Back and the typed box works when `getUserMedia` is missing (the headless browser has no camera).
- [ ] **Step 5: Run** `cd tests-ui && npm test`; expected FAIL.
- [ ] **Step 6: Implement the scan view** and vendor the scanner; run `cd tests-ui && npm test` and `npm test`; expected PASS.
- [ ] **Step 7: Commit** `feat: barcode scan with typed fallback (Open Food Facts)`.

---

### Task 10: Arabic, service worker, privacy, rules test, docs

**Files:**
- Modify: `public/lang-ar.js`, `public/sw.js`, `public/privacy.html`, `CLAUDE.md`, `docs/README.md`, `docs/open-points.md`
- Test: `tests/pages.test.js`, `tests-rules/firestore.rules.test.js`

**Interfaces:**
- Consumes: every new string from Tasks 6-9 (run `npm test`; `lang-coverage` lists what is missing).

- [ ] **Step 1: Run** `npm test`; expected FAIL listing missing Arabic strings. Add each to `AR.ui` in simple Modern Standard Arabic with the same `{placeholders}`.
- [ ] **Step 2: Add** `"/food-table.js"` and `"/barcode.js"` to `APP_SHELL` in `sw.js`, make sure the Open Food Facts host is never answered from cache (the fetch handler only serves same-origin and the Firebase SDK), cache the vendored scanner on first use (add it to the runtime-cached paths), and bump `VERSION` to `iron-log-v41`.
- [ ] **Step 3: Write failing page tests** in `tests/pages.test.js`: the English and Arabic blocks of `privacy.html` mention barcode scanning, that camera video stays on the phone, that only the barcode digits are sent to Open Food Facts, and that foods saved to the account are deleted with it. Run; expected FAIL; add the paragraphs to both language blocks; run; expected PASS.
- [ ] **Step 4: Add a rules test** in `tests-rules/firestore.rules.test.js`: `users/u1/items/foods` is readable and writable by `u1`, not by `u2` or a signed-out user. Run `cd tests-rules && npm test` with Java 21 (`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot\bin` on PATH); expected PASS with no rules change.
- [ ] **Step 5: Update docs:** `CLAUDE.md` (files list, data model rows for `foods` and meal `items`, the picker and scan features, the `foods` round-trip note next to the `settings` one), `docs/README.md` (sub-project 19 with links to this spec and plan), `docs/open-points.md` (move the food table out of "Unfinished"; add barcode-quality and `foods` last-write-wins notes).
- [ ] **Step 6: Run** `npm test`, `cd tests-ui && npm test`; expected all PASS.
- [ ] **Step 7: Commit** `feat: Arabic strings, offline cache, privacy text and docs for the food table`.

---

### Task 11: Whole-branch review and hand-over

- [ ] **Step 1:** Run the full set: `npm test`, `cd tests-ui && npm test`, `cd tests-rules && npm test`. All must pass; report the numbers.
- [ ] **Step 2:** Dispatch one fresh reviewer on the most capable model over the whole branch against the spec; fix findings test-first (red, then green), one commit per fix.
- [ ] **Step 3:** Hand over to the owner with this checklist for the phone: build a three-food meal in English and in Arabic; edit it; add a My food; type a barcode; scan a real packaged food (camera) in the browser and in the Android app; check the privacy page; check that an old meal still shows. Do **not** deploy until the owner approves.
- [ ] **Step 4 (after approval):** deploy hosting (rules unchanged), verify live, merge `--ff-only`, push, delete the branch, and update the project memory.
