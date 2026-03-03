import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { createNote, deleteNote, listNotes, updateNote } from "./api/notesApi";

/**
 * Normalizes a note object for UI usage.
 * The backend might use id/uuid/_id; we defensively pick the first available.
 */
function normalizeNote(note) {
  const id = note?.id ?? note?.note_id ?? note?.uuid ?? note?._id;
  return {
    ...note,
    id,
    title: note?.title ?? "",
    content: note?.content ?? "",
  };
}

/** Returns a user friendly error message. */
function getErrorMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  return err.message || "Something went wrong";
}

// PUBLIC_INTERFACE
function App() {
  /** Main Notes UI: list notes, create, edit, and delete. */
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const selectedNote = useMemo(
    () => notes.find((n) => String(n.id) === String(selectedId)) || null,
    [notes, selectedId]
  );

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const t = (n.title || "").toLowerCase();
      const c = (n.content || "").toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [notes, query]);

  async function refreshNotes({ keepSelection = true } = {}) {
    setError("");
    setLoading(true);
    try {
      const data = await listNotes();
      const normalized = Array.isArray(data) ? data.map(normalizeNote) : [];
      setNotes(normalized);

      if (!keepSelection) {
        setSelectedId(null);
      } else if (selectedId != null) {
        const stillExists = normalized.some((n) => String(n.id) === String(selectedId));
        if (!stillExists) setSelectedId(null);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setError("");
      setLoading(true);
      try {
        const data = await listNotes({ signal: ac.signal });
        const normalized = Array.isArray(data) ? data.map(normalizeNote) : [];
        setNotes(normalized);
      } catch (err) {
        if (err?.name !== "AbortError") setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep editor in sync with selection
    if (selectedNote) {
      setEditorTitle(selectedNote.title || "");
      setEditorContent(selectedNote.content || "");
    } else {
      setEditorTitle("");
      setEditorContent("");
    }
  }, [selectedNote]);

  function beginCreate() {
    setSelectedId("NEW");
    setEditorTitle("");
    setEditorContent("");
  }

  function hasChanges() {
    if (selectedId === "NEW") return editorTitle.trim() !== "" || editorContent.trim() !== "";
    if (!selectedNote) return false;
    return (
      (selectedNote.title || "") !== editorTitle ||
      (selectedNote.content || "") !== editorContent
    );
  }

  async function onSave() {
    setError("");
    const title = editorTitle.trim();
    const content = editorContent.trim();

    if (!title) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    try {
      if (selectedId === "NEW") {
        const created = normalizeNote(await createNote({ title, content }));
        // Optimistic insert at top
        setNotes((prev) => [created, ...prev]);
        setSelectedId(created.id ?? null);
      } else if (selectedNote?.id != null) {
        const updated = normalizeNote(await updateNote(selectedNote.id, { title, content }));
        setNotes((prev) =>
          prev.map((n) => (String(n.id) === String(updated.id) ? updated : n))
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(noteId) {
    setError("");
    setDeletingId(noteId);
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => String(n.id) !== String(noteId)));
      if (String(selectedId) === String(noteId)) setSelectedId(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="appRoot">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true" />
          <div className="brandText">
            <div className="brandTitle">Simple Notes</div>
            <div className="brandSubtitle">Create, edit, and organize your notes</div>
          </div>
        </div>

        <div className="topbarActions">
          <button className="btn btnSecondary" onClick={() => refreshNotes()} disabled={loading}>
            Refresh
          </button>
          <button className="btn btnPrimary" onClick={beginCreate}>
            New note
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="sidebar" aria-label="Notes list">
          <div className="sidebarHeader">
            <input
              className="input"
              placeholder="Search notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search notes"
            />
          </div>

          <div className="sidebarBody">
            {loading ? (
              <div className="emptyState">Loading notes…</div>
            ) : error ? (
              <div className="errorBox" role="alert">
                <div className="errorTitle">Could not load notes</div>
                <div className="errorMessage">{error}</div>
                <button className="btn btnSecondary" onClick={() => refreshNotes()}>
                  Try again
                </button>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="emptyState">
                <div className="emptyTitle">No notes found</div>
                <div className="emptyMessage">
                  {query.trim()
                    ? "Try a different search."
                    : "Create your first note to get started."}
                </div>
                {!query.trim() && (
                  <button className="btn btnPrimary" onClick={beginCreate}>
                    Create a note
                  </button>
                )}
              </div>
            ) : (
              <ul className="noteList">
                {filteredNotes.map((n) => {
                  const active = String(n.id) === String(selectedId);
                  return (
                    <li key={String(n.id)}>
                      <button
                        className={`noteCard ${active ? "active" : ""}`}
                        onClick={() => setSelectedId(n.id)}
                        aria-current={active ? "true" : "false"}
                      >
                        <div className="noteCardTop">
                          <div className="noteTitle">{n.title || "Untitled"}</div>
                        </div>
                        <div className="notePreview">
                          {(n.content || "").trim() ? n.content : "No content"}
                        </div>
                      </button>
                      <div className="noteCardActions">
                        <button
                          className="iconBtn"
                          onClick={() => {
                            setSelectedId(n.id);
                          }}
                          title="Edit note"
                          aria-label="Edit note"
                        >
                          Edit
                        </button>
                        <button
                          className="iconBtn danger"
                          onClick={() => onDelete(n.id)}
                          disabled={deletingId === n.id}
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          {deletingId === n.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="editor" aria-label="Note editor">
          <div className="editorHeader">
            <div className="editorTitle">
              {selectedId === "NEW" ? "New note" : selectedNote ? "Edit note" : "Select a note"}
            </div>
            <div className="editorMeta">
              {selectedNote?.id != null && selectedId !== "NEW" ? (
                <span className="pill">ID: {String(selectedNote.id)}</span>
              ) : null}
            </div>
          </div>

          <div className="editorBody">
            {selectedId == null ? (
              <div className="emptyState editorEmpty">
                <div className="emptyTitle">Pick a note to edit</div>
                <div className="emptyMessage">
                  Select one from the list, or create a new note.
                </div>
                <button className="btn btnPrimary" onClick={beginCreate}>
                  New note
                </button>
              </div>
            ) : (
              <>
                <label className="field">
                  <span className="label">Title</span>
                  <input
                    className="input"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="e.g., Meeting notes"
                    maxLength={120}
                  />
                </label>

                <label className="field">
                  <span className="label">Content</span>
                  <textarea
                    className="textarea"
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    placeholder="Write your note…"
                    rows={12}
                  />
                </label>

                <div className="editorActions">
                  <button
                    className="btn btnPrimary"
                    onClick={onSave}
                    disabled={saving || !hasChanges()}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>

                  <button
                    className="btn btnSecondary"
                    onClick={() => {
                      if (selectedNote) {
                        setEditorTitle(selectedNote.title || "");
                        setEditorContent(selectedNote.content || "");
                      } else {
                        setEditorTitle("");
                        setEditorContent("");
                      }
                    }}
                    disabled={saving || !hasChanges()}
                  >
                    Discard changes
                  </button>

                  {selectedNote?.id != null && selectedId !== "NEW" ? (
                    <button
                      className="btn btnDanger"
                      onClick={() => onDelete(selectedNote.id)}
                      disabled={deletingId === selectedNote.id}
                    >
                      {deletingId === selectedNote.id ? "Deleting…" : "Delete note"}
                    </button>
                  ) : null}
                </div>

                {error ? (
                  <div className="inlineError" role="alert">
                    {error}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span className="footerText">
          Tip: set <code>REACT_APP_API_BASE_URL</code> to point to the backend (e.g.{" "}
          <code>http://localhost:8000</code>) if running on a different origin.
        </span>
      </footer>
    </div>
  );
}

export default App;
