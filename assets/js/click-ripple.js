/**
 * PURPOSE
 *   Site-wide: a small "measurement point" ripple — a fading dot plus an
 *   expanding ring — at every primary click, echoing the blueprint/
 *   engineering-drawing motif used elsewhere on the site.
 *
 * RESPONSIBILITIES
 *   - Spawn one short-lived element per click, positioned via inline
 *     left/top, animated purely with CSS transform/opacity (no layout
 *     work) and removed once its animation finishes.
 *   - No-op entirely on touch/coarse-pointer devices (native tap feedback
 *     already covers that) and under prefers-reduced-motion.
 *
 * DEPENDENCIES
 *   assets/css/micro-interactions.css (.click-ripple rules).
 */

const RIPPLE_LIFETIME_MS = 650;

export function initClickRipple() {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (reduceMotionQuery.matches || !finePointerQuery.matches) return;

  function spawn(x, y) {
    const el = document.createElement("span");
    el.className = "click-ripple";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.setAttribute("aria-hidden", "true");

    const dot = document.createElement("span");
    dot.className = "click-ripple__dot";
    const ring = document.createElement("span");
    ring.className = "click-ripple__ring";
    el.append(dot, ring);

    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), RIPPLE_LIFETIME_MS);
  }

  function onPointerDown(event) {
    if (event.button !== 0) return; // primary button only
    spawn(event.clientX, event.clientY);
  }

  function teardown() {
    document.removeEventListener("pointerdown", onPointerDown);
    reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
  }

  function onReduceMotionChange(event) {
    if (event.matches) teardown();
  }

  document.addEventListener("pointerdown", onPointerDown, { passive: true });
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);
}
