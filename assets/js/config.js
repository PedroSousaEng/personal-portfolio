/**
 * PURPOSE
 *   Centralized configuration constants used across the JS modules.
 *
 * RESPONSIBILITIES
 *   - Paths to each JSON data file (relative to the site root).
 *   - Breakpoint numbers mirrored from docs/DESIGN_SYSTEM.md / tokens.css,
 *     for any JS that needs to match a CSS breakpoint (e.g. matchMedia).
 *
 * DEPENDENCIES
 *   None. This module has no imports so it can be imported from anywhere
 *   without risk of a circular dependency.
 *
 * SAFE EDITS
 *   Add a new constant here rather than hard-coding a path or magic number
 *   inside a render/behavior module.
 */

export const DATA_PATHS = Object.freeze({
  site: "assets/data/site.json",
  projects: "assets/data/projects.json",
  skills: "assets/data/skills.json",
  socials: "assets/data/socials.json",
  cv: "assets/data/cv.json",
  labnotes: "assets/data/labnotes.json",
});

// Mirrors the breakpoint table in docs/DESIGN_SYSTEM.md — keep in sync.
export const BREAKPOINTS = Object.freeze({
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
});

// Kept as a build-time fallback only; the source of truth for the name
// shown across pages is assets/data/site.json (see render-site.js).
export const SITE_NAME = "Pedro Sousa";
