/**
 * PURPOSE
 *   Turn assets/data/projects.json into project card DOM nodes.
 *
 * RESPONSIBILITIES
 *   - renderProjects(containerEl, { featuredOnly }): fetch, build, and
 *     insert project cards into a given container.
 *
 * DATA CONTRACT (assets/data/projects.json)
 *   Array<{
 *     id: string,
 *     title: string,
 *     subtitle: string,
 *     description: string,
 *     tags: string[],
 *     image: string,   // path to an image/SVG, relative to site root
 *     featured: boolean,
 *     github: string,  // URL, or "" if none
 *     demo: string      // URL, or "" if none
 *   }>
 *
 * DEPENDENCIES
 *   data-loader.js
 *
 * SAFE EDITS
 *   To change what a card displays, edit buildCard() below. To change what
 *   data is available, edit assets/data/projects.json — no other file needs
 *   to change for a new project to appear.
 */

import { loadJSON } from "./data-loader.js";
import { DATA_PATHS } from "./config.js";

const GITHUB_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.52 9.52 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.35 4.68-4.58 4.93.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>`;

const EXTERNAL_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`;

/**
 * Builds a single <article> project card from one project record.
 * @param {object} project
 * @returns {HTMLElement}
 */
function buildCard(project) {
  const card = document.createElement("article");
  card.className = "card card--interactive";

  // Whole-card click-through to the project's GitHub repo, when known.
  // Kept as a card-level affordance (not just the "Código" link below) so
  // clicking anywhere on the card — image, title, description — opens the
  // repository, while still behaving like a normal link for middle-click/
  // new-tab/keyboard users.
  if (project.github) {
    card.classList.add("card--linked");
    card.setAttribute("role", "link");
    card.tabIndex = 0;
    card.setAttribute(
      "aria-label",
      `Ver ${project.title} no GitHub (abre numa nova aba)`
    );

    const openRepo = () => {
      window.open(project.github, "_blank", "noopener,noreferrer");
    };

    card.addEventListener("click", (event) => {
      // Don't double-navigate if the click landed on an actual <a> inside
      // the card (e.g. the "Código" / "Ver demo" links) — let those follow
      // their own href/target normally.
      if (event.target.closest("a")) return;
      openRepo();
    });

    card.addEventListener("keydown", (event) => {
      if (event.target.closest("a")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openRepo();
      }
    });
  }

  const image = document.createElement("img");
  image.className = "card__image";
  image.src = project.image;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.width = 480;
  image.height = 300;
  card.appendChild(image);

  const titleRow = document.createElement("div");
  titleRow.className = "split";

  const title = document.createElement("h3");
  title.className = "card__title";
  title.textContent = project.title;
  titleRow.appendChild(title);

  if (project.featured) {
    const badge = document.createElement("span");
    badge.className = "tag tag--featured";
    badge.textContent = "Destaque";
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

  if (project.github) {
    const githubLink = document.createElement("a");
    githubLink.className = "card__link";
    githubLink.href = project.github;
    githubLink.target = "_blank";
    githubLink.rel = "noopener noreferrer";
    githubLink.innerHTML = GITHUB_ICON;
    githubLink.append(" Código");
    githubLink.setAttribute(
      "aria-label",
      `Ver código de ${project.title} no GitHub (abre numa nova aba)`
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
    demoLink.append(" Ver demo");
    demoLink.setAttribute(
      "aria-label",
      `Ver demonstração de ${project.title} (abre numa nova aba)`
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
      renderFallback(containerEl, "Ainda não há projetos para mostrar — volte em breve.");
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
      "Não foi possível carregar os projetos agora. Tente atualizar a página."
    );
  }
}
