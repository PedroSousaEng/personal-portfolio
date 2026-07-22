/**
 * PURPOSE
 *   Turn assets/data/socials.json into the Contact page's mailto call-to-
 *   action and list of social links.
 *
 * DATA CONTRACT (assets/data/socials.json)
 *   {
 *     email: string,
 *     links: Array<{ platform: string, url: string, icon: "github"|"linkedin"|"twitter" }>
 *   }
 *
 * DEPENDENCIES
 *   data-loader.js
 *
 * SAFE EDITS
 *   To add a new icon, add a case to ICONS below and reference its key from
 *   socials.json. To change contact link copy/order, edit socials.json.
 */

import { loadJSON } from "./data-loader.js";
import { DATA_PATHS } from "./config.js";

const ICONS = {
  github: `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.52 9.52 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.35 4.68-4.58 4.93.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M4.98 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3 9h4v12H3zM10 9h3.6v1.7h.05c.5-.94 1.75-1.94 3.6-1.94 3.85 0 4.75 2.5 4.75 5.9V21h-4v-5.3c0-1.27-.02-2.9-1.78-2.9-1.78 0-2.05 1.4-2.05 2.8V21h-4z"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M4 4l16 16M20 4 4 20"/></svg>`,
};

function renderFallback(containerEl, message) {
  const fallback = document.createElement("p");
  fallback.className = "empty-state";
  fallback.setAttribute("role", "status");
  fallback.textContent = message;
  containerEl.replaceChildren(fallback);
}

/** @param {HTMLElement} containerEl */
export async function renderContact(containerEl) {
  try {
    const socials = await loadJSON(DATA_PATHS.socials);
    const fragment = document.createDocumentFragment();

    const emailCta = document.createElement("a");
    emailCta.className = "btn btn--primary";
    emailCta.href = `mailto:${socials.email}`;
    emailCta.textContent = `Email ${socials.email}`;
    fragment.appendChild(emailCta);

    const methods = document.createElement("div");
    methods.className = "contact-methods";
    methods.style.marginTop = "var(--space-6)";

    for (const link of socials.links) {
      const item = document.createElement("a");
      item.className = "contact-method";
      item.href = link.url;
      item.target = "_blank";
      item.rel = "noopener noreferrer";
      item.setAttribute("aria-label", `${link.platform} (opens in a new tab)`);

      const iconWrap = document.createElement("span");
      iconWrap.className = "contact-method__icon";
      iconWrap.innerHTML = ICONS[link.icon] ?? "";
      item.appendChild(iconWrap);

      const label = document.createElement("span");
      label.className = "text-sm";
      label.textContent = link.platform;
      item.appendChild(label);

      methods.appendChild(item);
    }

    fragment.appendChild(methods);
    containerEl.replaceChildren(fragment);
  } catch (error) {
    console.error("renderContact:", error);
    renderFallback(
      containerEl,
      "Contact details couldn't be loaded right now — try refreshing the page."
    );
  }
}
