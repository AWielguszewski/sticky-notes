import type { Note, NoteId } from '../model/note';
import type { Tag, TagId } from '../model/tag';
import { decodeNotes, decodeTags } from './notesCodec';

export interface NotesApi {
  list(): Promise<Note[]>;
  save(note: Note): Promise<Note>;
  remove(id: NoteId): Promise<void>;
  listTags(): Promise<Tag[]>;
  saveTag(tag: Tag): Promise<Tag>;
  removeTag(id: TagId): Promise<void>;
}

// Requests are queued so that two writes of the same thing cannot land out of order.
let queue: Promise<unknown> = Promise.resolve();

const request = (path: string, init?: RequestInit): Promise<Response> => {
  const result = queue.then(async () => {
    const response = await fetch(`/api${path}`, init);
    if (!response.ok) {
      throw new Error(`${init?.method ?? 'GET'} /api${path} failed: ${response.status}`);
    }
    return response;
  });
  queue = result.catch(() => undefined);
  return result;
};

const put = (path: string, body: unknown): Promise<Response> =>
  request(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

export const notesApi: NotesApi = {
  list: async () => decodeNotes(await (await request('/notes')).json()),

  save: async (note) => {
    await put(`/notes/${note.id}`, note);
    return note;
  },

  remove: async (id) => {
    await request(`/notes/${id}`, { method: 'DELETE' });
  },

  listTags: async () => decodeTags(await (await request('/tags')).json()),

  saveTag: async (tag) => {
    await put(`/tags/${tag.id}`, tag);
    return tag;
  },

  removeTag: async (id) => {
    await request(`/tags/${id}`, { method: 'DELETE' });
  },
};
