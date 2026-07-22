/**
 * PURPOSE
 *   Fetch a JSON file exactly once per page load and hand every caller the
 *   same parsed result.
 *
 * RESPONSIBILITIES
 *   - loadJSON(path): fetch + parse + cache + return a Promise.
 *   - Surface fetch/parse failures as a rejected Promise with a clear
 *     message, so callers can render an accessible fallback state.
 *
 * DEPENDENCIES
 *   None.
 *
 * SAFE EDITS
 *   This module should stay generic. Anything specific to one data shape
 *   (projects, skills, etc.) belongs in that data type's render-*.js file,
 *   not here.
 */

const cache = new Map();

/**
 * Fetches and parses a JSON file, caching the result for subsequent calls
 * within the same page load.
 *
 * @param {string} path - Path to the JSON file, relative to the site root.
 * @returns {Promise<unknown>} The parsed JSON value.
 * @throws {Error} If the network request fails or the response is not OK.
 */
export async function loadJSON(path) {
  if (cache.has(path)) {
    return cache.get(path);
  }

  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Failed to load ${path}: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  cache.set(path, data);
  return data;
}
