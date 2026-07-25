/**
 * PURPOSE
 *   About page only: the avatar portrait subtly tilts toward the cursor's
 *   position anywhere in the viewport (not just while hovering the image
 *   itself), like it's gently watching the pointer.
 *
 * RESPONSIBILITIES
 *   - Track the pointer document-wide, cache the avatar's rect (refreshed
 *     on resize/scroll only, never read inside the move handler).
 *   - Ease the rotation toward its target with a lerp, so the motion reads
 *     as a gentle drift rather than a snap.
 *   - Pause the rAF loop once the tilt has settled near its target and the
 *     pointer is idle, matching the idle-stop pattern in cursor.js.
 *   - No-op entirely on touch/coarse-pointer devices and under
 *     prefers-reduced-motion, tearing itself down if the preference
 *     changes mid-session.
 *
 * SAFE EDITS
 *   Tune MAX_TILT_DEG / EASE below. This module only ever writes
 *   transform on the avatar element — no other file should set it.
 */

const MAX_TILT_DEG = 7;
const EASE = 0.08;
const SETTLE_DEG_SQ = 0.01;

export function initAvatarTilt() {
  if (document.body?.dataset.page !== "about") return;

  const avatar = document.querySelector(".about-avatar");
  if (!avatar) return;

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (reduceMotionQuery.matches || !finePointerQuery.matches) return;

  let rect = avatar.getBoundingClientRect();
  let targetRotX = 0;
  let targetRotY = 0;
  let rotX = 0;
  let rotY = 0;
  let rafId = null;

  function refreshRect() {
    rect = avatar.getBoundingClientRect();
  }

  function onPointerMove(event) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Normalize against the viewport, not the (small) avatar rect, so the
    // tilt reads as "aware of the whole page" rather than only reacting
    // once the pointer is already close.
    const nx = (event.clientX - cx) / (window.innerWidth / 2);
    const ny = (event.clientY - cy) / (window.innerHeight / 2);

    targetRotY = Math.max(-1, Math.min(1, nx)) * MAX_TILT_DEG;
    targetRotX = Math.max(-1, Math.min(1, -ny)) * MAX_TILT_DEG;

    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    const dx = targetRotX - rotX;
    const dy = targetRotY - rotY;
    rotX += dx * EASE;
    rotY += dy * EASE;

    avatar.style.transform = `perspective(700px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;

    if (dx * dx + dy * dy < SETTLE_DEG_SQ) {
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
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", refreshRect);
    window.removeEventListener("scroll", refreshRect);
    reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
    avatar.style.transform = "";
  }

  function onReduceMotionChange(event) {
    if (event.matches) teardown();
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("resize", refreshRect, { passive: true });
  window.addEventListener("scroll", refreshRect, { passive: true });
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);
}
