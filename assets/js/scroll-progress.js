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
 *   - Recompute scroll height on resize AND when the document body
 *     mutates (dynamically loaded content: skills/experience/timeline
 *     JSON on About, project cards on Projects, etc.). Both paths are
 *     rAF-throttled.
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

  // Cached values. All reads happen outside the scroll rAF path so the
  // hot loop only performs a single scrollTop read + a transform write.
  let scrollHeight = 0;
  let viewportHeight = window.innerHeight;
  let totalScrollable = 0;
  let rafScheduled = false;
  let recomputeScheduled = false;
  let lastProgress = -1;

  /**
   * Compute the total scrollable distance:
   *   totalScrollable = documentHeight - viewportHeight
   *
   * We read from multiple sources because different browsers /
   * document setups (overflow-x hidden on <html> or <body>, empty
   * body, quirks mode) can leave documentElement.scrollHeight
   * under-reporting. Taking the max across all reliable sources
   * gives the correct height on every page.
   */
  function recomputeHeights() {
    recomputeScheduled = false;
    viewportHeight = window.innerHeight;
    const doc = document.documentElement;
    const body = document.body;
    scrollHeight = Math.max(
      doc.scrollHeight,
      doc.offsetHeight,
      doc.clientHeight,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    );
    totalScrollable = Math.max(0, scrollHeight - viewportHeight);
    // Force a progress re-write with the new denominator on the next
    // scheduled frame so the bar snaps to the correct position even
    // when scroll hasn't fired (e.g. content just grew below the fold).
    lastProgress = -1;
    schedule();
  }

  function scheduleRecompute() {
    if (recomputeScheduled) return;
    recomputeScheduled = true;
    requestAnimationFrame(recomputeHeights);
  }

  function update() {
    rafScheduled = false;
    const y = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const progress = totalScrollable > 0
      ? Math.min(1, Math.max(0, y / totalScrollable))
      : 0;
    // Skip the write when nothing meaningfully changed — avoids a style
    // recalc on every scroll rAF while the bar is already at 0 or 1.
    if (progress === lastProgress) return;
    lastProgress = progress;
    bar.style.setProperty("--scroll-progress", String(progress));
  }

  function schedule() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", scheduleRecompute, { passive: true });
  // Orientation change also affects viewport height on mobile without
  // firing a synchronous resize on some browsers.
  window.addEventListener("orientationchange", scheduleRecompute, { passive: true });
  // Full-page load (fonts/images finalizing layout) can shift totals.
  window.addEventListener("load", scheduleRecompute);

  // Watch the body for size changes so dynamically loaded content
  // (skills/experience/timeline JSON on About, projects list, etc.)
  // updates the scroll denominator without needing per-page hooks.
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(scheduleRecompute);
    ro.observe(document.body);
  } else if (typeof MutationObserver === "function") {
    // Fallback for older browsers: recompute when the DOM changes.
    const mo = new MutationObserver(scheduleRecompute);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // First paint: measure, then draw.
  recomputeHeights();
}
