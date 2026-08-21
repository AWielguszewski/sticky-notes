import { createContext } from 'react';
import type { Rect } from '../model/geometry';
import type { NoteColor, NoteId } from '../model/note';
import type { SyncStatus } from './noteSyncer';
import type { NotesState } from './notesReducer';

export interface NoteActions {
  create(rect: Rect, color: NoteColor): NoteId;
  setGeometry(id: NoteId, rect: Rect): void;
  setText(id: NoteId, text: string): void;
  setColor(id: NoteId, color: NoteColor): void;
  raise(id: NoteId): void;
  select(id: NoteId | null): void;
  remove(id: NoteId): void;
}

export const NotesStateContext = createContext<NotesState | null>(null);

export const NoteActionsContext = createContext<NoteActions | null>(null);

export const SyncStatusContext = createContext<SyncStatus>('synced');
