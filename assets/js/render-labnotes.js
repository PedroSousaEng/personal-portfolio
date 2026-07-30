/**
 * PURPOSE
 *   Turn assets/data/labnotes.json into Lab Notes list cards and single
 *   article pages. Lab Notes is the site's blog + simulations section
 *   (name decided over the "Blog page (confirmed excluded at kickoff)"
 *   TODO — this replaces that entry now that scope includes both written
 *   notes and interactive simulations like a four-bar linkage).
 *
 * RESPONSIBILITIES
 *   - renderLabNotesList(containerEl): fetch every entry and render a
 *     card grid (Lab Notes index page).
 *   - renderLabNoteDetail(containerEl, breadcrumbEl): read ?id=<slug>
 *     from the URL and render a single article.
 *
 * DATA CONTRACT (assets/data/labnotes.json)
 *   Array<{
 *     id: string,
 *     title: string,
 *     subtitle: string,
 *     excerpt: string,
 *     tags: string[],
 *     date: string,            // "2026-01"
 *     relatedProject: string,  // optional project id to cross-link
 *     content: string[]        // paragraphs, rendered in order
 *   }>
 *
 *   Future entries can add a `simulation` field (e.g. an embedded
 *   four-bar-linkage widget) — no entry is required to have one, so nothing
 *   here breaks for text-only notes.
 *
 * DEPENDENCIES
 *   data-loader.js
 *
 * SAFE EDITS
 *   Add/edit entries in assets/data/labnotes.json — this file only needs
 *   to change if a new module/content type is introduced.
 */

import { loadJSON } from "./data-loader.js";
import { DATA_PATHS } from "./config.js";

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
 * Builds a single Lab Notes list card.
 * @param {object} note
 * @returns {HTMLElement}
 */
function buildCard(note) {
  const card = document.createElement("article");
  card.className = "card card--interactive card--linked";

  const detailHref = `lab-note.html?id=${encodeURIComponent(note.id)}`;

  card.setAttribute("role", "link");
  card.tabIndex = 0;
  card.setAttribute("aria-label", `Read ${note.title}`);

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

  if (note.date) {
    const meta = document.createElement("div");
    meta.className = "card__meta";
    const date = document.createElement("span");
    date.className = "card__meta-item";
    date.textContent = note.date;
    meta.appendChild(date);
    card.appendChild(meta);
  }

  const title = document.createElement("h3");
  title.className = "card__title";
  title.textContent = note.title;
  card.appendChild(title);

  if (note.subtitle) {
    const subtitle = document.createElement("p");
    subtitle.className = "text-sm text-muted";
    subtitle.textContent = note.subtitle;
    card.appendChild(subtitle);
  }

  const excerpt = document.createElement("p");
  excerpt.className = "text-sm";
  excerpt.textContent = note.excerpt;
  card.appendChild(excerpt);

  if (Array.isArray(note.tags) && note.tags.length > 0) {
    const tags = document.createElement("div");
    tags.className = "card__tags";
    for (const tagText of note.tags) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = tagText;
      tags.appendChild(tag);
    }
    card.appendChild(tags);
  }

  const links = document.createElement("div");
  links.className = "card__links";

  const openLink = document.createElement("a");
  openLink.className = "card__link card__link--primary";
  openLink.href = detailHref;
  openLink.innerHTML = `<svg viewBox="0 0 24 24" class="icon icon--sm" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg> Read note`;
  openLink.setAttribute("aria-label", `Read ${note.title}`);
  links.appendChild(openLink);
  card.appendChild(links);

  return card;
}

/**
 * Fetches Lab Notes data and renders cards into containerEl.
 * @param {HTMLElement} containerEl
 */
export async function renderLabNotesList(containerEl) {
  try {
    const notes = await loadJSON(DATA_PATHS.labnotes);

    if (notes.length === 0) {
      renderFallback(containerEl, "No notes yet — check back soon.");
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const note of notes) {
      fragment.appendChild(buildCard(note));
    }
    containerEl.replaceChildren(fragment);
  } catch (error) {
    console.error("renderLabNotesList:", error);
    renderFallback(
      containerEl,
      "Couldn't load Lab Notes right now. Try refreshing the page."
    );
  }
}

/**
 * Renders a single Lab Notes article based on the ?id= query param.
 * @param {HTMLElement} containerEl
 * @param {HTMLElement | null} [breadcrumbEl]
 */
export async function renderLabNoteDetail(containerEl, breadcrumbEl) {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const notes = await loadJSON(DATA_PATHS.labnotes);
    const note = notes.find((entry) => entry.id === id);

    if (!note) {
      renderFallback(
        containerEl,
        "This note doesn't exist or may have been moved."
      );
      return;
    }

    document.title = `${note.title} — Lab Notes — Pedro Sousa`;

    if (breadcrumbEl) {
      breadcrumbEl.innerHTML = `
        <a href="lab-notes.html">Lab Notes</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">${note.title}</span>
      `;
    }

    const header = document.createElement("header");
    header.className = "section-heading";

    if (note.date) {
      const eyebrow = document.createElement("p");
      eyebrow.className = "eyebrow";
      eyebrow.textContent = note.date;
      header.appendChild(eyebrow);
    }

    const title = document.createElement("h1");
    title.className = "text-3xl font-display mt-2";
    title.textContent = note.title;
    header.appendChild(title);

    if (note.subtitle) {
      const subtitle = document.createElement("p");
      subtitle.className = "text-lg text-muted mt-4";
      subtitle.textContent = note.subtitle;
      header.appendChild(subtitle);
    }

    if (Array.isArray(note.tags) && note.tags.length > 0) {
      const tags = document.createElement("div");
      tags.className = "card__tags mt-4";
      for (const tagText of note.tags) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = tagText;
        tags.appendChild(tag);
      }
      header.appendChild(tags);
    }

    const body = document.createElement("div");
    body.className = "prose mt-8";
    for (const paragraph of note.content || []) {
      const p = document.createElement("p");
      p.textContent = paragraph;
      body.appendChild(p);
    }

    const fragment = document.createDocumentFragment();
    fragment.appendChild(header);
    fragment.appendChild(body);

    if (note.relatedProject) {
      const cta = document.createElement("p");
      cta.className = "mt-8";
      const link = document.createElement("a");
      link.className = "btn btn--secondary";
      link.href = `project.html?id=${encodeURIComponent(note.relatedProject)}`;
      link.textContent = "View the related project";
      cta.appendChild(link);
      fragment.appendChild(cta);
    }

    containerEl.replaceChildren(fragment);
  } catch (error) {
    console.error("renderLabNoteDetail:", error);
    renderFallback(
      containerEl,
      "Couldn't load this note right now. Try refreshing the page."
    );
  }
}
