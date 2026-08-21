import type { Note, NoteId } from '../model/note';
import { readNotes, writeNotes } from './notesStorage';

export interface NotesApi {
  list(): Promise<Note[]>;
  save(note: Note): Promise<Note>;
  remove(id: NoteId): Promise<void>;
}

const MIN_LATENCY_MS = 40;
const MAX_LATENCY_MS = 180;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// Requests are queued so that concurrent read-modify-write calls cannot drop each other's changes.
let queue: Promise<unknown> = Promise.resolve();

const request = <T>(handler: () => T): Promise<T> => {
  const result = queue.then(async () => {
    await delay(MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS));
    return handler();
  });
  queue = result.catch(() => undefined);
  return result;
};

/** Stand-in for a REST backend: asynchronous, request-scoped, persisted in local storage. */
export const notesApi: NotesApi = {
  list: () => request(readNotes),

  save: (note) =>
    request(() => {
      const others = readNotes().filter((entry) => entry.id !== note.id);
      writeNotes([...others, note]);
      return note;
    }),

  remove: (id) =>
    request(() => {
      writeNotes(readNotes().filter((entry) => entry.id !== id));
    }),
};
