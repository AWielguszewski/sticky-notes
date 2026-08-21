import type { Rect, Size } from './geometry';
import type { TagId } from './tag';

export type NoteId = string & { readonly __brand: 'NoteId' };

export const NOTE_COLORS = [
  'amber',
  'peach',
  'rose',
  'blush',
  'violet',
  'indigo',
  'sky',
  'teal',
  'mint',
  'lime',
  'sand',
  'slate',
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Note {
  readonly id: NoteId;
  readonly rect: Rect;
  readonly text: string;
  readonly color: NoteColor;
  /** Paint order: the note with the highest value is on top. */
  readonly z: number;
  /** The first tag, when there is one, decides how the note is painted. */
  readonly tagIds: readonly TagId[];
}

export const MIN_NOTE_SIZE: Size = { width: 140, height: 120 };

export const DEFAULT_NOTE_SIZE: Size = { width: 220, height: 200 };

export const createNoteId = (): NoteId => crypto.randomUUID() as NoteId;
