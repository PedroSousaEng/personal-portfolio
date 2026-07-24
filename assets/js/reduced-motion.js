/**
 * PURPOSE
 *   Phase 8 — Centralized prefers-reduced-motion helper.
 *
 *   Every JS module currently reads
 *   window.matchMedia("(prefers-reduced-motion: reduce)") directly,
 *   which works but duplicates the query string a dozen times. This
 *   module owns a single MediaQueryList, exposes helpers to read it
 *   and subscribe to changes, and also toggles a body attribute
 *   `data-reduced-motion` so CSS that can't be expressed via the
 *   @media guard can also react.
 *
 * RESPONSIBILITIES
 *   - Expose `prefersReducedMotion()` — a one-line boolean read.
 *   - Expose `onReducedMotionChange(cb)` — subscribe to changes.
 *   - Mirror the current state to `body[data-reduced-motion]` so it
 *     survives beyond CSS's @media reach when needed.
 *
 * DEPENDENCIES
 *   None. Pure browser API.
 *
 * SAFE EDITS
 *   Do not add module-level side effects that require a specific
 *   DOM readiness — call sites are expected to run after
 *   DOMContentLoaded.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

const mql =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY)
    : null;

/**
 * @returns {boolean} true when the visitor prefers reduced motion.
 */
export function prefersReducedMotion() {
  return !!(mql && mql.matches);
}

/**
 * Subscribe to preference changes. The callback receives the current
 * boolean state. Returns an unsubscribe function.
 *
 * @param {(reduced: boolean) => void} callback
 * @returns {() => void}
 */
export function onReducedMotionChange(callback) {
  if (!mql || typeof callback !== "function") return () => {};

  const handler = (event) => callback(event.matches);

  // Safari 13 and earlier used addListener; modern browsers use
  // addEventListener. Handle both.
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }

  mql.addListener(handler);
  return () => mql.removeListener(handler);
}

/**
 * Wire the current preference to `body[data-reduced-motion]` and
 * keep it in sync. Called once from main.js during boot.
 */
export function initReducedMotion() {
  if (!document.body) return;

  const apply = (reduced) => {
    if (reduced) {
      document.body.dataset.reducedMotion = "true";
    } else {
      delete document.body.dataset.reducedMotion;
    }
  };

  apply(prefersReducedMotion());
  onReducedMotionChange(apply);
}
