/**
 * PURPOSE
 *   Ambient full-viewport background effect: a giant slow-swinging
 *   pendulum, a soft particle field that reacts to the pointer, and two
 *   roaming "light" sources (pointer + pendulum bob) that modulate
 *   particle/rod brightness for a subtle dynamic-lighting feel.
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
 *
 * SAFE EDITS
 *   Tunable constants are grouped at the top of initBackgroundFX(). This
 *   module is self-contained — it never reaches into DOM outside the
 *   canvas it creates, so it's safe to add/remove the initBackgroundFX()
 *   call in main.js without touching anything else.
 */

export function initBackgroundFX() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.requestAnimationFrame !== "function") return;

  // ---- Tunables -----------------------------------------------------
  const PENDULUM_PERIOD_MS = 14000; // full swing cycle — slow & giant
  const PENDULUM_AMPLITUDE = 0.26; // radians (~15deg either side)
  const PENDULUM_PIVOT_X_RATIO = 0.72;
  const PENDULUM_PIVOT_Y_RATIO = -0.08;
  const PENDULUM_ROD_LENGTH_RATIO = 0.95;

  const PARTICLE_AREA_DIVISOR = 14000; // lower = more particles
  const PARTICLE_MIN = 40;
  const PARTICLE_MAX = 110;
  const PARTICLE_LINK_DIST = 105;
  const MOUSE_REPEL_RADIUS = 130;
  const MOUSE_LIGHT_RADIUS = 260;
  const PENDULUM_LIGHT_RADIUS = 320;
  const MOUSE_IDLE_FADE_MS = 1400;

  // ---- Canvas setup ---------------------------------------------------
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
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedParticlesIfNeeded();
  }

  // ---- Pointer tracking ------------------------------------------------
  const pointer = { x: width / 2, y: height / 2, active: false, lastMove: 0 };

  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      pointer.lastMove = performance.now();
    },
    { passive: true }
  );

  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  // ---- Particles ------------------------------------------------------
  let particles = [];

  function targetParticleCount() {
    const count = Math.round((width * height) / PARTICLE_AREA_DIVISOR);
    return Math.max(PARTICLE_MIN, Math.min(PARTICLE_MAX, count));
  }

  function makeParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: 1.4 + Math.random() * 2.0,
      twinklePhase: Math.random() * Math.PI * 2,
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

  function drawPendulum() {
    const { pivotX, pivotY, bobX, bobY } = pendulum;

    // Rod: bright silvery line, glowing faintly along its length.
    ctx.save();
    ctx.shadowColor = "rgba(174, 184, 255, 0.5)";
    ctx.shadowBlur = 6;
    const rodGradient = ctx.createLinearGradient(pivotX, pivotY, bobX, bobY);
    rodGradient.addColorStop(0, "rgba(180, 190, 220, 0.15)");
    rodGradient.addColorStop(1, "rgba(210, 216, 255, 0.85)");
    ctx.strokeStyle = rodGradient;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    ctx.restore();

    // Small pivot anchor so the rod visibly hangs from something.
    ctx.fillStyle = "rgba(210, 216, 255, 0.4)";
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bob glow: large, saturated warm halo — the pendulum's signature.
    const glowR = 90;
    const glow = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, glowR);
    glow.addColorStop(0, "rgba(255, 190, 100, 0.9)");
    glow.addColorStop(0.35, "rgba(255, 170, 70, 0.45)");
    glow.addColorStop(1, "rgba(255, 170, 70, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bobX, bobY, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Bob core.
    ctx.save();
    ctx.shadowColor = "rgba(255, 200, 120, 0.9)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(255, 225, 180, 0.95)";
    ctx.beginPath();
    ctx.arc(bobX, bobY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- Dynamic lighting (roaming glow pools) ---------------------------
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

  // ---- Particle update + draw -------------------------------------------
  function updateAndDrawParticles(now, mouseStrength) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Gentle independent drift.
      p.x += p.vx;
      p.y += p.vy;

      // Pointer repulsion.
      if (mouseStrength > 0) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < MOUSE_REPEL_RADIUS) {
          const force = ((MOUSE_REPEL_RADIUS - dist) / MOUSE_REPEL_RADIUS) * 0.6 * mouseStrength;
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

      // Lighting contribution from pointer + pendulum bob.
      const distMouse = Math.hypot(p.x - pointer.x, p.y - pointer.y);
      const litByMouse = mouseStrength > 0 ? Math.max(0, 1 - distMouse / MOUSE_LIGHT_RADIUS) * mouseStrength : 0;

      const distBob = Math.hypot(p.x - pendulum.bobX, p.y - pendulum.bobY);
      const litByBob = Math.max(0, 1 - distBob / PENDULUM_LIGHT_RADIUS);

      const twinkle = 0.75 + 0.25 * Math.sin(now / 1800 + p.twinklePhase);
      const brightness = Math.min(1, 0.45 * twinkle + litByMouse * 0.85 + litByBob * 0.6);

      const radius = p.r + brightness * 1.8;
      ctx.save();
      if (brightness > 0.55) {
        ctx.shadowColor = "rgba(174, 184, 255, 0.8)";
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(190, 198, 255, ${0.35 + brightness * 0.65})`;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Faint constellation links between nearby particles.
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < PARTICLE_LINK_DIST) {
          const alpha = (1 - dist / PARTICLE_LINK_DIST) * 0.22;
          ctx.strokeStyle = `rgba(160, 168, 200, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
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
    const mouseStrength = pointer.active ? Math.max(0, 1 - Math.max(0, idleFor - MOUSE_IDLE_FADE_MS) / 600) : 0;

    drawAmbientLight(pointer.x, pointer.y, MOUSE_LIGHT_RADIUS, "108, 124, 255", mouseStrength);
    drawAmbientLight(pendulum.bobX, pendulum.bobY, PENDULUM_LIGHT_RADIUS, "255, 179, 71", 0.7);

    drawPendulum();
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

  resize();
  start();
}
