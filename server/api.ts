import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Note, NotesDatabase, Rect, Tag } from './db.ts';
import type { EventHub } from './events.ts';

const MAX_BODY_BYTES = 1_000_000;

const MAX_TAG_NAME_LENGTH = 32;

const NOTE_PATH = /^\/api\/notes\/([A-Za-z0-9_-]+)$/;

const TAG_PATH = /^\/api\/tags\/([A-Za-z0-9_-]+)$/;

export const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
};

const sendEmpty = (res: ServerResponse, status: number): void => {
  res.writeHead(status).end();
};

const readJson = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('request body is too large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const decodeRect = (value: unknown): Rect | null => {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return null;
  }
  return { x, y, width, height };
};

const decodeTagIds = (value: unknown): string[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  return value.every((entry) => typeof entry === 'string') ? (value as string[]) : null;
};

/** The id always comes from the path, never from the body. */
export const decodeNote = (id: string, value: unknown): Note | null => {
  if (!isRecord(value)) return null;
  const rect = decodeRect(value.rect);
  const tagIds = decodeTagIds(value.tagIds);
  const { text, color, z } = value;
  if (
    rect === null ||
    tagIds === null ||
    typeof text !== 'string' ||
    typeof color !== 'string' ||
    typeof z !== 'number'
  ) {
    return null;
  }
  return { id, rect, text, color, z, tagIds };
};

export const decodeTag = (id: string, value: unknown): Tag | null => {
  if (!isRecord(value)) return null;
  const { name, color } = value;
  if (typeof name !== 'string' || typeof color !== 'string') return null;
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_NAME_LENGTH);
  return trimmed === '' ? null : { id, name: trimmed, color };
};

const handleNotes = async (
  db: NotesDatabase,
  changed: () => void,
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
): Promise<boolean> => {
  if (req.method === 'PUT') {
    const note = decodeNote(id, await readJson(req));
    if (note === null) {
      sendJson(res, 422, { error: 'not a note' });
      return true;
    }
    db.saveNote(note);
    changed();
    sendJson(res, 200, note);
    return true;
  }

  if (req.method === 'DELETE') {
    db.removeNote(id);
    changed();
    sendEmpty(res, 204);
    return true;
  }

  return false;
};

const handleTags = async (
  db: NotesDatabase,
  changed: () => void,
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
): Promise<boolean> => {
  if (req.method === 'PUT') {
    const tag = decodeTag(id, await readJson(req));
    if (tag === null) {
      sendJson(res, 422, { error: 'not a tag' });
      return true;
    }
    if (!db.saveTag(tag)) {
      sendJson(res, 409, { error: 'a tag by that name already exists' });
      return true;
    }
    changed();
    sendJson(res, 200, tag);
    return true;
  }

  if (req.method === 'DELETE') {
    db.removeTag(id);
    changed();
    sendEmpty(res, 204);
    return true;
  }

  return false;
};

export const handleApiRequest = async (
  db: NotesDatabase,
  hub: EventHub,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (!pathname.startsWith('/api/')) return false;

  if (req.method === 'GET' && pathname === '/api/events') {
    hub.subscribe(res);
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/notes') {
    sendJson(res, 200, db.listNotes());
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/tags') {
    sendJson(res, 200, db.listTags());
    return true;
  }

  const client = req.headers['x-client-id'];
  const changed = (): void => hub.broadcast(typeof client === 'string' ? client : null);

  try {
    const noteId = NOTE_PATH.exec(pathname)?.[1];
    if (noteId !== undefined && (await handleNotes(db, changed, req, res, noteId))) return true;

    const tagId = TAG_PATH.exec(pathname)?.[1];
    if (tagId !== undefined && (await handleTags(db, changed, req, res, tagId))) return true;
  } catch {
    sendJson(res, 400, { error: 'malformed body' });
    return true;
  }

  sendJson(res, 404, { error: 'no such endpoint' });
  return true;
};
