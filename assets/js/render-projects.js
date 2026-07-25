/**
 * PURPOSE
 *   Turn assets/data/projects.json into project card DOM nodes, and (on the
 *   Projects page) a category filter bar above the grid.
 *
 * RESPONSIBILITIES
 *   - renderProjects(containerEl, { featuredOnly }): fetch, build, and
 *     insert project cards into a given container. Used by the home page's
 *     "Featured projects" strip and, unfiltered, by the Projects page.
 *   - renderProjectsPage(gridEl, filterBarEl): Projects-page variant that
 *     also builds a category filter bar wired to re-render the grid.
 *
 * DATA CONTRACT (assets/data/projects.json)
 *   Array<{
 *     id: string,
 *     title: string,
 *     subtitle: string,
 *     description: string,
 *     tags: string[],
 *     image: string,       // path to an image/SVG, relative to site root
 *     featured: boolean,
 *     github: string,      // URL, or "" if none
 *     demo: string,        // URL, or "" if none
 *     category: string,    // e.g. "Mechanical Engineering", "Software"
 *     year: string,        // e.g. "2023" or "2025 – 2026"
 *     status: string,      // e.g. "Completed", "In Progress"
 *     highlights: string[] // short badges, e.g. "Team Project", "1st Place — ..."
 *   }>
 *
 *   category/year/status/highlights are optional — a project missing them
 *   still renders a valid card with those pieces simply omitted, so nothing
 *   here breaks if a future entry doesn't set them yet.
 *
 * DEPENDENCIES
 *   data-loader.js
 *
 * SAFE EDITS
 *   To change what a card displays, edit buildCard() below. To change what
 *   data is available, edit assets/data/projects.json — no other file needs
 *   to change for a new project to appear. Each project now also gets a
 *   dedicated page at project.html?id=<id> (see render-project-detail.js);
 *   clicking a card opens that page instead of linking straight to GitHub.
 */

import { loadJSON } from "./data-loader.js";
import { DATA_PATHS } from "./config.js";

const GITHUB_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.52 9.52 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.35 4.68-4.58 4.93.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>`;

const EXTERNAL_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`;

const ARROW_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

const AWARD_ICON = `<svg viewBox="0 0 24 24" class="icon icon--xs" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5"/></svg>`;

const TEAM_ICON = `<svg viewBox="0 0 24 24" class="icon icon--xs" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14.5 14.2c2.5.4 4.5 2.5 4.5 5.3"/></svg>`;

const SOLO_ICON = `<svg viewBox="0 0 24 24" class="icon icon--xs" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>`;

/** Picks a small inline icon for a highlight badge based on its text. */
function highlightIcon(text) {
  const lower = text.toLowerCase();
  if (lower.includes("place") || lower.includes("award") || lower.includes("winner")) {
    return AWARD_ICON;
  }
  if (lower.includes("team")) return TEAM_ICON;
  if (lower.includes("personal") || lower.includes("solo")) return SOLO_ICON;
  return "";
}

/**
 * Builds a single <article> project card from one project record.
 * @param {object} project
 * @returns {HTMLElement}
 */
function buildCard(project) {
  const card = document.createElement("article");
  card.className = "card card--interactive card--linked";

  const detailHref = `project.html?id=${encodeURIComponent(project.id)}`;

  // Whole-card click-through to the project's dedicated page. Kept as a
  // card-level affordance (not just the "Open project" link below) so
  // clicking anywhere on the card — image, title, description — opens the
  // case study, while still behaving like a normal link for middle-click/
  // new-tab/keyboard users. Links inside the card (GitHub, demo) stop
  // propagation via the closest("a") check so they keep their own target.
  card.setAttribute("role", "link");
  card.tabIndex = 0;
  card.setAttribute("aria-label", `Open the ${project.title} case study`);

  const openDetail = () => {
    window.location.href = detailHref;
  };

  card.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;
    openDetail();
  });

  card.addEventListener("keydown", (event) => {
    if (event.target.closest("a")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail();
    }
  });

  const imageWrap = document.createElement("div");
  imageWrap.className = "card__image-wrap";

  const image = document.createElement("img");
  image.className = "card__image";
  image.src = project.image;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.width = 480;
  image.height = 300;
  imageWrap.appendChild(image);

  if (project.status) {
    const statusPill = document.createElement("span");
    const statusSlug = project.status.toLowerCase().replace(/\s+/g, "-");
    statusPill.className = `status-pill status-pill--${statusSlug}`;
    statusPill.innerHTML = `<span class="status-pill__dot" aria-hidden="true"></span>${project.status}`;
    imageWrap.appendChild(statusPill);
  }

  card.appendChild(imageWrap);

  // Category / year meta row — sits above the title like a breadcrumb of
  // "what this is and when," so a recruiter can triage at a glance.
  if (project.category || project.year) {
    const meta = document.createElement("div");
    meta.className = "card__meta";
    if (project.category) {
      const category = document.createElement("span");
      category.className = "card__meta-item";
      category.textContent = project.category;
      meta.appendChild(category);
    }
    if (project.category && project.year) {
      const dot = document.createElement("span");
      dot.className = "card__meta-dot";
      dot.setAttribute("aria-hidden", "true");
      dot.textContent = "•";
      meta.appendChild(dot);
    }
    if (project.year) {
      const year = document.createElement("span");
      year.className = "card__meta-item";
      year.textContent = project.year;
      meta.appendChild(year);
    }
    card.appendChild(meta);
  }

  const titleRow = document.createElement("div");
  titleRow.className = "split";

  const title = document.createElement("h3");
  title.className = "card__title";
  title.textContent = project.title;
  titleRow.appendChild(title);

  if (project.featured) {
    const badge = document.createElement("span");
    badge.className = "tag tag--featured";
    badge.textContent = "Featured";
    titleRow.appendChild(badge);
  }

  card.appendChild(titleRow);

  const subtitle = document.createElement("p");
  subtitle.className = "text-sm text-muted";
  subtitle.textContent = project.subtitle;
  card.appendChild(subtitle);

  const description = document.createElement("p");
  description.className = "text-sm";
  description.textContent = project.description;
  card.appendChild(description);

  if (Array.isArray(project.highlights) && project.highlights.length > 0) {
    const highlights = document.createElement("div");
    highlights.className = "card__highlights";
    for (const highlightText of project.highlights) {
      const highlight = document.createElement("span");
      highlight.className = "highlight-badge";
      highlight.innerHTML = `${highlightIcon(highlightText)}<span>${highlightText}</span>`;
      highlights.appendChild(highlight);
    }
    card.appendChild(highlights);
  }

  const tags = document.createElement("div");
  tags.className = "card__tags";
  for (const tagText of project.tags) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = tagText;
    tags.appendChild(tag);
  }
  card.appendChild(tags);

  const links = document.createElement("div");
  links.className = "card__links";

  const openLink = document.createElement("a");
  openLink.className = "card__link card__link--primary";
  openLink.href = detailHref;
  openLink.innerHTML = ARROW_ICON;
  openLink.append(" Open project");
  openLink.setAttribute("aria-label", `Open the ${project.title} case study`);
  links.appendChild(openLink);

  if (project.github) {
    const githubLink = document.createElement("a");
    githubLink.className = "card__link";
    githubLink.href = project.github;
    githubLink.target = "_blank";
    githubLink.rel = "noopener noreferrer";
    githubLink.innerHTML = GITHUB_ICON;
    githubLink.append(" Code");
    githubLink.setAttribute(
      "aria-label",
      `View ${project.title} source on GitHub (opens in a new tab)`
    );
    links.appendChild(githubLink);
  }

  if (project.demo) {
    const demoLink = document.createElement("a");
    demoLink.className = "card__link";
    demoLink.href = project.demo;
    demoLink.target = "_blank";
    demoLink.rel = "noopener noreferrer";
    demoLink.innerHTML = EXTERNAL_ICON;
    demoLink.append(" Live demo");
    demoLink.setAttribute(
      "aria-label",
      `View ${project.title} live demo (opens in a new tab)`
    );
    links.appendChild(demoLink);
  }

  card.appendChild(links);

  return card;
}

/**
 * Renders an accessible empty/error state into a container.
 * @param {HTMLElement} containerEl
 * @param {string} message
 */
function renderFallback(containerEl, message) {
  const fallback = document.createElement("p");
  fallback.className = "empty-state";
  fallback.setAttribute("role", "status");
  fallback.textContent = message;
  containerEl.replaceChildren(fallback);
}

/**
 * Fetches project data and renders cards into containerEl.
 *
 * @param {HTMLElement} containerEl - Element to populate (its existing
 *   children, typically a loading skeleton, are replaced).
 * @param {{ featuredOnly?: boolean }} [options]
 */
export async function renderProjects(containerEl, options = {}) {
  const { featuredOnly = false } = options;

  try {
    const projects = await loadJSON(DATA_PATHS.projects);
    const list = featuredOnly
      ? projects.filter((project) => project.featured)
      : projects;

    if (list.length === 0) {
      renderFallback(containerEl, "No projects to show yet — check back soon.");
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const project of list) {
      fragment.appendChild(buildCard(project));
    }
    containerEl.replaceChildren(fragment);
  } catch (error) {
    console.error("renderProjects:", error);
    renderFallback(
      containerEl,
      "Couldn't load the projects right now. Try refreshing the page."
    );
  }
}

/**
 * Renders the Projects page: a category filter bar wired to re-render the
 * grid below it. Falls back to an unfiltered grid (no bar) if filterBarEl
 * isn't provided or projects don't carry a `category`.
 *
 * @param {HTMLElement} gridEl
 * @param {HTMLElement | null} [filterBarEl]
 */
export async function renderProjectsPage(gridEl, filterBarEl) {
  try {
    const projects = await loadJSON(DATA_PATHS.projects);

    if (projects.length === 0) {
      renderFallback(gridEl, "No projects to show yet — check back soon.");
      return;
    }

    const renderGrid = (category) => {
      const list =
        category === "All"
          ? projects
          : projects.filter((project) => project.category === category);

      if (list.length === 0) {
        renderFallback(gridEl, "No projects match this filter yet.");
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const project of list) {
        fragment.appendChild(buildCard(project));
      }
      gridEl.replaceChildren(fragment);
    };

    const categories = [
      ...new Set(projects.map((project) => project.category).filter(Boolean)),
    ];

    if (filterBarEl && categories.length > 1) {
      const allButton = document.createElement("button");
      const buttons = [];

      const selectCategory = (category, button) => {
        for (const btn of buttons) {
          btn.classList.toggle("filter-pill--active", btn === button);
          btn.setAttribute("aria-pressed", btn === button ? "true" : "false");
        }
        renderGrid(category);
      };

      allButton.type = "button";
      allButton.className = "filter-pill filter-pill--active";
      allButton.textContent = "All";
      allButton.setAttribute("aria-pressed", "true");
      allButton.addEventListener("click", () => selectCategory("All", allButton));
      buttons.push(allButton);

      for (const category of categories) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-pill";
        button.textContent = category;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => selectCategory(category, button));
        buttons.push(button);
      }

      filterBarEl.replaceChildren(...buttons);
    }

    renderGrid("All");
  } catch (error) {
    console.error("renderProjectsPage:", error);
    renderFallback(
      gridEl,
      "Couldn't load the projects right now. Try refreshing the page."
    );
  }
}
