# SETUP.md

## Running it locally

This site has no build step, but `fetch()` requires an HTTP origin — opening
`index.html` directly via `file://` will fail to load the JSON data files
(browsers block `fetch` on `file://` for security reasons).

From the project root:

```bash
npx serve .
```

Then open the URL it prints (typically `http://localhost:3000`). Any static
server works equally well (`python3 -m http.server`, VS Code's Live Server,
etc.) — `npx serve .` is just a zero-config default.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo's **Settings → Pages**, set the source to the branch you
   pushed (typically `main`) and the root folder (`/`).
3. GitHub Pages will build nothing — it serves these files as-is. Your site
   will be live at `https://<username>.github.io/<repo>/`.

## What to customize

Everything a real deployment needs to change lives in a short list:

| What | Where |
|---|---|
| Name, role, bio copy | `index.html` (hero), `about.html` (bio paragraphs) |
| Projects | `assets/data/projects.json` |
| Skills | `assets/data/skills.json` |
| Work history / education | `assets/data/cv.json` (`education` array) — also shown on the About page |
| Personal milestones | Generated automatically from `assets/data/projects.json` (year + title + subtitle) — nothing to edit separately |
| Email + social links | `assets/data/socials.json` — **also update the footer markup** in each HTML page (four small `<a>` tags) and the `sameAs` array in `index.html`'s structured-data block, since those are static for reliability rather than data-driven. See the note in `ARCHITECTURE.md` if you want to make the footer JS-driven instead. |
| Site URL (for SEO tags) | Already set to `https://pedrosousaeng.github.io/portfolio/` across every `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image` tag, `sitemap.xml`, and `robots.txt`. If the repo/username ever changes, find-and-replace this URL in all of those places. |
| Avatar / project images | Replace the placeholder SVGs in `assets/images/` with real photos/screenshots. Keep the same filenames to avoid touching `projects.json` or `about.html`, or update the `image` field / `src` attribute if you rename them. |
| Social preview image | `assets/images/og-image.svg` is the source; `og-image.png` (1200×630, already exported) is what's actually referenced by the meta tags. If you edit the SVG, re-export a PNG — social platforms don't reliably render SVG for previews. |
| Colors, type, spacing | `assets/css/tokens.css` only — see `DESIGN_SYSTEM.md`. |

## Fonts

No font files are included and none are downloaded — the site deliberately
uses the operating system's own UI font (see the rationale in
`DESIGN_SYSTEM.md`). If you want a specific custom typeface, add the woff2
files to `assets/fonts/`, declare them with `@font-face` at the top of
`tokens.css`, and update `--font-display` / `--font-body`. Self-host rather
than linking a font service — that keeps the zero-external-request
performance profile intact.

## Browser support

Targets the last two versions of evergreen browsers (Chrome, Firefox,
Safari, Edge). Relies on: CSS custom properties, `clamp()`, `dvh` units,
`:focus-visible`, ES modules, and `fetch()`. No polyfills are included; if
you need to support older browsers, that's a deliberate trade-off to revisit.

## Verifying before you deploy

1. Run `npx serve .` and click through all four pages.
2. Resize the browser down to ~360px width and back up past 768px — check
   the nav toggle opens/closes cleanly at the breakpoint.
3. Tab through every page with only the keyboard; confirm the focus ring is
   always visible and the tab order is logical.
4. Run Lighthouse (Chrome DevTools → Lighthouse) against the served (not
   `file://`) pages.
5. Check the browser console for errors on every page.
