/**
 * PURPOSE
 *   3D tilt + subtle cursor-tracking glow for interactive cards
 *   (.card--interactive, currently only project cards).
 *
 * RESPONSIBILITIES
 *   - Event-delegate pointermove on document so cards rendered later from
 *     assets/data/projects.json (by render-projects.js) are covered
 *     without a MutationObserver or per-card listeners.
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
      }
    }

    if (!card) return;

    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    const rotateY = clamp((px - 0.5) * MAX_TILT_DEG * 2, -MAX_TILT_DEG, MAX_TILT_DEG);
    const rotateX = clamp((0.5 - py) * MAX_TILT_DEG * 2, -MAX_TILT_DEG, MAX_TILT_DEG);

    card.style.transform =
      `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-${LIFT_PX}px)`;
    card.style.setProperty("--tilt-x", `${px * 100}%`);
    card.style.setProperty("--tilt-y", `${py * 100}%`);
  }

  function onWindowLeave() {
    if (activeCard) resetCard(activeCard);
    activeCard = null;
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("mouseleave", onWindowLeave);
}
