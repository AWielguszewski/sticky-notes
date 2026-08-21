import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { notesApi } from '../api/notesApi';
import { createNoteId, type NoteId } from '../model/note';
import { createNoteSyncer, type SyncStatus } from './noteSyncer';
import { NoteActionsContext, NotesStateContext, SyncStatusContext, type NoteActions } from './notesContext';
import { initialNotesState, notesReducer } from './notesReducer';

export function NotesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notesReducer, initialNotesState);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const syncer = useMemo(
    () => createNoteSyncer({ api: notesApi, onStatusChange: setSyncStatus }),
    [],
  );
  const dirtyIds = useRef(new Set<NoteId>());

  const actions = useMemo<NoteActions>(() => {
    const touch = (id: NoteId): NoteId => {
      dirtyIds.current.add(id);
      return id;
    };

    return {
      create(rect, color) {
        const id = createNoteId();
        dispatch({ type: 'created', id, rect, color });
        return touch(id);
      },
      setGeometry(id, rect) {
        dispatch({ type: 'geometryChanged', id: touch(id), rect });
      },
      setText(id, text) {
        dispatch({ type: 'textChanged', id: touch(id), text });
      },
      setColor(id, color) {
        dispatch({ type: 'colorChanged', id: touch(id), color });
      },
      raise(id) {
        dispatch({ type: 'raised', id: touch(id) });
      },
      select(id) {
        dispatch({ type: 'selected', id });
      },
      remove(id) {
        dirtyIds.current.delete(id);
        syncer.remove(id);
        dispatch({ type: 'removed', id });
      },
    };
  }, [syncer]);

  useEffect(() => {
    let cancelled = false;
    void notesApi.list().then(
      (notes) => {
        if (!cancelled) dispatch({ type: 'loaded', notes });
      },
      () => {
        if (!cancelled) dispatch({ type: 'loadFailed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Persists whatever the reducer produced for the notes touched since the last commit.
  useEffect(() => {
    if (state.status !== 'ready' || dirtyIds.current.size === 0) return;
    for (const id of dirtyIds.current) {
      const note = state.notes[id];
      if (note !== undefined) syncer.save(note);
    }
    dirtyIds.current.clear();
  }, [state, syncer]);

  useEffect(() => {
    const flush = (): void => syncer.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      syncer.dispose();
    };
  }, [syncer]);

  return (
    <NotesStateContext.Provider value={state}>
      <NoteActionsContext.Provider value={actions}>
        <SyncStatusContext.Provider value={syncStatus}>{children}</SyncStatusContext.Provider>
      </NoteActionsContext.Provider>
    </NotesStateContext.Provider>
  );
}
