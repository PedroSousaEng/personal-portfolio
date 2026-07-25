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
 *   - Pause the rAF loop when the ring has settled on the dot and the
 *     pointer is idle — cuts a permanent per-frame cost on pages where
 *     the visitor isn't actively moving the mouse.
 *
 * PERF NOTE (regression fix)
 *   This used to also inject a second full-viewport <canvas> for a
 *   particle trail effect, with its own independent requestAnimationFrame
 *   loop doing a full-screen clearRect + N arc() fills on every pointer
 *   move. That ran on every single page, stacked on top of whatever
 *   ambient background canvas (background-fx / tech-network / rocket /
 *   spotlight / radar) was already running its own full-screen rAF loop —
 *   two-plus uncoordinated full-viewport redraw loops fighting for the
 *   same frame budget is exactly what made the site feel slow/janky again
 *   after being fixed once already. The trail was purely decorative, so
 *   it's removed outright rather than further optimized.
 *
 * DEPENDENCIES
 *   assets/css/micro-interactions.css (.cursor-dot / .cursor-ring rules).
 *
 * SAFE EDITS
 *   Tune EASE_TAU_MS below for ring catch-up speed; tune element sizes via
 *   the CSS file instead. Add more hover targets to HOVER_SELECTOR below
 *   rather than adding new listeners.
 */

const HOVER_SELECTOR = "a, button, .btn, .card--interactive, [data-cursor-hover]";
// Time-constant (ms) for the ring's catch-up smoothing — frame-rate
// independent (see tick() below), so the ring reaches the pointer in the
// same wall-clock time whether the page is running at 60fps or has
// dropped to 24fps under a heavier ambient background effect. Lower =
// snappier.
const EASE_TAU_MS = 40;
// Distance below which the ring is considered "settled" on the dot and
// the rAF loop can safely pause until the pointer moves again.
const SETTLE_DIST_SQ = 0.25;

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

  // The outer ring only ever receives the position transform (written every
  // frame below). Shape — border-radius, border-style, rotation — lives on
  // this inner element instead, so per-page CSS can freely use `transform:
  // rotate()` without fighting the JS-driven position transform on the
  // parent.
  const ringShape = document.createElement("span");
  ringShape.className = "cursor-ring-shape";
  ring.appendChild(ringShape);

  document.body.append(dot, ring);
  document.body.dataset.customCursor = "active";

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let ringX = targetX;
  let ringY = targetY;
  let rafId = null;
  let lastTickTime = null;
  let running = false;
  let visible = false;
  let hoverActive = false;

  function ensureRunning() {
    if (rafId === null) {
      running = true;
      lastTickTime = null;
      rafId = requestAnimationFrame(tick);
    }
  }

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

    // Direct GPU-friendly transform write — no layout reads.
    dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    ensureRunning();
  }

  function onWindowLeave() {
    visible = false;
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  }

  function onPointerOver(event) {
    const t = event.target;
    if (t && t.closest && t.closest(HOVER_SELECTOR)) {
      if (!hoverActive) {
        hoverActive = true;
        ring.dataset.hover = "true";
      }
    }
  }

  function onPointerOut(event) {
    if (!hoverActive) return;
    const related = event.relatedTarget;
    if (related && related.closest && related.closest(HOVER_SELECTOR)) return;
    hoverActive = false;
    ring.dataset.hover = "false";
  }

  function tick(now) {
    if (lastTickTime === null) {
      // First frame after (re)starting the loop — establish the clock
      // without moving, so a stale timestamp never produces a fake jump.
      lastTickTime = now;
      rafId = requestAnimationFrame(tick);
      return;
    }

    // Clamp so a long pause (backgrounded tab, big jank spike) doesn't
    // make the ring leap discontinuously on the next visible frame.
    const dt = Math.min(now - lastTickTime, 100);
    lastTickTime = now;

    const factor = 1 - Math.exp(-dt / EASE_TAU_MS);
    const dx = targetX - ringX;
    const dy = targetY - ringY;
    ringX += dx * factor;
    ringY += dy * factor;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

    // Sleep the rAF loop once the ring has caught up with the dot. It
    // resumes the instant the pointer next moves. Home already benefits
    // from a busy pointer field; the About/Projects/Contact/404 pages
    // often sit idle for long stretches, and this saves them the
    // constant frame cost.
    if (dx * dx + dy * dy < SETTLE_DIST_SQ) {
      ringX = targetX;
      ringY = targetY;
      running = false;
      rafId = null;
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function teardown() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    running = false;
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("mouseleave", onWindowLeave);
    reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
    dot.remove();
    ring.remove();
    delete document.body.dataset.customCursor;
  }

  function onReduceMotionChange(event) {
    if (event.matches) teardown();
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("mouseleave", onWindowLeave);

  // If the user flips on reduced-motion mid-session, remove the cursor
  // immediately rather than waiting for a reload.
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);
}
