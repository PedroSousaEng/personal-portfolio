/**
 * PURPOSE
 *   Ambient full-viewport background effect: a giant slow-swinging
 *   pendulum, a soft particle field that reacts to the pointer, and
 *   roaming "light" sources (pointer + pendulum bob + ambient drift)
 *   that modulate particle/rod brightness for a subtle dynamic-lighting
 *   feel.
 *
 *   Phase 3 enhancements (Home only):
 *   - Particles now carry a depth value (z ∈ [0,1]) that drives size,
 *     opacity, drift speed and link probability — creating a parallax-like
 *     sense of spatial depth without a third dimension.
 *   - Particle motion uses sinusoidal perturbation on top of linear drift,
 *     producing organic, non-mechanical movement.
 *   - A slow ambient light drifts across the viewport independently of the
 *     pointer, so the scene is alive even when the user is idle.
 *   - The pendulum bob glow "breathes" subtly (amplitude-modulated sine),
 *     reinforcing the living-instrument feeling.
 *   - Constellation links use a spatial hash grid (O(n·k) instead of
 *     O(n²)), with early-out distance checks.
 *   - All colours are read from CSS custom properties via getComputedStyle,
 *     so the physics layer never hardcodes a colour.
 *
 * RESPONSIBILITIES
 *   - Inject and size a <canvas class="bg-fx"> as the first child of
 *     <body> (styled fixed/behind-content in base.css).
 *   - Run a single requestAnimationFrame loop: update physics, draw.
 *   - Pause the loop when the tab is hidden; do nothing at all when the
 *     visitor prefers reduced motion (base.css also hides the canvas).
 *
 * DEPENDENCIES
 *   assets/css/base.css (.bg-fx sizing/stacking + reduced-motion guard).
 *   assets/css/tokens.css (--fx-* colour tokens).
 *
 * SAFE EDITS
 *   Tunable constants are grouped at the top of initBackgroundFX(). This
 *   module is self-contained — it never reaches into DOM outside the
 *   canvas it creates, so it's safe to add/remove the initBackgroundFX()
 *   call in main.js without touching anything else.
 *
 *   Page scope: this effect is intended for the Home page only. Other
 *   pages (About, Projects, Contact, 404) run their own effect modules
 *   via main.js, and calling initBackgroundFX() there would produce a
 *   double-layer canvas. The main.js orchestrator gates the call on
 *   `data-page="home"`; the guard below is a belt-and-braces early-out
 *   in case the module is ever imported directly.
 */

export function initBackgroundFX() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.requestAnimationFrame !== "function") return;
  // Belt-and-braces: never run on non-home pages even if the caller forgot to gate.
  if (document.body && document.body.dataset.page && document.body.dataset.page !== "home") return;

  // ---- Tunables ---------------------------------------------------------
  const PENDULUM_PERIOD_MS = 14000; // full swing cycle — slow & giant
  const PENDULUM_AMPLITUDE = 0.26; // radians (~15deg either side)
  const PENDULUM_PIVOT_X_RATIO = 0.72;
  const PENDULUM_PIVOT_Y_RATIO = -0.08;
  const PENDULUM_ROD_LENGTH_RATIO = 0.95;

  // Pendulum bob glow breathing: the halo radius and intensity oscillate
  // gently to make the pendulum feel like a living instrument.
  const BOB_GLOW_BASE_R = 90;
  const BOB_GLOW_BREATH_AMP = 12; // ±px variation in glow radius
  const BOB_GLOW_BREATH_PERIOD_MS = 5200;

  const PARTICLE_AREA_DIVISOR = 14000; // lower = more particles
  const PARTICLE_MIN = 40;
  const PARTICLE_MAX = 110;
  const PARTICLE_LINK_DIST = 105;
  const MOUSE_REPEL_RADIUS = 130;
  const MOUSE_LIGHT_RADIUS = 260;
  const PENDULUM_LIGHT_RADIUS = 320;
  const AMBIENT_LIGHT_RADIUS = 340; // roaming ambient light
  const AMBIENT_DRIFT_PERIOD_MS = 28000; // one full drift cycle
  const MOUSE_IDLE_FADE_MS = 1400;

  // Sinusoidal perturbation: adds organic curve to particle drift.
  // Each particle gets its own phase so they don't move in lockstep.
  const WAVE_AMP = 0.18; // max perpendicular displacement speed
  const WAVE_FREQ = 0.0007; // angular frequency (radians per ms)

  // ---- Read colour tokens from CSS --------------------------------------
  const rootStyles = getComputedStyle(document.documentElement);
  const tok = (name, fallback) =>
    rootStyles.getPropertyValue(name).trim() || fallback;

  // Parse "r, g, b" or "#hex" or "rgba(...)" into "r, g, b" string for
  // use in template literals with alpha.
  function parseColorTriplet(raw) {
    if (!raw) return null;
    const s = raw.trim();
    // "r, g, b" or "r,g,b"
    const commaMatch = s.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
    if (commaMatch) return `${commaMatch[1]}, ${commaMatch[2]}, ${commaMatch[3]}`;
    // rgba(r,g,b,a)
    const rgbaMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbaMatch) return `${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}`;
    // #hex
    const hexMatch = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hexMatch)
      return `${parseInt(hexMatch[1], 16)}, ${parseInt(hexMatch[2], 16)}, ${parseInt(hexMatch[3], 16)}`;
    return null;
  }

  const FX_PARTICLE = parseColorTriplet(tok("--fx-particle", "#aeb8ff")) || "174, 184, 255";
  const FX_PARTICLE_LINK = parseColorTriplet(tok("--fx-particle-link", "#a0a8c8")) || "160, 168, 200";
  const FX_PARTICLE_DIM = parseColorTriplet(tok("--fx-particle-dim", "#5b6376")) || "91, 99, 118";
  const FX_GLOW_CURSOR = parseColorTriplet(tok("--fx-glow-cursor", "#6c7cff")) || "108, 124, 255";
  const FX_GLOW_PENDULUM = parseColorTriplet(tok("--fx-glow-pendulum", "#ffb347")) || "255, 179, 71";
  const FX_GLOW_AMBIENT = FX_PARTICLE; // ambient uses particle colour for cohesion

  // ---- Canvas setup -----------------------------------------------------
  const canvas = document.createElement("canvas");
  canvas.className = "bg-fx";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedParticlesIfNeeded();
  }

  // ---- Pointer tracking -------------------------------------------------
  const pointer = { x: width / 2, y: height / 2, active: false, lastMove: 0 };

  function onPointerMove(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    pointer.lastMove = performance.now();
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave);

  // ---- Particles (with depth) -------------------------------------------
  let particles = [];

  function targetParticleCount() {
    const count = Math.round((width * height) / PARTICLE_AREA_DIVISOR);
    return Math.max(PARTICLE_MIN, Math.min(PARTICLE_MAX, count));
  }

  function makeParticle() {
    // z ∈ [0, 1]: 0 = far (small, dim, slow), 1 = near (large, bright, fast)
    const z = Math.random();
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: 1.0 + z * 2.4, // base radius scales with depth
      z: z,
      twinklePhase: Math.random() * Math.PI * 2,
      wavePhase: Math.random() * Math.PI * 2, // organic motion phase
      waveAngle: Math.random() * Math.PI * 2, // perturbation direction
    };
  }

  function seedParticlesIfNeeded() {
    const target = targetParticleCount();
    if (particles.length === 0) {
      particles = Array.from({ length: target }, makeParticle);
      return;
    }
    while (particles.length < target) particles.push(makeParticle());
    if (particles.length > target) particles.length = target;
  }

  // ---- Spatial hash grid for constellation links ------------------------
  // Instead of O(n²) pairwise checks, bucket particles into grid cells
  // and only compare neighbours within adjacent cells.
  const GRID_CELL = PARTICLE_LINK_DIST; // cell size = link distance
  let grid = new Map();

  function buildGrid() {
    grid.clear();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const cx = Math.floor(p.x / GRID_CELL);
      const cy = Math.floor(p.y / GRID_CELL);
      const key = cx * 100000 + cy;
      let cell = grid.get(key);
      if (!cell) {
        cell = [];
        grid.set(key, cell);
      }
      cell.push(i);
    }
  }

  // ---- Pendulum state ---------------------------------------------------
  const pendulum = { angle: 0, bobX: 0, bobY: 0, pivotX: 0, pivotY: 0, rodLength: 0 };

  function updatePendulum(now) {
    pendulum.pivotX = width * PENDULUM_PIVOT_X_RATIO;
    pendulum.pivotY = height * PENDULUM_PIVOT_Y_RATIO;
    pendulum.rodLength = height * PENDULUM_ROD_LENGTH_RATIO;
    pendulum.angle = PENDULUM_AMPLITUDE * Math.sin((now / PENDULUM_PERIOD_MS) * Math.PI * 2);
    pendulum.bobX = pendulum.pivotX + Math.sin(pendulum.angle) * pendulum.rodLength;
    pendulum.bobY = pendulum.pivotY + Math.cos(pendulum.angle) * pendulum.rodLength;
  }

  function drawPendulum(now) {
    const { pivotX, pivotY, bobX, bobY } = pendulum;

    // Rod: bright silvery line, glowing faintly along its length.
    ctx.save();
    ctx.shadowColor = `rgba(${FX_PARTICLE}, 0.5)`;
    ctx.shadowBlur = 6;
    const rodGradient = ctx.createLinearGradient(pivotX, pivotY, bobX, bobY);
    rodGradient.addColorStop(0, `rgba(${FX_PARTICLE_DIM}, 0.15)`);
    rodGradient.addColorStop(1, `rgba(${FX_PARTICLE}, 0.85)`);
    ctx.strokeStyle = rodGradient;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    ctx.restore();

    // Small pivot anchor so the rod visibly hangs from something.
    ctx.fillStyle = `rgba(${FX_PARTICLE}, 0.4)`;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bob glow: breathing halo — radius and intensity oscillate gently.
    const breath = Math.sin((now / BOB_GLOW_BREATH_PERIOD_MS) * Math.PI * 2);
    const glowR = BOB_GLOW_BASE_R + breath * BOB_GLOW_BREATH_AMP;
    const glowIntensity = 0.82 + breath * 0.12;

    const glow = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, glowR);
    glow.addColorStop(0, `rgba(${FX_GLOW_PENDULUM}, ${0.9 * glowIntensity})`);
    glow.addColorStop(0.35, `rgba(${FX_GLOW_PENDULUM}, ${0.45 * glowIntensity})`);
    glow.addColorStop(1, `rgba(${FX_GLOW_PENDULUM}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bobX, bobY, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Bob core.
    ctx.save();
    ctx.shadowColor = `rgba(${FX_GLOW_PENDULUM}, ${0.9 * glowIntensity})`;
    ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(255, 225, 180, 0.95)`;
    ctx.beginPath();
    ctx.arc(bobX, bobY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- Dynamic lighting (roaming glow pools) ----------------------------
  function drawAmbientLight(x, y, radius, color, strength) {
    if (strength <= 0.01) return;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${color}, ${0.32 * strength})`);
    gradient.addColorStop(0.5, `rgba(${color}, ${0.12 * strength})`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ambient light: slowly drifts in a Lissajous-like path across the
  // viewport, independent of pointer. Gives the scene life when idle.
  function ambientLightPos(now) {
    const t = (now / AMBIENT_DRIFT_PERIOD_MS) * Math.PI * 2;
    const x = width * (0.5 + 0.32 * Math.sin(t));
    const y = height * (0.5 + 0.28 * Math.sin(t * 1.3 + 0.7));
    return { x, y };
  }

  // ---- Particle update + draw -------------------------------------------
  function updateAndDrawParticles(now, mouseStrength) {
    const linkDistSq = PARTICLE_LINK_DIST * PARTICLE_LINK_DIST;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Organic motion: sinusoidal perturbation perpendicular to the
      // particle's drift direction, scaled by depth (near particles
      // sway more — they're "closer" so the motion is more perceptible).
      const wave = Math.sin(now * WAVE_FREQ + p.wavePhase) * WAVE_AMP * (0.4 + p.z * 0.6);
      const perpX = -Math.sin(p.waveAngle);
      const perpY = Math.cos(p.waveAngle);

      // Depth-scaled drift: nearer particles move faster (parallax).
      const speedScale = 0.5 + p.z * 0.8;

      p.x += (p.vx + perpX * wave) * speedScale;
      p.y += (p.vy + perpY * wave) * speedScale;

      // Pointer repulsion.
      if (mouseStrength > 0) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < MOUSE_REPEL_RADIUS * MOUSE_REPEL_RADIUS) {
          const dist = Math.sqrt(distSq) || 1;
          const force =
            ((MOUSE_REPEL_RADIUS - dist) / MOUSE_REPEL_RADIUS) * 0.6 * mouseStrength;
          p.vx += (dx / dist) * force * 0.06;
          p.vy += (dy / dist) * force * 0.06;
        }
      }

      // Mild velocity damping so repulsion doesn't accumulate forever.
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Wrap around edges for uninterrupted motion.
      if (p.x < -20) p.x = width + 20;
      if (p.x > width + 20) p.x = -20;
      if (p.y < -20) p.y = height + 20;
      if (p.y > height + 20) p.y = -20;

      // Early-out: skip drawing if the particle is well off-screen.
      if (p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10) continue;

      // Lighting contribution from pointer + pendulum bob.
      const distMouseSq = (p.x - pointer.x) ** 2 + (p.y - pointer.y) ** 2;
      const litByMouse =
        mouseStrength > 0
          ? Math.max(0, 1 - Math.sqrt(distMouseSq) / MOUSE_LIGHT_RADIUS) * mouseStrength
          : 0;

      const distBob = Math.hypot(p.x - pendulum.bobX, p.y - pendulum.bobY);
      const litByBob = Math.max(0, 1 - distBob / PENDULUM_LIGHT_RADIUS);

      // Twinkle: individual phase so particles don't pulse in sync.
      const twinkle = 0.75 + 0.25 * Math.sin(now / 1800 + p.twinklePhase);

      // Depth affects base brightness: far particles are dimmer.
      const depthBrightness = 0.3 + p.z * 0.35;
      const brightness = Math.min(
        1,
        depthBrightness * twinkle + litByMouse * 0.85 + litByBob * 0.6
      );

      // Far particles are smaller and more transparent — atmospheric
      // perspective without a real 3D projection.
      const depthScale = 0.5 + p.z * 0.5;
      const radius = (p.r + brightness * 1.8) * depthScale;
      const alpha = (0.25 + p.z * 0.25 + brightness * 0.5) * depthScale;

      ctx.save();
      if (brightness > 0.55) {
        ctx.shadowColor = `rgba(${FX_PARTICLE}, 0.8)`;
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(${FX_PARTICLE}, ${alpha})`;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Faint constellation links between nearby particles — spatial grid
    // reduces this from O(n²) to roughly O(n·k) where k is the average
    // particles per grid cell neighbourhood.
    buildGrid();
    ctx.lineWidth = 1;
    const drawn = new Set();

    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      const cx = Math.floor(a.x / GRID_CELL);
      const cy = Math.floor(a.y / GRID_CELL);

      // Check 3×3 neighbourhood of cells.
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = (cx + dx) * 100000 + (cy + dy);
          const cell = grid.get(key);
          if (!cell) continue;

          for (let ci = 0; ci < cell.length; ci++) {
            const j = cell[ci];
            if (j <= i) continue; // avoid duplicate pairs

            const pairKey = i * 100000 + j;
            if (drawn.has(pairKey)) continue;

            const b = particles[j];
            const ddx = a.x - b.x;
            const ddy = a.y - b.y;
            const distSq = ddx * ddx + ddy * ddy;

            if (distSq < linkDistSq) {
              const dist = Math.sqrt(distSq);
              const alpha = (1 - dist / PARTICLE_LINK_DIST) * 0.22;

              // Depth-aware link opacity: links between distant (far)
              // particles are fainter, reinforcing the depth illusion.
              const depthFactor = 0.5 + ((a.z + b.z) * 0.5) * 0.5;

              ctx.strokeStyle = `rgba(${FX_PARTICLE_LINK}, ${alpha * depthFactor})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
              drawn.add(pairKey);
            }
          }
        }
      }
    }
  }

  // ---- Main loop --------------------------------------------------------
  let rafId = null;

  function frame(now) {
    ctx.clearRect(0, 0, width, height);

    updatePendulum(now);

    const idleFor = now - pointer.lastMove;
    const mouseStrength = pointer.active
      ? Math.max(0, 1 - Math.max(0, idleFor - MOUSE_IDLE_FADE_MS) / 600)
      : 0;

    // Ambient roaming light — gives the scene life even when the pointer
    // is idle. Strength oscillates gently so it's never flat.
    const ambient = ambientLightPos(now);
    const ambientStrength = 0.35 + 0.15 * Math.sin(now / 6000);

    drawAmbientLight(ambient.x, ambient.y, AMBIENT_LIGHT_RADIUS, FX_GLOW_AMBIENT, ambientStrength);
    drawAmbientLight(pointer.x, pointer.y, MOUSE_LIGHT_RADIUS, FX_GLOW_CURSOR, mouseStrength);
    drawAmbientLight(pendulum.bobX, pendulum.bobY, PENDULUM_LIGHT_RADIUS, FX_GLOW_PENDULUM, 0.7);

    drawPendulum(now);
    updateAndDrawParticles(now, mouseStrength);

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

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // If reduced-motion is enabled mid-session, stop the loop and let
  // base.css hide the canvas.
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduceMotionQuery.addEventListener("change", (event) => {
    if (event.matches) {
      stop();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    }
  });

  resize();
  start();
}
