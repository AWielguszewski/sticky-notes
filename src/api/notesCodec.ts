import type { Rect } from '../model/geometry';
import { NOTE_COLORS, type Note, type NoteColor, type NoteId } from '../model/note';
import type { Tag, TagId } from '../model/tag';

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

const decodeTagIds = (value: unknown): TagId[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const ids: TagId[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    ids.push(entry as TagId);
  }
  return ids;
};

export const decodeNote = (value: unknown): Note | null => {
  if (!isRecord(value)) return null;
  const { id, text, color, z } = value;
  const rect = decodeRect(value.rect);
  const tagIds = decodeTagIds(value.tagIds);
  if (
    rect === null ||
    tagIds === null ||
    typeof id !== 'string' ||
    typeof text !== 'string' ||
    typeof z !== 'number' ||
    !isNoteColor(color)
  ) {
    return null;
  }
  return { id: id as NoteId, rect, text, color, z, tagIds };
};

export const decodeTag = (value: unknown): Tag | null => {
  if (!isRecord(value)) return null;
  const { id, name, color } = value;
  if (typeof id !== 'string' || typeof name !== 'string' || !isNoteColor(color)) return null;
  return { id: id as TagId, name, color };
};

/** Anything that does not decode is dropped: one broken entry must not empty the board. */
const decodeAll = <T>(value: unknown, decode: (entry: unknown) => T | null): T[] => {
  if (!Array.isArray(value)) return [];

  const decoded: T[] = [];
  for (const entry of value) {
    const item = decode(entry);
    if (item !== null) decoded.push(item);
  }
  return decoded;
};

export const decodeNotes = (value: unknown): Note[] => decodeAll(value, decodeNote);

export const decodeTags = (value: unknown): Tag[] => decodeAll(value, decodeTag);
