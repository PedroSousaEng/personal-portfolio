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
  if (document.querySelector(".bg-fx--contact")) return;

  const SWEEP_PERIOD_MS = 18000;
  const SWEEP_ARC = Math.PI * 0.34;
  const TRACKING_EASE = 0.045;
  const IDLE_DRIFT_PERIOD_MS = 26000;
  const BLIP_AREA_DIVISOR = 52000;
  const BLIP_MIN = 8;
  const BLIP_MAX = 18;
  const BLIP_PING_WINDOW = 0.28;
  const GRID_STEP = 72;
  const TAU = Math.PI * 2;

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
  const RING_COLOR = `rgb(${FX_RING})`;
  const SWEEP_COLOR = `rgb(${FX_SWEEP})`;

  const canvas = document.createElement("canvas");
  canvas.className = "bg-fx bg-fx--contact";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });

  // Static-background offscreen cache: the grid + concentric rings +
  // crosshair axes depend only on width/height/center. Re-render only
  // on resize; blit each frame with a single drawImage.
  const bgCanvas = document.createElement("canvas");
  const bgCtx = bgCanvas.getContext("2d", { alpha: true });

  function createGlowSprite(color, radius) {
    const size = radius * 2;
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const spriteCtx = sprite.getContext("2d", { alpha: true });
    const gradient = spriteCtx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, `rgb(${color})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    spriteCtx.fillStyle = gradient;
    spriteCtx.fillRect(0, 0, size, size);
    return sprite;
  }

  // These gradients are centre-independent and are only scaled/positioned in
  // the frame loop. Keeping them as sprites avoids rebuilding 8–18 blip
  // gradients plus the centre glow every frame.
  const blipHaloSprite = createGlowSprite(FX_SWEEP, 64);
  const centerGlowSprite = createGlowSprite(FX_RING, 32);

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let maxRadius = 0;
  let rafId = null;
  let resizeTimer = null;

  // Ambient/decorative effect: capping to ~30fps halves CPU/GPU cost with
  // no perceptible loss of smoothness for a slow radar sweep.
  const FRAME_INTERVAL_MS = 1000 / 30;
  let lastFrameTime = 0;

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
    maxRadius = Math.min(width, height) * 0.3;

    // Rebuild the cached static layer: grid + rings + crosshair axes.
    bgCanvas.width = Math.round(width * dpr);
    bgCanvas.height = Math.round(height * dpr);
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.clearRect(0, 0, width, height);

    // Grid.
    bgCtx.lineWidth = 1;
    bgCtx.strokeStyle = `rgba(${FX_LINE}, 0.08)`;
    for (let x = Math.ceil(width * 0.48 / GRID_STEP) * GRID_STEP; x < width + GRID_STEP; x += GRID_STEP) {
      bgCtx.beginPath();
      bgCtx.moveTo(x, 0);
      bgCtx.lineTo(x, height);
      bgCtx.stroke();
    }
    for (let y = 0; y < height + GRID_STEP; y += GRID_STEP) {
      bgCtx.beginPath();
      bgCtx.moveTo(width * 0.44, y);
      bgCtx.lineTo(width, y);
      bgCtx.stroke();
    }

    // Radar halo (radial fill) — static because it's centred on the
    // resting center; the animated center drift is small enough that
    // baking it once is visually indistinguishable.
    const halo = bgCtx.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxRadius * 1.08);
    halo.addColorStop(0, `rgba(${FX_SWEEP}, 0.05)`);
    halo.addColorStop(0.55, `rgba(${FX_SWEEP}, 0.018)`);
    halo.addColorStop(1, "rgba(0, 0, 0, 0)");
    bgCtx.fillStyle = halo;
    bgCtx.beginPath();
    bgCtx.arc(center.x, center.y, maxRadius * 1.08, 0, TAU);
    bgCtx.fill();

    // Concentric rings.
    bgCtx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const radius = (maxRadius * i) / 4;
      bgCtx.strokeStyle = `rgba(${FX_RING}, ${0.07 + i * 0.02})`;
      bgCtx.beginPath();
      bgCtx.arc(center.x, center.y, radius, 0, TAU);
      bgCtx.stroke();
    }

    // Crosshair axes.
    bgCtx.strokeStyle = `rgba(${FX_LINE}, 0.18)`;
    bgCtx.beginPath();
    bgCtx.moveTo(center.x - maxRadius, center.y);
    bgCtx.lineTo(center.x + maxRadius, center.y);
    bgCtx.stroke();
    bgCtx.beginPath();
    bgCtx.moveTo(center.x, center.y - maxRadius);
    bgCtx.lineTo(center.x, center.y + maxRadius);
    bgCtx.stroke();

    seedBlipsIfNeeded();
  }

  function targetBlipCount() {
    const count = Math.round((width * height) / BLIP_AREA_DIVISOR);
    return Math.max(BLIP_MIN, Math.min(BLIP_MAX, count));
  }

  function makeBlip() {
    return {
      angle: Math.random() * TAU,
      radiusRatio: 0.18 + Math.random() * 0.74,
      size: 1.2 + Math.random() * 2.2,
      phase: Math.random() * TAU,
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

  function updateTracking(now) {
    if (!pointer.active && now - pointer.lastMove > 1200) {
      const t = (now / IDLE_DRIFT_PERIOD_MS) * TAU;
      pointer.tx = width * (0.74 + Math.sin(t) * 0.06);
      pointer.ty = height * (0.54 + Math.cos(t * 1.3 + 0.6) * 0.05);
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

  function drawSweep(now) {
    const rotation = ((now % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS) * TAU;
    const start = rotation - SWEEP_ARC;
    const end = rotation;

    const sweep = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxRadius);
    sweep.addColorStop(0, `rgba(${FX_SWEEP}, 0.16)`);
    sweep.addColorStop(0.45, `rgba(${FX_SWEEP}, 0.075)`);
    sweep.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = sweep;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, maxRadius, start, end);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(${FX_RING}, 0.42)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x + Math.cos(rotation) * maxRadius, center.y + Math.sin(rotation) * maxRadius);
    ctx.stroke();

    return rotation;
  }

  function angleDistance(a, b) {
    let na = a % TAU; if (na < 0) na += TAU;
    let nb = b % TAU; if (nb < 0) nb += TAU;
    const diff = Math.abs(na - nb);
    return diff > Math.PI ? TAU - diff : diff;
  }

  function drawBlips(now, rotation) {
    const cx = center.x;
    const cy = center.y;
    for (let i = 0; i < blips.length; i++) {
      const blip = blips[i];
      const radius = maxRadius * blip.radiusRatio;
      const x = cx + Math.cos(blip.angle) * radius;
      const y = cy + Math.sin(blip.angle) * radius;
      const sweepDistance = angleDistance(rotation, blip.angle);
      const sweepBoost = Math.max(0, 1 - sweepDistance / BLIP_PING_WINDOW);
      blip.energy = Math.max(blip.energy * 0.94, sweepBoost);

      const drift = Math.sin(now * 0.0011 + blip.phase) * 0.5;
      const idleGlow = 0.22 + 0.18 * Math.sin(now * 0.0008 + blip.phase);
      const alpha = idleGlow + blip.energy * 0.62 + blip.bias;
      const haloRadius = blip.size * (4 + blip.energy * 8);

      ctx.globalAlpha = Math.min(alpha * 0.34, 0.34);
      ctx.drawImage(
        blipHaloSprite,
        x - haloRadius,
        y - haloRadius,
        haloRadius * 2,
        haloRadius * 2
      );

      ctx.globalAlpha = Math.min(alpha * 0.88, 0.92);
      ctx.fillStyle = SWEEP_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, blip.size + drift + blip.energy * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFrame(now) {
    if (now - lastFrameTime < FRAME_INTERVAL_MS) {
      rafId = window.requestAnimationFrame(drawFrame);
      return;
    }
    lastFrameTime = now;

    ctx.clearRect(0, 0, width, height);
    updateTracking(now);

    // Blit the pre-rendered static layer (grid + rings + crosshair).
    ctx.drawImage(bgCanvas, 0, 0, width, height);

    const rotation = drawSweep(now);
    drawBlips(now, rotation);

    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = RING_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 6, 0, TAU);
    ctx.stroke();

    const pulse = 0.9 + Math.sin((now / 4200) * TAU) * 0.1;
    ctx.globalAlpha = 0.32 * pulse;
    ctx.drawImage(centerGlowSprite, center.x - 18, center.y - 18, 36, 36);
    ctx.globalAlpha = 1;

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
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  resize();
  start();
}
