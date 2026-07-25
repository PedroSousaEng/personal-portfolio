/**
 * PURPOSE
 *   Occasional big rocket ship that flies straight across the viewport on
 *   the About page — enters from a random edge, exits toward a random
 *   point on another edge, then disappears until the next random spawn.
 *   Purely decorative, low-frequency (this should read as a rare surprise,
 *   not a repeating loop).
 *
 * RESPONSIBILITIES
 *   - Inject a <canvas class="bg-fx bg-fx--rocket"> appended as the LAST
 *     child of <body> (not prepended) so it paints above
 *     assets/js/effects/tech-network.js's canvas, which prepends itself as
 *     the first child — both sit at z-index -1 via .bg-fx, and painting
 *     order within an equal stacking level follows DOM order.
 *   - Own a single requestAnimationFrame loop; at most one rocket in
 *     flight at a time.
 *   - Pause while the tab is hidden; do nothing under
 *     prefers-reduced-motion (base.css also hides .bg-fx).
 *
 * DEPENDENCIES
 *   assets/css/base.css (.bg-fx sizing/stacking + reduced-motion guard).
 *   assets/css/tokens.css (--color-accent-amber, --fx-particle colour
 *   tokens — hull reads indigo, exhaust reads amber, matching the rest of
 *   the site's accent palette).
 *
 * SAFE EDITS
 *   Tunable constants are grouped at the top of initAboutRocket().
 */

export function initAboutRocket() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.requestAnimationFrame !== "function") return;
  if (document.body?.dataset.page !== "about") return;
  if (document.querySelector(".bg-fx--rocket")) return;

  // ---- Tunables ---------------------------------------------------------
  const SPAWN_DELAY_MIN_MS = 7000;  // shortest gap between flights
  const SPAWN_DELAY_MAX_MS = 18000; // longest gap between flights
  const CROSS_TIME_MIN_MS = 14000;  // slow, unhurried crossing — ~15s on screen
  const CROSS_TIME_MAX_MS = 16000;
  const ROCKET_LENGTH_RATIO = 0.045; // of min(width, height) — half the previous size
  const ROCKET_LENGTH_MIN = 35;
  const ROCKET_LENGTH_MAX = 75;
  const CURVE_STRENGTH_MIN = 0.18; // how far the flight path bows out, as a
  const CURVE_STRENGTH_MAX = 0.40; // fraction of the straight-line distance
  const TRAIL_POINTS = 26; // how many past positions feed the exhaust tail

  // ---- Colour tokens ------------------------------------------------------
  const rootStyles = getComputedStyle(document.documentElement);
  const tok = (name, fallback) => rootStyles.getPropertyValue(name).trim() || fallback;

  function parseColorTriplet(raw) {
    if (!raw) return null;
    const s = raw.trim();
    const commaMatch = s.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
    if (commaMatch) return `${commaMatch[1]}, ${commaMatch[2]}, ${commaMatch[3]}`;
    const rgbaMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbaMatch) return `${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}`;
    const hexMatch = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hexMatch)
      return `${parseInt(hexMatch[1], 16)}, ${parseInt(hexMatch[2], 16)}, ${parseInt(hexMatch[3], 16)}`;
    return null;
  }

  const FX_HULL = parseColorTriplet(tok("--fx-particle", "#aeb8ff")) || "174, 184, 255";
  const FX_HULL_DIM = parseColorTriplet(tok("--fx-particle-dim", "#5b6376")) || "91, 99, 118";
  const FX_FLAME = parseColorTriplet(tok("--fx-glow-cursor", "#6c7cff")) || "108, 124, 255";
  const FX_WINDOW = parseColorTriplet(tok("--color-accent-indigo", "#6c7cff")) || "108, 124, 255";

  // ---- Canvas setup -------------------------------------------------------
  const canvas = document.createElement("canvas");
  canvas.className = "bg-fx bg-fx--rocket";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas); // appended LAST -> paints above tech-network's canvas
  const ctx = canvas.getContext("2d", { alpha: true });

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- Rocket flight state ------------------------------------------------
  // Exactly one rocket may be in flight. `rocket` is null between flights.
  let rocket = null;
  let nextSpawnAt = performance.now() + rand(SPAWN_DELAY_MIN_MS, SPAWN_DELAY_MAX_MS);

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // Pick a random point on a random edge, a little outside the viewport so
  // the ship visibly enters/exits rather than popping in.
  function randomEdgePoint(margin) {
    const edge = Math.floor(Math.random() * 4); // 0 top, 1 right, 2 bottom, 3 left
    switch (edge) {
      case 0: return { x: rand(0, width), y: -margin };
      case 1: return { x: width + margin, y: rand(0, height) };
      case 2: return { x: rand(0, width), y: height + margin };
      default: return { x: -margin, y: rand(0, height) };
    }
  }

  function spawnRocket(now) {
    const length = Math.max(
      ROCKET_LENGTH_MIN,
      Math.min(ROCKET_LENGTH_MAX, Math.min(width, height) * ROCKET_LENGTH_RATIO)
    );
    const margin = length * 1.5;

    const from = randomEdgePoint(margin);
    let to = randomEdgePoint(margin);
    // Guard against a degenerate near-zero-length flight (both points
    // landing on the same edge close together) by re-rolling the target.
    let guard = 0;
    while (Math.hypot(to.x - from.x, to.y - from.y) < Math.min(width, height) * 0.5 && guard < 6) {
      to = randomEdgePoint(margin);
      guard += 1;
    }

    // Curvy path: bow the flight out to one side via a single control
    // point, offset perpendicular to the straight from->to line. The ship
    // then follows a quadratic bezier instead of a straight segment.
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const curveAmount = dist * rand(CURVE_STRENGTH_MIN, CURVE_STRENGTH_MAX) * (Math.random() < 0.5 ? -1 : 1);
    const control = {
      x: (from.x + to.x) / 2 + perpX * curveAmount,
      y: (from.y + to.y) / 2 + perpY * curveAmount,
    };

    const duration = rand(CROSS_TIME_MIN_MS, CROSS_TIME_MAX_MS);

    rocket = {
      from,
      to,
      control,
      startedAt: now,
      duration,
      angle: Math.atan2(dy, dx), // overwritten every frame once flight starts
      length,
      trail: [], // { x, y } most-recent-first, capped at TRAIL_POINTS
    };
  }

  function updateRocket(now) {
    if (!rocket) {
      if (now >= nextSpawnAt) spawnRocket(now);
      return;
    }

    const progress = (now - rocket.startedAt) / rocket.duration;
    if (progress >= 1) {
      rocket = null;
      nextSpawnAt = now + rand(SPAWN_DELAY_MIN_MS, SPAWN_DELAY_MAX_MS);
      return;
    }

    const t = progress;
    const oneMinusT = 1 - t;
    const { from, to, control } = rocket;

    // Position on the quadratic bezier from -> control -> to.
    const x =
      oneMinusT * oneMinusT * from.x + 2 * oneMinusT * t * control.x + t * t * to.x;
    const y =
      oneMinusT * oneMinusT * from.y + 2 * oneMinusT * t * control.y + t * t * to.y;

    // Tangent (derivative) of the same curve — used to orient the ship so
    // it visibly noses into the curve rather than sliding sideways.
    const tx = 2 * oneMinusT * (control.x - from.x) + 2 * t * (to.x - control.x);
    const ty = 2 * oneMinusT * (control.y - from.y) + 2 * t * (to.y - control.y);
    if (tx !== 0 || ty !== 0) {
      rocket.angle = Math.atan2(ty, tx);
    }

    rocket.trail.unshift({ x, y });
    if (rocket.trail.length > TRAIL_POINTS) rocket.trail.length = TRAIL_POINTS;

    rocket.x = x;
    rocket.y = y;
  }

  // Nose pointing along `angle`; drawn in local space then rotated/translated.
  function drawRocketBody(length) {
    const w = length * 0.34; // hull width

    // Engine glow (soft halo behind the exhaust, drawn first so the hull
    // and flame sit on top of it).
    const glowR = length * 0.9;
    const glow = ctx.createRadialGradient(-length * 0.55, 0, 0, -length * 0.55, 0, glowR);
    glow.addColorStop(0, `rgba(${FX_FLAME}, 0.45)`);
    glow.addColorStop(0.4, `rgba(${FX_FLAME}, 0.16)`);
    glow.addColorStop(1, `rgba(${FX_FLAME}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(-length * 0.55, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Flame (triangle trailing behind the tail, flickering length).
    const flicker = 0.75 + Math.random() * 0.35;
    ctx.beginPath();
    ctx.moveTo(-length * 0.5, -w * 0.28);
    ctx.lineTo(-length * (0.5 + 0.55 * flicker), 0);
    ctx.lineTo(-length * 0.5, w * 0.28);
    ctx.closePath();
    const flame = ctx.createLinearGradient(-length * 0.5, 0, -length * (0.5 + 0.55 * flicker), 0);
    flame.addColorStop(0, `rgba(${FX_FLAME}, 0.95)`);
    flame.addColorStop(1, `rgba(${FX_FLAME}, 0)`);
    ctx.fillStyle = flame;
    ctx.fill();

    // Fins (two small trapezoids near the tail).
    ctx.fillStyle = `rgba(${FX_HULL_DIM}, 0.9)`;
    ctx.beginPath();
    ctx.moveTo(-length * 0.32, -w * 0.32);
    ctx.lineTo(-length * 0.5, -w * 0.72);
    ctx.lineTo(-length * 0.18, -w * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-length * 0.32, w * 0.32);
    ctx.lineTo(-length * 0.5, w * 0.72);
    ctx.lineTo(-length * 0.18, w * 0.34);
    ctx.closePath();
    ctx.fill();

    // Hull: elongated capsule from tail to nose base, brushed-metal
    // gradient across its width so it reads as a cylinder, not a flat bar.
    const hullGradient = ctx.createLinearGradient(0, -w * 0.5, 0, w * 0.5);
    hullGradient.addColorStop(0, `rgba(${FX_HULL_DIM}, 0.95)`);
    hullGradient.addColorStop(0.5, `rgba(${FX_HULL}, 1)`);
    hullGradient.addColorStop(1, `rgba(${FX_HULL_DIM}, 0.95)`);
    ctx.fillStyle = hullGradient;
    ctx.beginPath();
    ctx.moveTo(-length * 0.5, -w * 0.5);
    ctx.lineTo(length * 0.28, -w * 0.5);
    ctx.quadraticCurveTo(length * 0.5, -w * 0.5, length * 0.5, 0);
    ctx.quadraticCurveTo(length * 0.5, w * 0.5, length * 0.28, w * 0.5);
    ctx.lineTo(-length * 0.5, w * 0.5);
    ctx.closePath();
    ctx.fill();

    // Window: small glowing porthole a third of the way back from the nose.
    const winX = length * 0.12;
    const winR = w * 0.22;
    const winGradient = ctx.createRadialGradient(
      winX - winR * 0.3, -winR * 0.3, 0,
      winX, 0, winR
    );
    winGradient.addColorStop(0, `rgba(${FX_WINDOW}, 0.95)`);
    winGradient.addColorStop(1, `rgba(${FX_WINDOW}, 0.25)`);
    ctx.fillStyle = winGradient;
    ctx.beginPath();
    ctx.arc(winX, 0, winR, 0, Math.PI * 2);
    ctx.fill();

    // Nose cone glint: a thin bright edge to sell "big metal ship catching
    // ambient light" rather than a flat silhouette.
    ctx.strokeStyle = `rgba(${FX_HULL}, 0.6)`;
    ctx.lineWidth = Math.max(1, length * 0.012);
    ctx.beginPath();
    ctx.moveTo(-length * 0.5, -w * 0.5);
    ctx.lineTo(length * 0.28, -w * 0.5);
    ctx.quadraticCurveTo(length * 0.5, -w * 0.5, length * 0.5, 0);
    ctx.stroke();
  }

  function drawTrail(trail) {
    if (trail.length < 2) return;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const t = i / trail.length; // 0 near ship, 1 near tail-end of trail
      const alpha = (1 - t) * 0.35;
      if (alpha < 0.01) continue;
      ctx.strokeStyle = `rgba(${FX_FLAME}, ${alpha})`;
      ctx.lineWidth = Math.max(0.5, (1 - t) * 5);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawRocket() {
    if (!rocket || rocket.x === undefined) return;

    drawTrail(rocket.trail);

    ctx.save();
    ctx.translate(rocket.x, rocket.y);
    ctx.rotate(rocket.angle);
    drawRocketBody(rocket.length);
    ctx.restore();
  }

  // ---- Main loop ----------------------------------------------------------
  let rafId = null;
  const FRAME_INTERVAL_MS = 1000 / 30;
  let lastFrameTime = 0;

  function frame(now) {
    if (now - lastFrameTime < FRAME_INTERVAL_MS) {
      rafId = window.requestAnimationFrame(frame);
      return;
    }
    lastFrameTime = now;

    ctx.clearRect(0, 0, width, height);
    updateRocket(now);
    drawRocket();

    // Perf fix: between flights (which is most of the time — a rocket is
    // only in view for a fraction of each spawn cycle) there is nothing to
    // draw and nothing changes frame-to-frame, yet this loop used to keep
    // calling requestAnimationFrame forever anyway, paying a full-viewport
    // clearRect 30x/sec for zero visual benefit. Once idle, sleep via
    // setTimeout until the next scheduled spawn (clamped so a resize/spawn
    // reschedule is never missed by more than ~250ms) instead of spinning
    // the rAF loop.
    if (rocket === null) {
      const idleFor = Math.max(50, Math.min(nextSpawnAt - now, 250));
      rafId = null;
      idleTimer = window.setTimeout(() => {
        idleTimer = null;
        if (running) rafId = window.requestAnimationFrame(frame);
      }, idleFor);
      return;
    }

    rafId = window.requestAnimationFrame(frame);
  }

  let running = false;
  let idleTimer = null;

  function start() {
    running = true;
    if (rafId === null && idleTimer === null) rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (idleTimer !== null) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function onVisibilityChange() {
    if (document.hidden) stop();
    else start();
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function onReduceMotionChange(event) {
    if (event.matches) {
      stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("resize", onResize, { passive: true });
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  resize();
  start();
}
