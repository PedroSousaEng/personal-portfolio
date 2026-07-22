/**
 * PURPOSE
 *   Draw and simulate the signature pendulum: a real (small-angle) pendulum
 *   whose swing is driven by scroll energy rather than a scripted timeline.
 *
 * RESPONSIBILITIES
 *   - Own the physics state (angle, angular velocity) and the canvas draw
 *     call. Nothing else in the codebase touches pendulum state.
 *   - Convert scroll deltas into angular-velocity "kicks."
 *   - Increase damping as the reader nears the end of the page, so the
 *     pendulum settles — never stopped abruptly, always eased to rest.
 *   - Dispatch a `pendulum:cross` event on `document` each time the bob
 *     crosses center, so other modules (scroll-reveal.js) can sync to it
 *     without depending on pendulum internals.
 *
 * DEPENDENCIES
 *   A `.pendulum` element with a `<canvas>` child must exist in the page
 *   (added to every page's markup right after <body>). Reads pendulum-*
 *   and dust-color tokens indirectly via getComputedStyle so the physics
 *   layer never hardcodes a color.
 *
 * SAFE EDITS
 *   Tune GRAVITY / DAMPING / SCROLL_GAIN below to change how lively the
 *   swing feels. Do not add unrelated DOM work here — see scroll-reveal.js.
 */

const GRAVITY = 1.6;          // angular acceleration constant (tuned for feel, not real units)
const BASE_DAMPING = 0.045;   // natural energy loss per frame
const REST_DAMPING = 0.16;    // extra damping applied near the end of the page
const SCROLL_GAIN = 0.00085;  // how much one pixel of scroll delta adds to angular velocity
const MAX_KICK = 0.045;       // clamp so a fast flick-scroll can't send it wild
const REST_THRESHOLD = 0.0006; // below this combined energy, treat as "at rest"

function initPendulum() {
  const root = document.querySelector('.pendulum');
  if (!root) return;
  const canvas = root.querySelector('canvas');
  if (!canvas) return;

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotionQuery.matches) {
    // Static, resting pendulum only — no listeners, no rAF loop.
    drawFrame(canvas, 0);
    return;
  }

  let theta = 0.12; // small resting tilt so the very first frame isn't dead-vertical
  let omega = 0;
  let lastScrollY = window.scrollY;
  let lastCrossSign = Math.sign(theta) || 1;

  function scrollProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  function onScroll() {
    const y = window.scrollY;
    const delta = y - lastScrollY;
    lastScrollY = y;
    const kick = Math.min(MAX_KICK, Math.max(-MAX_KICK, delta * SCROLL_GAIN));
    omega += kick;
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  function step() {
    const progress = scrollProgress();
    // Ease damping up over the last ~12% of the page so the pendulum comes
    // to rest by the time the reader reaches the bottom, rather than
    // snapping still.
    const restBlend = Math.max(0, (progress - 0.88) / 0.12);
    const damping = BASE_DAMPING + restBlend * REST_DAMPING;

    const angularAccel = -GRAVITY * Math.sin(theta) - damping * omega;
    omega += angularAccel * 0.12;
    theta += omega * 0.12;

    const energy = Math.abs(omega) + Math.abs(theta);
    if (energy < REST_THRESHOLD) {
      theta = 0;
      omega = 0;
    }

    const sign = Math.sign(theta) || lastCrossSign;
    if (sign !== lastCrossSign && Math.abs(theta) > 0.002) {
      lastCrossSign = sign;
      document.dispatchEvent(new CustomEvent('pendulum:cross'));
    }

    drawFrame(canvas, theta);
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);

  // If the user's system preference changes mid-session, stop reacting to
  // scroll and freeze at rest rather than fighting the new preference.
  reduceMotionQuery.addEventListener('change', (event) => {
    if (event.matches) {
      window.removeEventListener('scroll', onScroll);
      drawFrame(canvas, 0);
    }
  });
}

function drawFrame(canvas, theta) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const styles = getComputedStyle(canvas);
  const rodLight = styles.getPropertyValue('--pendulum-rod-light').trim() || '#d8dbe2';
  const rodDark = styles.getPropertyValue('--pendulum-rod-dark').trim() || '#5b6070';
  const bobLight = styles.getPropertyValue('--pendulum-bob-light').trim() || '#eef0f4';
  const bobMid = styles.getPropertyValue('--pendulum-bob-mid').trim() || '#aeb3c0';
  const bobDark = styles.getPropertyValue('--pendulum-bob-dark').trim() || '#33364a';
  const shadow = styles.getPropertyValue('--pendulum-shadow').trim() || 'rgba(0,0,0,0.45)';

  // Pivot sits above the visible canvas so the attachment point is never seen.
  const pivotX = width / 2;
  const pivotY = -18;
  const rodLength = height * 0.86;
  const bobRadius = Math.max(7, width * 0.16);

  const bobX = pivotX + rodLength * Math.sin(theta);
  const bobY = pivotY + rodLength * Math.cos(theta);

  // Rod: brushed-aluminium gradient along its length.
  const rodGradient = ctx.createLinearGradient(pivotX, pivotY, bobX, bobY);
  rodGradient.addColorStop(0, rodDark);
  rodGradient.addColorStop(0.5, rodLight);
  rodGradient.addColorStop(1, rodDark);
  ctx.strokeStyle = rodGradient;
  ctx.lineWidth = Math.max(1.5, width * 0.02);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.stroke();

  // Bob: machined-steel sphere — radial gradient plus a soft contact shadow.
  ctx.beginPath();
  ctx.ellipse(bobX, bobY + bobRadius * 0.85, bobRadius * 0.8, bobRadius * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = shadow;
  ctx.filter = 'blur(3px)';
  ctx.fill();
  ctx.filter = 'none';

  const bobGradient = ctx.createRadialGradient(
    bobX - bobRadius * 0.35,
    bobY - bobRadius * 0.4,
    bobRadius * 0.1,
    bobX,
    bobY,
    bobRadius
  );
  bobGradient.addColorStop(0, bobLight);
  bobGradient.addColorStop(0.55, bobMid);
  bobGradient.addColorStop(1, bobDark);
  ctx.beginPath();
  ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
  ctx.fillStyle = bobGradient;
  ctx.fill();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPendulum);
} else {
  initPendulum();
}
