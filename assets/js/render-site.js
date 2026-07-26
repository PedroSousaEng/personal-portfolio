/**
 * PURPOSE
 *   Central "single source of truth" for site-wide identity text (name,
 *   role, tagline, brand handle, university) and footer social links.
 *   Every page includes elements with a `data-site="..."` attribute
 *   instead of hard-coded copy — this module fills them in from
 *   assets/data/site.json and assets/data/socials.json on every load.
 *
 * RESPONSIBILITIES
 *   - applySiteIdentity(): fill every [data-site] element's text/attrs
 *     from site.json (name, first name, role, tagline, university, brand).
 *   - applySocialLinks(): fill footer/contact [data-social] links (href +
 *     visible label where relevant) from socials.json.
 *
 * DATA CONTRACTS
 *   site.json:    { name, firstName, brand, role, tagline, university }
 *   socials.json: { email, links: Array<{ platform, url, icon }> }
 *
 * SAFE EDITS
 *   To rename yourself across the whole site, edit assets/data/site.json —
 *   nothing here or in the HTML needs to change. To change social/contact
 *   links everywhere they appear (footers + contact page), edit
 *   assets/data/socials.json.
 */

import { loadJSON } from "./data-loader.js";
import { DATA_PATHS } from "./config.js";

/**
 * Fills every element carrying a `data-site` attribute with the matching
 * field from site.json. Supported keys: name, first-name, role, tagline,
 * university, brand. If the element is a <title> or has `data-site-attr`,
 * the value is written to that attribute instead of textContent.
 */
async function applySiteIdentity() {
  const site = await loadJSON(DATA_PATHS.site);

  const fieldMap = {
    name: site.name,
    "first-name": site.firstName,
    role: site.role,
    tagline: site.tagline,
    university: site.university,
    brand: site.brand,
  };

  document.querySelectorAll("[data-site]").forEach((el) => {
    const key = el.dataset.site;
    const value = fieldMap[key];
    if (value === undefined) return;

    const attr = el.dataset.siteAttr;
    if (attr) {
      el.setAttribute(attr, value);
    } else {
      el.textContent = value;
    }
  });
}

/**
 * Fills footer/contact social links from socials.json. Elements opt in
 * with `data-social="github"` / `data-social="linkedin"` / etc. (matched
 * against each entry's `icon`), or `data-social="email"` for the mailto
 * link.
 */
async function applySocialLinks() {
  const socials = await loadJSON(DATA_PATHS.socials);

  document.querySelectorAll('[data-social="email"]').forEach((el) => {
    el.href = `mailto:${socials.email}`;
    if (el.dataset.socialLabel) el.textContent = `Email ${socials.email}`;
  });

  for (const link of socials.links) {
    document
      .querySelectorAll(`[data-social="${link.icon}"]`)
      .forEach((el) => {
        el.href = link.url;
      });
  }
}

export async function initSiteIdentity() {
  try {
    await Promise.all([applySiteIdentity(), applySocialLinks()]);
  } catch (error) {
    console.error("initSiteIdentity:", error);
  }
}
