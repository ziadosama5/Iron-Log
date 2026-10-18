# Accent Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each person pick the app's accent color (8 presets + custom) on top of Light / Dark / System.

**Architecture:** A pure `theme-tools.js` turns one chosen color into the three accent tokens (`--accent`, `--accent-ink`, `--accent-soft`) for the active mode, correcting contrast. `index.html` applies them as inline custom properties on `<html>`, set by the existing `<head>` script before first paint and re-applied when the theme or system mode changes.

**Tech Stack:** plain JS ES modules, `node --test`, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-10-18-accent-colors-design.md`. Built **after** `2026-10-18-arabic-language.md` (the swatch labels use `t`).

## Global Constraints

- Default stays Plate blue: light `#1f5fd1`, dark `#6c9cff`; existing users see no change.
- Storage: `localStorage "ironlog.accent"` = preset id or `#rrggbb`; unset = `plate`.
- Presets (id → base color): `plate` #1f5fd1, `teal` #0f9488, `green` #2f9e44, `orange` #e8590c, `red` #e03131, `pink` #d6336c, `purple` #7048e8, `gold` #f0a500.
- Contrast: `--accent` against `--surface` and `--bg` ≥ 4.5:1; `--accent-ink` against `--accent` ≥ 4.5:1. `--accent-soft` = accent mixed over `--surface`: 14% (light), 22% (dark).
- Success/warning/danger tokens (`--good`, `--danger`) never change with the accent.
- No new dependency; add `/theme-tools.js` to `APP_SHELL`; bump `VERSION` to `"iron-log-v14"`.
- `index.html` has CRLF endings: single-line anchors, scratchpad scripts or the Edit tool.

## Review Focus

- Any hardcoded blue left (`#1f5fd1`, `#6c9cff`, `rgb(31,95,209)`, logo/plate/chart colors, `theme-color`) so the accent doesn't reach it. → Task 2 grep step.
- Pale accents (Gold, a custom yellow) giving unreadable button text or invisible focus rings. → Task 1 contrast tests + Task 2 screenshots.
- A red accent looking like an error. → Task 2 checks danger/warn UI keeps its own token and label.
- System mode: phone switches dark/light while the app is open and the accent is not re-derived. → Task 2 `matchMedia` listener.
- Corrupt or malicious `ironlog.accent` values (`javascript:`, `#xyz`, empty) → Task 1 `parseHex` test; fall back to default.

---

### Task 1: Color math and presets (`public/theme-tools.js`)

**Files:**
- Create: `public/theme-tools.js`, `tests/theme-tools.test.js`

**Interfaces:**
- Produces (exported):
  - `PRESETS: {id: string, name: string, hex: string}[]` — the 8 presets above, in that order; `name` is the English label (`"Plate blue"`, `"Teal"`, `"Green"`, `"Orange"`, `"Red"`, `"Pink"`, `"Purple"`, `"Gold"`).
  - `parseHex(s: unknown): string | null` — returns lowercase `#rrggbb` for `#rgb`/`#rrggbb` (any case); `null` for anything else (non-strings, bad digits, extra characters).
  - `contrast(a: string, b: string): number` — WCAG ratio of two hex colors.
  - `ensureContrast(hex: string, bg: string, mode: "light"|"dark", min = 4.5): string` — same hue/saturation; moves lightness down (light mode) or up (dark mode) in small steps until `contrast(result, bg) >= min`; returns the input if already enough.
  - `deriveAccent(setting: string|null, mode: "light"|"dark", surface: string, bg: string): {accent: string, ink: string, soft: string}` — `setting` is a preset id, `#rrggbb`, or null/invalid → `plate`. For `plate` it returns exactly today's tokens (light `#1f5fd1` / ink `#ffffff` / soft `#dbe6fb`; dark `#6c9cff` / `#0b1220` / `#1b2a47`).

- [ ] **Step 1: Write failing tests** `tests/theme-tools.test.js`:
  - `parseHex("#ABC")` → `"#aabbcc"`; `"#1F5FD1"` → `"#1f5fd1"`; `"1f5fd1"`, `"#xyz"`, `"#12345"`, `"javascript:alert(1)"`, `""`, `null`, `42` → `null`.
  - `contrast("#000000","#ffffff")` ≈ 21; `contrast("#ffffff","#ffffff")` = 1.
  - `ensureContrast("#f0a500", "#ffffff", "light")` has contrast ≥ 4.5 with white and the same hue (±3°); `ensureContrast("#1f5fd1", "#ffffff", "light")` returns it unchanged; `ensureContrast("#0a2a66", "#0b1220", "dark")` is lightened to ≥ 4.5.
  - `deriveAccent("plate","light","#ffffff","#f3f5f9")` equals today's light tokens, and dark likewise (use the dark `--surface`/`--bg` values from `index.html`).
  - For **every preset and a custom `#ffff00`**, in both modes: `contrast(accent, surface) >= 4.5`, `contrast(accent, bg) >= 4.5`, `contrast(ink, accent) >= 4.5`, and `soft` is a valid hex.
  - Gold gets dark ink; a navy custom gets white ink (light mode, after correction).
  - `deriveAccent("not-a-color", ...)` and `deriveAccent(null, ...)` return the plate tokens.
- [ ] **Step 2: Run** `node --test tests/theme-tools.test.js` → FAIL.
- [ ] **Step 3: Implement** `public/theme-tools.js` (HSL conversion for the lightness steps, WCAG relative luminance for `contrast`; `soft` = linear mix of accent over surface at 14%/22%).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `git add public/theme-tools.js tests/theme-tools.test.js && git commit -m "feat: accent color math and presets"`

---

### Task 2: Accent picker, apply logic and release

**Files:**
- Modify: `public/index.html`, `public/sw.js` (APP_SHELL `/theme-tools.js`, VERSION `iron-log-v14`), `CLAUDE.md`, `docs/README.md`

**Interfaces:**
- Consumes: `PRESETS, parseHex, deriveAccent` (Task 1); `t` from `i18n.js`.
- Produces in `index.html`: `currentAccent(): string` (stored setting or `"plate"`), `applyAccent(setting)` (saves `ironlog.accent`, sets `--accent`, `--accent-ink`, `--accent-soft` as inline custom properties on `document.documentElement`, updates `<meta name="theme-color">`), called at startup, from `applyTheme`, and from a `matchMedia("(prefers-color-scheme: dark)")` change listener.

- [ ] **Step 1: Find hardcoded blue:** `grep -n "1f5fd1\|6c9cff\|dbe6fb\|1b2a47\|rgb(31" public/index.html public/logo-mark.svg`. Everything in app UI must use the tokens; the token definitions, the `theme-color` meta default, the manifest and the app icon are the only allowed hits. Fix any others (charts, `.plate`, SVG strokes). The logo and icons stay blue.
- [ ] **Step 2: Apply logic:** implement `currentAccent` / `applyAccent`; extend the existing `<head>` script to read `ironlog.accent` and set the three custom properties before first paint using a tiny inline copy of the plate default (no module import in `<head>`): if the setting is plate or missing it does nothing; otherwise `applyAccent` from the module corrects it right after load (acceptable: a custom color may briefly show the plate color on a cold first paint; the saved computed values are written to `localStorage "ironlog.accent.css"` as `accent|ink|soft|mode` and the head script applies them directly to avoid the flash).
- [ ] **Step 3: Picker UI:** in the More sheet below Theme, an "Accent" row: 8 round swatches (`data-act="accent-set" data-v="<id>"`, `aria-pressed`, `aria-label` = preset name via `t`) and a "Custom" swatch wrapping `<input type="color">` (on `input` → `accent-set` with the hex). Swatch colors use the preset `hex`. Add the preset names and `Accent`, `Custom` to `AR.ui` in `public/lang-ar.js`; the coverage test must pass.
- [ ] **Step 4: Verify:** `npm test` → PASS. Headless-Edge frames of Workout, Coach, Goals for Plate, Teal, Gold, Red and a custom `#ffff00`, light and dark; check button text, focus ring, chips, charts, tab bar highlight are readable and the warn/danger UI is still distinct from a red accent. Fix what's off.
- [ ] **Step 5: Docs and release:** `CLAUDE.md` (files: `theme-tools.js`; Accent setting and derived tokens; "no hardcoded blue" rule), `docs/README.md` row 8; bump `VERSION`; `git commit -am "feat: accent colors, release v14"`.
