import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotesApi } from '../api/notesApi';
import type { Note, NoteId } from '../model/note';
import { createNoteSyncer, type SyncStatus } from './noteSyncer';

const noteId = (value: string): NoteId => value as NoteId;

const makeNote = (id: string, text: string): Note => ({
  id: noteId(id),
  rect: { x: 0, y: 0, width: 200, height: 200 },
  text,
  color: 'amber',
  z: 1,
  tagIds: [],
});

const recordingApi = () => {
  const saved: Note[] = [];
  const removed: NoteId[] = [];
  const api: NotesApi = {
    list: () => Promise.resolve([]),
    save: (note) => {
      saved.push(note);
      return Promise.resolve(note);
    },
    remove: (id) => {
      removed.push(id);
      return Promise.resolve();
    },
    listTags: () => Promise.resolve([]),
    saveTag: (tag) => Promise.resolve(tag),
    removeTag: () => Promise.resolve(),
  };
  return { api, saved, removed };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createNoteSyncer', () => {
  it('coalesces a burst of edits into one request', async () => {
    const { api, saved } = recordingApi();
    const syncer = createNoteSyncer({ api, onStatusChange: () => {} });

    syncer.save(makeNote('a', 'h'));
    syncer.save(makeNote('a', 'he'));
    syncer.save(makeNote('a', 'hey'));
    await vi.advanceTimersByTimeAsync(400);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.text).toBe('hey');
  });

  it('keeps edits of different notes apart', async () => {
    const { api, saved } = recordingApi();
    const syncer = createNoteSyncer({ api, onStatusChange: () => {} });

    syncer.save(makeNote('a', 'one'));
    syncer.save(makeNote('b', 'two'));
    await vi.advanceTimersByTimeAsync(400);

    expect(saved).toHaveLength(2);
  });

  it('reports syncing until the request lands', async () => {
    const statuses: SyncStatus[] = [];
    const { api } = recordingApi();
    const syncer = createNoteSyncer({ api, onStatusChange: (status) => statuses.push(status) });

    syncer.save(makeNote('a', 'hey'));
    expect(statuses).toEqual(['syncing']);
    await vi.advanceTimersByTimeAsync(400);
    expect(statuses.at(-1)).toBe('synced');
  });

  it('fails loudly when the api rejects', async () => {
    const statuses: SyncStatus[] = [];
    const api: NotesApi = {
      list: () => Promise.resolve([]),
      save: () => Promise.reject(new Error('offline')),
      remove: () => Promise.resolve(),
      listTags: () => Promise.resolve([]),
      saveTag: (tag) => Promise.resolve(tag),
      removeTag: () => Promise.resolve(),
    };
    const syncer = createNoteSyncer({ api, onStatusChange: (status) => statuses.push(status) });

    syncer.save(makeNote('a', 'hey'));
    await vi.advanceTimersByTimeAsync(400);

    expect(statuses.at(-1)).toBe('failed');
  });

  it('writes everything pending on flush', () => {
    const { api, saved } = recordingApi();
    const syncer = createNoteSyncer({ api, onStatusChange: () => {} });

    syncer.save(makeNote('a', 'hey'));
    syncer.flush();

    expect(saved).toHaveLength(1);
  });

  it('does not save a note that was removed first', async () => {
    const { api, saved, removed } = recordingApi();
    const syncer = createNoteSyncer({ api, onStatusChange: () => {} });

    syncer.save(makeNote('a', 'hey'));
    syncer.remove(noteId('a'));
    await vi.advanceTimersByTimeAsync(400);

    expect(saved).toHaveLength(0);
    expect(removed).toEqual([noteId('a')]);
  });

  it('drops pending writes when disposed', async () => {
    const { api, saved } = recordingApi();
    const syncer = createNoteSyncer({ api, onStatusChange: () => {} });

    syncer.save(makeNote('a', 'hey'));
    syncer.dispose();
    await vi.advanceTimersByTimeAsync(400);

    expect(saved).toHaveLength(0);
  });
});
