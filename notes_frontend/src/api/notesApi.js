const DEFAULT_API_BASE_URL = "http://localhost:3001";

/**
 * Returns the API base URL.
 * Uses REACT_APP_API_BASE_URL if provided, otherwise relative URLs (same-origin).
 */
function getApiBaseUrl() {
  return (process.env.REACT_APP_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

/**
 * Make a JSON request and return parsed JSON (or null for 204).
 * Throws an Error with a readable message for non-2xx.
 */
async function requestJson(path, { method = "GET", body, signal } = {}) {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    let details = "";
    try {
      const data = await res.json();
      details = data?.detail ? `: ${data.detail}` : "";
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(`Request failed (${res.status})${details}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// PUBLIC_INTERFACE
export async function listNotes({ signal } = {}) {
  /** List notes from the backend. */
  return requestJson("/notes", { method: "GET", signal });
}

// PUBLIC_INTERFACE
export async function createNote({ title, content }, { signal } = {}) {
  /** Create a note. */
  return requestJson("/notes", { method: "POST", body: { title, content }, signal });
}

// PUBLIC_INTERFACE
export async function updateNote(noteId, { title, content }, { signal } = {}) {
  /** Update an existing note by id. */
  return requestJson(`/notes/${encodeURIComponent(noteId)}`, {
    method: "PUT",
    body: { title, content },
    signal,
  });
}

// PUBLIC_INTERFACE
export async function deleteNote(noteId, { signal } = {}) {
  /** Delete a note by id. */
  return requestJson(`/notes/${encodeURIComponent(noteId)}`, { method: "DELETE", signal });
}
