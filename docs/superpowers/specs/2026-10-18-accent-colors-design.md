# Accent colors — design

Sub-project 2 of 2 ("language + accent colors"). Built after the Arabic language sub-project.

## Goal
Let each person pick the app's accent color on top of Light / Dark / System. Everything that is blue today (buttons, active tab, chips, charts, focus rings, progress) follows it.

## What was agreed
- Accent color only. No new named themes; Light / Dark / System stays as is.
- 8 presets plus a custom color picker.

## Presets
Default **Plate blue** (today's colors: `#1f5fd1` light / `#6c9cff` dark, unchanged so existing users see no difference), Teal, Green, Orange, Red, Pink, Purple, Gold. Each preset is one base color; the app derives the rest.

## Behavior
- UI: More sheet › "Accent" row: 8 round swatches (current one ringed) + a "Custom" swatch that opens a native `<input type="color">`. Labels are translated (needs the language sub-project's `t`).
- Storage: `localStorage "ironlog.accent"` = preset id or `#rrggbb`. Not set = Plate blue. Per device, like the theme.
- A `<head>` script applies it before first paint (no flash), and sets `<meta name="theme-color">` to the page background tint, kept in step with the theme.

## Derived colors (`public/theme-tools.js`, pure, unit-tested)
From one base color `c` and the active mode (light/dark), compute:
- `--accent`: `c`, adjusted so it has at least 4.5:1 contrast against `--surface` and `--bg` (darkened in light mode, lightened in dark mode, keeping the hue).
- `--accent-ink`: text on top of the accent, white or near-black, whichever has more contrast (≥ 4.5:1).
- `--accent-soft`: tint of the accent over the surface (about 14% in light, 22% in dark).
Functions: `parseHex`, `contrast(a, b)`, `ensureContrast(hex, bg, mode)`, `deriveAccent(hex, mode)` → `{accent, ink, soft}`, `PRESETS`. Custom colors that are too light/dark are corrected, never rejected.

## Files
- Create: `public/theme-tools.js`, `tests/theme-tools.test.js`.
- Modify: `public/index.html` (Accent row in More sheet, head script, apply function called by `applyTheme` and on theme change, `theme-color`), `public/sw.js`, `CLAUDE.md`, `docs/README.md`.

## Testing
- `contrast` against known pairs (black/white = 21), `ensureContrast` raises contrast to ≥ 4.5 in both modes, `deriveAccent` ink choice (yellow gets dark ink, navy gets white), invalid hex falls back to default, presets all pass the contrast rules in both modes.
- Screenshots: Workout, Coach, Goals in each preset, light and dark; the Gold and Teal presets checked closely (hardest for contrast).

## Review focus
- Anything that hardcodes blue instead of `var(--accent)` (SVG charts, logo, `theme-color`, focus outlines, `.plate`).
- Warning/good/danger colors must not be changed by the accent; a red accent must still be distinguishable from the "danger" state (danger uses its own token and an icon/label).
- System-mode dark-switch while the app is open updates the derived colors.
- Corrupt `ironlog.accent` values fall back to the default.
