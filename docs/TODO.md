# TODO.md

## Before deploying with real content
- [x] Replace placeholder name/bio copy in `index.html` and `about.html`.
- [x] Replace all six entries in `assets/data/projects.json` with real
      projects (or trim/extend the array — the grid handles any count).
- [x] Replace `assets/data/skills.json`, and the education/awards in `cv.json`.
- [x] Replace `assets/data/socials.json`, and the footer/structured-data
      copies described in `SETUP.md`.
- [x] Find-and-replace the placeholder site URL
      (`https://alexrivera.github.io/portfolio/`) with the real one.
- [x] OG/social-share image (`assets/images/og-image.svg` + exported
      `.png`) no longer says "Alex Rivera" — regenerated with the real
      name/role.
- [ ] **Avatar is still a placeholder.** `assets/images/avatar.svg` is a
      generated silhouette with "substituir por foto real" baked into the
      SVG text — this needs an actual photo before sharing the site
      widely. Drop a real photo in as `assets/images/avatar.jpg` (or
      similar) and update the `src` in `about.html`.
- [ ] Project cover images (`project-*.svg` in `assets/images/`) are still
      generic geometric placeholders, not real screenshots/renders — swap
      in real photos/CAD renders per project if you want the cards to
      show actual work instead of abstract icons.
- [x] GoatCounter analytics configured — site code `pedro-sousa` is live
      in all 7 pages.
- [ ] Run through the "Verifying before you deploy" checklist in
      `SETUP.md`.

## Before deploying Phase 2 content
- [ ] Double-check `year` and `status` on every entry in
      `assets/data/projects.json` — the Phase 2 pass filled these in with
      reasonable values (e.g. Formula Water's "1st Place — University of
      Minho" highlight, which came from the roadmap doc) but a few, like
      exact years on the mechanical projects, are best-guess placeholders
      and should be verified/corrected.
- [ ] `project.html` is a single shared template (`?id=<slug>`), not a
      real per-project static URL — it's marked `noindex` for SEO on
      purpose. Phase 3 replaces it with real static pages/URLs per
      project; Phase 6 then re-does SEO metadata + sitemap for those.

## Possible future enhancements (not started — not required by current brief)
- [x] ~~Tag-based filtering on the Projects page~~ — done in Phase 2, but
      by `category` (Mechanical Engineering / Software) rather than the
      finer-grained `tags` array. Filtering by individual tags as well is
      still open if that granularity turns out to be useful.
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
