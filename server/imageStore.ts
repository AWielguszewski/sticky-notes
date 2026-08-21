import { createReadStream, mkdirSync } from 'node:fs';
import { rm, stat, writeFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** Raster only: an svg opened in its own tab would run whatever script it carries. */
export const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export interface ImageStore {
  write(id: string, bytes: Buffer): Promise<void>;
  send(res: ServerResponse, id: string, mime: string): Promise<boolean>;
  remove(id: string): Promise<void>;
}

/** The bytes live next to the database, one file per image, named by its id. */
export const createImageStore = (dir: string): ImageStore => {
  mkdirSync(dir, { recursive: true });
  const fileFor = (id: string): string => join(dir, id);

  return {
    write: (id, bytes) => writeFile(fileFor(id), bytes),

    send: async (res, id, mime) => {
      const file = fileFor(id);
      let size: number;
      try {
        size = (await stat(file)).size;
      } catch {
        return false;
      }
      res.writeHead(200, {
        'content-type': mime,
        'content-length': size,
        // An image never changes under its id, so it can be kept for good.
        'cache-control': 'public, max-age=31536000, immutable',
      });
      createReadStream(file).pipe(res);
      return true;
    },

    remove: (id) => rm(fileFor(id), { force: true }),
  };
};
