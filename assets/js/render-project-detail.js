/**
 * PURPOSE
 *   Render a single project's dedicated page (project.html?id=<slug>) from
 *   assets/data/projects.json as a complete engineering case study.
 *
 * RESPONSIBILITIES
 *   - renderProjectDetail(detailEl, breadcrumbEl): read `id` from the URL's
 *     query string, find the matching project, and render:
 *       Hero -> Overview -> My Contribution -> Engineering Story
 *       -> Previous/Next project nav -> Related projects -> Footer CTA
 *     Falls back to a friendly "not found" state (with a link back to
 *     Projects) if the id is missing or unknown.
 *
 * DATA CONTRACT ADDITIONS (Phase 3, on top of the Phase 2 fields)
 *   objectives: string[]   // what the project set out to do
 *   outcome: string        // the final result, in one paragraph
 *   myRole: string[]       // short chips, e.g. "CAD Modeling", "Python Simulation"
 *   story: Array<{ stage: string, text: string }>
 *                          // e.g. Problem, Research, Design, Development,
 *                          // Manufacturing, Testing, Results, Lessons Learned
 *                          // — projects only include the stages that apply.
 *   report: string         // URL to a PDF report, or "" if none
 *
 *   All of the above are optional — a project missing them still renders a
 *   complete card with those sections simply omitted, so nothing here
 *   breaks for a future entry that hasn't been filled in yet.
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
const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
const ARROW_LEFT_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`;
const ARROW_RIGHT_ICON = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

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

/** Builds the hero block: image, meta, title, subtitle, highlights, tags, links. */
function buildHero(project) {
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
    githubLink.innerHTML = `${GITHUB_ICON} Resources`;
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

  if (project.report) {
    const reportLink = document.createElement("a");
    reportLink.className = "btn btn--secondary";
    reportLink.href = project.report;
    reportLink.target = "_blank";
    reportLink.rel = "noopener noreferrer";
    reportLink.innerHTML = `${DOWNLOAD_ICON} Download report`;
    links.appendChild(reportLink);
  }

  hero.appendChild(links);
  return hero;
}

/** Builds the Overview section: description, objectives, outcome. */
function buildOverview(project) {
  const section = document.createElement("section");
  section.className = "case-section mt-12";

  const heading = document.createElement("h2");
  heading.className = "text-xl";
  heading.textContent = "Overview";
  section.appendChild(heading);

  const body = document.createElement("p");
  body.className = "text-base mt-4";
  body.textContent = project.description;
  section.appendChild(body);

  if (Array.isArray(project.objectives) && project.objectives.length > 0) {
    const objectivesHeading = document.createElement("h3");
    objectivesHeading.className = "text-sm font-mono text-muted mt-6";
    objectivesHeading.textContent = "Objectives";
    section.appendChild(objectivesHeading);

    const list = document.createElement("ul");
    list.className = "case-list mt-3";
    for (const objective of project.objectives) {
      const item = document.createElement("li");
      item.textContent = objective;
      list.appendChild(item);
    }
    section.appendChild(list);
  }

  if (project.outcome) {
    const outcomeHeading = document.createElement("h3");
    outcomeHeading.className = "text-sm font-mono text-muted mt-6";
    outcomeHeading.textContent = "Outcome";
    section.appendChild(outcomeHeading);

    const outcomeBody = document.createElement("p");
    outcomeBody.className = "text-base mt-3";
    outcomeBody.textContent = project.outcome;
    section.appendChild(outcomeBody);
  }

  return section;
}

/** Builds the "My Contribution" section from project.myRole. */
function buildContribution(project) {
  if (!Array.isArray(project.myRole) || project.myRole.length === 0) return null;

  const section = document.createElement("section");
  section.className = "case-section mt-12";

  const heading = document.createElement("h2");
  heading.className = "text-xl";
  heading.textContent = "My Contribution";
  section.appendChild(heading);

  const chips = document.createElement("div");
  chips.className = "role-chips mt-4";
  for (const roleText of project.myRole) {
    const chip = document.createElement("span");
    chip.className = "role-chip";
    chip.textContent = roleText;
    chips.appendChild(chip);
  }
  section.appendChild(chips);

  return section;
}

/** Builds the "Engineering Story" section from project.story. */
function buildStory(project) {
  if (!Array.isArray(project.story) || project.story.length === 0) return null;

  const section = document.createElement("section");
  section.className = "case-section mt-12";

  const heading = document.createElement("h2");
  heading.className = "text-xl";
  heading.textContent = "Engineering Story";
  section.appendChild(heading);

  const timeline = document.createElement("ol");
  timeline.className = "story-timeline mt-6";

  project.story.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "story-timeline__item";

    const marker = document.createElement("span");
    marker.className = "story-timeline__marker";
    marker.setAttribute("aria-hidden", "true");
    item.appendChild(marker);

    const content = document.createElement("div");

    const stageLabel = document.createElement("span");
    stageLabel.className = "story-timeline__stage text-sm font-mono text-accent";
    stageLabel.textContent = `${String(index + 1).padStart(2, "0")} · ${step.stage}`;
    content.appendChild(stageLabel);

    const text = document.createElement("p");
    text.className = "text-base mt-2";
    text.textContent = step.text;
    content.appendChild(text);

    item.appendChild(content);
    timeline.appendChild(item);
  });

  section.appendChild(timeline);
  return section;
}

/** Builds a compact prev/next navigation row between two projects. */
function buildPrevNextNav(prevProject, nextProject) {
  if (!prevProject && !nextProject) return null;

  const nav = document.createElement("nav");
  nav.className = "project-pager mt-16";
  nav.setAttribute("aria-label", "More projects");

  if (prevProject) {
    const prevLink = document.createElement("a");
    prevLink.className = "project-pager__link project-pager__link--prev";
    prevLink.href = `project.html?id=${encodeURIComponent(prevProject.id)}`;
    prevLink.innerHTML = `
      ${ARROW_LEFT_ICON}
      <span>
        <span class="project-pager__label">Previous</span>
        <span class="project-pager__title">${prevProject.title}</span>
      </span>
    `;
    nav.appendChild(prevLink);
  } else {
    nav.appendChild(document.createElement("span"));
  }

  if (nextProject) {
    const nextLink = document.createElement("a");
    nextLink.className = "project-pager__link project-pager__link--next";
    nextLink.href = `project.html?id=${encodeURIComponent(nextProject.id)}`;
    nextLink.innerHTML = `
      <span>
        <span class="project-pager__label">Next</span>
        <span class="project-pager__title">${nextProject.title}</span>
      </span>
      ${ARROW_RIGHT_ICON}
    `;
    nav.appendChild(nextLink);
  }

  return nav;
}

/** Builds a small "Related projects" grid (same category, excluding self). */
function buildRelated(project, allProjects) {
  const related = allProjects
    .filter((item) => item.id !== project.id && item.category === project.category)
    .slice(0, 3);

  if (related.length === 0) return null;

  const section = document.createElement("section");
  section.className = "case-section mt-16";

  const heading = document.createElement("h2");
  heading.className = "text-xl";
  heading.textContent = "Related projects";
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "grid grid--3 mt-6";

  for (const item of related) {
    const card = document.createElement("a");
    card.className = "related-card";
    card.href = `project.html?id=${encodeURIComponent(item.id)}`;

    const image = document.createElement("img");
    image.className = "related-card__image";
    image.src = item.image;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    card.appendChild(image);

    const title = document.createElement("span");
    title.className = "related-card__title";
    title.textContent = item.title;
    card.appendChild(title);

    const subtitle = document.createElement("span");
    subtitle.className = "related-card__subtitle";
    subtitle.textContent = item.subtitle;
    card.appendChild(subtitle);

    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

/** Builds the closing footer CTA: contact + back to all projects. */
function buildFooterCta() {
  const section = document.createElement("section");
  section.className = "case-section case-cta mt-16";

  const heading = document.createElement("h2");
  heading.className = "text-xl";
  heading.textContent = "Interested in working together?";
  section.appendChild(heading);

  const body = document.createElement("p");
  body.className = "text-base text-muted mt-2";
  body.textContent = "Get in touch, or keep exploring the rest of the projects.";
  section.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "card__links mt-6";

  const contactLink = document.createElement("a");
  contactLink.className = "btn btn--primary";
  contactLink.href = "contact.html";
  contactLink.textContent = "Contact me";
  actions.appendChild(contactLink);

  const backLink = document.createElement("a");
  backLink.className = "btn btn--secondary";
  backLink.href = "projects.html";
  backLink.textContent = "← Back to all projects";
  actions.appendChild(backLink);

  section.appendChild(actions);
  return section;
}

/**
 * Builds the full case-study fragment for one project, given the complete
 * project list (needed for prev/next + related projects).
 * @param {object} project
 * @param {object[]} allProjects
 * @returns {DocumentFragment}
 */
function buildDetail(project, allProjects) {
  const fragment = document.createDocumentFragment();

  fragment.appendChild(buildHero(project));
  fragment.appendChild(buildOverview(project));

  const contribution = buildContribution(project);
  if (contribution) fragment.appendChild(contribution);

  const story = buildStory(project);
  if (story) fragment.appendChild(story);

  const index = allProjects.findIndex((item) => item.id === project.id);
  const prevProject = index > 0 ? allProjects[index - 1] : null;
  const nextProject = index >= 0 && index < allProjects.length - 1 ? allProjects[index + 1] : null;
  const pagerNav = buildPrevNextNav(prevProject, nextProject);
  if (pagerNav) fragment.appendChild(pagerNav);

  const related = buildRelated(project, allProjects);
  if (related) fragment.appendChild(related);

  fragment.appendChild(buildFooterCta());

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

    detailEl.replaceChildren(buildDetail(project, projects));
  } catch (error) {
    console.error("renderProjectDetail:", error);
    renderNotFound(detailEl);
  }
}
