/**
 * PURPOSE
 *   Contact-page-only ambient radar field. A soft radar sweep rotates slowly
 *   around an off-centre hub, with faint rings, technical guide lines and a
 *   few quiet signal blips. The scene should feel premium and alive, never
 *   busy or game-like.
 *
 * RESPONSIBILITIES
 *   - Inject a <canvas class="bg-fx bg-fx--contact"> as the first child of
 *     <body> and own its lifecycle.
 *   - Run a single requestAnimationFrame loop.
 *   - Pause when the tab is hidden.
 *   - Respect prefers-reduced-motion both on init and if the preference
 *     changes while the page is open.
 *
 * DEPENDENCIES
 *   assets/css/base.css (.bg-fx positioning + reduced-motion guard)
 *   assets/css/effects/contact-radar.css (page-scoped static surface layer)
 *   assets/css/tokens.css (--fx-contact-* tokens)
 */

export function initContactRadar() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.requestAnimationFrame !== "function") return;
  if (document.body?.dataset.page !== "contact") return;

  const SWEEP_PERIOD_MS = 18000;
  const SWEEP_ARC = Math.PI * 0.34;
  const TRACKING_EASE = 0.045;
  const IDLE_DRIFT_PERIOD_MS = 26000;
  const BLIP_AREA_DIVISOR = 52000;
  const BLIP_MIN = 8;
  const BLIP_MAX = 18;
  const BLIP_PING_WINDOW = 0.28;
  const GRID_STEP = 72;

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

  const FX_RING = parseColorTriplet(tok("--fx-contact-ring", "#6c7cff")) || "108, 124, 255";
  const FX_SWEEP = parseColorTriplet(tok("--fx-contact-sweep", "#aeb8ff")) || "174, 184, 255";
  const FX_LINE = parseColorTriplet(tok("--fx-contact-line", "#5b6376")) || "91, 99, 118";

  const canvas = document.createElement("canvas");
  canvas.className = "bg-fx bg-fx--contact";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rafId = null;
  let resizeTimer = null;

  const pointer = {
    x: width * 0.7,
    y: height * 0.52,
    tx: width * 0.7,
    ty: height * 0.52,
    active: false,
    lastMove: 0,
  };

  const center = {
    x: width * 0.72,
    y: height * 0.54,
    tx: width * 0.72,
    ty: height * 0.54,
  };

  let blips = [];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (pointer.tx > width) pointer.tx = width * 0.7;
    if (pointer.ty > height) pointer.ty = height * 0.52;
    if (pointer.x > width) pointer.x = width * 0.7;
    if (pointer.y > height) pointer.y = height * 0.52;

    center.x = width * 0.72;
    center.y = height * 0.54;
    center.tx = center.x;
    center.ty = center.y;

    seedBlipsIfNeeded();
  }

  function targetBlipCount() {
    const count = Math.round((width * height) / BLIP_AREA_DIVISOR);
    return Math.max(BLIP_MIN, Math.min(BLIP_MAX, count));
  }

  function makeBlip() {
    return {
      angle: Math.random() * Math.PI * 2,
      radiusRatio: 0.18 + Math.random() * 0.74,
      size: 1.2 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      energy: 0,
      bias: Math.random() * 0.18,
    };
  }

  function seedBlipsIfNeeded() {
    const target = targetBlipCount();
    if (blips.length === 0) {
      blips = Array.from({ length: target }, makeBlip);
      return;
    }
    while (blips.length < target) blips.push(makeBlip());
    if (blips.length > target) blips.length = target;
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

  function idlePointerTarget(now) {
    const t = (now / IDLE_DRIFT_PERIOD_MS) * Math.PI * 2;
    return {
      x: width * (0.74 + Math.sin(t) * 0.06),
      y: height * (0.54 + Math.cos(t * 1.3 + 0.6) * 0.05),
    };
  }

  function updateTracking(now) {
    if (!pointer.active && now - pointer.lastMove > 1200) {
      const idle = idlePointerTarget(now);
      pointer.tx = idle.x;
      pointer.ty = idle.y;
    }

    pointer.x += (pointer.tx - pointer.x) * TRACKING_EASE;
    pointer.y += (pointer.ty - pointer.y) * TRACKING_EASE;

    const nx = width ? (pointer.x / width) * 2 - 1 : 0;
    const ny = height ? (pointer.y / height) * 2 - 1 : 0;
    center.tx = width * 0.72 - nx * 18;
    center.ty = height * 0.54 - ny * 14;
    center.x += (center.tx - center.x) * 0.035;
    center.y += (center.ty - center.y) * 0.035;
  }

  function drawGrid() {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${FX_LINE}, 0.08)`;

    for (let x = Math.ceil(width * 0.48 / GRID_STEP) * GRID_STEP; x < width + GRID_STEP; x += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height + GRID_STEP; y += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(width * 0.44, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawRadarBase(maxRadius) {
    const halo = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxRadius * 1.08);
    halo.addColorStop(0, `rgba(${FX_SWEEP}, 0.05)`);
    halo.addColorStop(0.55, `rgba(${FX_SWEEP}, 0.018)`);
    halo.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(center.x, center.y, maxRadius * 1.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const radius = (maxRadius * i) / 4;
      ctx.strokeStyle = `rgba(${FX_RING}, ${0.07 + i * 0.02})`;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(${FX_LINE}, 0.18)`;
    ctx.beginPath();
    ctx.moveTo(center.x - maxRadius, center.y);
    ctx.lineTo(center.x + maxRadius, center.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - maxRadius);
    ctx.lineTo(center.x, center.y + maxRadius);
    ctx.stroke();
    ctx.restore();
  }

  function drawSweep(now, maxRadius) {
    const rotation = ((now % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS) * Math.PI * 2;
    const start = rotation - SWEEP_ARC;
    const end = rotation;

    const sweep = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxRadius);
    sweep.addColorStop(0, `rgba(${FX_SWEEP}, 0.16)`);
    sweep.addColorStop(0.45, `rgba(${FX_SWEEP}, 0.075)`);
    sweep.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.save();
    ctx.fillStyle = sweep;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, maxRadius, start, end);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = `rgba(${FX_RING}, 0.42)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x + Math.cos(rotation) * maxRadius, center.y + Math.sin(rotation) * maxRadius);
    ctx.stroke();
    ctx.restore();

    return rotation;
  }

  function normaliseAngle(angle) {
    let value = angle % (Math.PI * 2);
    if (value < 0) value += Math.PI * 2;
    return value;
  }

  function angleDistance(a, b) {
    const diff = Math.abs(normaliseAngle(a) - normaliseAngle(b));
    return Math.min(diff, Math.PI * 2 - diff);
  }

  function drawBlips(now, maxRadius, rotation) {
    for (let i = 0; i < blips.length; i++) {
      const blip = blips[i];
      const radius = maxRadius * blip.radiusRatio;
      const x = center.x + Math.cos(blip.angle) * radius;
      const y = center.y + Math.sin(blip.angle) * radius;
      const sweepDistance = angleDistance(rotation, blip.angle);
      const sweepBoost = Math.max(0, 1 - sweepDistance / BLIP_PING_WINDOW);
      blip.energy = Math.max(blip.energy * 0.94, sweepBoost);

      const drift = Math.sin(now * 0.0011 + blip.phase) * 0.5;
      const idleGlow = 0.22 + 0.18 * Math.sin(now * 0.0008 + blip.phase);
      const alpha = idleGlow + blip.energy * 0.62 + blip.bias;
      const haloRadius = blip.size * (4 + blip.energy * 8);

      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
      halo.addColorStop(0, `rgba(${FX_SWEEP}, ${Math.min(alpha * 0.34, 0.34)})`);
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${FX_SWEEP}, ${Math.min(alpha * 0.88, 0.92)})`;
      ctx.beginPath();
      ctx.arc(x, y, blip.size + drift + blip.energy * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFrame(now) {
    ctx.clearRect(0, 0, width, height);
    updateTracking(now);
    drawGrid();

    const maxRadius = Math.min(width, height) * 0.3;
    drawRadarBase(maxRadius);
    const rotation = drawSweep(now, maxRadius);
    drawBlips(now, maxRadius, rotation);

    ctx.strokeStyle = `rgba(${FX_RING}, 0.32)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
    ctx.stroke();

    const pulse = 0.9 + Math.sin((now / 4200) * Math.PI * 2) * 0.1;
    const core = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, 18);
    core.addColorStop(0, `rgba(${FX_RING}, ${0.32 * pulse})`);
    core.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 18, 0, Math.PI * 2);
    ctx.fill();

    rafId = window.requestAnimationFrame(drawFrame);
  }

  function start() {
    if (rafId === null) rafId = window.requestAnimationFrame(drawFrame);
  }

  function stop() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }

  function onVisibilityChange() {
    if (document.hidden) stop();
    else start();
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
