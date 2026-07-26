# CHANGELOG.md

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com).

## [Unreleased] — Real-content cleanup & polish pass

### Fixed
- **OG/social-share image** (`assets/images/og-image.svg` + exported
  `.png`) still said "Alex Rivera — Software Engineer" — this is what
  rendered as the link preview on LinkedIn/WhatsApp/etc. Regenerated with
  the real name and role.
- Removed a dead `document.title` find-and-replace in `render-site.js`
  left over from the original template (real content no longer contains
  "Alex Rivera" anywhere, so it was a permanent no-op).
- `sitemap.xml` was missing `cv.html`.
- GoatCounter analytics configured with the real site code
  (`pedro-sousa`) across all 7 pages, replacing the `YOUR-CODE` placeholder.

### Changed
- **Featured projects** swapped to better represent mechanical engineering
  work: Vinted OS and Personal Portfolio (software/meta) are no longer
  featured; Fatigue Study (FEA) and Pin Clutch (concept → CAD → kinematics
  → prototype) are now featured alongside Formula Water.
- **Category filter bar** removed from the Projects page — it always
  shows the full grid now, no Software/Mechanical Engineering tabs.
- **Custom cursor** simplified: gentler hover growth (28px → 34px instead
  of 32px → 52px), no background fill tint on hover, and the four
  per-page shape variants (diamond on About, square on Projects, dashed
  on Contact, tilted dashed square on 404) were removed in favor of one
  consistent minimal ring everywhere.

### Removed
- **Boot intro** (the "SYSTEM / Initializing engine…" splash screen on
  first Home visit) removed entirely — `assets/js/boot-intro.js`,
  `assets/css/boot-intro.css`, the overlay markup and the
  sessionStorage-gating inline script in `index.html` are all gone. The
  site now renders straight to content on every load.

## [Unreleased] — Phase 2: Project Showcase Enhancement

### Added
- **Richer project cards**: each project now carries `category`, `year`,
  `status`, and `highlights` fields in `projects.json`. Cards show a
  category/year meta row, a status pill ("Completed" / "In Progress")
  overlaid on the thumbnail, and highlight badges (e.g. "Team Project",
  "1st Place — University of Minho") with small inline icons picked
  automatically from the badge text.
- **Dedicated project pages**: every card now opens `project.html?id=<slug>`
  instead of linking straight to GitHub. `render-project-detail.js` reads
  the `id` from the URL and renders that project's hero, overview, tags,
  and links, with a "project not found" fallback for bad/old URLs. GitHub
  remains one click away as a secondary "Code" link on the card and a
  primary button on the project page. This is the foundation Phase 3 will
  build the full case-study layout (Problem → Research → ... → Lessons
  Learned) on top of.
- **Category filter bar** on the Projects page — pills generated from the
  distinct `category` values in `projects.json`, filtering the grid
  client-side with no page reload. A new category value gets its own pill
  automatically; no code change needed.
- **Featured strip** at the top of the Projects page, surfacing the three
  `featured: true` projects (Vinted OS, Formula Water, Personal Portfolio)
  above the full filterable grid.
- Card hover polish: thumbnail scales slightly and the "Open project" link
  nudges right on hover/focus, layered on top of the existing tilt/glow
  micro-interactions from Phase 1 — no existing animation was replaced.

### Changed
- `render-projects.js` split into `renderProjects()` (used by the home
  page's featured strip, unchanged behavior) and `renderProjectsPage()`
  (Projects page: featured-aware, filter-bar aware).

## [Unreleased] — Phase 1: Stabilization & Performance

### Fixed
- **Click-freeze bug on first visit**: the home page's boot-intro overlay
  (`assets/js/boot-intro.js`) dismisses on the visitor's first click/key
  press, but because the overlay sits above the entire page until it
  fades, that first click was being consumed entirely by the dismiss
  handler — even when aimed at a real nav link or button. The intro would
  close, but the intended action never fired, so the site looked
  unresponsive until a second click. Fixed by forwarding the same
  interaction to whatever element is underneath once the overlay stops
  intercepting pointer events, so one click now both skips the intro and
  performs the action the visitor meant to take. Verified with automated
  browser tests (desktop + mobile viewport, click/keyboard/repeat-visit
  paths) — zero console errors before and after.

### Removed (dead code / unused assets)
- `assets/js/pendulum.js` + `assets/css/signature.css` — an earlier
  standalone pendulum/dust/blueprint implementation. Confirmed via git
  history and a full-codebase reference scan that this was fully
  superseded by the canvas-based system in `background-fx.js` (already
  wired up correctly via `.bg-fx` in `base.css`) and had zero remaining
  references anywhere — the markup it depended on was removed from every
  page long ago, leaving the JS/CSS as inert dead weight.
- `assets/js/counter-animate.js`, `assets/js/staggered-letters.js`,
  `assets/js/tag-hover-scale.js` — three in-progress features (count-up
  numbers, letter-by-letter heading reveal, tag hover scale) that were
  written but never wired into `main.js`, and whose supporting CSS
  (`.animate-letters`, `.tag--hover-active`) and markup (`[data-counter]`)
  were never added either. Confirmed zero references anywhere in the
  codebase before removal. Re-introducing any of these is a Phase 2+
  decision (needs matching CSS/markup, not a Phase 1 stabilization fix).
- Six leftover placeholder project images (`project-aurora.svg`,
  `project-ledger-lite.svg`, `project-pathfinder.svg`,
  `project-quiet-hours.svg`, `project-signal.svg`, `project-typeset.svg`)
  from the original six-project template — `assets/data/projects.json`
  has since been replaced with real project entries, but the old image
  files were never deleted. Confirmed unreferenced anywhere before
  removal.

### Verified (no change needed)
- Zero console errors/warnings/failed requests on all five pages
  (Chromium, desktop + mobile viewport).
- No broken `src`/`href` references in any HTML file or in
  `projects.json`.
- Scroll-progress bar math double-checked against real scroll positions
  (0/25/50/75/100%) — accurate in every case.
- Repeat-visit and reduced-motion paths for the boot intro re-tested
  after the click-freeze fix — no regressions.

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
