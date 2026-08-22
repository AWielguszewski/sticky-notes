import { createContext } from 'react';
import type { Point, Rect } from '../model/geometry';
import type { ImageId, NoteColor, NoteId } from '../model/note';
import type { TagId } from '../model/tag';
import type { SyncStatus } from './noteSyncer';
import type { NotesState } from './notesReducer';

export interface NoteActions {
  create(rect: Rect, color: NoteColor, tagIds?: readonly TagId[]): NoteId;
  setGeometry(id: NoteId, rect: Rect): void;
  setText(id: NoteId, text: string): void;
  setColor(id: NoteId, color: NoteColor): void;
  toggleTag(id: NoteId, tagId: TagId): void;
  attachImage(id: NoteId, file: Blob): void;
  detachImage(id: NoteId, imageId: ImageId): void;
  makeTagPrimary(id: NoteId, tagId: TagId): void;
  raise(id: NoteId): void;
  select(ids: readonly NoteId[]): void;
  /** Moves a whole selection at once, so undo takes it back in one step. */
  move(ids: readonly NoteId[], by: Point): void;
  remove(ids: readonly NoteId[]): void;
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
