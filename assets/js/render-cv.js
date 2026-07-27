/**
 * PURPOSE
 *   Turn assets/data/cv.json (plus assets/data/projects.json, for full
 *   project titles/summaries, and assets/data/skills.json, the shared
 *   skills source with the About page) into the CV page's content:
 *   summary, education, skills, projects, awards, certifications,
 *   languages, and interests.
 *
 * RESPONSIBILITIES
 *   - renderCv(containerEl): fetch, build, and insert the full CV body.
 *
 * DATA CONTRACT (assets/data/cv.json)
 *   {
 *     summary: string,
 *     education: Array<{ degree, institution, location, period, details, highlights?: string[] }>,
 *     experienceSummary: string,
 *     projects: Array<{ id: string }>,
 *     awards: Array<{ title, description, year }>,
 *     certifications: Array<{ title, issuer, year }>,
 *     languages: Array<{ language, level }>,
 *     interests: string[]
 *   }
 *
 *   Skills are NOT read from cv.json — they come from assets/data/skills.json
 *   (Array<{ category: string, items: string[] }>), the same file the About
 *   page reads. Edit skills.json once and both pages update together.
 *
 *   Projects are only referenced by `id` here — title, subtitle, and the
 *   link target all come from the matching entry in projects.json, so a
 *   project's name/blurb only ever needs editing in one place.
 *
 *   Every array section renders nothing (and is skipped, not shown as an
 *   empty heading) if it's missing or empty — certifications is expected
 *   to start empty and light up automatically once entries are added.
 *
 * DEPENDENCIES
 *   data-loader.js
 *
 * SAFE EDITS
 *   To change what the CV displays, edit this file. To change the content
 *   itself, edit assets/data/cv.json — no other file needs to change.
 */

import { loadJSON } from "./data-loader.js";
import { DATA_PATHS } from "./config.js";

function renderFallback(containerEl, message) {
  const fallback = document.createElement("p");
  fallback.className = "empty-state";
  fallback.setAttribute("role", "status");
  fallback.textContent = message;
  containerEl.replaceChildren(fallback);
}

function buildSectionHeading(text) {
  const heading = document.createElement("h2");
  heading.className = "cv-section__heading text-xl";
  heading.textContent = text;
  return heading;
}

function buildSummarySection(cv) {
  if (!cv.summary) return null;
  const section = document.createElement("section");
  section.className = "cv-section";
  section.appendChild(buildSectionHeading("Professional Summary"));

  const body = document.createElement("p");
  body.className = "text-base mt-3";
  body.textContent = cv.summary;
  section.appendChild(body);

  return section;
}

function buildEducationSection(cv) {
  if (!Array.isArray(cv.education) || cv.education.length === 0) return null;
  const section = document.createElement("section");
  section.className = "cv-section";
  section.appendChild(buildSectionHeading("Education"));

  const list = document.createElement("div");
  list.className = "stack mt-4";

  for (const entry of cv.education) {
    const item = document.createElement("article");
    item.className = "cv-entry";

    const header = document.createElement("div");
    header.className = "split";

    const degree = document.createElement("h3");
    degree.className = "cv-entry__title";
    degree.textContent = `${entry.degree} · ${entry.institution}`;
    header.appendChild(degree);

    const period = document.createElement("span");
    period.className = "text-sm text-muted";
    period.textContent = entry.period;
    header.appendChild(period);

    item.appendChild(header);

    if (entry.location) {
      const location = document.createElement("p");
      location.className = "text-sm text-muted";
      location.textContent = entry.location;
      item.appendChild(location);
    }

    if (entry.details) {
      const details = document.createElement("p");
      details.className = "text-sm mt-2";
      details.textContent = entry.details;
      item.appendChild(details);
    }

    list.appendChild(item);
  }

  section.appendChild(list);
  return section;
}

function buildExperienceSection(cv) {
  if (!cv.experienceSummary) return null;
  const section = document.createElement("section");
  section.className = "cv-section";
  section.appendChild(buildSectionHeading("Experience"));

  const body = document.createElement("p");
  body.className = "text-base text-muted mt-3";
  body.textContent = cv.experienceSummary;
  section.appendChild(body);

  return section;
}

function buildSkillsSection(skillGroups) {
  if (!Array.isArray(skillGroups) || skillGroups.length === 0) return null;
  const section = document.createElement("section");
  section.className = "cv-section";
  section.appendChild(buildSectionHeading("Technical Skills"));

  const grid = document.createElement("div");
  grid.className = "stack mt-4";

  for (const group of skillGroups) {
    const groupEl = document.createElement("div");
    groupEl.className = "stack stack--tight";

    const heading = document.createElement("h3");
    heading.className = "text-sm text-muted";
    heading.textContent = group.category;
    groupEl.appendChild(heading);

    const chips = document.createElement("div");
    chips.className = "skills-grid";
    for (const skillItem of group.items) {
      const chip = document.createElement("span");
      chip.className = "skill-chip";
      chip.textContent = skillItem;
      chips.appendChild(chip);
    }
    groupEl.appendChild(chips);
    grid.appendChild(groupEl);
  }

  section.appendChild(grid);
  return section;
}

/**
 * Projects section: cv.json only lists which project ids to show — the
 * title, link, and one-line note all come from projects.json (title +
 * subtitle), so a project's name/blurb never needs editing in two files.
 * An id with no match in projects.json is skipped entirely.
 */
function buildProjectsSection(cv, projectsById) {
  if (!Array.isArray(cv.projects) || cv.projects.length === 0) return null;
  const section = document.createElement("section");
  section.className = "cv-section";
  section.appendChild(buildSectionHeading("Projects"));

  const list = document.createElement("ul");
  list.className = "cv-list mt-4";

  for (const entry of cv.projects) {
    const matched = projectsById.get(entry.id);
    if (!matched) continue;

    const item = document.createElement("li");

    const link = document.createElement("a");
    link.className = "cv-list__link";
    link.href = `project.html?id=${encodeURIComponent(entry.id)}`;
    link.textContent = matched.title;
    item.appendChild(link);

    if (matched.subtitle) {
      const note = document.createElement("span");
      note.className = "text-sm text-muted";
      note.textContent = ` — ${matched.subtitle}`;
      item.appendChild(note);
    }

    list.appendChild(item);
  }

  section.appendChild(list);
  return section;
}

function buildAwardsSection(cv) {
  if (!Array.isArray(cv.awards) || cv.awards.length === 0) return null;
  const section = document.createElement("section");
  section.className = "cv-section";
  section.appendChild(buildSectionHeading("Awards"));

  const list = document.createElement("div");
  list.className = "stack stack--tight mt-4";

  for (const award of cv.awards) {
    const item = document.createElement("div");
    item.className = "cv-entry";

    const header = document.createElement("div");
    header.className = "split";

    const title = document.createElement("h3");
    title.className = "cv-entry__title";
    title.textContent = award.title;
    header.appendChild(title);

    if (award.year) {
      const year = document.createElement("span");
      year.className = "text-sm text-muted";
      year.textContent = award.year;
      header.appendChild(year);
    }

    item.appendChild(header);

    if (award.description) {
      const description = document.createElement("p");
      description.className = "text-sm text-muted mt-1";
      description.textContent = award.description;
      item.appendChild(description);
    }

    list.appendChild(item);
  }

  section.appendChild(list);
  return section;
}

function buildCertificationsSection(cv) {
  if (!Array.isArray(cv.certifications) || cv.certifications.length === 0) return null;
  const section = document.createElement("section");
  section.className = "cv-section";
  section.appendChild(buildSectionHeading("Certifications"));

  const list = document.createElement("ul");
  list.className = "cv-list mt-4";

  for (const cert of cv.certifications) {
    const item = document.createElement("li");
    const pieces = [cert.title, cert.issuer, cert.year].filter(Boolean);
    item.textContent = pieces.join(" — ");
    list.appendChild(item);
  }

  section.appendChild(list);
  return section;
}

function buildLanguagesSection(cv) {
  if (!Array.isArray(cv.languages) || cv.languages.length === 0) return null;
  const section = document.createElement("section");
  section.className = "cv-section";
  section.appendChild(buildSectionHeading("Languages"));

  const chips = document.createElement("div");
  chips.className = "skills-grid mt-4";
  for (const entry of cv.languages) {
    const chip = document.createElement("span");
    chip.className = "skill-chip";
    chip.textContent = `${entry.language} — ${entry.level}`;
    chips.appendChild(chip);
  }
  section.appendChild(chips);
  return section;
}

function buildInterestsSection(cv) {
  if (!Array.isArray(cv.interests) || cv.interests.length === 0) return null;
  const section = document.createElement("section");
  section.className = "cv-section";
  section.appendChild(buildSectionHeading("Interests"));

  const tags = document.createElement("div");
  tags.className = "card__tags mt-4";
  for (const interest of cv.interests) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = interest;
    tags.appendChild(tag);
  }
  section.appendChild(tags);
  return section;
}

/**
 * Fetches cv.json + projects.json and renders the full CV into containerEl.
 * @param {HTMLElement} containerEl
 */
export async function renderCv(containerEl) {
  try {
    const [cv, projects, skillGroups] = await Promise.all([
      loadJSON(DATA_PATHS.cv),
      loadJSON(DATA_PATHS.projects).catch(() => []),
      loadJSON(DATA_PATHS.skills).catch(() => []),
    ]);

    const projectsById = new Map(projects.map((project) => [project.id, project]));

    const builders = [
      buildSummarySection,
      buildEducationSection,
      buildExperienceSection,
      () => buildSkillsSection(skillGroups),
      (data) => buildProjectsSection(data, projectsById),
      buildAwardsSection,
      buildCertificationsSection,
      buildLanguagesSection,
      buildInterestsSection,
    ];

    const fragment = document.createDocumentFragment();
    for (const build of builders) {
      const section = build(cv);
      if (section) fragment.appendChild(section);
    }

    if (!fragment.childNodes.length) {
      renderFallback(containerEl, "CV content isn't available yet — check back soon.");
      return;
    }

    containerEl.replaceChildren(fragment);
  } catch (error) {
    console.error("renderCv:", error);
    renderFallback(
      containerEl,
      "Couldn't load the CV right now. Try refreshing the page."
    );
  }
}
