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
 *   World landmasses are stroke-only (no fill) on purpose: a filled,
 *   hand-approximated polygon at this point count reads as a solid dark
 *   blob rather than a coastline, so keep it to thin outlines.
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
  const SIGNAL_COLOR = `rgb(${FX_SIGNAL})`;
  const FILL_PT = tok("--fx-contact-map-fill-pt", "rgba(230, 232, 238, 0.06)");
  const FILL_ES = tok("--fx-contact-map-fill-es", "rgba(230, 232, 238, 0.035)");

  // ---- Geography (hand-simplified line art — not surveyed data) ----
  // Anchor: everything is projected relative to Braga, so the faint world
  // silhouette and the bright peninsula detail always share one origin.
  const BRAGA = { lon: -8.42, lat: 41.55 };

  // Very low-detail continent outlines — decorative backdrop only.
  // Stroke-only: no fill (see SAFE EDITS above).
  const WORLD_LANDMASSES = [
    // Europe + Africa + western Asia, one connected mass.
    [
      [-9.3, 43], [-9, 37], [-6, 36], [-2, 38], [4, 43], [12, 45], [18, 40],
      [23, 36], [28, 41], [35, 37], [36, 20], [43, 12], [50, 12], [43, -2],
      [40, -15], [35, -25], [25, -34], [16, -34], [12, -18], [9, -4], [8, 5],
      [-2, 5], [-9, 10], [-17, 14], [-16, 21], [-10, 25], [-8, 33], [-9.3, 43],
    ],
    // Rest of Asia — kept separate and mostly off-screen at typical
    // viewport widths; adds depth at wide/ultrawide sizes only.
    [
      [50, 12], [60, 22], [68, 24], [72, 20], [78, 10], [82, 16], [90, 22],
      [95, 20], [100, 12], [105, 0], [102, -6], [108, -8], [115, 4], [120, 15],
      [122, 28], [130, 40], [140, 50], [155, 62], [130, 70], [100, 76],
      [75, 70], [60, 65], [48, 55], [43, 40], [35, 37], [43, 12], [50, 12],
    ],
    // North America.
    [
      [-160, 62], [-145, 60], [-130, 52], [-124, 40], [-117, 32], [-105, 20],
      [-96, 16], [-88, 14], [-82, 22], [-80, 27], [-75, 35], [-71, 42],
      [-66, 45], [-64, 50], [-72, 58], [-88, 63], [-100, 68], [-120, 70],
      [-140, 68], [-160, 62],
    ],
    // South America.
    [
      [-79, 8], [-77, 1], [-80, -5], [-78, -15], [-71, -18], [-70, -30],
      [-71, -40], [-68, -51], [-66, -54], [-58, -38], [-48, -24], [-35, -8],
      [-40, 3], [-50, 6], [-60, 9], [-72, 9], [-79, 8],
    ],
    // Australia (small, low detail).
    [
      [114, -22], [122, -18], [131, -12], [142, -11], [148, -20], [153, -27],
      [150, -37], [140, -38], [131, -32], [122, -34], [114, -30], [114, -22],
    ],
  ];

  // Peninsula coastline, split as PT_COAST (Minho mouth -> Guadiana
  // mouth) and ES_COAST (Guadiana mouth -> ... -> back to Minho mouth),
  // so Portugal/Spain can be filled as two distinct shapes.
  const PT_COAST = [
    [-8.85, 41.88], [-8.9, 41.15], [-8.85, 40.6], [-9.0, 40.15],
    [-9.25, 39.6], [-9.5, 38.78], [-9.25, 38.68], [-8.9, 38.45],
    [-8.87, 37.95], [-8.97, 37.02], [-8.67, 37.1], [-7.93, 37.0],
    [-7.42, 37.18],
  ];

  const ES_COAST = [
    [-7.42, 37.18], [-6.95, 37.18], [-6.3, 36.53], [-5.6, 36.0],
    [-5.35, 36.12], [-4.42, 36.72], [-2.47, 36.83], [-0.99, 37.6],
    [-0.48, 38.35], [-0.33, 39.47], [1.25, 41.12], [2.17, 41.38],
    [3.18, 42.43], [1.0, 42.6], [-1.0, 42.9], [-1.98, 43.32],
    [-2.93, 43.36], [-3.8, 43.46], [-5.66, 43.55], [-7.03, 43.54],
    [-8.4, 43.37], [-9.3, 42.9], [-8.87, 42.24], [-8.85, 41.88],
  ];

  // The land border, Minho mouth (north) -> Guadiana mouth (south).
  const BORDER = [
    [-8.85, 41.88], [-8.2, 41.92], [-6.9, 41.95], [-6.85, 41.0],
    [-6.9, 40.3], [-7.0, 39.5], [-7.0, 38.7], [-7.3, 38.15], [-7.42, 37.18],
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
    bgCtx.strokeStyle = `rgba(${FX_LINE}, 0.18)`;
    bgCtx.lineWidth = 1;
    WORLD_LANDMASSES.forEach((mass, i) => {
      const wobbled = withOrganicWobble(mass, 0.2, 1000 + i * 37);
      bgCtx.beginPath();
      pathFromLonLat(bgCtx, wobbled, worldScale);
      bgCtx.stroke();
    });
  }

  function drawPeninsula() {
    const pt = withOrganicWobble(PT_POLYGON, 0.015, 42);
    const es = withOrganicWobble(ES_POLYGON, 0.015, 73);
    const border = withOrganicWobble(BORDER, 0.01, 91);
    const outline = withOrganicWobble(PENINSULA_OUTLINE, 0.015, 15);

    // Country fills — subtle, not a colored map, just enough to read as
    // two distinct territories.
    bgCtx.fillStyle = FILL_PT;
    bgCtx.beginPath();
    pathFromLonLat(bgCtx, pt, iberiaScale);
    bgCtx.fill();

    bgCtx.fillStyle = FILL_ES;
    bgCtx.beginPath();
    pathFromLonLat(bgCtx, es, iberiaScale);
    bgCtx.fill();

    // Coastline — the brighter, more detailed focal element.
    bgCtx.strokeStyle = `rgba(${FX_LINE}, 0.6)`;
    bgCtx.lineWidth = 1.4;
    bgCtx.lineJoin = "round";
    bgCtx.beginPath();
    pathFromLonLat(bgCtx, outline, iberiaScale);
    bgCtx.stroke();

    // PT/ES border — a touch brighter than the coastline so the two
    // countries read as clearly distinct.
    bgCtx.strokeStyle = `rgba(${FX_LINE}, 0.75)`;
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

    // World silhouette sized to sit in the background at low detail;
    // the peninsula is then redrawn larger, in the same spot, as the
    // focal "zoom".
    worldScale = Math.min(width, height) / 210;
    iberiaScale = Math.min(width, height) / 15;

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
    const dx = Math.max(0, bragaPoint.x - patch);
    const dy = Math.max(0, bragaPoint.y - patch);
    const dw = Math.min(width - dx, patch * 2);
    const dh = Math.min(height - dy, patch * 2);

    // Restore the clean static map under the dot before repainting the
    // glow — the only per-frame redraw, never the whole canvas. Source
    // rect must be in bgCanvas's own device-pixel buffer (dpr-scaled),
    // while the destination rect stays in the ctx's CSS-pixel space
    // (ctx already carries the dpr transform) — mixing the two spaces
    // here was the earlier bug that left a black patch around the dot.
    ctx.clearRect(dx, dy, dw, dh);
    ctx.drawImage(
      bgCanvas,
      dx * dpr, dy * dpr, dw * dpr, dh * dpr,
      dx, dy, dw, dh,
    );

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
