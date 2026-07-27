# PROJECT_CONTEXT.md

## What this is

A premium, static portfolio website for a mechanical engineer (who also codes
side projects), built to be hosted on GitHub Pages with zero build step and
zero backend. It is designed to feel like a well-made, considered product
rather than a template — without reading as a software/dev portfolio, since
the subject's primary discipline is mechanical engineering.

## Who it's for

The site now ships with real content (name: "Pedro Sousa", role: "Mechanical
Engineering Student") in the `assets/data/*.json` files. Nothing about the
design depends on that specific content — swap the JSON and images and the site
becomes yours. See `SETUP.md` for exactly what to edit.

## Confirmed requirements (from project kickoff)

| Decision | Answer |
|---|---|
| Pages included | Home, About, Projects, Contact — no Blog |
| Contact method | `mailto:` link (no backend, no third-party form service) |
| Visual direction | Dark, bold, high-contrast |
| Hosting | GitHub Pages (static files only) |
| JS | Vanilla ES2023, no frameworks, no build tool |
| Content | Data-driven via JSON, loaded with `fetch()` |

Because the contact page uses a `mailto:` link rather than a form, there is no
Formspree dependency and no client-side form validation/submission logic to
maintain — this removes an entire category of accessibility and error-handling
work while still giving visitors a direct way to reach out.

## Non-goals

- No blog (explicitly excluded).
- No CMS, no server, no build pipeline, no bundler. Files are served as-is.
- No CSS or JS frameworks. No icon font libraries — icons are inline SVG.
- No client-side routing / SPA behavior — this is a traditional multi-page site,
  so `404.html` is included for good hosting hygiene but is not load-bearing for
  routing logic.

## Design north star

Apple / Stripe / Linear / Vercel / Framer: restrained, confident, fast,
accessible. Dark, bold, high-contrast, with a plain sans-serif type system
throughout — no terminal/IDE styling (shell-prompt logos, monospace UI
chrome, blinking cursors), since those read as "software engineer" rather
than "mechanical engineer." The signature ideas instead lean on the
engineering subject matter itself (project imagery, spec-style detail,
precise layout) rather than on developer-tool visual tropes. Also avoids
generic AI-portfolio defaults (no cream+serif+terracotta, no
acid-green-on-black, no numbered-marker sections). Full rationale in
`DESIGN_SYSTEM.md`.

## How to read this repo

1. Start here for the "why."
2. `ARCHITECTURE.md` for the "how it's wired together."
3. `DESIGN_SYSTEM.md` for every visual token and component rule.
4. `SETUP.md` for running it locally and editing your content.
5. `TODO.md` / `CHANGELOG.md` for what's done and what's next.
