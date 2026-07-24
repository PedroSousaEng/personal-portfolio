/**
 * PURPOSE
 *   Phase 8 — Global page-transition (fade) between same-origin
 *   HTML pages.
 *
 *   When a visitor clicks an internal link (same origin, non-hash,
 *   not target=_blank, no modifier keys), we intercept the
 *   navigation, fade a full-viewport overlay in over the current
 *   page, and only then follow the link. On the next page's load,
 *   we run the mirror step: the overlay starts opaque and fades out.
 *   The combined effect reads as a single seamless surface, not two
 *   documents.
 *
 * RESPONSIBILITIES
 *   - Inject a single .page-transition overlay into <body>.
 *   - Intercept qualifying link clicks and drive the outbound fade.
 *   - Play the inbound fade on load (and after `pageshow`, so the
 *     bfcache back/forward path also clears the overlay).
 *   - No-op entirely under prefers-reduced-motion and when the
 *     browser doesn't support requestAnimationFrame.
 *
 * DEPENDENCIES
 *   assets/css/page-transitions.css (owns opacity/visibility rules).
 *
 * SAFE EDITS
 *   Duration lives in tokens.css (--duration-slow). Add a link
 *   attribute `data-no-transition` on any anchor to opt that one out.
 */

const OVERLAY_CLASS = "page-transition";
const OPT_OUT_ATTR = "data-no-transition";
const FADE_MS_FALLBACK = 400; // matches --duration-slow

function isInternalNavigation(anchor) {
  if (!anchor || anchor.tagName !== "A") return false;
  if (anchor.hasAttribute(OPT_OUT_ATTR)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href) return false;
  if (href.startsWith("#")) return false;
  if (href.startsWith("mailto:")) return false;
  if (href.startsWith("tel:")) return false;
  if (href.startsWith("javascript:")) return false;

  // Cross-origin: skip.
  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    // Same page (only hash differs): skip.
    if (
      url.pathname === window.location.pathname &&
      url.search === window.location.search &&
      url.hash
    ) {
      return false;
    }
  } catch (_) {
    return false;
  }

  return true;
}

/**
 * Read --duration-slow from tokens.css so the JS timeout matches the
 * CSS transition exactly. Falls back to a sane default when the
 * property is missing (e.g. tokens.css failed to load).
 */
function readFadeDurationMs() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--duration-slow")
    .trim();
  if (!raw) return FADE_MS_FALLBACK;
  if (raw.endsWith("ms")) return parseFloat(raw) || FADE_MS_FALLBACK;
  if (raw.endsWith("s")) return (parseFloat(raw) || 0) * 1000 || FADE_MS_FALLBACK;
  return FADE_MS_FALLBACK;
}

export function initPageTransitions() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.requestAnimationFrame !== "function") return;

  // Never mount twice.
  if (document.querySelector("." + OVERLAY_CLASS)) return;

  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);

  const durationMs = readFadeDurationMs();

  // --- Inbound fade: on load, fade the overlay from opaque to clear. ---
  function playInboundFade() {
    overlay.dataset.state = "entering";
    // Two-frame delay: first frame commits the initial opaque state,
    // second frame flips the class so the transition actually plays.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add("is-clearing");
        window.setTimeout(() => {
          overlay.classList.remove("is-clearing");
          delete overlay.dataset.state;
        }, durationMs);
      });
    });
  }

  // Guard: only auto-play the inbound fade on the very first visit if
  // we didn't arrive here from a same-origin navigation we control. It
  // still plays if the outbound fade set the flag on unload.
  const shouldPlayInbound = sessionStorage.getItem("pageTransitionInbound") === "1";
  sessionStorage.removeItem("pageTransitionInbound");
  if (shouldPlayInbound) playInboundFade();

  // --- Outbound fade: intercept internal link clicks. ---
  function onLinkClick(event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return; // primary click only
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest ? event.target.closest("a") : null;
    if (!isInternalNavigation(anchor)) return;

    event.preventDefault();

    const href = anchor.href;
    overlay.dataset.state = "leaving";

    // Set the inbound flag so the next page knows to play the mirror.
    try {
      sessionStorage.setItem("pageTransitionInbound", "1");
    } catch (_) {
      // Private mode etc — degrade silently, the outbound fade still runs.
    }

    window.setTimeout(() => {
      window.location.href = href;
    }, durationMs);
  }

  document.addEventListener("click", onLinkClick);

  // bfcache back/forward: if the browser restores this page from cache,
  // the overlay may still be marked "leaving". Reset it so the user
  // isn't stuck behind a black wash.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      delete overlay.dataset.state;
      overlay.classList.remove("is-clearing");
    }
  });

  // If reduced-motion is enabled mid-session, remove the overlay so it
  // can't accidentally cover the page after a subsequent nav.
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduceMotionQuery.addEventListener("change", (event) => {
    if (event.matches) {
      document.removeEventListener("click", onLinkClick);
      overlay.remove();
    }
  });
}
