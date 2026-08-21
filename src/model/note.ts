import type { Rect, Size } from './geometry';

export type NoteId = string & { readonly __brand: 'NoteId' };

export const NOTE_COLORS = ['amber', 'lime', 'sky', 'rose', 'violet'] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Note {
  readonly id: NoteId;
  readonly rect: Rect;
  readonly text: string;
  readonly color: NoteColor;
  /** Paint order: the note with the highest value is on top. */
  readonly z: number;
}

export const MIN_NOTE_SIZE: Size = { width: 140, height: 120 };

export const DEFAULT_NOTE_SIZE: Size = { width: 220, height: 200 };

export const createNoteId = (): NoteId => crypto.randomUUID() as NoteId;
