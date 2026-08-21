import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Anything Vite fingerprints can be cached forever; index.html never can. */
const isImmutable = (path: string): boolean => path.startsWith('/assets/');

const fileFor = (root: string, pathname: string): string | null => {
  const wanted = resolve(root, `.${normalize(pathname)}`);
  const inside = wanted === resolve(root) || wanted.startsWith(resolve(root) + sep);
  return inside ? wanted : null;
};

const send = (res: ServerResponse, file: string, immutable: boolean, size: number): void => {
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
};

const sizeOf = async (file: string): Promise<number | null> => {
  try {
    const stats = await stat(file);
    return stats.isFile() ? stats.size : null;
  } catch {
    return null;
  }
};

/** Serves the built client, falling back to index.html so the app owns its routes. */
export const serveStatic = async (
  root: string,
  res: ServerResponse,
  pathname: string,
): Promise<void> => {
  const file = fileFor(root, pathname);
  const size = file === null ? null : await sizeOf(file);
  if (file !== null && size !== null) {
    send(res, file, isImmutable(pathname), size);
    return;
  }

  const index = join(root, 'index.html');
  const indexSize = await sizeOf(index);
  if (indexSize === null) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('client build is missing');
    return;
  }
  send(res, index, false, indexSize);
};
