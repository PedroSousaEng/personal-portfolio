/**
 * PURPOSE
 *   Reveal below-the-fold content (`[data-reveal]`) once it enters the
 *   viewport, timed to the pendulum crossing center so motion on the page
 *   reads as one synchronized system rather than two unrelated effects.
 *
 * RESPONSIBILITIES
 *   - IntersectionObserver bookkeeping only. Owns no physics, no colors.
 *
 * DEPENDENCIES
 *   [data-reveal] elements + the .is-visible class defined in
 *   signature.css. Listens for the `pendulum:cross` event dispatched by
 *   pendulum.js, but degrades gracefully (reveals on a short timer) if
 *   that event never arrives — e.g. under prefers-reduced-motion, where
 *   pendulum.js never dispatches it and signature.css already forces
 *   [data-reveal] visible via a media query.
 */
function initScrollReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  const pending = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          pending.add(entry.target);
          observer.unobserve(entry.target);
        }
      });
      flush();
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
  );
  targets.forEach((el) => observer.observe(el));
  function flush() {
    if (!pending.size) return;
    let delay = 0;
    pending.forEach((el) => {
      setTimeout(() => el.classList.add('is-visible'), delay);
      delay += 70;
    });
    pending.clear();
  }
  document.addEventListener('pendulum:cross', flush);
  // Safety net: if a target has been waiting a while with no cross event
  // (very short pages, or the pendulum module failing to load), reveal it
  // anyway so content is never permanently stuck hidden.
  setInterval(flush, 900);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollReveal);
} else {
  initScrollReveal();
}
