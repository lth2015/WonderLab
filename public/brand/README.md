# Wonderful World — brand files

The mark is a blue–green Möbius ribbon folded into a circle: 一念起，万物生.
Vector files (`*.svg`) are the source of truth; PNGs in `png/` are exports. Text is outlined, so no font is needed to display them.

| File | Use |
| --- | --- |
| `mark.svg` | The ribbon alone, full colour |
| `mark-gray.svg` | Grayscale gradient |
| `mark-mono-navy.svg`, `mark-mono-white.svg` | One colour (print, stamps, embossing) |
| `logo-stacked.svg` | Mark over "Wonderful / WORLD", light backgrounds |
| `logo-stacked-on-dark.svg` | Same, white text, transparent; `logo-stacked-dark-bg.svg` includes the navy background |
| `logo-stacked-mono*.svg` | Grayscale / one-colour stacked versions |
| `logo-horizontal*.svg` | Mark left, words right: site header, email signature |
| `app-icon.svg`, `app-icon-dark.svg` | Rounded app icon, light and dark |
| `app-icon-full.svg`, `app-icon-maskable.svg` | Square sources for iOS / Android (the OS rounds the corners) |
| `favicon.svg`, `favicon.ico`, `favicon-16/32.png`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png`, `site.webmanifest` | Web icons |
| `og-image.png` | 1200×630 social share card |

Colours: navy `#0E1B33`, slate `#4A5568`, mist `#AEB9CC`; ribbon blues `#A8EAF6 → #3E9DEB → #1452C7`, greens `#D9F59E → #63CC7C → #10855A`.
Type: Jost (SIL Open Font License) — Medium for "Wonderful", Regular with wide tracking for "WORLD".

Keep clear space around the logo of at least half the mark's height, and don't show the full-colour mark smaller than 16 px.

Head tags:

```html
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="manifest" href="/brand/site.webmanifest">
<meta property="og:image" content="https://want.world/brand/og-image.png">
```
