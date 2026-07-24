/**
 * PURPOSE
 *   Phase 8 — Global scroll-progress indicator.
 *
 *   Injects a fixed 2px bar at the top of the viewport and drives
 *   its horizontal scale from the current scroll position. The
 *   update path is transform-only: no width/height mutation, no
 *   style reads inside the rAF loop, no reflow.
 *
 * RESPONSIBILITIES
 *   - Mount the two elements once, per page load.
 *   - Track scroll via a passive listener, schedule one rAF per
 *     scroll burst (rAF-throttled), read scrollTop / scrollHeight
 *     once per frame, and write a single --scroll-progress custom
 *     property to the bar.
 *   - Recompute scroll height on resize (also rAF-throttled).
 *   - Under prefers-reduced-motion: still show the bar (it's an
 *     information indicator, not a decoration), just skip the
 *     smoothing transition. The CSS module already handles that.
 *
 * DEPENDENCIES
 *   assets/css/scroll-progress.css.
 *
 * SAFE EDITS
 *   None expected — this module is single-purpose. If a page has
 *   an unusual scroller (e.g. an inner element that scrolls
 *   instead of the document), wire a new module rather than
 *   forking this one.
 */

const ROOT_CLASS = "scroll-progress";
const BAR_CLASS = "scroll-progress__bar";

export function initScrollProgress() {
  // Never mount twice.
  if (document.querySelector("." + ROOT_CLASS)) return;

  const root = document.createElement("div");
  root.className = ROOT_CLASS;
  root.setAttribute("aria-hidden", "true");

  const bar = document.createElement("div");
  bar.className = BAR_CLASS;
  root.appendChild(bar);
  document.body.appendChild(root);

  let scrollHeight = computeScrollHeight();
  let rafScheduled = false;

  function computeScrollHeight() {
    return Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
  }

  function update() {
    rafScheduled = false;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const progress = scrollHeight > 0 ? Math.min(1, Math.max(0, y / scrollHeight)) : 0;
    bar.style.setProperty("--scroll-progress", String(progress));
  }

  function schedule() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(update);
  }

  function onResize() {
    scrollHeight = computeScrollHeight();
    schedule();
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  // First paint.
  update();
}
