# CHANGELOG.md

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com).

## [1.0.0] — Initial build

### Added
- Full documentation set: `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`,
  `DESIGN_SYSTEM.md`, `SETUP.md`, `TODO.md`, `CHANGELOG.md`.
- Design system implemented as CSS custom properties in `tokens.css`: color
  palette, type scale, spacing scale, elevation, radius, motion duration,
  breakpoints, icon sizing.
- Five-file CSS architecture (`tokens`, `base`, `layout`, `components`,
  `pages`), linked directly from each page's `<head>` (see `ARCHITECTURE.md`
  for why `@import` was deliberately avoided).
- Four pages: Home, About, Projects, Contact (mailto-based, no form/backend
  per project brief), plus a static `404.html`.
- Data-driven content: `projects.json`, `skills.json`, `experience.json`,
  `timeline.json`, `socials.json`, loaded client-side with `fetch()` and
  rendered by dedicated `render-*.js` modules.
- Accessibility: skip link, semantic landmarks, visible focus rings,
  `aria-current` on nav, `aria-live` regions around async content,
  reduced-motion support, alt text/aria-labels throughout.
- SEO: per-page meta description, canonical URL, Open Graph + Twitter Card
  tags, `Person` structured data on the home page, `sitemap.xml`,
  `robots.txt`.
- Performance: no CSS/JS frameworks, no icon font, no external font
  requests, lazy-loaded project images, `loading="lazy"` + explicit
  width/height to prevent layout shift.
- Placeholder content throughout (name "Alex Rivera," six example projects,
  three example roles) — see `SETUP.md` for what to replace.

### Known trade-offs (see ARCHITECTURE.md / SETUP.md for full rationale)
- Header/nav/footer markup is duplicated across the five HTML files rather
  than assembled via an include mechanism, since there's no build step or
  server-side templating in a pure static GitHub Pages site.
- Footer social links and structured-data `sameAs` are static HTML rather
  than rendered from `socials.json`, for reliability without JS; keep them
  in sync manually (documented in `SETUP.md`).

## [1.8.0] — Phase 8: Final polish

### Added
- **Global scroll-progress bar** (`assets/css/scroll-progress.css` +
  `assets/js/scroll-progress.js`): 2px top-of-viewport indicator, driven
  by a single rAF-throttled `--scroll-progress` custom property (no
  reflow, transform-only paint).
- **Custom scrollbar** (`assets/css/scrollbar.css`): thin, tokenized
  scrollbar via modern `scrollbar-*` properties + WebKit fallback.
- **Global noise / grain overlay** (`assets/css/noise.css` + `.noise`
  element mounted on every page): fixed SVG-turbulence texture at low
  opacity to kill flatness on OLED / high-contrast panels.
- **Global page-transition fade** (`assets/css/page-transitions.css` +
  `assets/js/page-transitions.js`): intercepts internal link clicks,
  fades a full-viewport overlay in/out synced to `--duration-slow`.
- **SVG line-draw** (`assets/css/svg-line-draw.css` +
  `assets/js/svg-line-draw.js`): opt-in via `data-line-draw` on any
  inline `<svg>` — measures path length once, animates
  stroke-dashoffset when the SVG enters the viewport. Optional
  per-child `data-line-index` for staggered drawing.
- **Centralized reduced-motion helper** (`assets/js/reduced-motion.js`):
  one `MediaQueryList`, `prefersReducedMotion()` /
  `onReducedMotionChange()` helpers, and a `body[data-reduced-motion]`
  mirror for CSS that can't sit inside a `@media` guard.

### Changed
- `assets/js/main.js` — now imports and boots the five new polish
  modules (reduced-motion first, then scroll-progress / svg-line-draw /
  page-transitions).
- `assets/js/pendulum.js` — added `visibilitychange` guard: the rAF
  loop now suspends when the tab is hidden and resynchronises
  `lastScrollY` on resume, so a background-scroll can't produce a
  giant angular-velocity kick when the tab comes back.
- All five HTML pages — new `<link>` tags after `micro-interactions.css`
  in the canonical order (scrollbar → scroll-progress → page-transitions
  → svg-line-draw → noise), and a single `<div class="noise">` mounted
  before `</body>`.

### Performance / accessibility review
- Every new module honours `prefers-reduced-motion: reduce`:
  page-transitions no-op, noise overlay hidden, line-draw reveals
  instantly, scroll-progress drops its smoothing transition (bar is
  informational, kept visible).
- Every rAF-driven module in the codebase (pendulum, background-fx,
  tech-network, projects-spotlight, contact-radar, error-signal) now
  pauses on `visibilitychange` — no wasted frames while the tab is
  hidden.
- All scroll / resize / pointermove listeners are `passive` where
  applicable.
- New modules read `--duration-slow` from tokens rather than hardcoding
  milliseconds, so tuning motion still happens in one place.

### Architecture
- Nothing restructured. All new files are additive and self-contained;
  every one lives inside the existing `assets/css/` and `assets/js/`
  trees, and the CSS module boundary rule (a page-scoped file never
  touches shared components) is preserved.
