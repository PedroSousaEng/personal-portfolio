/**
 * PURPOSE
 *   Turn skills.json, cv.json, and projects.json into the About page's
 *   skills grid, background/education list, project milestone timeline,
 *   and awards/achievements list — all sourced from the same files the
 *   CV page uses, so nothing needs editing twice.
 *
 * RESPONSIBILITIES
 *   - renderSkills(containerEl)
 *   - renderExperience(containerEl)
 *   - renderTimeline(containerEl)
 *   - renderAwards(containerEl)
 *
 * DATA CONTRACTS
 *   skills.json:      Array<{ category: string, items: string[] }>
 *   cv.json:           { education: Array<{ degree, institution, location,
 *                        period, details, highlights?: string[] }>,
 *                        awards: Array<{ title, description, year }>, ... }
 *                      — education and awards are read straight from
 *                      cv.json (not duplicated into their own files) so
 *                      the About page and the CV page always agree.
 *   projects.json:     Array<{ id, title, subtitle, year, ... }>
 *                      — drives the timeline directly; a project's
 *                      milestone entry only ever needs editing here.
 *
 * DEPENDENCIES
 *   data-loader.js
 *
 * SAFE EDITS
 *   Each render function is independent — a change to one data shape only
 *   requires editing its corresponding function below.
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

/** @param {HTMLElement} containerEl */
export async function renderSkills(containerEl) {
  try {
    const groups = await loadJSON(DATA_PATHS.skills);
    const fragment = document.createDocumentFragment();
    let chipIndex = 0;

    for (const group of groups) {
      const groupEl = document.createElement("div");
      groupEl.className = "stack stack--tight";

      const heading = document.createElement("h3");
      heading.className = "text-sm text-muted";
      heading.textContent = group.category;
      groupEl.appendChild(heading);

      const chips = document.createElement("div");
      chips.className = "skills-grid";
      for (const item of group.items) {
        const chip = document.createElement("span");
        chip.className = "skill-chip";
        chip.style.setProperty("--chip-index", chipIndex);
        chipIndex += 1;
        chip.textContent = item;
        chips.appendChild(chip);
      }
      groupEl.appendChild(chips);
      fragment.appendChild(groupEl);
    }

    containerEl.replaceChildren(fragment);
  } catch (error) {
    console.error("renderSkills:", error);
    renderFallback(containerEl, "Couldn't load the skills right now.");
  }
}

/**
 * Reads education straight from cv.json (the same array the CV page's
 * Education section uses) so the About page's "Experience" block and the
 * CV always agree — edit assets/data/cv.json once, both pages update.
 * @param {HTMLElement} containerEl
 */
export async function renderExperience(containerEl) {
  try {
    const cv = await loadJSON(DATA_PATHS.cv);
    const entries = Array.isArray(cv.education) ? cv.education : [];

    if (entries.length === 0) {
      renderFallback(containerEl, "Couldn't load the background right now.");
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const entry of entries) {
      const item = document.createElement("article");
      item.className = "card";

      const header = document.createElement("div");
      header.className = "split";

      const roleTitle = document.createElement("h3");
      roleTitle.className = "card__title";
      roleTitle.textContent = `${entry.degree} · ${entry.institution}`;
      header.appendChild(roleTitle);

      const period = document.createElement("span");
      period.className = "text-sm text-muted";
      period.textContent = entry.period;
      header.appendChild(period);

      item.appendChild(header);

      const location = document.createElement("p");
      location.className = "text-sm text-muted";
      location.textContent = entry.location;
      item.appendChild(location);

      const summary = document.createElement("p");
      summary.className = "text-sm";
      summary.textContent = entry.details;
      item.appendChild(summary);

      if (Array.isArray(entry.highlights) && entry.highlights.length > 0) {
        const highlights = document.createElement("ul");
        highlights.className = "stack stack--tight";
        for (const highlight of entry.highlights) {
          const li = document.createElement("li");
          li.className = "text-sm text-muted";
          li.textContent = `— ${highlight}`;
          highlights.appendChild(li);
        }
        item.appendChild(highlights);
      }

      fragment.appendChild(item);
    }

    containerEl.replaceChildren(fragment);
  } catch (error) {
    console.error("renderExperience:", error);
    renderFallback(containerEl, "Couldn't load the background right now.");
  }
}

/**
 * Builds the About page's milestone timeline straight from projects.json
 * (year, title, subtitle) instead of a separately maintained file, so
 * adding/editing a project only ever means touching projects.json.
 * @param {HTMLElement} containerEl
 */
export async function renderTimeline(containerEl) {
  try {
    const projects = await loadJSON(DATA_PATHS.projects);
    const milestones = [...projects].sort((a, b) =>
      String(a.year).localeCompare(String(b.year))
    );

    const list = document.createElement("ol");
    list.className = "timeline";

    for (const milestone of milestones) {
      const item = document.createElement("li");
      item.className = "timeline__item";

      const marker = document.createElement("span");
      marker.className = "timeline__marker";
      marker.setAttribute("aria-hidden", "true");
      item.appendChild(marker);

      const content = document.createElement("div");

      const year = document.createElement("span");
      year.className = "timeline__period text-sm text-accent";
      year.textContent = milestone.year;
      content.appendChild(year);

      const title = document.createElement("h3");
      title.className = "text-lg";
      title.textContent = milestone.title;
      content.appendChild(title);

      const description = document.createElement("p");
      description.className = "text-sm text-muted";
      description.textContent = milestone.subtitle || milestone.description;
      content.appendChild(description);

      item.appendChild(content);
      list.appendChild(item);
    }

    containerEl.replaceChildren(list);
  } catch (error) {
    console.error("renderTimeline:", error);
    renderFallback(containerEl, "Couldn't load the timeline right now.");
  }
}

/** @param {HTMLElement} containerEl */
export async function renderAwards(containerEl) {
  try {
    const cv = await loadJSON(DATA_PATHS.cv);
    const awards = Array.isArray(cv.awards) ? cv.awards : [];

    if (awards.length === 0) {
      renderFallback(containerEl, "No awards yet — check back soon.");
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const award of awards) {
      const item = document.createElement("article");
      item.className = "card";

      const header = document.createElement("div");
      header.className = "split";

      const title = document.createElement("h3");
      title.className = "card__title";
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
        description.className = "text-sm text-muted";
        description.textContent = award.description;
        item.appendChild(description);
      }

      fragment.appendChild(item);
    }

    containerEl.replaceChildren(fragment);
  } catch (error) {
    console.error("renderAwards:", error);
    renderFallback(containerEl, "Couldn't load the awards right now.");
  }
}
