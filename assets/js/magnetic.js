/**
 * PURPOSE
 *   Magnetic buttons: every .btn shifts subtly toward the pointer while
 *   it's nearby, and eases back to rest the moment the pointer leaves.
 *
 * RESPONSIBILITIES
 *   - Event-delegate pointermove on document (rather than binding a
 *     listener per button) so the effect works on any .btn in the DOM,
 *     present now or added later, with a single listener.
 *   - Clamp displacement to a small maximum so the effect reads as
 *     "subtle," per the design brief.
 *   - No-op on touch/coarse-pointer devices and under
 *     prefers-reduced-motion.
 *
 * DEPENDENCIES
 *   assets/css/micro-interactions.css (return-transition rule for
 *   [data-magnetic-active="true"]).
 *
 * SAFE EDITS
 *   Tune MAX_OFFSET_PX / STRENGTH below. Add data-magnetic="false" to any
 *   .btn in HTML to opt that one button out.
 */

const SELECTOR = ".btn:not([data-magnetic='false'])";
const MAX_OFFSET_PX = 10;
const STRENGTH = 0.35;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function initMagneticButtons() {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (reduceMotionQuery.matches || !finePointerQuery.matches) return;

  let activeButton = null;

  function applyOffset(el, event) {
    const rect = el.getBoundingClientRect();
    const relX = event.clientX - (rect.left + rect.width / 2);
    const relY = event.clientY - (rect.top + rect.height / 2);
    const offsetX = clamp(relX * STRENGTH, -MAX_OFFSET_PX, MAX_OFFSET_PX);
    const offsetY = clamp(relY * STRENGTH, -MAX_OFFSET_PX, MAX_OFFSET_PX);
    el.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  }

  function snapBack(el) {
    // Enable the CSS return-transition for exactly this one move back to
    // rest, then drop the flag once it's done so a future hover starts
    // instant-follow again instead of transitioning.
    el.dataset.magneticActive = "true";
    el.style.transform = "";
    el.addEventListener(
      "transitionend",
      () => {
        delete el.dataset.magneticActive;
      },
      { once: true }
    );
  }

  function onPointerMove(event) {
    const el = event.target.closest ? event.target.closest(SELECTOR) : null;

    if (el !== activeButton) {
      if (activeButton) snapBack(activeButton);
      activeButton = el;
      if (activeButton) delete activeButton.dataset.magneticActive; // instant-follow while actively tracked
    }

    if (!el) return;
    applyOffset(el, event);
  }

  function onPointerOut(event) {
    if (!activeButton) return;
    const related = event.relatedTarget;
    if (related && activeButton.contains && activeButton.contains(related)) return;

    snapBack(activeButton);
    activeButton = null;
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerout", onPointerOut);
}
