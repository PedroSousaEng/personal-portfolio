/**
 * PURPOSE
 *   The single JS entry point loaded by every page.
 *
 * RESPONSIBILITIES
 *   - Wire up the mobile nav toggle (aria-expanded, focus handling, Escape
 *     to close).
 *   - Set the footer's copyright year.
 *   - Call the correct render-*.js function(s) for the current page, based
 *     on the `data-page` attribute on <body>.
 *   - Boot Phase 8 global polish modules: reduced-motion, page
 *     transitions and SVG line-draw.
 *
 * DEPENDENCIES
 *   render-projects.js, render-about.js, background-fx.js, scroll-reveal.js,
 *   cursor.js, magnetic.js, text-decode.js, tilt.js, reduced-motion.js,
 *   page-transitions.js, svg-line-draw.js,
 *   effects/{tech-network,projects-spotlight,contact-radar,error-signal}.js
 *
 * SAFE EDITS
 *   To wire up a new page's data rendering, add a case to initPageData()
 *   below rather than adding a script tag/logic to that page's HTML.
 */

import { renderProjects } from "./render-projects.js";
import { renderSkills, renderExperience, renderTimeline } from "./render-about.js";
import { renderContact } from "./render-contact.js";
import { initSiteIdentity } from "./render-site.js";
import { initBackgroundFX } from "./background-fx.js";
import { initTechNetwork } from "./effects/tech-network.js";
import { initProjectsSpotlight } from "./effects/projects-spotlight.js";
import { initContactRadar } from "./effects/contact-radar.js";
import { initErrorSignal } from "./effects/error-signal.js";
import { initScrollReveal } from "./scroll-reveal.js";
import { initCursor } from "./cursor.js";
import { initMagneticButtons } from "./magnetic.js";
import { initTextDecode } from "./text-decode.js";
import { initCardTilt } from "./tilt.js";
import { initReducedMotion } from "./reduced-motion.js";
import { initPageTransitions } from "./page-transitions.js";
import { initSvgLineDraw } from "./svg-line-draw.js";
import { initScrollProgress } from "./scroll-progress.js";

let initialized = false;

/** Wires up the mobile navigation toggle button and overlay menu. */
function initNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");

  if (!toggle || !menu) return;

  const closeMenu = () => {
    menu.dataset.open = "false";
    toggle.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    menu.dataset.open = "true";
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", () => {
    const isOpen = menu.dataset.open === "true";
    isOpen ? closeMenu() : openMenu();
  });

  menu.addEventListener("click", (event) => {
    if (event.target.tagName === "A") closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.dataset.open === "true") {
      closeMenu();
      toggle.focus();
    }
  });

  // Close the mobile overlay automatically if the viewport grows past the
  // point where it's no longer needed, so it can't be left open+hidden.
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", (event) => {
    if (event.matches) closeMenu();
  });
}

/** Sets the footer year element's text to the current year. */
function initFooterYear() {
  const yearEl = document.querySelector("[data-current-year]");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

/** Calls the appropriate render function(s) for the current page. */
function initPageData() {
  const page = document.body.dataset.page;

  if (page === "home") {
    const featuredEl = document.querySelector("[data-featured-projects]");
    if (featuredEl) renderProjects(featuredEl, { featuredOnly: true });
  }

  if (page === "projects") {
    const allEl = document.querySelector("[data-all-projects]");
    if (allEl) renderProjects(allEl, { featuredOnly: false });
  }

  if (page === "about") {
    const skillsEl = document.querySelector("[data-skills]");
    const experienceEl = document.querySelector("[data-experience]");
    const timelineEl = document.querySelector("[data-timeline]");
    if (skillsEl) renderSkills(skillsEl);
    if (experienceEl) renderExperience(experienceEl);
    if (timelineEl) renderTimeline(timelineEl);
  }

  if (page === "contact") {
    const contactEl = document.querySelector("[data-contact]");
    if (contactEl) renderContact(contactEl);
  }
}

/**
 * Route the page to the correct ambient background effect.
 *   home    -> initBackgroundFX()      : pendulum + particle field + lighting
 *   about   -> initTechNetwork()       : nodes / links / slow orbits + parallax
 *   projects-> initProjectsSpotlight() : mouse-led spotlight wash
 *   contact -> initContactRadar()      : slow radar sweep + signal blips
 *   404     -> initErrorSignal()       : broken signal lines + interference
 *
 * Each effect module is self-contained: it injects its own <canvas>,
 * owns its own rAF loop, and honours prefers-reduced-motion internally.
 * Never call more than one on the same page — they'd stack.
 */
function initPageBackground() {
  const page = document.body.dataset.page;

  if (page === "home") {
    initBackgroundFX();
  } else if (page === "about") {
    initTechNetwork();
  } else if (page === "projects") {
    initProjectsSpotlight();
  } else if (page === "contact") {
    initContactRadar();
  } else if (page === "404") {
    initErrorSignal();
  }
}

function init() {
  if (initialized) return;
  initialized = true;

  // Reduced-motion first so the boolean is mirrored on <body>
  // before any subsequent module inspects it.
  initReducedMotion();

  initSiteIdentity();
  initNav();
  initFooterYear();
  initPageData();
  initPageBackground();
  initScrollReveal();
  initCursor();
  initMagneticButtons();
  initTextDecode();
  initCardTilt();

  // Phase 8 polish: scroll progress, SVG line-draw, page fade.
  initScrollProgress();
  initSvgLineDraw();
  initPageTransitions();
}

document.addEventListener("DOMContentLoaded", init);
