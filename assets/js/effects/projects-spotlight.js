/**
 * PURPOSE
 *   Ambient full-viewport spotlight background for the Projects page.
 *   A soft light pool follows the pointer with a smoothed response, plus
 *   ultra-subtle dust particles floating randomly in the deep background.
 *   No tracking lines — just the dust and glow.
 *   The effect should feel premium and technical, never loud.
 *
 * RESPONSIBILITIES
 *   - Inject a <canvas class="bg-fx bg-fx--projects"> as the first child of
 *     <body> and own its entire lifecycle.
 *   - Run a single requestAnimationFrame loop.
 *   - Pause when the tab is hidden.
 *   - Respect prefers-reduced-motion by doing nothing at init time and
 *     tearing down if the preference changes while the page is open.
 *
 * DEPENDENCIES
 *   assets/css/base.css (.bg-fx positioning + reduced-motion guard)
 *   assets/css/effects/projects-spotlight.css (page-scoped static washes)
 *   assets/css/tokens.css (--fx-projects-* colour tokens)
 *
 * SAFE EDITS
 *   Tune the constants grouped near the top. Keep this module self-contained:
 *   no DOM mutations beyond its own canvas.
 */

export function initProjectsSpotlight() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.requestAnimationFrame !== "function") return;
  if (document.body?.dataset.page !== "projects") return;
  if (document.querySelector(".bg-fx--projects")) return;

  const SPOTLIGHT_RADIUS = 320;
  const SPOTLIGHT_RADIUS_LARGE = 540;
  const TRACKING_EASE = 0.085;
  const IDLE_AFTER_MS = 1400;
  const IDLE_DRIFT_PERIOD_MS = 22000;
  const PULSE_PERIOD_MS = 3600;

  // Floating dust particles — drift around randomly rather than in
  // straight lines, and visible enough to actually notice.
  const DUST_COUNT = 42;
  const DUST_MAX_RADIUS = 2.4;
  const DUST_BASE_SPEED = 0.05; // base wander speed
  const DUST_TURN_RATE = 0.06; // max radians/frame the heading can drift by
  const DUST_TWINKLE_PERIOD_MS = 4200;

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
    if (hexMatch) {
      return `${parseInt(hexMatch[1], 16)}, ${parseInt(hexMatch[2], 16)}, ${parseInt(hexMatch[3], 16)}`;
    }
    return null;
  }

  const FX_CORE = parseColorTriplet(tok("--fx-projects-spotlight-core", "#6c7cff")) || "108, 124, 255";
  const FX_SOFT = parseColorTriplet(tok("--fx-projects-spotlight-soft", "#aeb8ff")) || "174, 184, 255";
  const FX_LINE = parseColorTriplet(tok("--fx-projects-line", "#5b6376")) || "91, 99, 118";

  const canvas = document.createElement("canvas");
  canvas.className = "bg-fx bg-fx--projects";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });

  // Cached window metrics — updated only on resize.
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rafId = null;
  let resizeTimer = null;

  // Ambient/decorative effect: capping to ~30fps halves CPU/GPU cost with
  // no perceptible loss of smoothness for a slow-tracking spotlight.
  const FRAME_INTERVAL_MS = 1000 / 24;
  let lastFrameTime = 0;

  // The base wash (top gradient + top-right corner glow) is completely
  // static: it depends only on width/height. Rendering it into an
  // offscreen canvas once per resize and blitting via drawImage every
  // frame replaces two createLinearGradient/createRadialGradient +
  // fillRect calls per frame with a single fast drawImage.
  const bgCanvas = document.createElement("canvas");
  const bgCtx = bgCanvas.getContext("2d", { alpha: true });

  function createRadialSprite(color, radius, stops) {
    const size = radius * 2;
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const spriteCtx = sprite.getContext("2d", { alpha: true });
    const gradient = spriteCtx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      gradient.addColorStop(stop[0], `rgba(${color}, ${stop[1]})`);
    }
    spriteCtx.fillStyle = gradient;
    spriteCtx.fillRect(0, 0, size, size);
    return sprite;
  }

  // The spotlight colour profiles are static. Pulse strength and position are
  // applied through destination alpha/coordinates, so the render loop does
  // not need to allocate two radial gradients every frame.
  const largeSpotlightSprite = createRadialSprite(FX_SOFT, SPOTLIGHT_RADIUS_LARGE, [
    [0, 1],
    [0.42, 0.4375],
    [1, 0],
  ]);
  const coreSpotlightSprite = createRadialSprite(FX_CORE, SPOTLIGHT_RADIUS, [
    [0, 1],
    [0.28, 0.5],
    [0.72, 0.09375],
    [1, 0],
  ]);

  const pointer = {
    x: width * 0.5,
    y: height * 0.35,
    tx: width * 0.5,
    ty: height * 0.35,
    active: false,
    lastMove: 0,
  };

  // ---- Floating dust particles ----
  let dustParticles = [];

  function makeDustParticle() {
    const heading = Math.random() * Math.PI * 2;
    const speed = DUST_BASE_SPEED * (0.5 + Math.random());
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      heading, // direction of travel, in radians — wanders over time
      speed,
      r: 0.8 + Math.random() * DUST_MAX_RADIUS,
      twinklePhase: Math.random() * Math.PI * 2,
      life: Math.random(), // Random start opacity
    };
  }

  function initDustParticles() {
    dustParticles = Array.from({ length: DUST_COUNT }, makeDustParticle);
  }

  function updateAndDrawDust(now) {
    for (let i = 0; i < dustParticles.length; i++) {
      const p = dustParticles[i];

      // Random-walk the heading a little each frame instead of drifting in
      // a straight line — this is what actually reads as "flying around
      // randomly" rather than gentle linear drift.
      p.heading += (Math.random() - 0.5) * DUST_TURN_RATE;
      p.x += Math.cos(p.heading) * p.speed;
      p.y += Math.sin(p.heading) * p.speed;

      // Wrap around edges
      if (p.x < -5) p.x = width + 5;
      if (p.x > width + 5) p.x = -5;
      if (p.y < -5) p.y = height + 5;
      if (p.y > height + 5) p.y = -5;

      // Twinkle: gentle pulsing brightness
      const twinkle = 0.5 + 0.5 * Math.sin(now / DUST_TWINKLE_PERIOD_MS + p.twinklePhase);

      // Draw dust mote — visible, but still soft and ambient.
      ctx.fillStyle = `rgba(${FX_SOFT}, ${twinkle * 0.4})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rebuild the cached background wash for the new viewport size.
    bgCanvas.width = Math.round(width * dpr);
    bgCanvas.height = Math.round(height * dpr);
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.clearRect(0, 0, width, height);

    const topWash = bgCtx.createLinearGradient(0, 0, 0, height * 0.72);
    topWash.addColorStop(0, `rgba(${FX_LINE}, 0.18)`);
    topWash.addColorStop(0.45, `rgba(${FX_LINE}, 0.07)`);
    topWash.addColorStop(1, `rgba(${FX_LINE}, 0)`);
    bgCtx.fillStyle = topWash;
    bgCtx.fillRect(0, 0, width, height);

    const cornerWash = bgCtx.createRadialGradient(
      width * 0.82, height * 0.18, 0,
      width * 0.82, height * 0.18, Math.max(width, height) * 0.42
    );
    cornerWash.addColorStop(0, `rgba(${FX_SOFT}, 0.08)`);
    cornerWash.addColorStop(1, `rgba(${FX_SOFT}, 0)`);
    bgCtx.fillStyle = cornerWash;
    bgCtx.fillRect(0, 0, width, height);

    initDustParticles();
  }

  function onPointerMove(event) {
    pointer.tx = event.clientX;
    pointer.ty = event.clientY;
    pointer.active = true;
    pointer.lastMove = performance.now();
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  function updatePointer(now) {
    if (!pointer.active && now - pointer.lastMove > IDLE_AFTER_MS) {
      const t = (now / IDLE_DRIFT_PERIOD_MS) * Math.PI * 2;
      pointer.tx = width * (0.5 + Math.sin(t) * 0.18);
      pointer.ty = height * (0.34 + Math.sin(t * 1.37 + 0.9) * 0.12);
    }

    pointer.x += (pointer.tx - pointer.x) * TRACKING_EASE;
    pointer.y += (pointer.ty - pointer.y) * TRACKING_EASE;
  }

  function drawSpotlight(now) {
    const pulse = 0.92 + Math.sin((now / PULSE_PERIOD_MS) * Math.PI * 2) * 0.08;

    const lx = pointer.x - SPOTLIGHT_RADIUS_LARGE;
    const ly = pointer.y - SPOTLIGHT_RADIUS_LARGE;
    const lw = SPOTLIGHT_RADIUS_LARGE * 2;
    ctx.globalAlpha = 0.08 * pulse;
    ctx.drawImage(largeSpotlightSprite, lx, ly, lw, lw);

    const cx = pointer.x - SPOTLIGHT_RADIUS;
    const cy = pointer.y - SPOTLIGHT_RADIUS;
    const cw = SPOTLIGHT_RADIUS * 2;
    ctx.globalAlpha = 0.16 * pulse;
    ctx.drawImage(coreSpotlightSprite, cx, cy, cw, cw);
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (now - lastFrameTime < FRAME_INTERVAL_MS) {
      rafId = window.requestAnimationFrame(frame);
      return;
    }
    lastFrameTime = now;

    ctx.clearRect(0, 0, width, height);
    updatePointer(now);
    // Blit the pre-rendered static base wash instead of rebuilding it.
    ctx.drawImage(bgCanvas, 0, 0, width, height);
    drawSpotlight(now);
    updateAndDrawDust(now);
    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (rafId === null) rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function destroy() {
    stop();
    clearTimeout(resizeTimer);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }

  function onVisibilityChange() {
    if (document.hidden) stop();
    else start();
  }

  function onReduceMotionChange(event) {
    if (event.matches) destroy();
  }

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  resize();
  start();
}
