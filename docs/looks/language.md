# Looks 2.0: design language (Task 1)

Board: https://claude.ai/artifact/SSZFbydoQhtnhwbNn9PXPC (four boards: Carbon dark/light, Bloom light/dark). Status: awaiting owner approval.

## Shared rules (Apple-clean)
- System font stack (SF on iPhone, Roboto/system on Android); tabular numerals. Scale: 34 large title, 22 title, 17 headline, 16 body, 14 subhead, 13 caption, 12 footnote (never smaller).
- 4 px spacing grid (4, 8, 12, 16, 20, 24, 32); 20 px screen gutter; rows at least 52 px, targets at least 44 px.
- Grouped lists with hairline separators, inset cards, no borders plus shadows together; shadow only for floating things (bars, sheets, toasts).
- One 1.75 px line icon set; one accent per look; large title headers; translucent bars.

## Carbon (dark-first)
bg #0B0B0D, surface #161619, raised #1E1E22, text #F5F5F7, accent #FF7A2F (ink #1B0E06). Light: bg #F2F2F5, accent #C2410C. Card radius 18, control 12, tab bar 22 radius. Large numerals 44.

## Bloom (light-first)
bg #FBF6F8, surface #FFF, text #1E1519, accent #C2255C. Dark: bg #140F13, accent #FF7AA8. Card radius 24, control 16, floating pill tab bar radius 32. Large numerals 40.

Contrast figures are computed on each board; every text/accent pairing is at least 4.5:1.

## Glass (owner request, 2026-11-01)
Cards, chips, steppers, search, sheets and bars are frosted glass, Apple style: translucent fill (dark white 7%, light white 62%), backdrop blur 28 px with 180% saturation, a 1 px light edge (inset) plus a top highlight line, soft shadow. The page background carries two or three soft accent-tinted colour blobs so the glass has something to blur. Text always sits on a surface that keeps 4.5:1 (checked against the opaque surface token). Fallback when backdrop-filter is missing: the opaque surface token.
