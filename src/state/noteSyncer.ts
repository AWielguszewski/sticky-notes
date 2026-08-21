import type { NotesApi } from '../api/notesApi';
import type { Note, NoteId } from '../model/note';

export type SyncStatus = 'synced' | 'syncing' | 'failed';

export interface NoteSyncer {
  save(note: Note): void;
  remove(id: NoteId): void;
  /** Sends a request of its own, so the status still reflects what is in flight. */
  track<T>(request: Promise<T>): Promise<T>;
  flush(): void;
  dispose(): void;
}

export interface NoteSyncerOptions {
  api: NotesApi;
  onStatusChange: (status: SyncStatus) => void;
}

const WRITE_DELAY_MS = 250;

/**
 * Write-behind buffer between the store and the API: edits of a single note are coalesced,
 * so a burst of keystrokes or a finished drag results in one request.
 */
export const createNoteSyncer = ({ api, onStatusChange }: NoteSyncerOptions): NoteSyncer => {
  const timers = new Map<NoteId, ReturnType<typeof setTimeout>>();
  const pending = new Map<NoteId, Note>();
  let inFlight = 0;
  let failed = false;

  const report = (): void => {
    if (failed) return onStatusChange('failed');
    onStatusChange(inFlight > 0 || pending.size > 0 ? 'syncing' : 'synced');
  };

  const track = <T,>(request: Promise<T>): Promise<T> => {
    inFlight += 1;
    void request
      .then(
        () => {
          failed = false;
        },
        () => {
          failed = true;
        },
      )
      .finally(() => {
        inFlight -= 1;
        report();
      });
    return request;
  };

  const cancelTimer = (id: NoteId): void => {
    const timer = timers.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.delete(id);
  };

  const writeNow = (id: NoteId): void => {
    cancelTimer(id);
    const note = pending.get(id);
    if (note === undefined) return;
    pending.delete(id);
    void track(api.save(note)).catch(() => undefined);
  };

  return {
    save(note) {
      pending.set(note.id, note);
      cancelTimer(note.id);
      timers.set(
        note.id,
        setTimeout(() => writeNow(note.id), WRITE_DELAY_MS),
      );
      report();
    },

    remove(id) {
      cancelTimer(id);
      pending.delete(id);
      void track(api.remove(id)).catch(() => undefined);
      report();
    },

    track,

    flush() {
      for (const id of [...timers.keys()]) writeNow(id);
    },

    dispose() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      pending.clear();
    },
  };
};
