import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { notesApi } from '../api/notesApi';
import { createNoteId, type NoteId } from '../model/note';
import { createTagId, normaliseTagName, sameTagName, type Tag } from '../model/tag';
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
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const load = useCallback(() => {
    void Promise.all([notesApi.list(), notesApi.listTags()]).then(
      ([notes, tags]) => dispatch({ type: 'loaded', notes, tags }),
      () => dispatch({ type: 'loadFailed' }),
    );
  }, []);

  const actions = useMemo<NoteActions>(() => {
    const touch = (id: NoteId): NoteId => {
      dirtyIds.current.add(id);
      return id;
    };

    // A tag write that the server turns down would leave the board lying, so the truth is refetched.
    const writeTag = (tag: Tag): void => {
      dispatch({ type: 'tagSaved', tag });
      void syncer.track(notesApi.saveTag(tag)).catch(load);
    };

    return {
      create(rect, color, tagIds = []) {
        const id = createNoteId();
        dispatch({ type: 'created', id, rect, color, tagIds });
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
      toggleTag(id, tagId) {
        const note = stateRef.current.notes[id];
        if (note === undefined) return;
        const tagIds = note.tagIds.includes(tagId)
          ? note.tagIds.filter((entry) => entry !== tagId)
          : [...note.tagIds, tagId];
        dispatch({ type: 'tagsChanged', id: touch(id), tagIds });
      },
      makeTagPrimary(id, tagId) {
        const note = stateRef.current.notes[id];
        if (note === undefined || !note.tagIds.includes(tagId)) return;
        dispatch({
          type: 'tagsChanged',
          id: touch(id),
          tagIds: [tagId, ...note.tagIds.filter((entry) => entry !== tagId)],
        });
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
      createTag(name, color) {
        const trimmed = normaliseTagName(name);
        if (trimmed === '') return null;
        const taken = Object.values(stateRef.current.tags).some((tag) =>
          sameTagName(tag.name, trimmed),
        );
        if (taken) return null;

        const tag: Tag = { id: createTagId(), name: trimmed, color };
        writeTag(tag);
        return tag.id;
      },
      renameTag(id, name) {
        const tag = stateRef.current.tags[id];
        const trimmed = normaliseTagName(name);
        if (tag === undefined || trimmed === '' || trimmed === tag.name) return false;
        const taken = Object.values(stateRef.current.tags).some(
          (other) => other.id !== id && sameTagName(other.name, trimmed),
        );
        if (taken) return false;

        writeTag({ ...tag, name: trimmed });
        return true;
      },
      setTagColor(id, color) {
        const tag = stateRef.current.tags[id];
        if (tag === undefined || tag.color === color) return;
        writeTag({ ...tag, color });
      },
      removeTag(id) {
        dispatch({ type: 'tagRemoved', id });
        void syncer.track(notesApi.removeTag(id)).catch(load);
      },
      filterByTag(tagId) {
        dispatch({ type: 'filtered', tagId });
      },
    };
  }, [load, syncer]);

  useEffect(load, [load]);

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
