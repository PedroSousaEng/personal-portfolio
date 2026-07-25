/**
 * PURPOSE
 *   Cursor-tracking glow for interactive project cards.
 *
 * FIX (buttons "run away" from the cursor)
 *   This used to also apply a 3D tilt to the whole card
 *   (`perspective() rotateX() rotateY()`). Because .card__links sits
 *   inside that same 3D-transformed element, rotating the card displaced
 *   the button row in 3D depth in a way that no longer matched the flat
 *   2D screen position the pointer math was computed against — the
 *   buttons visibly drifted away from the cursor and created a
 *   disconnected-looking gap under the card. Flattening the rotation only
 *   while hovering the link row (a previous attempt at this fix) still
 *   left a moving target everywhere else on the card.
 *
 *   The rotation is removed entirely. The card lift on hover is handled
 *   declaratively by CSS (`.card--interactive:hover { transform:
 *   translateY(-4px) }` in components.css), which never touches 3D space,
 *   so buttons/links always sit exactly where they're laid out — no
 *   chasing, no click-freeze, and no separate "flush" transform write per
 *   frame (only the two custom properties below, which are cheap and never
 *   move the element or its children).
 */

const SELECTOR = ".card--interactive";

let destroyTilt = null;

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
    // Custom-property-only write: never touches transform, so the card
    // and everything inside it (including the link row) stays exactly
    // where CSS laid it out.
    activeCard.style.setProperty("--tilt-x", `${pendingTiltX}%`);
    activeCard.style.setProperty("--tilt-y", `${pendingTiltY}%`);
  }

  function scheduleFlush() {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(flush);
  }

  function deactivateCard() {
    cancelFrame();
    if (activeCard?.isConnected) delete activeCard.dataset.tilting;
    activeCard = null;
    activeRect = null;
  }

  function onPointerOver(event) {
    const card = event.target.closest ? event.target.closest(SELECTOR) : null;
    if (!card || card === activeCard) return;

    deactivateCard();
    activeCard = card;
    activeCard.dataset.tilting = "true";
    // One layout read when the pointer enters the card; the move path below
    // only reads cached numbers and writes custom properties.
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
