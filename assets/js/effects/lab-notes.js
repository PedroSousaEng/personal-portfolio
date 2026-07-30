/**
 * PURPOSE
 *   Lab Notes-only ambient background: a ruled notebook page (see
 *   assets/css/effects/lab-notes.css for the full rationale on why this
 *   is deliberately NOT a repeat of About's schematic grid or Projects'
 *   dust/spotlight). Static by design — this page is for reading — with
 *   a single slow ambient glow drift handled entirely in CSS.
 *
 * RESPONSIBILITIES
 *   - Inject a <div class="bg-fx bg-fx--labnotes"> as the first child of
 *     <body> and do nothing else. No requestAnimationFrame loop: the only
 *     motion (the glow drift) is a CSS animation, which the browser
 *     already suspends under prefers-reduced-motion via the global rule
 *     in base.css.
 *
 * DEPENDENCIES
 *   assets/css/base.css (.bg-fx positioning + reduced-motion guard)
 *   assets/css/effects/lab-notes.css (all visual styling)
 *   assets/css/tokens.css (--fx-labnotes-* tokens)
 *
 * SAFE EDITS
 *   This module is intentionally tiny. Visual tuning belongs in
 *   lab-notes.css, not here.
 */

export function initLabNotesBackground() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const page = document.body?.dataset.page;
  if (page !== "lab-notes" && page !== "lab-note") return;
  if (document.querySelector(".bg-fx--labnotes")) return;

  const layer = document.createElement("div");
  layer.className = "bg-fx bg-fx--labnotes";
  layer.setAttribute("aria-hidden", "true");
  document.body.prepend(layer);
}
