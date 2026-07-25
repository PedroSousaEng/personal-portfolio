/**
 * PURPOSE
 *   Home page only: dismiss the boot-intro overlay after a short hold, or
 *   instantly if the visitor clicks/presses a key. The overlay markup
 *   itself lives directly in index.html (not injected here) so it's
 *   guaranteed to paint on the very first frame — no flash-of-content
 *   risk from waiting on a script to run.
 *
 * RESPONSIBILITIES
 *   - First visit this tab session: mark sessionStorage so subsequent
 *     Home loads (in this tab) skip the overlay entirely, then run the
 *     hold → fade → remove sequence.
 *   - Repeat visit (the inline <script> in index.html <head> already
 *     added .no-boot-intro to <html> before first paint): just remove
 *     the (already hidden) overlay node, no animation.
 *   - Reduced motion: the overlay is already `display: none` via CSS;
 *     just remove the dead node.
 *
 * DEPENDENCIES
 *   assets/css/boot-intro.css, the inline <script> + .boot-intro markup
 *   in index.html.
 */

const INTRO_SESSION_KEY = "pf-boot-intro-seen";
const INTRO_HOLD_MS = 1000;
const INTRO_FADE_MS = 420;

export function initBootIntro() {
  if (document.body?.dataset.page !== "home") return;

  const overlay = document.querySelector(".boot-intro");
  if (!overlay) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let alreadySeen = document.documentElement.classList.contains("no-boot-intro");
  if (!alreadySeen) {
    try {
      alreadySeen = sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
    } catch (error) {
      alreadySeen = false;
    }
  }

  if (reduceMotion || alreadySeen) {
    overlay.remove();
    return;
  }

  try {
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
  } catch (error) {
    // Private mode etc — degrade silently, the intro still plays and
    // dismisses on schedule, it just won't be remembered for next time.
  }

  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    window.clearTimeout(holdTimer);
    window.removeEventListener("keydown", onSkip);
    window.removeEventListener("pointerdown", onSkip);
    overlay.classList.add("is-leaving");
    window.setTimeout(() => overlay.remove(), INTRO_FADE_MS);
  }

  function onSkip() {
    dismiss();
  }

  window.addEventListener("keydown", onSkip);
  window.addEventListener("pointerdown", onSkip);
  const holdTimer = window.setTimeout(dismiss, INTRO_HOLD_MS);
}
