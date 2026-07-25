/**
 * PURPOSE
 *   Render a single project's dedicated page (project.html?id=<slug>) from
 *   assets/data/projects.json.
 *
 * RESPONSIBILITIES
 *   - renderProjectDetail(detailEl, breadcrumbEl): read `id` from the URL's
 *     query string, find the matching project, and render its hero,
 *     overview, tags, and links into detailEl. Falls back to a friendly
 *     "not found" state (with a link back to Projects) if the id is
 *     missing or unknown.
 *
 * PHASE NOTE
 *   This intentionally renders the fields Phase 2 added (category, year,
 *   status, highlights, description) rather than the full Phase 3 case
 *   study (My Contribution / Problem / Research / ... / Lessons Learned).
 *   Those sections land in Phase 3 as new optional fields on the project
 *   record — this renderer is written so adding them later is additive,
 *   not a rewrite.
 *
 * DEPENDENCIES
 *   data-loader.js
 *
 * SAFE EDITS
 *   To change what a project page displays, edit this file. To change what
 *   data is available, edit assets/data/projects.json.
 */

import { loadJSON } from "./data-loader.js";
import { DATA_PATHS } from "./config.js";

const GITHUB_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.52 9.52 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.35 4.68-4.58 4.93.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>`;
const EXTERNAL_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`;

/**
 * Renders a friendly "project not found" state, with a link back to the
 * full grid so a bad/old URL never dead-ends the visitor.
 * @param {HTMLElement} detailEl
 */
function renderNotFound(detailEl) {
  const wrap = document.createElement("div");
  wrap.className = "empty-state";
  wrap.setAttribute("role", "status");

  const message = document.createElement("p");
  message.textContent = "We couldn't find that project.";
  wrap.appendChild(message);

  const link = document.createElement("a");
  link.className = "card__link mt-4";
  link.href = "projects.html";
  link.textContent = "← Back to all projects";
  wrap.appendChild(link);

  detailEl.replaceChildren(wrap);
}

/**
 * Builds the project hero + overview + tags + links markup for one project.
 * @param {object} project
 * @returns {DocumentFragment}
 */
function buildDetail(project) {
  const fragment = document.createDocumentFragment();

  const hero = document.createElement("div");
  hero.className = "project-hero";

  const image = document.createElement("img");
  image.className = "project-hero__image";
  image.src = project.image;
  image.alt = "";
  image.decoding = "async";
  hero.appendChild(image);

  if (project.category || project.year || project.status) {
    const meta = document.createElement("div");
    meta.className = "card__meta mt-6";
    const pieces = [project.category, project.year, project.status].filter(Boolean);
    meta.textContent = pieces.join("  •  ");
    hero.appendChild(meta);
  }

  const title = document.createElement("h1");
  title.className = "text-3xl font-display mt-2";
  title.textContent = project.title;
  hero.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "text-lg text-muted mt-2";
  subtitle.textContent = project.subtitle;
  hero.appendChild(subtitle);

  if (Array.isArray(project.highlights) && project.highlights.length > 0) {
    const highlights = document.createElement("div");
    highlights.className = "card__highlights mt-4";
    for (const highlightText of project.highlights) {
      const highlight = document.createElement("span");
      highlight.className = "highlight-badge";
      highlight.textContent = highlightText;
      highlights.appendChild(highlight);
    }
    hero.appendChild(highlights);
  }

  const tags = document.createElement("div");
  tags.className = "card__tags mt-4";
  for (const tagText of project.tags) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = tagText;
    tags.appendChild(tag);
  }
  hero.appendChild(tags);

  const links = document.createElement("div");
  links.className = "card__links mt-6";

  if (project.github) {
    const githubLink = document.createElement("a");
    githubLink.className = "btn btn--primary";
    githubLink.href = project.github;
    githubLink.target = "_blank";
    githubLink.rel = "noopener noreferrer";
    githubLink.innerHTML = `${GITHUB_ICON} View GitHub`;
    links.appendChild(githubLink);
  }

  if (project.demo) {
    const demoLink = document.createElement("a");
    demoLink.className = "btn btn--secondary";
    demoLink.href = project.demo;
    demoLink.target = "_blank";
    demoLink.rel = "noopener noreferrer";
    demoLink.innerHTML = `${EXTERNAL_ICON} Live demo`;
    links.appendChild(demoLink);
  }

  hero.appendChild(links);
  fragment.appendChild(hero);

  const overview = document.createElement("section");
  overview.className = "mt-12";

  const overviewHeading = document.createElement("h2");
  overviewHeading.className = "text-xl";
  overviewHeading.textContent = "Overview";
  overview.appendChild(overviewHeading);

  const overviewBody = document.createElement("p");
  overviewBody.className = "text-base mt-4";
  overviewBody.textContent = project.description;
  overview.appendChild(overviewBody);

  fragment.appendChild(overview);

  return fragment;
}

/**
 * Reads `id` from the current URL, loads projects.json, and renders the
 * matching project into detailEl (plus its title into breadcrumbEl, if
 * given). Also updates document.title for a correct browser tab / history
 * entry.
 *
 * @param {HTMLElement} detailEl
 * @param {HTMLElement | null} [breadcrumbEl]
 */
export async function renderProjectDetail(detailEl, breadcrumbEl) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    renderNotFound(detailEl);
    return;
  }

  try {
    const projects = await loadJSON(DATA_PATHS.projects);
    const project = projects.find((item) => item.id === id);

    if (!project) {
      renderNotFound(detailEl);
      return;
    }

    document.title = `${project.title} — Pedro Sousa`;
    if (breadcrumbEl) breadcrumbEl.textContent = project.title;

    detailEl.replaceChildren(buildDetail(project));
  } catch (error) {
    console.error("renderProjectDetail:", error);
    renderNotFound(detailEl);
  }
}
