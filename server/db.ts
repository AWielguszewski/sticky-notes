import { DatabaseSync } from 'node:sqlite';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Note {
  id: string;
  rect: Rect;
  text: string;
  color: string;
  z: number;
  tagIds: string[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface NotesDatabase {
  listNotes(): Note[];
  saveNote(note: Note): void;
  removeNote(id: string): void;
  listTags(): Tag[];
  /** False when another tag already goes by that name. */
  saveTag(tag: Tag): boolean;
  removeTag(id: string): void;
  close(): void;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    text TEXT NOT NULL,
    color TEXT NOT NULL,
    z INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS tags_by_name ON tags (name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id)
  );
`;

const toTag = (row: Record<string, unknown>): Tag => ({
  id: String(row.id),
  name: String(row.name),
  color: String(row.color),
});

export const openDatabase = (file: string): NotesDatabase => {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);

  const selectNotes = db.prepare('SELECT * FROM notes ORDER BY z');
  const selectNoteTags = db.prepare('SELECT note_id, tag_id FROM note_tags ORDER BY note_id, position');
  const insertNote = db.prepare(`
    INSERT INTO notes (id, x, y, width, height, text, color, z)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      x = excluded.x,
      y = excluded.y,
      width = excluded.width,
      height = excluded.height,
      text = excluded.text,
      color = excluded.color,
      z = excluded.z
  `);
  const deleteNote = db.prepare('DELETE FROM notes WHERE id = ?');
  const clearNoteTags = db.prepare('DELETE FROM note_tags WHERE note_id = ?');
  // Selecting from tags keeps a note from pointing at a tag that is no longer there.
  const linkNoteTag = db.prepare(
    'INSERT INTO note_tags (note_id, tag_id, position) SELECT ?, id, ? FROM tags WHERE id = ?',
  );

  const selectTags = db.prepare('SELECT * FROM tags ORDER BY name COLLATE NOCASE');
  const selectTagByName = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE AND id <> ?');
  const insertTag = db.prepare(`
    INSERT INTO tags (id, name, color)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      color = excluded.color
  `);
  const deleteTag = db.prepare('DELETE FROM tags WHERE id = ?');

  const transaction = (run: () => void): void => {
    db.exec('BEGIN');
    try {
      run();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };

  return {
    listNotes: () => {
      const tagIds = new Map<string, string[]>();
      for (const row of selectNoteTags.all()) {
        const noteId = String(row.note_id);
        const ids = tagIds.get(noteId) ?? [];
        ids.push(String(row.tag_id));
        tagIds.set(noteId, ids);
      }

      return selectNotes.all().map((row) => ({
        id: String(row.id),
        rect: {
          x: Number(row.x),
          y: Number(row.y),
          width: Number(row.width),
          height: Number(row.height),
        },
        text: String(row.text),
        color: String(row.color),
        z: Number(row.z),
        tagIds: tagIds.get(String(row.id)) ?? [],
      }));
    },

    saveNote: (note) => {
      transaction(() => {
        insertNote.run(
          note.id,
          note.rect.x,
          note.rect.y,
          note.rect.width,
          note.rect.height,
          note.text,
          note.color,
          note.z,
        );
        clearNoteTags.run(note.id);
        note.tagIds.forEach((tagId, position) => {
          linkNoteTag.run(note.id, position, tagId);
        });
      });
    },

    removeNote: (id) => {
      deleteNote.run(id);
    },

    listTags: () => selectTags.all().map(toTag),

    saveTag: (tag) => {
      if (selectTagByName.get(tag.name, tag.id) !== undefined) return false;
      insertTag.run(tag.id, tag.name, tag.color);
      return true;
    },

    removeTag: (id) => {
      deleteTag.run(id);
    },

    close: () => db.close(),
  };
};
