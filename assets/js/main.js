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
 *
 * DEPENDENCIES
 *   render-projects.js, render-about.js
 *
 * SAFE EDITS
 *   To wire up a new page's data rendering, add a case to initPageData()
 *   below rather than adding a script tag/logic to that page's HTML.
 */

import { renderProjects } from "./render-projects.js";
import { renderSkills, renderExperience, renderTimeline } from "./render-about.js";
import { renderContact } from "./render-contact.js";

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

function init() {
  initNav();
  initFooterYear();
  initPageData();
}

document.addEventListener("DOMContentLoaded", init);
