import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { handleApiRequest, sendJson } from './api.ts';
import { openDatabase } from './db.ts';
import { createEventHub } from './events.ts';
import { createImageStore } from './imageStore.ts';
import { serveStatic } from './static.ts';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data');
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist');

mkdirSync(DATA_DIR, { recursive: true });
const db = openDatabase(join(DATA_DIR, 'stickynotes.db'));
const images = createImageStore(join(DATA_DIR, 'images'));
const hub = createEventHub();

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;

  void (async () => {
    try {
      if (await handleApiRequest(db, images, hub, req, res, pathname)) return;
      await serveStatic(STATIC_DIR, res, pathname);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) sendJson(res, 500, { error: 'server error' });
      else res.end();
    }
  })();
});

server.listen(PORT, HOST, () => {
  console.log(`sticky notes on http://localhost:${PORT} — data in ${DATA_DIR}`);
});

const shutdown = (): void => {
  hub.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
