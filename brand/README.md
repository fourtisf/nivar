# NIVAR — brand assets

Logo system locked to the in-game palette (mint `#7CFFB0` × ice `#56e0ff`,
ember `#ff8a2b`, navy `#06101c`). All marks are vector-built; the wordmark is
custom vector paths (font-independent), so it renders identically everywhere.

## Primary logo
- `apps/web/public/brand/nivar-logo.svg` — **primary lockup** (Frostflake icon +
  NIVAR wordmark + tagline), self-contained SVG. Use this first.
- `apps/web/public/brand/nivar-primary.png` — primary lockup on dark.
- `apps/web/public/brand/nivar-primary-transparent.png` — transparent background.

## Icon / favicon / PFP
- `apps/web/app/icon.svg` — favicon (Next App Router auto-serves it; live on nivar.fun).
- `apps/web/public/brand/nivar-icon.svg` / `nivar-icon-512.png` — Frostflake app icon.

## Social (X / Twitter)
- `apps/web/public/brand/nivar-x-pfp.png` — profile picture (Crystal N monogram, 800×800, circular-safe).
- `apps/web/public/brand/nivar-x-banner.png` — header banner (3000×1000).
- `nivar-hero.png` is also wired as the OpenGraph/Twitter card image (link previews).

## Concepts board
- `apps/web/public/brand/nivar-logo-board.png` — the four explored concepts
  (Frostflake / Crystal N / Rig Peak / $NIVAR coin) + variants + palette.

## Sources
Editable HTML/SVG render sources live in `brand/src/` (`primary.html`,
`board.html`, `pfp.html`, `banner.html`, `hero.html`). Re-render with the
project's headless Chromium. Production wordmark font is **Oswald 700**.
