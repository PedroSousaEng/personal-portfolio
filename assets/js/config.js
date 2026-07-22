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
  projects: "assets/data/projects.json",
  skills: "assets/data/skills.json",
  experience: "assets/data/experience.json",
  timeline: "assets/data/timeline.json",
  socials: "assets/data/socials.json",
});

// Mirrors the breakpoint table in docs/DESIGN_SYSTEM.md — keep in sync.
export const BREAKPOINTS = Object.freeze({
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
});

export const SITE_NAME = "Alex Rivera";
