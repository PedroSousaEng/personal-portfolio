/**
 * PURPOSE
 *   Magnetic buttons: each eligible .btn shifts subtly toward the pointer
 *   while hovered and eases back immediately after exit.
 *
 *   Delegated entry/exit avoids scanning the DOM on every pointermove and
 *   keeps the interaction available for buttons rendered after boot.
 */

const SELECTOR = ".btn:not([data-magnetic='false'])";
const MAX_OFFSET_PX = 10;
const STRENGTH = 0.35;

let destroyMagnetic = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function initMagneticButtons() {
  if (!document.querySelector(SELECTOR) || destroyMagnetic) return;

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (reduceMotionQuery.matches || !finePointerQuery.matches) return;

  let activeButton = null;
  let activeRect = null;
  let pendingX = 0;
  let pendingY = 0;
  let rafId = null;

  function refreshRect() {
    if (activeButton?.isConnected) activeRect = activeButton.getBoundingClientRect();
  }

  function cancelFrame() {
    if (rafId === null) return;
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  function flush() {
    rafId = null;
    if (!activeButton?.isConnected) return;
    activeButton.style.transform = `translate3d(${pendingX}px, ${pendingY}px, 0)`;
  }

  function scheduleFlush() {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(flush);
  }

  function resetButton(button) {
    delete button.dataset.magneticActive;
    button.style.transform = "";
  }

  function snapBack(button) {
    button.dataset.magneticActive = "true";
    button.style.transform = "";
    button.addEventListener(
      "transitionend",
      (event) => {
        if (event.propertyName === "transform") delete button.dataset.magneticActive;
      },
      { once: true }
    );
  }

  function deactivateButton(animate = true) {
    cancelFrame();
    if (activeButton?.isConnected) {
      if (animate) snapBack(activeButton);
      else resetButton(activeButton);
    }
    activeButton = null;
    activeRect = null;
  }

  function onPointerOver(event) {
    const button = event.target.closest ? event.target.closest(SELECTOR) : null;
    if (!button || button === activeButton) return;

    deactivateButton();
    activeButton = button;
    delete activeButton.dataset.magneticActive;
    // One layout read per entry. Pointer movement works only from this cache.
    activeRect = activeButton.getBoundingClientRect();
  }

  function onPointerOut(event) {
    if (!activeButton) return;
    const button = event.target.closest ? event.target.closest(SELECTOR) : null;
    if (button !== activeButton) return;

    const related = event.relatedTarget;
    if (related && activeButton.contains(related)) return;
    deactivateButton();
  }

  function onPointerMove(event) {
    if (!activeRect || !activeButton) return;

    const relX = event.clientX - (activeRect.left + activeRect.width * 0.5);
    const relY = event.clientY - (activeRect.top + activeRect.height * 0.5);
    pendingX = clamp(relX * STRENGTH, -MAX_OFFSET_PX, MAX_OFFSET_PX);
    pendingY = clamp(relY * STRENGTH, -MAX_OFFSET_PX, MAX_OFFSET_PX);
    scheduleFlush();
  }

  function onWindowLeave() {
    deactivateButton();
  }

  function onReduceMotionChange(event) {
    if (event.matches) destroy();
  }

  function destroy() {
    deactivateButton(false);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("mouseleave", onWindowLeave);
    window.removeEventListener("scroll", refreshRect);
    window.removeEventListener("resize", refreshRect);
    reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
    destroyMagnetic = null;
  }

  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("mouseleave", onWindowLeave);
  // Only the active button's cached rect is refreshed on document movement.
  window.addEventListener("scroll", refreshRect, { passive: true });
  window.addEventListener("resize", refreshRect, { passive: true });
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  destroyMagnetic = destroy;
}
