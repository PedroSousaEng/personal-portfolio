# TODO.md

## Before deploying with real content
- [ ] Replace placeholder name/bio copy in `index.html` and `about.html`.
- [ ] Replace all six entries in `assets/data/projects.json` with real
      projects (or trim/extend the array — the grid handles any count).
- [ ] Replace `assets/data/skills.json`, `experience.json`, `timeline.json`.
- [ ] Replace `assets/data/socials.json`, and the footer/structured-data
      copies described in `SETUP.md`.
- [ ] Replace placeholder images in `assets/images/` (avatar, project
      covers, OG image) with real photos/screenshots.
- [ ] Find-and-replace the placeholder site URL
      (`https://alexrivera.github.io/portfolio/`) with the real one.
- [ ] Run through the "Verifying before you deploy" checklist in
      `SETUP.md`.

## Possible future enhancements (not started — not required by current brief)
- [ ] Tag-based filtering on the Projects page (data already supports it —
      each project has a `tags` array; would need a small filter UI plus a
      `render-projects.js` update to accept an active-tag argument).
- [ ] A blog, if that scope changes — `blog.json` was intentionally left
      out per the confirmed requirements in `PROJECT_CONTEXT.md`, but the
      data-driven pattern here would extend to it directly.
- [ ] Light theme / theme toggle, if the fixed "dark, bold, high-contrast"
      direction is ever revisited — would need a `[data-theme]` attribute
      switch and a parallel light palette added to `tokens.css`.
- [ ] Automated accessibility testing (e.g. axe-core) wired into a CI
      workflow, if this repo grows a CI pipeline.

## Explicitly out of scope
- Blog page (confirmed excluded at kickoff).
- Contact form / Formspree integration (confirmed: mailto only).
- Any build tool, bundler, or framework.
