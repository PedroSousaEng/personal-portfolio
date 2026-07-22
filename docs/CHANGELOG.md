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
