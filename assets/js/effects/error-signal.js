/**
 * PURPOSE
 *   404-page ambient error/interference background. Quiet broken signal lines,
 *   drifting bars and a restrained glitch pulse reinforce the not-found state
 *   without becoming noisy or playful in the wrong way.
 *
 * RESPONSIBILITIES
 *   - Inject a <canvas class="bg-fx bg-fx--404"> as the first child of
 *     <body> and own its lifecycle.
 *   - Run a single requestAnimationFrame loop.
 *   - Pause when the tab is hidden.
 *   - Respect prefers-reduced-motion at init time and react to preference
 *     changes while the page is open.
 *
 * DEPENDENCIES
 *   assets/css/base.css (.bg-fx positioning + reduced-motion guard)
 *   assets/css/effects/error-signal.css (page-scoped static layer)
 *   assets/css/tokens.css (--fx-404-* tokens)
 */

export function initErrorSignal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.requestAnimationFrame !== "function") return;
  if (document.body?.dataset.page !== "404") return;

  const SEGMENT_AREA_DIVISOR = 36000;
  const SEGMENT_MIN = 18;
  const SEGMENT_MAX = 34;
  const TRACK_EASE = 0.035;
  const GLITCH_MIN_MS = 3200;
  const GLITCH_MAX_MS = 7600;
  const GLITCH_DURATION_MS = 160;
  const BAR_COUNT = 5;

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

  const FX_LINE = parseColorTriplet(tok("--fx-404-line", "#5b6376")) || "91, 99, 118";
  const FX_GLITCH = parseColorTriplet(tok("--fx-404-glitch", "#6c7cff")) || "108, 124, 255";
  const FX_SOFT = parseColorTriplet(tok("--fx-404-soft", "#aeb8ff")) || "174, 184, 255";

  const canvas = document.createElement("canvas");
  canvas.className = "bg-fx bg-fx--404";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });

  // Static-background offscreen cache for the base radial glow — depends
  // only on viewport size, so re-rendering it every frame is pure waste.
  const bgCanvas = document.createElement("canvas");
  const bgCtx = bgCanvas.getContext("2d", { alpha: true });

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rafId = null;
  let resizeTimer = null;

  const pointer = {
    x: width * 0.5,
    y: height * 0.5,
    tx: width * 0.5,
    ty: height * 0.5,
  };

  let segments = [];
  let bars = [];
  let nextGlitchAt = performance.now() + 4200;
  let glitchUntil = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rebuild the cached base radial glow.
    bgCanvas.width = Math.round(width * dpr);
    bgCanvas.height = Math.round(height * dpr);
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.clearRect(0, 0, width, height);
    const glow = bgCtx.createRadialGradient(
      width * 0.52, height * 0.42, 0,
      width * 0.52, height * 0.42, Math.max(width, height) * 0.42
    );
    glow.addColorStop(0, `rgba(${FX_SOFT}, 0.06)`);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    bgCtx.fillStyle = glow;
    bgCtx.fillRect(0, 0, width, height);

    seedSegments();
    seedBars();
  }

  function segmentCount() {
    const count = Math.round((width * height) / SEGMENT_AREA_DIVISOR);
    return Math.max(SEGMENT_MIN, Math.min(SEGMENT_MAX, count));
  }

  function makeSegment() {
    const horizontal = Math.random() > 0.32;
    const len = horizontal
      ? 70 + Math.random() * 180
      : 40 + Math.random() * 140;

    return {
      horizontal,
      x: Math.random() * width,
      y: Math.random() * height,
      len,
      gap: 14 + Math.random() * 34,
      thickness: 1 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      drift: 10 + Math.random() * 26,
      alpha: 0.06 + Math.random() * 0.14,
      glitchBias: Math.random(),
    };
  }

  function seedSegments() {
    const target = segmentCount();
    // Reuse the array; only allocate the tail when growing.
    if (segments.length < target) {
      while (segments.length < target) segments.push(makeSegment());
    } else if (segments.length > target) {
      segments.length = target;
    }
    // Re-scatter existing segments across the new viewport so they don't
    // clump in the old rect after a resize.
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (s.x > width) s.x = Math.random() * width;
      if (s.y > height) s.y = Math.random() * height;
    }
  }

  function makeBar(index) {
    return {
      yRatio: (index + 1) / (BAR_COUNT + 1),
      widthRatio: 0.12 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0002 + Math.random() * 0.00018,
      opacity: 0.025 + Math.random() * 0.03,
    };
  }

  function seedBars() {
    if (bars.length !== BAR_COUNT) {
      bars = Array.from({ length: BAR_COUNT }, (_, index) => makeBar(index));
    }
  }

  function onPointerMove(event) {
    pointer.tx = event.clientX;
    pointer.ty = event.clientY;
  }

  function updatePointer() {
    pointer.x += (pointer.tx - pointer.x) * TRACK_EASE;
    pointer.y += (pointer.ty - pointer.y) * TRACK_EASE;
  }

  function scheduleNextGlitch(now) {
    nextGlitchAt = now + GLITCH_MIN_MS + Math.random() * (GLITCH_MAX_MS - GLITCH_MIN_MS);
  }

  function drawBars(now, glitching) {
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const y = height * bar.yRatio + Math.sin(now * bar.speed + bar.phase) * 18;
      const x = width * (0.15 + Math.sin(now * bar.speed * 0.6 + bar.phase) * 0.16 + i * 0.08);
      const barWidth = width * bar.widthRatio;
      const alpha = bar.opacity + (glitching ? 0.025 : 0);

      const gradient = ctx.createLinearGradient(x, y, x + barWidth, y);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(0.35, `rgba(${FX_LINE}, ${alpha})`);
      gradient.addColorStop(0.6, `rgba(${FX_GLITCH}, ${alpha * 0.9})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + barWidth, y);
      ctx.stroke();
    }
  }

  function drawSegments(now, glitching) {
    const px = width ? (pointer.x / width) * 2 - 1 : 0;
    const py = height ? (pointer.y / height) * 2 - 1 : 0;

    // Group segments by stroke colour so we can batch strokes with the
    // same style — avoids setting strokeStyle for every segment.
    // Since the colour choice depends on glitchBias (constant per segment)
    // and only glitchBias > 0.66 uses FX_GLITCH, we run two passes.
    const flickerT = now * 0.0011;
    const driftT = now * 0.00045;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const flicker = 0.55 + 0.45 * Math.sin(flickerT + segment.phase);
      const drift = Math.sin(driftT + segment.phase) * segment.drift;
      const offsetX = -px * (4 + segment.glitchBias * 6) + (glitching && segment.glitchBias > 0.58 ? 6 : 0);
      const offsetY = -py * (3 + segment.glitchBias * 4) + (glitching && segment.glitchBias < 0.42 ? -4 : 0);
      const alpha = segment.alpha * flicker + (glitching ? 0.06 * segment.glitchBias : 0);

      const x = segment.horizontal ? segment.x + drift + offsetX : segment.x + offsetX;
      const y = segment.horizontal ? segment.y + offsetY : segment.y + drift + offsetY;

      ctx.strokeStyle = `rgba(${segment.glitchBias > 0.66 ? FX_GLITCH : FX_LINE}, ${alpha})`;
      ctx.lineWidth = segment.thickness;
      ctx.beginPath();

      if (segment.horizontal) {
        const firstEnd = x + segment.len * 0.42;
        const secondStart = firstEnd + segment.gap;
        const secondEnd = secondStart + segment.len * 0.58;
        ctx.moveTo(x, y);
        ctx.lineTo(firstEnd, y);
        ctx.moveTo(secondStart, y);
        ctx.lineTo(secondEnd, y);
      } else {
        const firstEnd = y + segment.len * 0.48;
        const secondStart = firstEnd + segment.gap;
        const secondEnd = secondStart + segment.len * 0.52;
        ctx.moveTo(x, y);
        ctx.lineTo(x, firstEnd);
        ctx.moveTo(x, secondStart);
        ctx.lineTo(x, secondEnd);
      }

      ctx.stroke();
    }
  }

  function drawNoise(now, glitching) {
    const count = glitching ? 8 : 4;
    for (let i = 0; i < count; i++) {
      const y = ((now * 0.08) + i * 137) % height;
      const h = 1 + ((i + 1) % 3);
      const alpha = glitching ? 0.08 : 0.03;
      const gradient = ctx.createLinearGradient(0, y, width, y);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(0.5, `rgba(${FX_SOFT}, ${alpha})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, width, h);
    }
  }

  function frame(now) {
    if (now >= nextGlitchAt) {
      glitchUntil = now + GLITCH_DURATION_MS;
      scheduleNextGlitch(now);
    }

    const glitching = now < glitchUntil;

    updatePointer();
    ctx.clearRect(0, 0, width, height);
    // Blit the pre-rendered static base glow instead of rebuilding a
    // radial gradient every frame.
    ctx.drawImage(bgCanvas, 0, 0, width, height);
    drawBars(now, glitching);
    drawSegments(now, glitching);
    drawNoise(now, glitching);

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
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  resize();
  scheduleNextGlitch(performance.now());
  start();
}
