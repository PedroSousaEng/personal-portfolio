/**
 * PURPOSE
 *   Contact-page-only ambient background: a minimalist, hand-drawn-style
 *   world map rendered in line art, faint everywhere except the Iberian
 *   Peninsula, which sits brighter and more detailed at the composition's
 *   focal point — with a small red signal marker pulsing over Braga.
 *   Replaces the earlier radar-sweep background (Phase 6 revision).
 *
 * RESPONSIBILITIES
 *   - Inject a <canvas class="bg-fx bg-fx--contact-map"> as the first
 *     child of <body> and own its lifecycle.
 *   - Draw the static linework (world silhouette + peninsula + PT/ES
 *     border) once per resize onto an offscreen cache — never rebuilt
 *     mid-frame.
 *   - Run a requestAnimationFrame loop ONLY to pulse the Braga marker's
 *     glow; every frame only repaints the small dot region by blitting
 *     the cached static layer back underneath it, never the whole canvas.
 *   - Skip the rAF loop entirely (draw once, no pulse) under
 *     prefers-reduced-motion, and re-check if the preference changes
 *     while the page is open.
 *
 * DEPENDENCIES
 *   assets/css/base.css (.bg-fx positioning + reduced-motion guard)
 *   assets/css/effects/iberian-map.css (page-scoped static surface layer)
 *   assets/css/tokens.css (--fx-contact-map-*, --fx-contact-signal tokens)
 *
 * SAFE EDITS
 *   Coordinates below are hand-simplified line-art, not surveyed data —
 *   nudge points directly rather than importing a geo library. The whole
 *   scene shares one projection (see `project()`), anchored on Braga, so
 *   the world silhouette and the peninsula always stay in registration.
 */

export function initIberianMap() {
  if (typeof window.requestAnimationFrame !== "function") return;
  if (document.body?.dataset.page !== "contact") return;
  if (document.querySelector(".bg-fx--contact-map")) return;

  const TAU = Math.PI * 2;

  const rootStyles = getComputedStyle(document.documentElement);
  const tok = (name, fallback) => rootStyles.getPropertyValue(name).trim() || fallback;

  function parseColorTriplet(raw) {
    if (!raw) return null;
    const s = raw.trim();
    const hexMatch = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hexMatch) {
      return `${parseInt(hexMatch[1], 16)}, ${parseInt(hexMatch[2], 16)}, ${parseInt(hexMatch[3], 16)}`;
    }
    const rgbaMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbaMatch) return `${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}`;
    return null;
  }

  const FX_LINE = parseColorTriplet(tok("--fx-contact-map-line", "#e6e8ee")) || "230, 232, 238";
  const FX_SIGNAL = parseColorTriplet(tok("--fx-contact-signal", "#e5484d")) || "229, 72, 77";
  const LINE_COLOR = `rgb(${FX_LINE})`;
  const SIGNAL_COLOR = `rgb(${FX_SIGNAL})`;

  // ---- Geography (hand-simplified line art — not surveyed data) ----
  // Anchor: everything is projected relative to Braga, so the faint world
  // silhouette and the bright peninsula detail always share one origin.
  const BRAGA = { lon: -8.42, lat: 41.55 };

  // Very low-detail continent silhouettes — decorative backdrop only.
  const WORLD_LANDMASSES = [
    // Afro-Eurasia (Europe + Africa + Asia as one connected mass).
    [
      [-9, 43], [-9.3, 38], [-9, 36], [-5, 36], [0, 38], [10, 44], [15, 40],
      [23, 40], [30, 42], [36, 33], [35, 20], [40, 12], [45, 2], [42, -10],
      [35, -25], [20, -35], [15, -18], [10, -5], [9, 6], [-4, 5], [-10, 10],
      [-17, 15], [-9, 21], [-9, 33], [-6, 35], [-9, 38], [-9, 43],
    ],
    // Extension covering the Asian landmass so the backdrop reads as a
    // full world map rather than just Europe/Africa.
    [
      [30, 42], [45, 40], [60, 45], [75, 48], [95, 52], [115, 50], [135, 45],
      [140, 55], [160, 65], [130, 75], [90, 78], [60, 72], [40, 66], [30, 60],
      [36, 33], [30, 42],
    ],
    [
      [70, 20], [80, 8], [90, 20], [98, 10], [105, 2], [100, -8], [110, -8],
      [115, 5], [122, 22], [110, 20], [95, 22], [80, 22], [70, 20],
    ],
    // North America.
    [
      [-165, 65], [-150, 60], [-130, 55], [-125, 40], [-118, 33], [-105, 20],
      [-97, 16], [-88, 14], [-82, 22], [-80, 26], [-75, 35], [-70, 43],
      [-65, 48], [-70, 58], [-85, 63], [-95, 68], [-115, 70], [-140, 68],
      [-165, 65],
    ],
    // South America.
    [
      [-80, 9], [-77, 2], [-80, -5], [-78, -15], [-71, -20], [-70, -30],
      [-71, -40], [-68, -52], [-65, -55], [-58, -40], [-48, -25], [-35, -9],
      [-40, 2], [-50, 5], [-60, 8], [-72, 8], [-80, 9],
    ],
    // Australia (small, low detail).
    [
      [113, -22], [122, -18], [130, -12], [142, -11], [148, -20], [153, -28],
      [150, -37], [140, -38], [131, -32], [122, -34], [114, -30], [113, -22],
    ],
  ];

  // Peninsula coastline, ordered as PT_COAST (Minho mouth -> Guadiana
  // mouth) followed by ES_COAST (Guadiana mouth -> back to Minho mouth) —
  // see the two arrays below, kept separate so PT/ES can be filled apart.
  const PT_COAST = [
    [-8.87, 41.88], [-8.85, 41.15], [-9.05, 40.65], [-9.47, 39.36],
    [-9.2, 38.68], [-8.98, 38.0], [-8.78, 37.5], [-8.9, 37.05],
    [-8.68, 37.0], [-8.0, 36.98], [-7.42, 37.17],
  ];

  const ES_COAST = [
    [-7.42, 37.17], [-6.3, 37.0], [-6.0, 36.75], [-5.6, 36.15], [-5.35, 36.13],
    [-4.4, 36.72], [-2.47, 36.84], [-1.3, 37.6], [0.48, 38.35], [0.33, 39.47],
    [1.15, 41.15], [2.17, 41.38], [3.2, 42.32], [1.7, 42.5], [0.0, 42.7],
    [-1.5, 43.3], [-2.0, 43.37], [-3.2, 43.47], [-4.5, 43.4], [-5.7, 43.55],
    [-7.0, 43.55], [-8.2, 43.4], [-9.3, 43.0], [-8.87, 42.2], [-8.87, 41.88],
  ];

  // The land border, Minho mouth (north) -> Guadiana mouth (south).
  const BORDER = [
    [-8.87, 41.88], [-8.15, 41.92], [-6.95, 41.95], [-6.85, 41.0],
    [-6.95, 40.3], [-7.0, 39.4], [-7.05, 38.6], [-7.3, 38.2], [-7.42, 37.17],
  ];

  const PT_POLYGON = [...PT_COAST, ...[...BORDER].reverse().slice(1, -1)];
  const ES_POLYGON = [...ES_COAST, ...BORDER.slice(1, -1)];
  const PENINSULA_OUTLINE = [...PT_COAST, ...ES_COAST.slice(1)];

  // Deterministic "hand-drawn" jitter — same seed every render, so the
  // wobble is baked once and never recomputed per frame.
  function seededJitter(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647 - 0.5;
    };
  }

  function withOrganicWobble(points, amount, seed) {
    const rand = seededJitter(seed);
    return points.map(([x, y], i) => {
      if (i === 0 || i === points.length - 1) return [x, y];
      return [x + rand() * amount, y + rand() * amount];
    });
  }

  const canvas = document.createElement("canvas");
  canvas.className = "bg-fx bg-fx--contact-map";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });

  // Offscreen cache of the static linework (world + peninsula + border).
  // Rebuilt only on resize; the per-frame pulse blits a small patch of
  // this back over itself before redrawing the glow, so the geometry
  // itself is never recalculated in the animation loop.
  const bgCanvas = document.createElement("canvas");
  const bgCtx = bgCanvas.getContext("2d", { alpha: true });

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let anchor = { x: 0, y: 0 };
  let worldScale = 1;
  let iberiaScale = 1;
  let bragaPoint = { x: 0, y: 0 };
  let rafId = null;
  let resizeTimer = null;

  function project(lon, lat, scale) {
    return [
      anchor.x + (lon - BRAGA.lon) * scale,
      anchor.y - (lat - BRAGA.lat) * scale,
    ];
  }

  function pathFromLonLat(context, ring, scale, { close = true } = {}) {
    ring.forEach(([lon, lat], i) => {
      const [x, y] = project(lon, lat, scale);
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    if (close) context.closePath();
  }

  function drawWorld() {
    bgCtx.strokeStyle = `rgba(${FX_LINE}, 0.16)`;
    bgCtx.fillStyle = `rgba(${FX_LINE}, 0.03)`;
    bgCtx.lineWidth = 1;
    WORLD_LANDMASSES.forEach((mass, i) => {
      const wobbled = withOrganicWobble(mass, 0.15, 1000 + i * 37);
      bgCtx.beginPath();
      pathFromLonLat(bgCtx, wobbled, worldScale);
      bgCtx.fill();
      bgCtx.stroke();
    });
  }

  function drawPeninsula() {
    const pt = withOrganicWobble(PT_POLYGON, 0.02, 42);
    const es = withOrganicWobble(ES_POLYGON, 0.02, 73);
    const border = withOrganicWobble(BORDER, 0.015, 91);
    const outline = withOrganicWobble(PENINSULA_OUTLINE, 0.02, 15);

    // Country fills — subtle, not a colored map, just enough to read as
    // two distinct territories.
    bgCtx.fillStyle = `var(--fx-contact-map-fill-pt, rgba(230,232,238,0.05))`;
    bgCtx.fillStyle = tok("--fx-contact-map-fill-pt", "rgba(230, 232, 238, 0.05)");
    bgCtx.beginPath();
    pathFromLonLat(bgCtx, pt, iberiaScale);
    bgCtx.fill();

    bgCtx.fillStyle = tok("--fx-contact-map-fill-es", "rgba(230, 232, 238, 0.03)");
    bgCtx.beginPath();
    pathFromLonLat(bgCtx, es, iberiaScale);
    bgCtx.fill();

    // Coastline — the brighter, more detailed focal element.
    bgCtx.strokeStyle = `rgba(${FX_LINE}, 0.55)`;
    bgCtx.lineWidth = 1.4;
    bgCtx.beginPath();
    pathFromLonLat(bgCtx, outline, iberiaScale);
    bgCtx.stroke();

    // PT/ES border — a touch brighter than the coastline so the two
    // countries read as clearly distinct.
    bgCtx.strokeStyle = `rgba(${FX_LINE}, 0.7)`;
    bgCtx.lineWidth = 1.2;
    bgCtx.beginPath();
    pathFromLonLat(bgCtx, border, iberiaScale, { close: false });
    bgCtx.stroke();
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bgCanvas.width = Math.round(width * dpr);
    bgCanvas.height = Math.round(height * dpr);
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.clearRect(0, 0, width, height);

    // Same off-centre composition the radar background used, so the
    // rest of the Contact layout doesn't need to change.
    anchor = { x: width * 0.72, y: height * 0.5 };

    // World silhouette sized to roughly fill the viewport at low detail;
    // the peninsula is then redrawn much larger, in the same spot, as
    // the focal "zoom".
    worldScale = Math.min(width, height) / 130;
    iberiaScale = Math.min(width, height) / 16;

    drawWorld();
    drawPeninsula();

    const [bx, by] = project(BRAGA.lon, BRAGA.lat, iberiaScale);
    bragaPoint = { x: bx, y: by };
  }

  function drawStaticDot() {
    ctx.fillStyle = SIGNAL_COLOR;
    ctx.beginPath();
    ctx.arc(bragaPoint.x, bragaPoint.y, 3.5, 0, TAU);
    ctx.fill();
  }

  function drawFullFrame() {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bgCanvas, 0, 0, width, height);
    drawStaticDot();
  }

  const DOT_PATCH_RADIUS = 26;

  function drawPulseFrame(now) {
    const pulse = 0.5 + 0.5 * Math.sin((now / 1400) * TAU);
    const haloRadius = 5 + pulse * 9;

    const patch = DOT_PATCH_RADIUS;
    const sx = Math.max(0, bragaPoint.x - patch);
    const sy = Math.max(0, bragaPoint.y - patch);
    const sw = Math.min(width - sx, patch * 2);
    const sh = Math.min(height - sy, patch * 2);

    // Restore the clean static map under the dot before repainting the
    // glow — the only per-frame redraw, never the whole canvas.
    ctx.clearRect(sx, sy, sw, sh);
    ctx.drawImage(bgCanvas, sx, sy, sw, sh, sx, sy, sw, sh);

    ctx.globalAlpha = 0.35 * (1 - pulse) + 0.1;
    ctx.fillStyle = SIGNAL_COLOR;
    ctx.beginPath();
    ctx.arc(bragaPoint.x, bragaPoint.y, haloRadius, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = SIGNAL_COLOR;
    ctx.beginPath();
    ctx.arc(bragaPoint.x, bragaPoint.y, 3.5, 0, TAU);
    ctx.fill();

    rafId = window.requestAnimationFrame(drawPulseFrame);
  }

  function start() {
    if (rafId === null) rafId = window.requestAnimationFrame(drawPulseFrame);
  }

  function stop() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      drawFullFrame();
    }, 120);
  }

  function onVisibilityChange() {
    if (reduceMotionQuery.matches) return;
    if (document.hidden) stop();
    else start();
  }

  function onReduceMotionChange(event) {
    if (event.matches) {
      stop();
      drawFullFrame();
    } else {
      start();
    }
  }

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  resize();
  drawFullFrame();

  if (!reduceMotionQuery.matches) start();
}
