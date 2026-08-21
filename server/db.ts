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
}

export interface NotesDatabase {
  listNotes(): Note[];
  saveNote(note: Note): void;
  removeNote(id: string): void;
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
`;

const toNote = (row: Record<string, unknown>): Note => ({
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
});

export const openDatabase = (file: string): NotesDatabase => {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);

  const selectNotes = db.prepare('SELECT * FROM notes ORDER BY z');
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

  return {
    listNotes: () => selectNotes.all().map(toNote),

    saveNote: (note) => {
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
    },

    removeNote: (id) => {
      deleteNote.run(id);
    },

    close: () => db.close(),
  };
};
