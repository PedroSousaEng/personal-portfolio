/**
 * PURPOSE
 *   Ambient full-viewport spotlight background for the Projects page.
 *   A soft light pool follows the pointer with a smoothed response, plus
 *   faint tracking lines and a slow idle drift when the pointer stops.
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

  const SPOTLIGHT_RADIUS = 320;
  const SPOTLIGHT_RADIUS_LARGE = 540;
  const TRACKING_EASE = 0.085;
  const IDLE_AFTER_MS = 1400;
  const IDLE_DRIFT_PERIOD_MS = 22000;
  const LINE_FADE_RADIUS = 180;
  const PULSE_PERIOD_MS = 3600;

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

  const ctx = canvas.getContext("2d");
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rafId = null;
  let resizeTimer = null;

  const pointer = {
    x: width * 0.5,
    y: height * 0.35,
    tx: width * 0.5,
    ty: height * 0.35,
    active: false,
    lastMove: 0,
  };

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  function idleTarget(now) {
    const t = (now / IDLE_DRIFT_PERIOD_MS) * Math.PI * 2;
    return {
      x: width * (0.5 + Math.sin(t) * 0.18),
      y: height * (0.34 + Math.sin(t * 1.37 + 0.9) * 0.12),
    };
  }

  function updatePointer(now) {
    if (!pointer.active && now - pointer.lastMove > IDLE_AFTER_MS) {
      const target = idleTarget(now);
      pointer.tx = target.x;
      pointer.ty = target.y;
    }

    pointer.x += (pointer.tx - pointer.x) * TRACKING_EASE;
    pointer.y += (pointer.ty - pointer.y) * TRACKING_EASE;
  }

  function drawBaseWash() {
    const topWash = ctx.createLinearGradient(0, 0, 0, height * 0.72);
    topWash.addColorStop(0, `rgba(${FX_LINE}, 0.18)`);
    topWash.addColorStop(0.45, `rgba(${FX_LINE}, 0.07)`);
    topWash.addColorStop(1, `rgba(${FX_LINE}, 0)`);
    ctx.fillStyle = topWash;
    ctx.fillRect(0, 0, width, height);

    const cornerWash = ctx.createRadialGradient(width * 0.82, height * 0.18, 0, width * 0.82, height * 0.18, Math.max(width, height) * 0.42);
    cornerWash.addColorStop(0, `rgba(${FX_SOFT}, 0.08)`);
    cornerWash.addColorStop(1, `rgba(${FX_SOFT}, 0)`);
    ctx.fillStyle = cornerWash;
    ctx.fillRect(0, 0, width, height);
  }

  function drawSpotlight(now) {
    const pulse = 0.92 + Math.sin((now / PULSE_PERIOD_MS) * Math.PI * 2) * 0.08;

    const large = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, SPOTLIGHT_RADIUS_LARGE);
    large.addColorStop(0, `rgba(${FX_SOFT}, ${0.08 * pulse})`);
    large.addColorStop(0.42, `rgba(${FX_SOFT}, ${0.035 * pulse})`);
    large.addColorStop(1, `rgba(${FX_SOFT}, 0)`);
    ctx.fillStyle = large;
    ctx.fillRect(0, 0, width, height);

    const core = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, SPOTLIGHT_RADIUS);
    core.addColorStop(0, `rgba(${FX_CORE}, ${0.16 * pulse})`);
    core.addColorStop(0.28, `rgba(${FX_CORE}, ${0.08 * pulse})`);
    core.addColorStop(0.72, `rgba(${FX_CORE}, 0.015)`);
    core.addColorStop(1, `rgba(${FX_CORE}, 0)`);
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTrackingLines() {
    const xGradient = ctx.createLinearGradient(pointer.x - LINE_FADE_RADIUS, 0, pointer.x + LINE_FADE_RADIUS, 0);
    xGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    xGradient.addColorStop(0.5, `rgba(${FX_LINE}, 0.22)`);
    xGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.strokeStyle = xGradient;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pointer.x, 0);
    ctx.lineTo(pointer.x, height);
    ctx.stroke();

    const yGradient = ctx.createLinearGradient(0, pointer.y - LINE_FADE_RADIUS, 0, pointer.y + LINE_FADE_RADIUS);
    yGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    yGradient.addColorStop(0.5, `rgba(${FX_LINE}, 0.16)`);
    yGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.strokeStyle = yGradient;
    ctx.beginPath();
    ctx.moveTo(0, pointer.y);
    ctx.lineTo(width, pointer.y);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${FX_CORE}, 0.22)`;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  function frame(now) {
    ctx.clearRect(0, 0, width, height);
    updatePointer(now);
    drawBaseWash();
    drawSpotlight(now);
    drawTrackingLines();
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
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  resize();
  start();
}
