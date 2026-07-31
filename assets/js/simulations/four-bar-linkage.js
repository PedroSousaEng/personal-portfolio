/**
 * PURPOSE
 *   Interactive four-bar linkage simulator for Lab Notes. Original
 *   implementation from first-principles planar kinematics (vector loop
 *   closure + circle-circle intersection) — not derived from or modeled
 *   after any third-party simulator's code or UI.
 *
 * MECHANISM MODEL
 *   Four pin-jointed links in a plane:
 *     link1 (ground)  — fixed, length g, laid along the x-axis: O2=(0,0), O4=(g,0)
 *     link2 (crank)   — driven, length a, angle θ2 (the input we animate)
 *     link3 (coupler) — length b, connects crank pin A to rocker pin B
 *     link4 (rocker)  — length c, connects ground pivot O4 to B
 *
 *   Given θ2, A is fixed. B must satisfy |B - A| = b AND |B - O4| = c,
 *   i.e. B is one of the (at most two) intersection points of a circle
 *   of radius b centered at A and a circle of radius c centered at O4.
 *   This is the standard analytic solution for a 4-bar position problem
 *   (no iterative solver needed). We track the previous B and keep
 *   whichever candidate is closer to it, so the mechanism doesn't
 *   randomly flip assembly branch between frames.
 *
 *   Grashof's law (s = shortest link, l = longest, p/q = the other two):
 *   if s + l <= p + q, at least one link can fully rotate relative to
 *   the ground. Rather than special-casing which link that is, we just
 *   drive θ2 forward each frame and geometrically check whether the two
 *   circles still intersect; if they don't (the mechanism has reached a
 *   toggle/limit position), we reverse direction. That single check
 *   correctly produces full rotation for Grashof mechanisms where link2
 *   is the shortest-or-ground link, and correct oscillation for every
 *   other case (Grashof rocker-output, and non-Grashof) — no
 *   classification-specific driving logic required.
 *
 * RESPONSIBILITIES
 *   - initFourBarLinkage(containerEl): build the SVG stage + control
 *     panel inside containerEl, wire up sliders, run the rAF loop.
 *   - Trace a coupler point (rigidly offset from the coupler link) to
 *     draw the coupler curve live.
 *   - Respect prefers-reduced-motion: mechanism starts paused; the user
 *     can still press Play (an explicit, user-initiated action).
 *
 * DEPENDENCIES
 *   assets/css/simulations/four-bar-linkage.css (all visual styling —
 *   this file only sets SVG geometry attributes, no inline styling).
 *
 * SAFE EDITS
 *   Slider ranges/defaults are in DEFAULTS below. Visual styling
 *   (colors, stroke widths, panel layout) belongs in the CSS file, not
 *   here — this file should only ever set x/y/d/transform attributes.
 */

const DEFAULTS = {
  ground: 160,
  crank: 60,
  coupler: 140,
  rocker: 100,
};

const LIMITS = { min: 20, max: 220 };
const SPEED = 0.9; // radians/sec at the crank
const TRACE_MAX_POINTS = 300;
const VIEW_W = 640;
const VIEW_H = 420;
// Cap our own work to ~30fps. The mechanism doesn't need 60fps to read
// as smooth, and this halves the per-frame cost competing with the
// site's own cursor rAF loop (see cursor.js's PERF NOTE — this is the
// same class of regression, fixed the same way: do less work per frame).
const MIN_FRAME_MS = 1000 / 30;
// Full trace-path string rebuilds are the most expensive thing this
// widget does (building an SVG path `d` string from up to
// TRACE_MAX_POINTS points). Only rebuild it a few times a second — the
// mechanism itself still animates every throttled frame; only the trail
// redraw is decoupled and slower.
const TRACE_REBUILD_MS = 120;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

/**
 * Circle-circle intersection. Returns [p1, p2] (each {x,y}) or null if
 * the circles don't intersect (mechanism can't reach this θ2).
 */
function circleIntersect(c0, r0, c1, r1) {
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy);

  if (d > r0 + r1 || d < Math.abs(r0 - r1) || d === 0) return null;

  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const hSq = r0 * r0 - a * a;
  if (hSq < 0) return null;
  const h = Math.sqrt(hSq);

  const xm = c0.x + (a * dx) / d;
  const ym = c0.y + (a * dy) / d;

  const rx = -dy * (h / d);
  const ry = dx * (h / d);

  return [
    { x: xm + rx, y: ym + ry },
    { x: xm - rx, y: ym - ry },
  ];
}

function classify(g, a, b, c) {
  const lengths = [g, a, b, c];
  const s = Math.min(...lengths);
  const l = Math.max(...lengths);
  const sum = g + a + b + c;
  const isGrashof = s + l <= sum - s - l + 0.001; // s + l <= p + q

  if (!isGrashof) return "Non-Grashof — every link rocks, none fully rotates";
  if (s === g) return "Grashof Double-Crank — both links pivoting on the ground fully rotate";
  if (s === a) return "Grashof Crank-Rocker — the driven crank fully rotates, the rocker oscillates";
  if (s === c) return "Grashof Rocker-Crank — driving this link, it can only oscillate (the rocker would be the one to fully rotate)";
  return "Grashof Double-Rocker — the coupler is shortest; both ground-pivoted links oscillate";
}

export function initFourBarLinkage(containerEl) {
  if (!containerEl) return;

  const state = {
    ...DEFAULTS,
    theta2: 0.6,
    direction: 1,
    running: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    prevB: null,
    trace: [],
    lastFrameTime: null,
    lastRenderTime: 0,
    lastTraceBuildTime: 0,
    traceDirty: true,
    inView: true,
    cachedScale: null,
    classification: classify(DEFAULTS.ground, DEFAULTS.crank, DEFAULTS.coupler, DEFAULTS.rocker),
  };

  containerEl.classList.add("fourbar");
  containerEl.innerHTML = "";

  // ---- Control panel -----------------------------------------------
  const panel = document.createElement("div");
  panel.className = "fourbar__panel";

  const sliderDefs = [
    { key: "ground", label: "Ground link" },
    { key: "crank", label: "Crank" },
    { key: "coupler", label: "Coupler" },
    { key: "rocker", label: "Rocker" },
  ];

  const sliders = {};
  for (const def of sliderDefs) {
    const row = document.createElement("label");
    row.className = "fourbar__control";

    const labelText = document.createElement("span");
    labelText.className = "fourbar__control-label";
    labelText.textContent = def.label;

    const valueText = document.createElement("span");
    valueText.className = "fourbar__control-value";
    valueText.textContent = String(state[def.key]);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(LIMITS.min);
    input.max = String(LIMITS.max);
    input.value = String(state[def.key]);
    input.setAttribute("aria-label", def.label);

    input.addEventListener("input", () => {
      state[def.key] = Number(input.value);
      valueText.textContent = input.value;
      state.trace = [];
      state.prevB = null;
      state.cachedScale = null;
      state.traceDirty = true;
      state.classification = classify(state.ground, state.crank, state.coupler, state.rocker);
    });

    const labelRow = document.createElement("div");
    labelRow.className = "fourbar__control-head";
    labelRow.appendChild(labelText);
    labelRow.appendChild(valueText);

    row.appendChild(labelRow);
    row.appendChild(input);
    panel.appendChild(row);
    sliders[def.key] = input;
  }

  const buttonRow = document.createElement("div");
  buttonRow.className = "fourbar__buttons";

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "btn btn--secondary";
  playBtn.textContent = state.running ? "Pause" : "Play";

  const resetTraceBtn = document.createElement("button");
  resetTraceBtn.type = "button";
  resetTraceBtn.className = "btn btn--ghost";
  resetTraceBtn.textContent = "Clear trace";

  playBtn.addEventListener("click", () => {
    state.running = !state.running;
    playBtn.textContent = state.running ? "Pause" : "Play";
    state.lastFrameTime = null;
    if (state.running) requestAnimationFrame(loop);
  });

  resetTraceBtn.addEventListener("click", () => {
    state.trace = [];
    state.traceDirty = true;
  });

  buttonRow.appendChild(playBtn);
  buttonRow.appendChild(resetTraceBtn);
  panel.appendChild(buttonRow);

  const readout = document.createElement("p");
  readout.className = "fourbar__readout";
  panel.appendChild(readout);

  // ---- SVG stage -----------------------------------------------------
  const stage = document.createElement("div");
  stage.className = "fourbar__stage";

  const svg = svgEl("svg", {
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    class: "fourbar__svg",
    "aria-hidden": "true",
  });

  const traceGroup = svgEl("g", { class: "fourbar__trace-group" });
  const tracePath = svgEl("path", { class: "fourbar__trace" });
  traceGroup.appendChild(tracePath);

  const groundLine = svgEl("path", { class: "fourbar__link fourbar__link--ground" });
  const crankLine = svgEl("path", { class: "fourbar__link fourbar__link--crank" });
  const couplerLine = svgEl("path", { class: "fourbar__link fourbar__link--coupler" });
  const rockerLine = svgEl("path", { class: "fourbar__link fourbar__link--rocker" });
  const couplerPointLine1 = svgEl("path", { class: "fourbar__link fourbar__link--coupler-tri" });
  const couplerPointLine2 = svgEl("path", { class: "fourbar__link fourbar__link--coupler-tri" });

  const pivotO2 = svgEl("circle", { r: 6, cx: 0, cy: 0, class: "fourbar__pivot fourbar__pivot--ground" });
  const pivotO4 = svgEl("circle", { r: 6, cx: 0, cy: 0, class: "fourbar__pivot fourbar__pivot--ground" });
  const jointA = svgEl("circle", { r: 5, cx: 0, cy: 0, class: "fourbar__pivot" });
  const jointB = svgEl("circle", { r: 5, cx: 0, cy: 0, class: "fourbar__pivot" });
  const couplerPoint = svgEl("circle", { r: 4, cx: 0, cy: 0, class: "fourbar__coupler-point" });

  svg.append(
    traceGroup,
    groundLine,
    couplerPointLine1,
    couplerPointLine2,
    crankLine,
    couplerLine,
    rockerLine,
    pivotO2,
    pivotO4,
    jointA,
    jointB,
    couplerPoint
  );

  stage.appendChild(svg);
  containerEl.appendChild(panel);
  containerEl.appendChild(stage);

  // ---- Geometry / animation ------------------------------------------

  function originAndScale() {
    if (state.cachedScale) return state.cachedScale;
    // Fit the mechanism's max possible reach inside the viewBox with margin.
    const maxReach = state.ground + state.crank + state.coupler + state.rocker;
    const scale = Math.min(VIEW_W, VIEW_H) / Math.max(maxReach * 0.9, 1);
    const ox = VIEW_W / 2 - (state.ground * scale) / 2;
    const oy = VIEW_H / 2 + 20;
    state.cachedScale = { scale, ox, oy };

    // The ground link and its two pivots only move when a slider changes
    // (they're fixed in model space at (0,0) and (ground,0)) — never
    // during animation. Redraw them here, once per slider change,
    // instead of every single animation frame.
    const O2 = { x: ox, y: oy };
    const O4 = { x: ox + state.ground * scale, y: oy };
    setLine(groundLine, O2, O4);
    setPos(pivotO2, O2);
    setPos(pivotO4, O4);

    return state.cachedScale;
  }

  function toScreen(pt, ox, oy, scale) {
    return { x: ox + pt.x * scale, y: oy - pt.y * scale };
  }

  function setLine(pathEl, p1, p2) {
    pathEl.setAttribute(
      "d",
      `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    );
  }

  function setPos(circleEl, pt) {
    circleEl.setAttribute("transform", `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
  }

  function step(dt) {
    if (state.running) {
      state.theta2 += state.direction * SPEED * dt;
    }

    const { ground: g, crank: a, coupler: b, rocker: c } = state;
    const O2 = { x: 0, y: 0 };
    const O4 = { x: g, y: 0 };

    // Tentative crank position for this frame's theta2.
    let theta2 = state.theta2;
    let A = { x: a * Math.cos(theta2), y: a * Math.sin(theta2) };
    let candidates = circleIntersect(A, b, O4, c);

    // If the mechanism can't reach this position, back off in small
    // steps until we find the limit, then reverse direction.
    let guard = 0;
    while (!candidates && guard < 40) {
      state.theta2 -= state.direction * SPEED * dt * 0.5;
      theta2 = state.theta2;
      A = { x: a * Math.cos(theta2), y: a * Math.sin(theta2) };
      candidates = circleIntersect(A, b, O4, c);
      guard += 1;
    }
    if (!candidates) {
      // Degenerate link lengths (e.g. all sliders at extremes) — bail
      // out gracefully rather than throwing.
      return null;
    }
    if (guard > 0) {
      state.direction *= -1;
    }

    let B = candidates[0];
    if (state.prevB) {
      const d0 = Math.hypot(candidates[0].x - state.prevB.x, candidates[0].y - state.prevB.y);
      const d1 = Math.hypot(candidates[1].x - state.prevB.x, candidates[1].y - state.prevB.y);
      B = d1 < d0 ? candidates[1] : candidates[0];
    }
    state.prevB = B;

    const theta3 = Math.atan2(B.y - A.y, B.x - A.x);

    // Coupler point: rigidly attached to link3, offset half the coupler
    // length along AB and ~35% perpendicular to it, so it traces an
    // interesting (non-degenerate) curve rather than retracing AB.
    const along = b * 0.5;
    const perp = b * 0.35;
    const P = {
      x: A.x + along * Math.cos(theta3) - perp * Math.sin(theta3),
      y: A.y + along * Math.sin(theta3) + perp * Math.cos(theta3),
    };

    return { A, B, P };
  }

  function render(points, now) {
    const { scale, ox, oy } = originAndScale();

    const A = toScreen(points.A, ox, oy, scale);
    const B = toScreen(points.B, ox, oy, scale);
    const P = toScreen(points.P, ox, oy, scale);
    // O2/O4 don't need recomputing here — see originAndScale, which
    // already redrew the ground link/pivots when the cache was last
    // rebuilt. They're only needed below to connect the moving links.
    const O2 = { x: ox, y: oy };
    const O4 = { x: ox + state.ground * scale, y: oy };

    setLine(crankLine, O2, A);
    setLine(couplerLine, A, B);
    setLine(rockerLine, O4, B);
    setLine(couplerPointLine1, A, P);
    setLine(couplerPointLine2, B, P);

    setPos(jointA, A);
    setPos(jointB, B);
    setPos(couplerPoint, P);

    if (state.running) {
      state.trace.push(P);
      if (state.trace.length > TRACE_MAX_POINTS) state.trace.shift();
      state.traceDirty = true;
    }

    // The trace path is the expensive part (rebuilding a string from up
    // to TRACE_MAX_POINTS points). The mechanism itself still redraws
    // every throttled frame above; only the trail redraw is decoupled
    // and slowed further, since a few-hundred-ms-old trail is visually
    // indistinguishable from an up-to-the-frame one.
    if (state.traceDirty && now - state.lastTraceBuildTime >= TRACE_REBUILD_MS) {
      if (state.trace.length > 1) {
        const parts = new Array(state.trace.length);
        for (let i = 0; i < state.trace.length; i += 1) {
          const pt = state.trace[i];
          parts[i] = `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        }
        tracePath.setAttribute("d", parts.join(""));
      } else {
        tracePath.setAttribute("d", "");
      }
      state.traceDirty = false;
      state.lastTraceBuildTime = now;
    }

    if (readout.dataset.label !== state.classification) {
      readout.textContent = state.classification;
      readout.dataset.label = state.classification;
    }
  }

  function loop(now) {
    if (!state.running || !state.inView) return;

    // Throttle our own work to ~30fps (see MIN_FRAME_MS) rather than
    // running at whatever the display refresh rate is — this is the
    // single biggest lever on how much this widget competes with the
    // page's own cursor rAF loop for frame budget.
    if (now - state.lastRenderTime < MIN_FRAME_MS) {
      requestAnimationFrame(loop);
      return;
    }

    if (state.lastFrameTime === null) state.lastFrameTime = now;
    const dt = Math.min((now - state.lastFrameTime) / 1000, 0.05);
    state.lastFrameTime = now;
    state.lastRenderTime = now;

    const points = step(dt);
    if (points) render(points, now);

    requestAnimationFrame(loop);
  }

  // Pause entirely when the tab isn't visible or the widget has
  // scrolled out of view — no reason to spend any frame budget on
  // something nobody can see.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.running && state.inView) {
      state.lastFrameTime = null;
      requestAnimationFrame(loop);
    }
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const wasInView = state.inView;
        state.inView = entries[0]?.isIntersecting ?? true;
        if (state.inView && !wasInView && state.running) {
          state.lastFrameTime = null;
          requestAnimationFrame(loop);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(containerEl);
  }

  // Render one static frame immediately (even if paused / reduced motion).
  const initialPoints = step(0);
  if (initialPoints) render(initialPoints, 0);
  if (state.running) requestAnimationFrame(loop);
}
