/**
 * PURPOSE
 *   Turn skills.json, experience.json, timeline.json, and cv.json's
 *   awards into the About page's skills grid, experience list, milestone
 *   timeline, and awards/achievements list.
 *
 * RESPONSIBILITIES
 *   - renderSkills(containerEl)
 *   - renderExperience(containerEl)
 *   - renderTimeline(containerEl)
 *   - renderAwards(containerEl)
 *
 * DATA CONTRACTS
 *   skills.json:     Array<{ category: string, items: string[] }>
 *   experience.json: Array<{ id, role, company, period, location, summary, highlights: string[] }>
 *   timeline.json:   Array<{ id, year, title, description }>
 *   cv.json:         { awards: Array<{ title, description, year }>, ... }
 *                    — awards is read from cv.json (not duplicated into
 *                    its own file) so the About page and the CV page
 *                    always show the same list from one source.
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
      heading.className = "text-sm font-mono text-muted";
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

/** @param {HTMLElement} containerEl */
export async function renderExperience(containerEl) {
  try {
    const roles = await loadJSON(DATA_PATHS.experience);
    const fragment = document.createDocumentFragment();

    for (const role of roles) {
      const item = document.createElement("article");
      item.className = "card";

      const header = document.createElement("div");
      header.className = "split";

      const roleTitle = document.createElement("h3");
      roleTitle.className = "card__title";
      roleTitle.textContent = `${role.role} · ${role.company}`;
      header.appendChild(roleTitle);

      const period = document.createElement("span");
      period.className = "text-sm font-mono text-muted";
      period.textContent = role.period;
      header.appendChild(period);

      item.appendChild(header);

      const location = document.createElement("p");
      location.className = "text-sm text-muted";
      location.textContent = role.location;
      item.appendChild(location);

      const summary = document.createElement("p");
      summary.className = "text-sm";
      summary.textContent = role.summary;
      item.appendChild(summary);

      const highlights = document.createElement("ul");
      highlights.className = "stack stack--tight";
      for (const highlight of role.highlights) {
        const li = document.createElement("li");
        li.className = "text-sm text-muted";
        li.textContent = `— ${highlight}`;
        highlights.appendChild(li);
      }
      item.appendChild(highlights);

      fragment.appendChild(item);
    }

    containerEl.replaceChildren(fragment);
  } catch (error) {
    console.error("renderExperience:", error);
    renderFallback(containerEl, "Couldn't load the background right now.");
  }
}

/** @param {HTMLElement} containerEl */
export async function renderTimeline(containerEl) {
  try {
    const milestones = await loadJSON(DATA_PATHS.timeline);
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
      year.className = "timeline__period text-sm font-mono text-accent";
      year.textContent = milestone.year;
      content.appendChild(year);

      const title = document.createElement("h3");
      title.className = "text-lg";
      title.textContent = milestone.title;
      content.appendChild(title);

      const description = document.createElement("p");
      description.className = "text-sm text-muted";
      description.textContent = milestone.description;
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
        year.className = "text-sm font-mono text-muted";
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
