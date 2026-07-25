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
 *   - PENDULUM BOB IS NOW CLICKABLE: clicking triggers a MASSIVE expanding wave
 *     that travels to all screen corners. Cooldown prevents spam.
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
  if (document.querySelector(".bg-fx")) return;

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

  // Pendulum clickable wave — slow ocean-swell version
  const WAVE_COOLDOWN_MS = 1600; // Min time between clicks (waves now last longer)
  const WAVE_CLICK_RADIUS = 16; // Detect click within this radius of bob
  const WAVE_MAX_RADIUS = Math.max(window.innerWidth, window.innerHeight) * 1.5; // Goes to screen corners
  const WAVE_DURATION_MS = 8000; // Slow, rolling pace — like a swell crossing open water
  const WAVE_LINE_WIDTH = 3;
  const WAVE_COLOR = "107, 124, 255"; // Indigo blue, as an "r, g, b" triplet

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
  const grid = new Map();
  const gridCellPool = [];
  const activeGridCells = [];

  function buildGrid() {
    // Reuse cell arrays so the spatial hash remains allocation-free after
    // warm-up. Node membership is rebuilt, but storage is retained.
    for (let i = 0; i < activeGridCells.length; i++) {
      const cell = activeGridCells[i];
      cell.length = 0;
      gridCellPool.push(cell);
    }
    activeGridCells.length = 0;
    grid.clear();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const cx = Math.floor(p.x / GRID_CELL);
      const cy = Math.floor(p.y / GRID_CELL);
      const key = cx * 100000 + cy;
      let cell = grid.get(key);
      if (!cell) {
        cell = gridCellPool.pop() || [];
        grid.set(key, cell);
        activeGridCells.push(cell);
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

  // ---- Clickable wave effect on pendulum --------------------------------
  let waves = []; // { createdAt, originX, originY }
  let lastWaveTime = 0;

  function triggerWave() {
    const now = performance.now();
    if (now - lastWaveTime < WAVE_COOLDOWN_MS) return; // Cooldown
    lastWaveTime = now;
    waves.push({ createdAt: now, originX: pendulum.bobX, originY: pendulum.bobY });
  }

  function drawWaves(now) {
    const activeWaves = [];
    for (const wave of waves) {
      const elapsed = now - wave.createdAt;
      if (elapsed > WAVE_DURATION_MS) continue; // Wave disappears after duration

      const linear = elapsed / WAVE_DURATION_MS;

      // Ease-out cubic: the ring pushes out quickly at first, then keeps
      // decelerating for most of its life — the rolling, losing-energy
      // feel of a real swell rather than a ripple expanding at constant
      // speed.
      const eased = 1 - Math.pow(1 - linear, 3);
      const radius = eased * WAVE_MAX_RADIUS;

      // Quick fade-in, then hold near-full brightness through the middle,
      // then fade out over the back half — keeps the ring clearly readable
      // for most of its life instead of thinning out from frame one.
      const fadeIn = Math.min(1, linear * 6);
      const fadeOut = 1 - Math.max(0, (linear - 0.65) / 0.35);
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut));

      // NOTE: this used to draw via ctx.shadowBlur for the glow. shadowBlur
      // forces the compositor to blur the shape's entire bounding box —
      // fine for a small particle, but this ring's bounding box can span
      // most (or all) of the viewport at full radius. Redrawn every frame
      // for the ~8s the wave is alive, that was expensive enough to stall
      // the tab (and on some GPUs lose the canvas context entirely, which
      // is why the whole scene could freeze and go black after a click).
      // A few concentric strokes of falling alpha/width fake the same soft
      // halo for a fraction of the cost — same trick already used for the
      // particle glow above.
      ctx.save();
      ctx.strokeStyle = `rgba(${WAVE_COLOR}, ${alpha * 0.85})`;
      ctx.lineWidth = WAVE_LINE_WIDTH;
      ctx.beginPath();
      ctx.arc(wave.originX, wave.originY, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(${WAVE_COLOR}, ${alpha * 0.32})`;
      ctx.lineWidth = WAVE_LINE_WIDTH + 6;
      ctx.beginPath();
      ctx.arc(wave.originX, wave.originY, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(${WAVE_COLOR}, ${alpha * 0.14})`;
      ctx.lineWidth = WAVE_LINE_WIDTH + 14;
      ctx.beginPath();
      ctx.arc(wave.originX, wave.originY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      activeWaves.push(wave);
    }
    waves = activeWaves;
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
    // Now using blue/white colors instead of amber
    const breath = Math.sin((now / BOB_GLOW_BREATH_PERIOD_MS) * Math.PI * 2);
    const glowR = BOB_GLOW_BASE_R + breath * BOB_GLOW_BREATH_AMP;
    const glowIntensity = 0.82 + breath * 0.12;

    const glow = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, glowR);
    glow.addColorStop(0, `rgba(${FX_GLOW_CURSOR}, ${0.9 * glowIntensity})`);
    glow.addColorStop(0.35, `rgba(${FX_GLOW_CURSOR}, ${0.45 * glowIntensity})`);
    glow.addColorStop(1, `rgba(${FX_GLOW_CURSOR}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bobX, bobY, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Bob core: WHITE/BLUISH instead of amber
    ctx.save();
    ctx.shadowColor = `rgba(${FX_GLOW_CURSOR}, ${0.9 * glowIntensity})`;
    ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(200, 220, 255, 0.95)`; // Bright blue-white
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
  const ambientLight = { x: 0, y: 0 };

  function updateAmbientLightPosition(now) {
    const t = (now / AMBIENT_DRIFT_PERIOD_MS) * Math.PI * 2;
    ambientLight.x = width * (0.5 + 0.32 * Math.sin(t));
    ambientLight.y = height * (0.5 + 0.28 * Math.sin(t * 1.3 + 0.7));
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

      // Bright particles get a slightly larger/softer radius instead of a
      // real shadowBlur pass — shadowBlur forces a per-draw blur convolution
      // on the canvas compositor and was the single most expensive line in
      // this loop when dozens of particles were lit at once.
      ctx.beginPath();
      ctx.fillStyle = `rgba(${FX_PARTICLE}, ${alpha})`;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Faint constellation links between nearby particles — spatial grid
    // reduces this from O(n²) to roughly O(n·k) where k is the average
    // particles per grid cell neighbourhood. Links are grouped into a
    // handful of alpha buckets and drawn as one path per bucket instead of
    // one beginPath/stroke pair per link — previously the biggest source of
    // draw-call overhead on a dense particle field.
    buildGrid();
    const alphaStep = 0.22 / LINK_ALPHA_BUCKETS;
    for (let i = 0; i < LINK_ALPHA_BUCKETS; i++) linkBuckets[i].length = 0;

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
              const finalAlpha = alpha * depthFactor;
              if (finalAlpha < 0.006) continue;

              const bucketIndex = Math.min(
                LINK_ALPHA_BUCKETS - 1,
                Math.floor(finalAlpha / alphaStep)
              );
              linkBuckets[bucketIndex].push(a.x, a.y, b.x, b.y);
            }
          }
        }
      }
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < LINK_ALPHA_BUCKETS; i++) {
      const bucket = linkBuckets[i];
      if (!bucket.length) continue;
      ctx.globalAlpha = Math.min(0.22, (i + 0.5) * alphaStep);
      ctx.strokeStyle = `rgb(${FX_PARTICLE_LINK})`;
      ctx.beginPath();
      for (let j = 0; j < bucket.length; j += 4) {
        ctx.moveTo(bucket[j], bucket[j + 1]);
        ctx.lineTo(bucket[j + 2], bucket[j + 3]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Link draw batching (alpha-bucketed, single path per bucket) -----
  const LINK_ALPHA_BUCKETS = 16;
  const linkBuckets = Array.from({ length: LINK_ALPHA_BUCKETS }, () => []);

  // ---- Main loop --------------------------------------------------------
  let rafId = null;

  // Ambient/decorative effect: capping to ~30fps halves CPU/GPU cost with
  // no perceptible loss of smoothness for slow drifting motion like this.
  const FRAME_INTERVAL_MS = 1000 / 30;
  let lastFrameTime = 0;

  function frame(now) {
    if (now - lastFrameTime < FRAME_INTERVAL_MS) {
      rafId = window.requestAnimationFrame(frame);
      return;
    }
    lastFrameTime = now;

    // Defensive: an uncaught error in any of the drawing calls below would
    // otherwise stop requestAnimationFrame from ever being re-scheduled,
    // permanently freezing the whole scene on whatever the last clearRect
    // left behind (i.e. a blank canvas over the page's dark background —
    // reads as "everything stopped and turned black"). Catching here means
    // a bad frame just gets skipped instead of killing the loop forever.
    try {
      ctx.clearRect(0, 0, width, height);

      updatePendulum(now);

      const idleFor = now - pointer.lastMove;
      const mouseStrength = pointer.active
        ? Math.max(0, 1 - Math.max(0, idleFor - MOUSE_IDLE_FADE_MS) / 600)
        : 0;

      // Ambient roaming light — gives the scene life even when the pointer
      // is idle. Strength oscillates gently so it's never flat.
      updateAmbientLightPosition(now);
      const ambientStrength = 0.35 + 0.15 * Math.sin(now / 6000);

      drawAmbientLight(ambientLight.x, ambientLight.y, AMBIENT_LIGHT_RADIUS, FX_GLOW_AMBIENT, ambientStrength);
      drawAmbientLight(pointer.x, pointer.y, MOUSE_LIGHT_RADIUS, FX_GLOW_CURSOR, mouseStrength);
      drawAmbientLight(pendulum.bobX, pendulum.bobY, PENDULUM_LIGHT_RADIUS, FX_GLOW_CURSOR, 0.7);

      drawPendulum(now);
      drawWaves(now);
      updateAndDrawParticles(now, mouseStrength);
    } catch (err) {
      // Drop whatever caused it (most likely a stray wave) rather than
      // let one bad frame take the whole ambient effect down with it.
      waves = [];
      console.error("[background-fx] frame error, skipping frame:", err);
    }

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

  let resizeTimer = null;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function onVisibilityChange() {
    if (document.hidden) stop();
    else start();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }

  function destroy() {
    stop();
    clearTimeout(resizeTimer);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("click", onClick);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reduceMotionQuery.removeEventListener("change", onReduceMotionChange);
    canvas.removeEventListener("contextlost", onContextLost);
    canvas.removeEventListener("contextrestored", onContextRestored);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  function onReduceMotionChange(event) {
    // If reduced-motion is enabled mid-session, fully release the canvas
    // and listeners instead of only stopping the frame loop.
    if (event.matches) destroy();
  }

  // ---- Canvas click detection for pendulum ------
  function onClick(event) {
    // Get canvas position relative to viewport
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // pendulum.bobX/bobY are already in CSS-pixel space (the canvas
    // context is scaled once via ctx.setTransform(dpr, ...) in resize(),
    // and updatePendulum() derives bobX/bobY from `width`/`height`, which
    // are themselves CSS pixels). Dividing by dpr again here shrank the
    // click target toward the top-left on any screen with dpr > 1
    // (e.g. Retina/high-DPI displays), so clicks on the actual bob missed.
    const bobX = pendulum.bobX;
    const bobY = pendulum.bobY;
    const dx = x - bobX;
    const dy = y - bobY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < WAVE_CLICK_RADIUS) {
      triggerWave();
    }
  }

  // ---- Canvas context loss recovery --------------------------------
  // Heavy GPU-side canvas work (or unrelated memory pressure from other
  // tabs) can cause the browser to drop the canvas's rendering context.
  // Without handling this, every subsequent draw call silently no-ops,
  // the canvas stays permanently blank, and the whole scene looks
  // "frozen and black" with no way to recover short of a page reload.
  function onContextLost(event) {
    event.preventDefault();
    stop();
  }

  function onContextRestored() {
    seedParticlesIfNeeded();
    start();
  }

  canvas.addEventListener("contextlost", onContextLost);
  canvas.addEventListener("contextrestored", onContextRestored);

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("click", onClick, { passive: true });
  reduceMotionQuery.addEventListener("change", onReduceMotionChange);

  resize();
  start();
}
