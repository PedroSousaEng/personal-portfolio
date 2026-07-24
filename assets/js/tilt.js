/**
 * PURPOSE
 *   3D tilt + subtle cursor-tracking glow for interactive project cards.
 *
 *   The module uses delegated pointer entry/exit to identify one active card,
 *   then uses a single rAF-coalesced pointer path while that card is active.
 */

const SELECTOR = ".card--interactive";
const MAX_TILT_DEG = 6;
const LIFT_PX = 6;

let destroyTilt = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function initCardTilt() {
  // Project cards are rendered dynamically on Home and Projects. A static
  // match keeps the module extensible without making About, Contact or 404
  // subscribe to global pointer/scroll/resize work they cannot use.
  const page = document.body?.dataset.page;
  if (!document.querySelector(SELECTOR) && page !== "home" && page !== "projects") return;
  if (destroyTilt) return;

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (reduceMotionQuery.matches || !finePointerQuery.matches) return;

  let activeCard = null;
  let activeRect = null;
  let pendingRotX = 0;
  let pendingRotY = 0;
  let pendingTiltX = 0;
  let pendingTiltY = 0;
  let rafId = null;

  function refreshRect() {
    if (activeCard?.isConnected) activeRect = activeCard.getBoundingClientRect();
  }

  function cancelFrame() {
    if (rafId === null) return;
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  function flush() {
    rafId = null;
    if (!activeCard?.isConnected) return;

    activeCard.style.transform =
      `perspective(900px) rotateX(${pendingRotX}deg) rotateY(${pendingRotY}deg) translate3d(0, -${LIFT_PX}px, 0)`;
    activeCard.style.setProperty("--tilt-x", `${pendingTiltX}%`);
    activeCard.style.setProperty("--tilt-y", `${pendingTiltY}%`);
  }

  function scheduleFlush() {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(flush);
  }

  function resetCard(card) {
    card.style.transition =
      "transform var(--duration-base) var(--ease-standard), " +
      "box-shadow var(--duration-base) var(--ease-standard), " +
      "border-color var(--duration-base) var(--ease-standard)";
    card.style.transform = "";
    delete card.dataset.tilting;
  }

  function deactivateCard() {
    cancelFrame();
    if (activeCard?.isConnected) resetCard(activeCard);
    activeCard = null;
    activeRect = null;
  }

  function onPointerOver(event) {
    const card = event.target.closest ? event.target.closest(SELECTOR) : null;
    if (!card || card === activeCard) return;

    deactivateCard();
    activeCard = card;
    activeCard.style.transition = "none";
    activeCard.dataset.tilting = "true";
    // One layout read when the pointer enters the card; the move path below
    // only reads cached numbers and writes transforms/custom properties.
    activeRect = activeCard.getBoundingClientRect();
  }

  function onPointerOut(event) {
    if (!activeCard) return;
    const card = event.target.closest ? event.target.closest(SELECTOR) : null;
    if (card !== activeCard) return;

    const related = event.relatedTarget;
    if (related && activeCard.contains(related)) return;
    deactivateCard();
  }

  function onPointerMove(event) {
    if (!activeCard || !activeRect) return;

    const px = (event.clientX - activeRect.left) / activeRect.width;
    const py = (event.clientY - activeRect.top) / activeRect.height;

    pendingRotY = clamp((px - 0.5) * MAX_TILT_DEG * 2, -MAX_TILT_DEG, MAX_TILT_DEG);
    pendingRotX = clamp((0.5 - py) * MAX_TILT_DEG * 2, -MAX_TILT_DEG, MAX_TILT_DEG);
    pendingTiltX = px * 100;
    pendingTiltY = py * 100;
    scheduleFlush();
  }

  function onWindowLeave() {
    deactivateCard();
  }

  function onReduceMotionChange(event) {
    if (event.matches) destroy();
  }

  function destroy() {
    deactivateCard();
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("mouseleave", onWindowLeave);
    window.removeEventListener("scroll", refreshRect);
    window.removeEventListener("resize", refreshRect);
    reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
    destroyTilt = null;
  }

  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("mouseleave", onWindowLeave);
  // Re-read the cached rect only for the one card currently under the pointer.
  window.addEventListener("scroll", refreshRect, { passive: true });
  window.addEventListener("resize", refreshRect, { passive: true });
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  destroyTilt = destroy;
}
