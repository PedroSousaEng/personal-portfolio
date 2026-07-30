# TODO.md

## Content improvement pass (in progress)
- [x] Home badge: "🟢 Open to internship opportunities" added under the
      hero name/role.
- [x] Vinted OS tag: "Artificial Intelligence" → "AI-Assisted Development"
      (was misleading — the project uses AI coding assistants, not AI
      features).
- [x] Formula Water Key Result badge reformatted to "🥇 1st Place —
      University of Minho Competition (2026)" and confirmed visible on the
      Projects grid card (not just the project page).
- [x] Pin Clutch Key Result added, scoped to kinematics only (position,
      velocity, acceleration) since the dynamic analysis — real engagement
      force/time — was left unfinished in the report.
- [x] Lab Notes page created (see dedicated section below) with its first
      article.
- [ ] Fatigue Study Key Result badge — not added yet. Needs a decision on
      which real number to headline (e.g. the converged 242 MPa peak
      stress, the ~94-cycle FEA estimate, or the 4-step mesh-convergence
      itself — all three are already in `projects.json`).
- [ ] Door Lock Teardown Key Result badge — not added yet. Needs a real,
      quantifiable result to headline (e.g. number of components
      reverse-engineered, manufacturing processes identified, etc.).

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
- [ ] Light theme / theme toggle, if the fixed "dark, bold, high-contrast"
      direction is ever revisited — would need a `[data-theme]` attribute
      switch and a parallel light palette added to `tokens.css`.
- [ ] Automated accessibility testing (e.g. axe-core) wired into a CI
      workflow, if this repo grows a CI pipeline.

## Lab Notes (scope change — supersedes the earlier "no Blog" decision)
- [x] Scope revisited: a blog-only page was excluded at kickoff, but a
      combined blog + interactive-simulations page was requested and named
      "Lab Notes". Added `lab-notes.html` (index), `lab-note.html`
      (article template, `?id=<slug>`), `assets/data/labnotes.json`, and
      `assets/js/render-labnotes.js`, following the same data-driven
      pattern as Projects. Nav link added on all pages.
- [x] First article published: "Why Mesh Convergence Matters More Than a
      Refined Model" (Fatigue Study mesh-convergence note).
- [ ] Add the exact per-step mesh-convergence numbers (element counts
      and/or % variation at each of the four refinement steps) to that
      article, if/when available.
- [ ] Build an actual interactive simulation module for Lab Notes (e.g.
      four-bar linkage) — the page and data contract support a future
      `simulation` field per entry, but no simulation widget exists yet.

## Explicitly out of scope
- Contact form / Formspree integration (confirmed: mailto only).
- Any build tool, bundler, or framework.
