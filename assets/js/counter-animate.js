/**
 * PURPOSE
 *   Animate numeric counters when they scroll into view.
 *   Counts up from 0 to target over ~1 second (or longer on first visit).
 *
 * DATA ATTRIBUTE
 *   Use [data-counter="NUMBER"] on any element to animate it.
 *   Example: <span data-counter="50">50</span>
 *
 * DEPENDENCIES
 *   IntersectionObserver, prefers-reduced-motion
 *
 * SAFE EDITS
 *   Tune COUNTER_DURATION_MS and FIRST_VISIT_MULTIPLIER below.
 */

const COUNTER_DURATION_MS = 1200; // 1.2 seconds per count
const FIRST_VISIT_MULTIPLIER = 3; // 3x slower on first visit (3.6 seconds)
const FIRST_VISIT_MARKER = "pf-counters-animated";

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

function animateCounter(element, target, duration) {
  const start = Date.now();
  const original = element.textContent;

  const updateCount = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.floor(progress * target);

    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(updateCount);
    } else {
      element.textContent = target;
      element.dataset.counted = "true";
    }
  };

  updateCount();
}

export function initCounters() {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotionQuery.matches) return;

  isFirstVisit = isFirstPageVisit();
  const duration = isFirstVisit
    ? COUNTER_DURATION_MS * FIRST_VISIT_MULTIPLIER
    : COUNTER_DURATION_MS;

  const counters = document.querySelectorAll("[data-counter]");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !entry.target.dataset.counted) {
          const target = parseInt(entry.target.dataset.counter, 10);
          if (!isNaN(target)) {
            animateCounter(entry.target, target, duration);
          }
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((el) => observer.observe(el));

  if (isFirstVisit) {
    markFirstVisitComplete();
  }
}
