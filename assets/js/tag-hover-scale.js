/**
 * PURPOSE
 *   Small scale + color shift on tag/badge hover.
 *   Applies to .tag, .pill, and skill category badges.
 *
 * DEPENDENCIES
 *   prefers-reduced-motion media query
 *
 * SAFE EDITS
 *   Tune scale amount and color in micro-interactions.css (.tag--hover-active).
 */

export function initTagHoverScale() {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotionQuery.matches) return;

  const tags = document.querySelectorAll(".tag, .pill, [data-skill-category]");

  tags.forEach((tag) => {
    tag.addEventListener("mouseenter", () => {
      tag.classList.add("tag--hover-active");
    });

    tag.addEventListener("mouseleave", () => {
      tag.classList.remove("tag--hover-active");
    });

    // Also support keyboard focus for accessibility
    tag.addEventListener("focus", () => {
      tag.classList.add("tag--hover-active");
    });

    tag.addEventListener("blur", () => {
      tag.classList.remove("tag--hover-active");
    });
  });
}
