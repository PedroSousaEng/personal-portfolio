/**
 * PURPOSE
 *   Scroll-based entrance animation for page sections. Complements the
 *   on-load [data-animate] stagger in pages.css, which only covers the
 *   hero — this handles everything a visitor scrolls to afterwards.
 *
 * RESPONSIBILITIES
 *   - Observe every [data-reveal] element on the page.
 *   - Add .is-visible the first time each one enters the viewport.
 *   - Stop observing an element once revealed (one-shot, no re-hide on
 *     scroll back up — avoids distracting flicker).
 *
 * DEPENDENCIES
 *   assets/css/pages.css defines the actual opacity/transform transition
 *   and the prefers-reduced-motion override lives in base.css.
 *
 * SAFE EDITS
 *   Adjust `threshold`/`rootMargin` below to change how early/late a
 *   section reveals. Add data-reveal to new markup to opt it in — no JS
 *   changes needed.
 */

export function initScrollReveal() {
  const targets = document.querySelectorAll("[data-reveal]");
  if (!targets.length) return;

  // Respect reduced motion: reveal everything immediately, no observer.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
  );

  targets.forEach((el) => observer.observe(el));
}
