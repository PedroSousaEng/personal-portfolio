# ARCHITECTURE.md

## Folder structure

```
/
├── index.html          Home page (hero, highlights, featured projects, CTA)
├── about.html           Bio, skills grid, experience + timeline
├── projects.html        Featured strip + filterable grid, rendered from projects.json
├── project.html          Dedicated project page template (project.html?id=<slug>)
├── contact.html         Contact via mailto: + socials, no form/backend
├── 404.html              Static not-found page (GitHub Pages convention)
├── sitemap.xml           SEO: page list for crawlers
├── robots.txt            SEO: crawler rules + sitemap pointer
├── docs/                 This documentation set
└── assets/
    ├── css/
    │   ├── tokens.css        Design tokens ONLY (colors, type, spacing, etc.) — no rules
    │   ├── base.css          Reset + element defaults
    │   ├── layout.css        Grid/container/section primitives, utility classes
    │   ├── components.css    Buttons, cards, nav, forms, badges, pills
    │   └── pages.css         Page-specific composition (hero, timeline, etc.)
    ├── js/
    │   ├── config.js              Site-wide constants (paths, breakpoints mirrored from CSS)
    │   ├── data-loader.js         Generic fetch()-and-cache helper for JSON data
    │   ├── render-projects.js     Turns projects.json into card markup + the Projects page's category filter bar
    │   ├── render-project-detail.js  Renders one project (via ?id=) into project.html
    │   ├── render-about.js        Turns skills.json + cv.json (education/awards) + projects.json (timeline) into markup
    │   ├── render-contact.js      Turns socials.json into the mailto CTA + social link list
    │   └── main.js                Entry point: nav toggle, active-link state, footer year, init calls
    ├── data/
    │   ├── projects.json     Single source for every project — also drives the CV's project list and the About timeline
    │   ├── skills.json       Single source for skills — shared by the CV page and the About page
    │   ├── cv.json           Education, awards, certifications, languages, interests — shared by the CV and About pages
    │   └── socials.json
    ├── images/               Project screenshots / avatar (SVG placeholders included)
    ├── icons/                Inline-SVG icon source files + favicon
    └── fonts/                Empty — the system font stack is used deliberately (see DESIGN_SYSTEM.md)
```

**One responsibility per file** is enforced literally: `tokens.css` never contains
a selector, `layout.css` never contains a color, and no JS file both fetches
data and renders it — fetching lives in `data-loader.js`, rendering lives in the
`render-*.js` files.

## Page load flow

1. Browser parses HTML. `<head>` links all five CSS files directly, in
   cascade order (`tokens → base → layout → components → pages`), as
   separate `<link rel="stylesheet">` tags rather than via `@import`.
   `@import` forces the browser to download and parse the importing file
   before it can even discover the imported ones, turning five small
   parallel requests into a serial waterfall — a real cost against the
   Lighthouse performance budget for a negligible authoring convenience.
   Direct `<link>` tags let the browser fetch all five in parallel over the
   same HTTP/2 connection GitHub Pages already serves over.
2. All JS is loaded with `type="module"` and `defer` semantics are implicit to
   modules, so parsing continues uninterrupted.
3. On `DOMContentLoaded`, `main.js` runs `initNav()` (works with zero data
   dependency) then calls the page's render function if that page has a
   `data-page` attribute on `<body>` matching a known renderer.
4. Render modules call `loadJSON(path)` from `data-loader.js`, which fetches
   once, caches the parsed result in a module-level `Map`, and returns a
   promise any renderer can `await`. This means navigating between the two
   pages that both use `skills.json`-style data in the same session (there
   currently are none, but the pattern generalizes) never double-fetches.
5. Renderers build DOM with `document.createElement` + `textContent`
   (never `innerHTML` with interpolated strings) — this is a deliberate XSS-safe
   default even though the data is currently first-party/trusted.
6. If a fetch fails (e.g. someone opens `index.html` via `file://` instead of a
   server), each render function catches the error and injects a visible,
   accessible fallback message rather than leaving a blank section.

## Why vanilla JS, no bundler

The brief calls for zero unnecessary dependencies and GitHub Pages hosting.
A bundler would add a build step that must run before every deploy and a
second thing to keep in sync with the source; ES modules loaded natively by
the browser remove that step entirely while still allowing the code to be
split into single-responsibility files. The trade-off: no JSX/TSX ergonomics
and no tree-shaking — acceptable, because the JS surface here is small
(nav, fetch, render three data types) and unlikely to grow enough to need it.

## Why five CSS files instead of one

Splitting by responsibility (tokens / base / layout / components / pages)
means a color or spacing change never requires touching layout code, and a
layout change never risks redefining a token. All five files are linked
directly from every page's `<head>`, in the same fixed order (see the
"Page load flow" note above on why `@import` is avoided) — adding a page
means copying that same five-line block.

## Data contracts

Each JSON file is an array (or, for `socials.json`, an object of arrays) of
flat objects. See the top of each `render-*.js` file for the exact shape each
renderer expects — the contract is documented next to the code that consumes
it, not duplicated here where it could drift out of sync.

## Extending the site safely

- **New project:** add an object to `assets/data/projects.json`. Nothing else
  changes — `render-projects.js` already handles any count of projects, and
  it automatically gets its own page at `project.html?id=<id>` via
  `render-project-detail.js`. Set `category` so it's covered by the Projects
  page filter bar (a new category value automatically gets its own filter
  pill — no code change needed).
- **New page:** copy the shared `<head>`/nav/footer block from an existing
  page (this is the one deliberate duplication in the project — see note in
  `DESIGN_SYSTEM.md` on why a shared-header include was not built), add the
  page to `sitemap.xml`, and add a nav link in every existing page's nav.
- **New CSS component:** add it to `components.css` using only tokens from
  `tokens.css`. If a value isn't in `tokens.css` yet, add it there first.
