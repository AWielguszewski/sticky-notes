import { createContext } from 'react';
import type { Rect } from '../model/geometry';
import type { NoteColor, NoteId } from '../model/note';
import type { TagId } from '../model/tag';
import type { SyncStatus } from './noteSyncer';
import type { NotesState } from './notesReducer';

export interface NoteActions {
  create(rect: Rect, color: NoteColor, tagIds?: readonly TagId[]): NoteId;
  setGeometry(id: NoteId, rect: Rect): void;
  setText(id: NoteId, text: string): void;
  setColor(id: NoteId, color: NoteColor): void;
  toggleTag(id: NoteId, tagId: TagId): void;
  makeTagPrimary(id: NoteId, tagId: TagId): void;
  raise(id: NoteId): void;
  select(id: NoteId | null): void;
  remove(id: NoteId): void;
  /** Null when the name is blank or another tag already goes by it. */
  createTag(name: string, color: NoteColor): TagId | null;
  renameTag(id: TagId, name: string): boolean;
  setTagColor(id: TagId, color: NoteColor): void;
  removeTag(id: TagId): void;
  filterByTag(tagId: TagId | null): void;
  undo(): void;
  redo(): void;
}

export const NotesStateContext = createContext<NotesState | null>(null);

export const NoteActionsContext = createContext<NoteActions | null>(null);

export const SyncStatusContext = createContext<SyncStatus>('synced');
