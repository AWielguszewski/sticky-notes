import type { Rect } from '../model/geometry';
import { NOTE_COLORS, type Note, type NoteColor, type NoteId } from '../model/note';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNoteColor = (value: unknown): value is NoteColor =>
  NOTE_COLORS.includes(value as NoteColor);

const decodeRect = (value: unknown): Rect | null => {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return null;
  }
  return { x, y, width, height };
};

export const decodeNote = (value: unknown): Note | null => {
  if (!isRecord(value)) return null;
  const { id, text, color, z } = value;
  const rect = decodeRect(value.rect);
  if (
    rect === null ||
    typeof id !== 'string' ||
    typeof text !== 'string' ||
    typeof z !== 'number' ||
    !isNoteColor(color)
  ) {
    return null;
  }
  return { id: id as NoteId, rect, text, color, z };
};

/** Anything that does not decode is dropped: one broken note must not empty the board. */
export const decodeNotes = (value: unknown): Note[] => {
  if (!Array.isArray(value)) return [];

  const notes: Note[] = [];
  for (const entry of value) {
    const note = decodeNote(entry);
    if (note !== null) notes.push(note);
  }
  return notes;
};
