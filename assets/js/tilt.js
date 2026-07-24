/**
 * PURPOSE
 *   3D tilt + subtle cursor-tracking glow for interactive cards
 *   (.card--interactive, currently only project cards).
 *
 * RESPONSIBILITIES
 *   - Event-delegate pointermove on document so cards rendered later from
 *     assets/data/projects.json (by render-projects.js) are covered
 *     without a MutationObserver or per-card listeners.
 *   - Cache the active card's bounding rect on entry — refresh only on
 *     scroll/resize — so the hot pointermove path performs no layout
 *     reads.
 *   - Batch style writes through requestAnimationFrame so a burst of
 *     pointermove events collapses into a single transform per frame.
 *   - Compute a small rotateX/rotateY from pointer position within the
 *     card, applied with perspective() directly in the transform so no
 *     parent element needs its own `perspective` rule.
 *   - Feed the pointer position to CSS via --tilt-x/--tilt-y custom
 *     properties, which micro-interactions.css uses to position the glow.
 *   - No-op on touch/coarse-pointer devices and under
 *     prefers-reduced-motion — the plain CSS :hover lift already defined
 *     on .card--interactive in components.css still applies in both
 *     cases, so cards stay interactive either way.
 *
 * DEPENDENCIES
 *   assets/css/micro-interactions.css (the [data-tilting] glow rules).
 *
 * SAFE EDITS
 *   Tune MAX_TILT_DEG / LIFT_PX below.
 */

const SELECTOR = ".card--interactive";
const MAX_TILT_DEG = 6;
const LIFT_PX = 6;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function initCardTilt() {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (reduceMotionQuery.matches || !finePointerQuery.matches) return;

  let activeCard = null;
  let activeRect = null;
  let pendingRotX = 0;
  let pendingRotY = 0;
  let pendingTiltX = 0;
  let pendingTiltY = 0;
  let rafScheduled = false;

  function refreshRect() {
    if (activeCard) activeRect = activeCard.getBoundingClientRect();
  }

  function flush() {
    rafScheduled = false;
    if (!activeCard) return;
    activeCard.style.transform =
      `perspective(900px) rotateX(${pendingRotX}deg) rotateY(${pendingRotY}deg) translate3d(0, -${LIFT_PX}px, 0)`;
    activeCard.style.setProperty("--tilt-x", `${pendingTiltX}%`);
    activeCard.style.setProperty("--tilt-y", `${pendingTiltY}%`);
  }

  function scheduleFlush() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(flush);
  }

  function resetCard(card) {
    card.style.transition =
      "transform var(--duration-base) var(--ease-standard), " +
      "box-shadow var(--duration-base) var(--ease-standard), " +
      "border-color var(--duration-base) var(--ease-standard)";
    card.style.transform = "";
    delete card.dataset.tilting;
  }

  function onPointerMove(event) {
    const card = event.target.closest ? event.target.closest(SELECTOR) : null;

    if (card !== activeCard) {
      if (activeCard) resetCard(activeCard);
      activeCard = card;
      if (activeCard) {
        activeCard.style.transition = "none"; // instant-follow while actively tracked
        activeCard.dataset.tilting = "true";
        // One layout read per activation, cached for the whole hover.
        activeRect = activeCard.getBoundingClientRect();
      } else {
        activeRect = null;
      }
    }

    if (!card || !activeRect) return;

    const px = (event.clientX - activeRect.left) / activeRect.width;
    const py = (event.clientY - activeRect.top) / activeRect.height;

    pendingRotY = clamp((px - 0.5) * MAX_TILT_DEG * 2, -MAX_TILT_DEG, MAX_TILT_DEG);
    pendingRotX = clamp((0.5 - py) * MAX_TILT_DEG * 2, -MAX_TILT_DEG, MAX_TILT_DEG);
    pendingTiltX = px * 100;
    pendingTiltY = py * 100;
    scheduleFlush();
  }

  function onWindowLeave() {
    if (activeCard) resetCard(activeCard);
    activeCard = null;
    activeRect = null;
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("mouseleave", onWindowLeave);
  // Cached rect must be invalidated when the page reflows.
  window.addEventListener("scroll", refreshRect, { passive: true });
  window.addEventListener("resize", refreshRect, { passive: true });
}
