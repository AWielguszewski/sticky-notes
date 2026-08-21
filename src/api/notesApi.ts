import type { Note, NoteId } from '../model/note';
import { decodeNotes } from './notesCodec';

export interface NotesApi {
  list(): Promise<Note[]>;
  save(note: Note): Promise<Note>;
  remove(id: NoteId): Promise<void>;
}

const BASE_PATH = '/api/notes';

// Requests are queued so that two writes of the same note cannot land out of order.
let queue: Promise<unknown> = Promise.resolve();

const request = (path: string, init?: RequestInit): Promise<Response> => {
  const result = queue.then(async () => {
    const response = await fetch(`${BASE_PATH}${path}`, init);
    if (!response.ok) {
      throw new Error(`${init?.method ?? 'GET'} ${BASE_PATH}${path} failed: ${response.status}`);
    }
    return response;
  });
  queue = result.catch(() => undefined);
  return result;
};

export const notesApi: NotesApi = {
  list: async () => decodeNotes(await (await request('')).json()),

  save: async (note) => {
    await request(`/${note.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(note),
    });
    return note;
  },

  remove: async (id) => {
    await request(`/${id}`, { method: 'DELETE' });
  },
};
