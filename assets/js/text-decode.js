/**
 * PURPOSE
 *   "Decode" / scramble-to-resolve text effect: characters flicker through
 *   a random set before settling into the real text, left to right — used
 *   on the hero name.
 *
 * RESPONSIBILITIES
 *   - Wrap a target's existing text in one <span> per character, keep the
 *     real text available to assistive tech via aria-label on the parent,
 *     and hide the per-character spans from it (aria-hidden) since they
 *     briefly show scrambled, non-word content.
 *   - Drive the scramble with requestAnimationFrame (never setInterval) so
 *     it stays on the browser's frame clock and never drifts.
 *   - Skip entirely under prefers-reduced-motion — the real text is
 *     already sitting in the DOM before this runs, so skipping just means
 *     it never gets scrambled in the first place.
 *
 * DEPENDENCIES
 *   assets/css/micro-interactions.css (.decode-char / .is-resolved rules).
 *
 * SAFE EDITS
 *   Add a `data-decode` attribute to any heading/span to opt it into this
 *   effect — no JS change needed for a new target. Tune SCRAMBLE_CHARS /
 *   timing constants below.
 */

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+-/=";
const CHAR_REVEAL_MS = 35; // how often the resolve column advances, left to right
const SCRAMBLE_FRAME_MS = 45; // how often still-unresolved characters flicker

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function displayChar(char) {
  return char === " " ? "\u00A0" : char;
}

function decodeElement(el) {
  const text = el.textContent;
  el.textContent = "";
  el.setAttribute("aria-label", text);

  const chars = [...text].map((char) => {
    const span = document.createElement("span");
    span.className = "decode-char";
    span.setAttribute("aria-hidden", "true");
    span.textContent = displayChar(char);
    el.appendChild(span);
    return { span, char };
  });

  let resolvedCount = 0;
  let lastReveal = 0;
  let lastScramble = 0;

  function frame(timestamp) {
    if (timestamp - lastReveal > CHAR_REVEAL_MS && resolvedCount < chars.length) {
      lastReveal = timestamp;
      const entry = chars[resolvedCount];
      entry.span.textContent = displayChar(entry.char);
      entry.span.classList.add("is-resolved");
      resolvedCount += 1;
    }

    if (timestamp - lastScramble > SCRAMBLE_FRAME_MS) {
      lastScramble = timestamp;
      for (let i = resolvedCount; i < chars.length; i += 1) {
        const entry = chars[i];
        entry.span.textContent = entry.char === " " ? "\u00A0" : randomChar();
      }
    }

    if (resolvedCount < chars.length) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

export function initTextDecode() {
  const targets = document.querySelectorAll("[data-decode]");
  if (!targets.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  targets.forEach(decodeElement);
}
