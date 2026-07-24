/**
 * PURPOSE
 *   Ambient full-viewport "technological network" background for the About
 *   page. A field of quiet nodes connected by hair-thin lines, with a
 *   slow orbital layer overlaid on top and a very gentle parallax reaction
 *   to the pointer. The whole scene should read as an instrument idling —
 *   never busy, never colourful.
 *
 * DESIGN INTENT
 *   - Nodes: small, dim, breathe subtly. A few "hub" nodes are slightly
 *     larger and hold longer connections.
 *   - Links: only drawn between nodes within a threshold distance. The
 *     line alpha decays with distance and with combined node depth.
 *   - Orbits: 2–3 concentric ellipses centred slightly off-screen; each
 *     hosts one traveller that ticks along the ring very slowly.
 *   - Parallax: nodes shift a fraction of a pixel toward or away from the
 *     pointer, scaled by depth. No repulsion, no scatter.
 *
 * RESPONSIBILITIES
 *   - Inject a <canvas class="bg-fx bg-fx--network"> as the first child of
 *     <body> and run a single requestAnimationFrame loop.
 *   - Pause the loop when the tab is hidden.
 *   - Do nothing at all (early-return) when reduced-motion is preferred —
 *     base.css hides .bg-fx in that case.
 *   - Fully self-contained: never touches DOM outside its own canvas.
 *
 * DEPENDENCIES
 *   assets/css/base.css (.bg-fx sizing/stacking + reduced-motion guard).
 *   assets/css/effects/tech-network.css (page-scoped visual layer).
 *   assets/css/tokens.css (--fx-* colour tokens).
 *
 * SAFE EDITS
 *   Tunable constants are grouped at the top of initTechNetwork(). This
 *   module is self-contained; add/remove the initTechNetwork() call in
 *   main.js without touching anything else.
 */

export function initTechNetwork() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.requestAnimationFrame !== "function") return;
  if (document.body?.dataset.page !== "about") return;
  if (document.querySelector(".bg-fx--network")) return;

  // ---- Tunables ---------------------------------------------------------
  const NODE_AREA_DIVISOR = 16000; // lower = more nodes
  const NODE_MIN = 46;
  const NODE_MAX = 120;
  const HUB_RATIO = 0.08; // proportion of nodes promoted to "hub"

  const LINK_DIST = 138;         // px, threshold for drawing a link
  const HUB_LINK_DIST = 210;     // hubs reach further
  const LINK_ALPHA_MAX = 0.22;
  const LINK_ALPHA_BUCKETS = 24;

  // Parallax: how many px a near node shifts toward/away from the pointer.
  const PARALLAX_MAX = 6;
  const PARALLAX_EASE = 0.06;    // low-pass filter toward target offset

  // Node drift (very slow) — organic sinusoidal wander around anchor.
  const DRIFT_AMP = 6;           // px around each anchor
  const DRIFT_FREQ = 0.00018;    // rad / ms

  // Node breathing (alpha modulation).
  const BREATH_FREQ = 0.00055;

  // Orbits: number of concentric rings and their configuration.
  const ORBITS = [
    { rx: 0.62, ry: 0.44, cx: 0.28, cy: 0.55, period: 42000, phase: 0.0 },
    { rx: 0.48, ry: 0.34, cx: 0.74, cy: 0.42, period: 58000, phase: 1.9 },
    { rx: 0.36, ry: 0.24, cx: 0.5,  cy: 0.5,  period: 74000, phase: 3.4 },
  ];

  // ---- Read colour tokens from CSS --------------------------------------
  const rootStyles = getComputedStyle(document.documentElement);
  const tok = (name, fallback) =>
    rootStyles.getPropertyValue(name).trim() || fallback;

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

  const FX_NODE  = parseColorTriplet(tok("--fx-particle", "#aeb8ff")) || "174, 184, 255";
  const FX_LINK  = parseColorTriplet(tok("--fx-particle-link", "#a0a8c8")) || "160, 168, 200";
  const FX_DIM   = parseColorTriplet(tok("--fx-particle-dim", "#5b6376")) || "91, 99, 118";
  const FX_ORBIT = parseColorTriplet(tok("--fx-network-orbit", "#6c7cff")) || "108, 124, 255";
  const NODE_COLOR = `rgb(${FX_NODE})`;
  const LINK_COLOR = `rgb(${FX_LINK})`;

  // ---- Canvas setup -----------------------------------------------------
  const canvas = document.createElement("canvas");
  canvas.className = "bg-fx bg-fx--network";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d", { alpha: true });

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

  const hubHaloSprite = createGlowSprite(FX_NODE, 32);
  const travellerGlowSprite = createGlowSprite(FX_ORBIT, 32);

  // Cached window metrics — updated only on resize, never read inside
  // the rAF loop.
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let minWH = Math.min(width, height);

  // Pre-computed per-orbit geometry, recomputed only on resize.
  const orbitGeom = ORBITS.map(() => ({ cx0: 0, cy0: 0, rx: 0, ry: 0 }));

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    minWH = Math.min(width, height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < ORBITS.length; i++) {
      const o = ORBITS[i];
      const g = orbitGeom[i];
      g.cx0 = width * o.cx;
      g.cy0 = height * o.cy;
      g.rx = minWH * o.rx;
      g.ry = minWH * o.ry;
    }
    seedNodesIfNeeded();
  }

  // ---- Pointer (parallax only, no repulsion) ----------------------------
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

  function onPointerMove(event) {
    // Target parallax: normalised offset from centre, scaled to PARALLAX_MAX.
    // No time reads or per-frame allocations here — assignment only.
    const nx = (event.clientX / width) * 2 - 1;
    const ny = (event.clientY / height) * 2 - 1;
    parallax.tx = -nx * PARALLAX_MAX;
    parallax.ty = -ny * PARALLAX_MAX;
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });

  // ---- Nodes ------------------------------------------------------------
  // Reusable node objects — the array is grown/shrunk in place, never
  // reallocated. Each object is mutated frame-to-frame instead of
  // recreated, so the effect makes zero per-frame allocations.
  let nodes = [];

  function targetNodeCount() {
    const count = Math.round((width * height) / NODE_AREA_DIVISOR);
    return Math.max(NODE_MIN, Math.min(NODE_MAX, count));
  }

  function makeNode() {
    const z = Math.random(); // depth [0..1]
    const isHub = Math.random() < HUB_RATIO;
    return {
      ax: Math.random() * width,    // anchor
      ay: Math.random() * height,
      x: 0, y: 0,                    // rendered position (anchor + drift + parallax)
      z,
      r: isHub ? 1.6 + z * 1.4 : 0.8 + z * 1.4,
      hub: isHub,
      driftPhaseX: Math.random() * Math.PI * 2,
      driftPhaseY: Math.random() * Math.PI * 2,
      breathPhase: Math.random() * Math.PI * 2,
      // Cached-per-frame values populated by updateNodes so link + node
      // draw passes don't recompute them.
      _depthFactor: 0,
      _cellX: 0,
      _cellY: 0,
    };
  }

  function seedNodesIfNeeded() {
    const target = targetNodeCount();
    if (nodes.length === 0) {
      nodes = Array.from({ length: target }, makeNode);
      return;
    }
    // Rescatter anchors to fill the new viewport rather than clumping in
    // the previous size's rect.
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].ax > width)  nodes[i].ax = Math.random() * width;
      if (nodes[i].ay > height) nodes[i].ay = Math.random() * height;
    }
    while (nodes.length < target) nodes.push(makeNode());
    if (nodes.length > target) nodes.length = target;
  }

  // ---- Spatial hash grid (link culling) ---------------------------------
  // Reused across frames — Map is cleared, cell arrays are reused rather
  // than reallocated, so buildGrid() makes no allocations after warmup.
  const GRID_CELL = HUB_LINK_DIST; // widest possible reach
  const grid = new Map();
  const cellPool = []; // pool of empty arrays we can hand out
  const activeCells = []; // cells currently in grid — cleared at start of buildGrid
  const linkBuckets = Array.from({ length: LINK_ALPHA_BUCKETS }, () => []);

  function buildGrid() {
    // Return every active cell to the pool (length=0 preserves capacity).
    for (let i = 0; i < activeCells.length; i++) {
      const cell = activeCells[i];
      cell.length = 0;
      cellPool.push(cell);
    }
    activeCells.length = 0;
    grid.clear();

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const cx = (n.x / GRID_CELL) | 0;
      const cy = (n.y / GRID_CELL) | 0;
      n._cellX = cx;
      n._cellY = cy;
      const key = cx * 100000 + cy;
      let cell = grid.get(key);
      if (!cell) {
        cell = cellPool.pop() || [];
        grid.set(key, cell);
        activeCells.push(cell);
      }
      cell.push(i);
    }
  }

  // ---- Update + draw ----------------------------------------------------
  function updateNodes(now) {
    // Ease parallax toward target for a fluid, non-jittery feel.
    parallax.x += (parallax.tx - parallax.x) * PARALLAX_EASE;
    parallax.y += (parallax.ty - parallax.y) * PARALLAX_EASE;

    const px = parallax.x;
    const py = parallax.y;
    const t1 = now * DRIFT_FREQ;
    const t2 = now * DRIFT_FREQ * 0.85;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dx = Math.sin(t1 + n.driftPhaseX) * DRIFT_AMP;
      const dy = Math.cos(t2 + n.driftPhaseY) * DRIFT_AMP;
      // Depth-scaled parallax: near nodes (z→1) shift most.
      const depthP = 0.35 + n.z * 0.65;
      n.x = n.ax + dx + px * depthP;
      n.y = n.ay + dy + py * depthP;
    }
  }

  function drawLinks() {
    buildGrid();

    const linkDistSq = LINK_DIST * LINK_DIST;
    const hubLinkDistSq = HUB_LINK_DIST * HUB_LINK_DIST;
    const alphaStep = LINK_ALPHA_MAX / LINK_ALPHA_BUCKETS;

    // Reuse flattened coordinate arrays. Grouping by closely spaced alpha
    // values turns hundreds of beginPath/stroke calls into at most 24 without
    // changing link geometry, colour or the perceived falloff.
    for (let i = 0; i < linkBuckets.length; i++) linkBuckets[i].length = 0;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const cx = a._cellX;
      const cy = a._cellY;

      for (let ox = -1; ox <= 1; ox++) {
        const cxo = (cx + ox) * 100000;
        for (let oy = -1; oy <= 1; oy++) {
          const cell = grid.get(cxo + (cy + oy));
          if (!cell) continue;

          for (let ci = 0; ci < cell.length; ci++) {
            const j = cell[ci];
            if (j <= i) continue;

            const b = nodes[j];
            const ddx = a.x - b.x;
            const ddy = a.y - b.y;
            const distSq = ddx * ddx + ddy * ddy;
            const eitherHub = a.hub || b.hub;
            const limitSq = eitherHub ? hubLinkDistSq : linkDistSq;
            if (distSq > limitSq) continue;

            const limit = eitherHub ? HUB_LINK_DIST : LINK_DIST;
            const falloff = 1 - Math.sqrt(distSq) / limit;
            const depthFactor = 0.45 + ((a.z + b.z) * 0.5) * 0.55;
            const alpha = falloff * LINK_ALPHA_MAX * depthFactor;
            if (alpha < 0.005) continue;

            const bucketIndex = Math.min(
              LINK_ALPHA_BUCKETS - 1,
              Math.floor(alpha / alphaStep)
            );
            const bucket = linkBuckets[bucketIndex];
            bucket.push(a.x, a.y, b.x, b.y);
          }
        }
      }
    }

    ctx.strokeStyle = LINK_COLOR;
    ctx.lineWidth = 1;
    for (let i = 0; i < linkBuckets.length; i++) {
      const bucket = linkBuckets[i];
      if (!bucket.length) continue;

      ctx.globalAlpha = Math.min(LINK_ALPHA_MAX, (i + 0.5) * alphaStep);
      ctx.beginPath();
      for (let j = 0; j < bucket.length; j += 4) {
        ctx.moveTo(bucket[j], bucket[j + 1]);
        ctx.lineTo(bucket[j + 2], bucket[j + 3]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawNodes(now) {
    const breathT = now * BREATH_FREQ;
    ctx.fillStyle = NODE_COLOR;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.x < -12 || n.x > width + 12 || n.y < -12 || n.y > height + 12) continue;

      const breath = 0.75 + 0.25 * Math.sin(breathT + n.breathPhase);
      const depthScale = 0.55 + n.z * 0.45;
      const radius = n.r * depthScale * (n.hub ? 1.15 : 1);
      const alpha = (0.22 + n.z * 0.32) * breath;

      if (n.hub) {
        const haloR = radius * 4;
        ctx.globalAlpha = 0.18 * breath;
        ctx.drawImage(hubHaloSprite, n.x - haloR, n.y - haloR, haloR * 2, haloR * 2);
      }

      ctx.fillStyle = NODE_COLOR;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function drawOrbits(now) {
    ctx.lineWidth = 1;
    const paraX04 = parallax.x * 0.4;
    const paraY04 = parallax.y * 0.4;

    for (let i = 0; i < ORBITS.length; i++) {
      const o = ORBITS[i];
      const g = orbitGeom[i];
      const cx = g.cx0 + paraX04;
      const cy = g.cy0 + paraY04;
      const rx = g.rx;
      const ry = g.ry;

      // The orbit ring: dashed, extremely faint.
      ctx.save();
      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = `rgba(${FX_ORBIT}, 0.08)`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Traveller ticking along the ring.
      const t = (now / o.period) * Math.PI * 2 + o.phase;
      const tx = cx + Math.cos(t) * rx;
      const ty = cy + Math.sin(t) * ry;

      // Trail: a short arc behind the traveller for gentle motion cue.
      ctx.save();
      const trailFrom = t - 0.28;
      ctx.strokeStyle = `rgba(${FX_ORBIT}, 0.22)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, trailFrom, t);
      ctx.stroke();

      // Traveller glow + core. The glow colour profile is static, so only
      // its destination position changes from frame to frame.
      ctx.globalAlpha = 0.55;
      ctx.drawImage(travellerGlowSprite, tx - 22, ty - 22, 44, 44);

      ctx.globalAlpha = 0.9;
      ctx.fillStyle = NODE_COLOR;
      ctx.beginPath();
      ctx.arc(tx, ty, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- Main loop --------------------------------------------------------
  let rafId = null;

  function frame(now) {
    ctx.clearRect(0, 0, width, height);
    updateNodes(now);
    drawOrbits(now);
    drawLinks();
    drawNodes(now);
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

  function onVisibilityChange() {
    if (document.hidden) stop();
    else start();
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }
  window.addEventListener("resize", onResize, { passive: true });

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function onReduceMotionChange(event) {
    if (event.matches) {
      stop();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
      // Remove the canvas so nothing lingers behind the reduced-motion CSS.
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  resize();
  start();
}
