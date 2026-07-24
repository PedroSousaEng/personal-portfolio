/**
 * PURPOSE
 *   Global scroll-progress indicator.
 *
 *   Mounts a fixed, transform-driven bar and derives its progress from the
 *   actual document scroll range:
 *
 *     progress = scrollY / (documentHeight - viewportHeight)
 *
 *   Measurements are coalesced with visual updates so scroll, resize and
 *   dynamically rendered content never create competing animation frames.
 */

const ROOT_CLASS = "scroll-progress";
const BAR_CLASS = "scroll-progress__bar";

export function initScrollProgress() {
  // A module can be reached more than once through browser restoration or a
  // future bootstrap change. The mounted root is the lifecycle guard.
  if (document.querySelector(`.${ROOT_CLASS}`)) return;

  const root = document.createElement("div");
  root.className = ROOT_CLASS;
  root.setAttribute("aria-hidden", "true");

  const bar = document.createElement("div");
  bar.className = BAR_CLASS;
  root.appendChild(bar);
  document.body.appendChild(root);

  const documentElement = document.documentElement;
  const body = document.body;
  const scrollingElement = document.scrollingElement || documentElement;
  const visualViewport = window.visualViewport;

  let documentHeight = 0;
  let viewportHeight = 0;
  let totalScrollable = 0;
  let rafId = null;
  let needsMeasurement = true;
  let lastProgress = -1;

  function measureScrollRange() {
    // The scrolling element is authoritative where available, while the
    // remaining values cover browser/document combinations that under-report
    // a root height. All values are live only when a measurement is requested.
    documentHeight = Math.max(
      scrollingElement.scrollHeight,
      documentElement.scrollHeight,
      documentElement.offsetHeight,
      body.scrollHeight,
      body.offsetHeight
    );

    // clientHeight is the height of the layout viewport used by the document
    // scroller. Falling back to innerHeight preserves the same formula on
    // browser/document implementations without a usable clientHeight.
    viewportHeight = scrollingElement.clientHeight || documentElement.clientHeight || window.innerHeight;
    totalScrollable = Math.max(0, documentHeight - viewportHeight);
  }

  function schedule(needsFreshMeasurement = false) {
    needsMeasurement = needsMeasurement || needsFreshMeasurement;
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(update);
  }

  function update() {
    rafId = null;

    if (needsMeasurement) {
      needsMeasurement = false;
      measureScrollRange();
      // A changed denominator must always write again, even if scrollY is
      // unchanged because content was added below the viewport.
      lastProgress = -1;
    }

    const scrollY = window.scrollY || scrollingElement.scrollTop || 0;
    const progress = totalScrollable > 0
      ? Math.min(1, Math.max(0, scrollY / totalScrollable))
      : 0;

    // Keep the hot scroll path to one layout-neutral style write only when
    // the visual value actually changed.
    if (progress === lastProgress) return;
    lastProgress = progress;
    bar.style.setProperty("--scroll-progress", String(progress));
  }

  function onScroll() {
    schedule();
  }

  function onGeometryChange() {
    schedule(true);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onGeometryChange, { passive: true });
  window.addEventListener("orientationchange", onGeometryChange, { passive: true });
  window.addEventListener("load", onGeometryChange, { once: true });

  // Mobile browser chrome and pinch-zoom can change the usable viewport
  // independently of a window resize. Coalesce those notifications too.
  if (visualViewport) {
    visualViewport.addEventListener("resize", onGeometryChange, { passive: true });
    visualViewport.addEventListener("scroll", onScroll, { passive: true });
  }

  // ResizeObserver catches layout growth/shrinkage; MutationObserver covers
  // DOM changes before a size observer is available or before its callback.
  if (typeof ResizeObserver === "function") {
    const resizeObserver = new ResizeObserver(onGeometryChange);
    resizeObserver.observe(documentElement);
    resizeObserver.observe(body);
  }

  if (typeof MutationObserver === "function") {
    const mutationObserver = new MutationObserver(onGeometryChange);
    mutationObserver.observe(body, { childList: true, subtree: true });
  }

  schedule(true);
}
