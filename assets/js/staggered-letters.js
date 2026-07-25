/**
 * PURPOSE
 *   Staggered letter-by-letter reveal animation for H2 headings.
 *   Each letter fades and slides in sequentially (longer on first visit: ~4-5 seconds).
 *
 * DEPENDENCIES
 *   prefers-reduced-motion media query
 *
 * SAFE EDITS
 *   Tune timing in micro-interactions.css (.animate-letters span animation).
 */

const LETTER_DELAY_MS = 60; // Delay between each letter (ms)
const FIRST_VISIT_MULTIPLIER = 1.8; // Make it 80% slower on first visit
const FIRST_VISIT_MARKER = "pf-letters-animated";

let isFirstVisit = false;

function isFirstPageVisit() {
  try {
    const hasVisited = sessionStorage.getItem(FIRST_VISIT_MARKER);
    return !hasVisited;
  } catch {
    return false;
  }
}

function markFirstVisitComplete() {
  try {
    sessionStorage.setItem(FIRST_VISIT_MARKER, "1");
  } catch {
    // Private mode; degrade silently
  }
}

function wrapLetters(element) {
  const text = element.textContent;
  element.innerHTML = "";

  text.split("").forEach((char, index) => {
    const span = document.createElement("span");
    span.textContent = char;

    // Calculate delay based on whether it's first visit
    const baseDelay = LETTER_DELAY_MS * index;
    const delay = isFirstVisit ? baseDelay * FIRST_VISIT_MULTIPLIER : baseDelay;

    span.style.animationDelay = `${delay}ms`;
    element.appendChild(span);
  });

  element.classList.add("animate-letters");
}

export function initStaggeredLetters() {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotionQuery.matches) return;

  isFirstVisit = isFirstPageVisit();

  // Find all H2 elements and wrap their text
  const headings = document.querySelectorAll("h2");
  headings.forEach(heading => {
    // Skip if already animated (e.g., in rendered content)
    if (!heading.classList.contains("animate-letters")) {
      wrapLetters(heading);
    }
  });

  if (isFirstVisit) {
    markFirstVisitComplete();
  }
}
