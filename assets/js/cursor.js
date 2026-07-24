/**
 * PURPOSE
 *   Custom cursor: a small dot that tracks the pointer immediately, plus a
 *   larger ring that trails it with easing and grows over interactive
 *   elements (links, buttons, interactive cards).
 *
 * RESPONSIBILITIES
 *   - Inject the two cursor elements once and position them every frame
 *     via requestAnimationFrame, lerping the ring toward the dot's latest
 *     position (transform-only updates — no layout reads in the loop).
 *   - Detect hover state via event delegation on document so DOM added
 *     later (e.g. project cards rendered from JSON) is covered without
 *     rebinding listeners.
 *   - No-op entirely on touch/coarse-pointer devices and under
 *     prefers-reduced-motion, and tear itself down cleanly if the
 *     preference changes mid-session.
 *
 * DEPENDENCIES
 *   assets/css/micro-interactions.css (.cursor-dot / .cursor-ring rules).
 *
 * SAFE EDITS
 *   Tune EASE / element sizes via the CSS file, not here. Add more hover
 *   targets to HOVER_SELECTOR below rather than adding new listeners.
 */

const HOVER_SELECTOR = "a, button, .btn, .card--interactive, [data-cursor-hover]";
const EASE = 0.18;

export function initCursor() {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (reduceMotionQuery.matches || !finePointerQuery.matches) return;

  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  dot.setAttribute("aria-hidden", "true");

  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  ring.setAttribute("aria-hidden", "true");

  document.body.append(dot, ring);
  document.body.dataset.customCursor = "active";

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let ringX = targetX;
  let ringY = targetY;
  let rafId = null;
  let visible = false;

  function onPointerMove(event) {
    targetX = event.clientX;
    targetY = event.clientY;

    if (!visible) {
      visible = true;
      dot.style.opacity = "1";
      ring.style.opacity = "1";
      ringX = targetX;
      ringY = targetY;
    }

    dot.style.transform = `translate(${targetX}px, ${targetY}px)`;
  }

  function onWindowLeave() {
    visible = false;
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  }

  function onPointerOver(event) {
    if (event.target.closest && event.target.closest(HOVER_SELECTOR)) {
      ring.dataset.hover = "true";
    }
  }

  function onPointerOut(event) {
    const related = event.relatedTarget;
    if (related && related.closest && related.closest(HOVER_SELECTOR)) return;
    ring.dataset.hover = "false";
  }

  function tick() {
    ringX += (targetX - ringX) * EASE;
    ringY += (targetY - ringY) * EASE;
    ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
    rafId = requestAnimationFrame(tick);
  }

  function teardown() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("mouseleave", onWindowLeave);
    dot.remove();
    ring.remove();
    delete document.body.dataset.customCursor;
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("mouseleave", onWindowLeave);
  rafId = requestAnimationFrame(tick);

  // If the user flips on reduced-motion mid-session, remove the cursor
  // immediately rather than waiting for a reload.
  reduceMotionQuery.addEventListener("change", (event) => {
    if (event.matches) teardown();
  });
}
