import { useContext } from 'react';
import {
  NoteActionsContext,
  NotesStateContext,
  SyncStatusContext,
  type NoteActions,
} from './notesContext';
import type { SyncStatus } from './noteSyncer';
import type { NotesState } from './notesReducer';

const missingProvider = (hook: string): never => {
  throw new Error(`${hook}() must be used inside <NotesProvider>`);
};

export const useNotesState = (): NotesState =>
  useContext(NotesStateContext) ?? missingProvider('useNotesState');

export const useNoteActions = (): NoteActions =>
  useContext(NoteActionsContext) ?? missingProvider('useNoteActions');

export const useSyncStatus = (): SyncStatus => useContext(SyncStatusContext);
