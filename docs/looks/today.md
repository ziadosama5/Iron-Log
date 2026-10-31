# Looks 2.0: Today tab design (Task 2)

Boards: https://claude.ai/artifact/SSZFbydoQhtnhwbNn9PXPC (two rows below the language boards: Carbon, then Bloom; 15 boards each, 390 px wide). Status: awaiting owner approval.
Boards per look: Home dark / light / Arabic / new user; Workout logging + rest bar dark / light / Arabic / finished; Card variants (bodyweight, hold, deload, avoided); sheets: Add exercise, Info, Demo viewer, Food, Cardio, Target.

## Carbon (glanceable, data first)
- **Home:** left-aligned large title "Today" with the date above and sync dot + avatar at the right; week strip (square-ish day buttons, dot = planned day); ONE "Up next" glance card: day name 34 px, meta, muscle chips, a 56 px "Start workout" button, then Free workout and + Cardio side by side; a three-tile strip (Streak, Level ring, Week 3/4); deload banner row; compact Food and energy card (Eaten as a 44 px numeral, bar, Burned/Balance/Protein in three columns, + Add meal).
- **Workout:** header with day name, "N of M done · X min", thin progress bar, exercise chips (round pills, tick when done, any order); one focus card: name + tags + target on the left, 96 px demo thumbnail with expand button on the right; accent "advice" row with the grey why-line; set type segmented control; set list (done ticks, PR tag, current row, planned rows); two big steppers (40 px numerals) and one 56 px "Log set N"; Done / Next / overflow; + Exercise and + Cardio; rest bar floats above the tab bar (ring with countdown, -15, +15, Skip).
- **Finished:** tick, four stats (duration, volume, sets, PRs), list of exercises, Add cardio / Finish.

## Bloom (soft, guided)
- **Home:** greeting line + rounded 34 px title; round day buttons; the Level card comes first (ring, XP, next badge) because Bloom rewards progress; "Today's plan" card previews the first three exercises and a pill Start button; deload banner; Food card with a calorie ring and protein bar.
- **Workout:** ring "2/6" at the top; exercise chips become numbered circles with labels; the focus card has a 150 px demo banner on top (expand button), name, tag chips, target, advice note, set list, 36 px steppers, a pill Log button; rest bar is a floating pill.
- **Finished:** big ring with a tick and four glass stat tiles.

## Same in both (shared decisions)
- Sheets are glass bottom sheets over a dimmed workout: Add exercise (search, muscle chips, suggestions, gym note, type your own), Info (240 px demo, Works/Equipment, tips, Avoid this exercise, credit line), Food (tray, search, recent chips, expanded result, Scan, + My food, Save meal), Cardio (type, minutes, intensity, machine kcal, estimate), Target (rows from explainTarget, activity chips, adjustment, Use goal default). Demo viewer is full screen black with pause and close.
- Variants: bodyweight (Extra weight, BW), hold (seconds), deload line, avoided-exercise banner with Skip it.
- Arabic boards mirror the layout (RTL); numbers and units stay LTR.
- The "New looks" hint card is a Classic-only card and is not drawn in Carbon/Bloom.

## Classic data-act kept (contract for the build)
Home: tab, start-day, start-free, train-day, change-day, open-cardiosheet, add-cardio, open-mealsheet, meal-edit, rm-meal, journey-open, hero-go, deload-start, deload-later, deload-end, target-open, goto-days, goto-history.
Workout: jump-ex, next-ex, done-ex, undone-ex, ex-info, set-kind, add-set, save-set, edit-set, rm-set, rm-ex, skip-avoided, target-edit, target-adjust, tgt-step, tgt-done, tgt-reset, bw-toggle, rest-adj, rest-skip, demo-full, demo-view-close, demo-pause, open-exsheet, add-ex, more-ex, rm-cardio, cardio-step, cardio-type, cardio-int, sheet-close, exinfo-close.
Food sheet: food-open, food-add, food-amount, food-serving, food-more, tray-step, tray-remove, recent-add, scan-open, scan-start, scan-close, scan-dismiss, myfood-new/save/edit/delete/cancel, manual-toggle, meal-name.
Target sheet: target-activity, target-adjust, target-adjust-reset, tgt-*.

## Removed / moved (explicit list)
- Nothing removed. Moved: "Remove exercise" goes into the overflow (...) menu of the focus card; "Add set N" button becomes "Log set N"; the rest of the actions keep their Classic names.

## Approved 2026-11-01 (owner), with two rules added
- **Demo picture room stays:** Carbon = 96 px thumbnail beside the name, Bloom = 150 px banner on top of the card, 240 px in the info sheet, full screen in the viewer. No GIF / failed load = the box is not drawn (the text takes the room).
- **Long text never breaks a layout** (board "Overflow rules" in both looks): a row or chip label is one line with an ellipsis (`min-width:0` on every flex child, `text-overflow:ellipsis`); a card title is clamped to two lines; big numbers do not wrap (`white-space:nowrap`, font shrinks by a step at 7+ characters); buttons never wrap, the label is shortened with an ellipsis; chips cap at 120-170 px; Arabic runs about 30% longer, so containers flex instead of fixing widths. A test renders each builder with a 70-character exercise name and 7-digit numbers and fails on horizontal overflow.
