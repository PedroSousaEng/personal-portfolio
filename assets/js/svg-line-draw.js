/**
 * PURPOSE
 *   Phase 8 — SVG line-draw effect.
 *
 *   Any inline <svg> annotated with `data-line-draw` has each of its
 *   strokable primitives (path, line, polyline, rect, circle,
 *   ellipse, polygon) revealed as if a pen were drawing it. The CSS
 *   pairs stroke-dasharray/stroke-dashoffset with a transition; this
 *   module's only job is:
 *
 *   1. Measure each primitive's total length once.
 *   2. Expose that length as a CSS custom property (--line-length).
 *   3. Toggle [data-drawn="true"] the first time the SVG enters the
 *      viewport, via IntersectionObserver.
 *
 *   Optional stagger: children with `data-line-index` receive a
 *   per-child `--line-delay` proportional to their order, so the
 *   strokes draw in sequence rather than all at once.
 *
 * RESPONSIBILITIES
 *   - Feature-detect getTotalLength() / IntersectionObserver and
 *     degrade silently when missing.
 *   - Respect prefers-reduced-motion: reveal instantly, don't set up
 *     an observer.
 *   - Never re-measure on resize — SVG geometry is resolution-
 *     independent, so a one-shot measurement is correct forever.
 *
 * DEPENDENCIES
 *   assets/css/svg-line-draw.css (the actual dasharray / transition).
 *
 * SAFE EDITS
 *   Add `data-line-draw` to any inline SVG to opt it in. Add
 *   `data-line-index="N"` on children for staggered drawing (index
 *   0 draws first). Duration lives in the CSS file.
 */

const CONTAINER_SELECTOR = "[data-line-draw]";
const PRIMITIVE_SELECTOR = "path, line, polyline, rect, circle, ellipse, polygon";
const STAGGER_MS = 90;

function measurePrimitive(el) {
  // getTotalLength() is defined on SVGGeometryElement in modern browsers.
  // Rects/circles/etc without it (very old browsers) fall through to a
  // bounding-box perimeter approximation, then to a sensible constant.
  if (typeof el.getTotalLength === "function") {
    try {
      const length = el.getTotalLength();
      if (Number.isFinite(length) && length > 0) return length;
    } catch (_) {
      /* fall through */
    }
  }

  try {
    const box = el.getBBox();
    const perimeter = 2 * (box.width + box.height);
    if (perimeter > 0) return perimeter;
  } catch (_) {
    /* fall through */
  }

  return 1000;
}

function prepareContainer(svg) {
  const primitives = svg.querySelectorAll(PRIMITIVE_SELECTOR);
  if (!primitives.length) return;

  primitives.forEach((el, index) => {
    const length = measurePrimitive(el);
    // Round to reduce sub-pixel jitter and keep dev-tools readable.
    el.style.setProperty("--line-length", String(Math.ceil(length)));

    // Only stagger when the author explicitly marks children with an
    // index — otherwise strokes draw in unison (the default look).
    if (el.hasAttribute("data-line-index")) {
      const staggerIndex = parseInt(el.getAttribute("data-line-index"), 10);
      const safeIndex = Number.isFinite(staggerIndex) ? staggerIndex : index;
      el.style.setProperty("--line-delay", `${safeIndex * STAGGER_MS}ms`);
    }
  });
}

export function initSvgLineDraw() {
  const targets = document.querySelectorAll(CONTAINER_SELECTOR);
  if (!targets.length) return;

  // Reduced motion: reveal instantly, don't animate.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    targets.forEach((svg) => {
      svg.dataset.drawn = "true";
    });
    return;
  }

  // Measure every container up-front. Cheap: it's a single sync read
  // per SVG, done once, before any drawing starts.
  targets.forEach(prepareContainer);

  if (!("IntersectionObserver" in window)) {
    // Old browser: draw everything immediately rather than not at all.
    targets.forEach((svg) => {
      svg.dataset.drawn = "true";
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.dataset.drawn = "true";
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -40px 0px" }
  );

  targets.forEach((svg) => observer.observe(svg));
}
