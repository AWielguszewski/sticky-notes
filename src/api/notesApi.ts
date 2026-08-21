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

/** Identifies this board, so the server can tell it apart from the ones it has to notify. */
export const CLIENT_ID = crypto.randomUUID();

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
    headers: { 'content-type': 'application/json', 'x-client-id': CLIENT_ID },
    body: JSON.stringify(body),
  });

const remove = (path: string): Promise<Response> =>
  request(path, { method: 'DELETE', headers: { 'x-client-id': CLIENT_ID } });

export const notesApi: NotesApi = {
  list: async () => decodeNotes(await (await request('/notes')).json()),

  save: async (note) => {
    await put(`/notes/${note.id}`, note);
    return note;
  },

  remove: async (id) => {
    await remove(`/notes/${id}`);
  },

  listTags: async () => decodeTags(await (await request('/tags')).json()),

  saveTag: async (tag) => {
    await put(`/tags/${tag.id}`, tag);
    return tag;
  },

  removeTag: async (id) => {
    await remove(`/tags/${id}`);
  },
};
