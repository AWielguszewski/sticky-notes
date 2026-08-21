import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Note, NotesDatabase, Rect } from './db.ts';

const MAX_BODY_BYTES = 1_000_000;

const NOTE_PATH = /^\/api\/notes\/([A-Za-z0-9_-]+)$/;

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

/** The id always comes from the path, never from the body. */
export const decodeNote = (id: string, value: unknown): Note | null => {
  if (!isRecord(value)) return null;
  const rect = decodeRect(value.rect);
  const { text, color, z } = value;
  if (rect === null || typeof text !== 'string' || typeof color !== 'string' || typeof z !== 'number') {
    return null;
  }
  return { id, rect, text, color, z };
};

export const handleApiRequest = async (
  db: NotesDatabase,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (!pathname.startsWith('/api/')) return false;

  if (pathname === '/api/notes' && req.method === 'GET') {
    sendJson(res, 200, db.listNotes());
    return true;
  }

  const noteId = NOTE_PATH.exec(pathname)?.[1];
  if (noteId !== undefined) {
    if (req.method === 'PUT') {
      let body: unknown;
      try {
        body = await readJson(req);
      } catch {
        sendJson(res, 400, { error: 'malformed body' });
        return true;
      }
      const note = decodeNote(noteId, body);
      if (note === null) {
        sendJson(res, 422, { error: 'not a note' });
        return true;
      }
      db.saveNote(note);
      sendJson(res, 200, note);
      return true;
    }

    if (req.method === 'DELETE') {
      db.removeNote(noteId);
      sendEmpty(res, 204);
      return true;
    }
  }

  sendJson(res, 404, { error: 'no such endpoint' });
  return true;
};
