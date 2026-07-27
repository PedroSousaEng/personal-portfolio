/**
 * PURPOSE
 *   Contact-page-only ambient background: injects a real, accurately-
 *   coastlined world map (not hand-drawn approximations) as a fixed,
 *   low-opacity decorative layer, weighted to the right side of the
 *   viewport, with a small glowing pin over Lisbon. Replaces the
 *   earlier canvas-drawn Iberian map (iberian-map.js).
 *
 * RESPONSIBILITIES
 *   - Fetch assets/images/world-map.svg exactly once and inject it,
 *     wrapped in a <div class="world-map">, as the first child of
 *     <body>.
 *   - Do nothing else. All positioning, fade, stroke styling, and the
 *     pin's pulse animation live in CSS (assets/css/effects/world-map.css)
 *     since none of it needs per-frame JS — a big simplification over
 *     the previous canvas + requestAnimationFrame approach.
 *   - Fail quietly: if the fetch fails (e.g. opened via file:// without
 *     a local server), the contact page still works fine without the
 *     decorative map.
 *
 * DEPENDENCIES
 *   assets/images/world-map.svg (the map + pin markup)
 *   assets/css/effects/world-map.css (all visual styling)
 *
 * SAFE EDITS
 *   To reposition the Lisbon pin, edit the <g class="world-map__pin">
 *   transform in the SVG asset — don't add coordinate math here.
 */

export async function initWorldMap() {
  if (document.body?.dataset.page !== "contact") return;
  if (document.querySelector(".world-map")) return;

  try {
    const response = await fetch("assets/images/world-map.svg");
    if (!response.ok) return;

    const markup = await response.text();

    const wrapper = document.createElement("div");
    wrapper.className = "world-map";
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.innerHTML = markup;

    document.body.prepend(wrapper);
  } catch (err) {
    // Decorative only — the page is fully usable without it.
    console.warn("[world-map] could not load background map:", err);
  }
}
