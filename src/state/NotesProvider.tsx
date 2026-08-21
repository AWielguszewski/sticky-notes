import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { notesApi } from '../api/notesApi';
import { subscribeToChanges } from '../api/notesEvents';
import { createNoteId, type NoteId } from '../model/note';
import { createTagId, normaliseTagName, sameTagName, type Tag, type TagId } from '../model/tag';
import { createNoteSyncer, type SyncStatus } from './noteSyncer';
import { NoteActionsContext, NotesStateContext, SyncStatusContext, type NoteActions } from './notesContext';
import { initialNotesState, notesReducer, type NoteMap, type TagMap } from './notesReducer';

const HISTORY_LIMIT = 100;

interface Snapshot {
  notes: NoteMap;
  tags: TagMap;
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notesReducer, initialNotesState);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const syncer = useMemo(
    () => createNoteSyncer({ api: notesApi, onStatusChange: setSyncStatus }),
    [],
  );
  const dirtyIds = useRef(new Set<NoteId>());
  const history = useRef<{ past: Snapshot[]; future: Snapshot[]; last: string }>({
    past: [],
    future: [],
    last: '',
  });
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

  // Someone else changed something: take the server truth, but keep what is not written yet.
  const refresh = useCallback(() => {
    void Promise.all([notesApi.list(), notesApi.listTags()]).then(
      ([notes, tags]) =>
        dispatch({ type: 'refreshed', notes, tags, keep: [...dirtyIds.current] }),
      () => undefined,
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
      void syncer.track(notesApi.saveTag(tag)).catch(refresh);
    };

    /** Remembers the state about to be left behind; a run of keystrokes counts as one step. */
    const record = (label: string): void => {
      const log = history.current;
      log.future = [];
      if (label !== '' && label === log.last) return;
      log.last = label;
      log.past.push({ notes: stateRef.current.notes, tags: stateRef.current.tags });
      if (log.past.length > HISTORY_LIMIT) log.past.shift();
    };

    // Whatever the two snapshots disagree on is what has to reach the server.
    const writeDiff = (from: Snapshot, to: Snapshot): void => {
      for (const note of Object.values(to.notes)) {
        if (from.notes[note.id] !== note) syncer.save(note);
      }
      for (const id of Object.keys(from.notes) as NoteId[]) {
        if (to.notes[id] === undefined) syncer.remove(id);
      }
      for (const tag of Object.values(to.tags)) {
        if (from.tags[tag.id] !== tag) void syncer.track(notesApi.saveTag(tag)).catch(refresh);
      }
      for (const id of Object.keys(from.tags) as TagId[]) {
        if (to.tags[id] === undefined) void syncer.track(notesApi.removeTag(id)).catch(refresh);
      }
    };

    const step = (from: Snapshot[], to: Snapshot[]): void => {
      const target = from.pop();
      if (target === undefined) return;
      const current: Snapshot = { notes: stateRef.current.notes, tags: stateRef.current.tags };
      to.push(current);
      history.current.last = '';
      dispatch({ type: 'restored', notes: target.notes, tags: target.tags });
      writeDiff(current, target);
    };

    return {
      create(rect, color, tagIds = []) {
        record('');
        const id = createNoteId();
        dispatch({ type: 'created', id, rect, color, tagIds });
        return touch(id);
      },
      setGeometry(id, rect) {
        record('');
        dispatch({ type: 'geometryChanged', id: touch(id), rect });
      },
      setText(id, text) {
        record(`text:${id}`);
        dispatch({ type: 'textChanged', id: touch(id), text });
      },
      setColor(id, color) {
        record('');
        dispatch({ type: 'colorChanged', id: touch(id), color });
      },
      attachImage(id, file) {
        // The id of an image is the server's to give, so nothing is drawn before it answers.
        void syncer
          .track(notesApi.addImage(id, file))
          .then((image) => dispatch({ type: 'imageAdded', id, image }))
          .catch(refresh);
      },
      detachImage(id, imageId) {
        dispatch({ type: 'imageRemoved', id, imageId });
        void syncer.track(notesApi.removeImage(imageId)).catch(refresh);
      },
      toggleTag(id, tagId) {
        const note = stateRef.current.notes[id];
        if (note === undefined) return;
        record('');
        const tagIds = note.tagIds.includes(tagId)
          ? note.tagIds.filter((entry) => entry !== tagId)
          : [...note.tagIds, tagId];
        dispatch({ type: 'tagsChanged', id: touch(id), tagIds });
      },
      makeTagPrimary(id, tagId) {
        const note = stateRef.current.notes[id];
        if (note === undefined || !note.tagIds.includes(tagId)) return;
        record('');
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
        record('');
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

        record('');
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

        record('');
        writeTag({ ...tag, name: trimmed });
        return true;
      },
      setTagColor(id, color) {
        const tag = stateRef.current.tags[id];
        if (tag === undefined || tag.color === color) return;
        record('');
        writeTag({ ...tag, color });
      },
      removeTag(id) {
        record('');
        dispatch({ type: 'tagRemoved', id });
        void syncer.track(notesApi.removeTag(id)).catch(refresh);
      },
      filterByTag(tagId) {
        dispatch({ type: 'filtered', tagId });
      },
      undo() {
        step(history.current.past, history.current.future);
      },
      redo() {
        step(history.current.future, history.current.past);
      },
    };
  }, [refresh, syncer]);

  useEffect(load, [load]);

  useEffect(() => subscribeToChanges(refresh), [refresh]);

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
