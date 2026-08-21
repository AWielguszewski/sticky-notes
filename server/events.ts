import type { ServerResponse } from 'node:http';

const HEARTBEAT_MS = 25_000;

export interface EventHub {
  subscribe(res: ServerResponse): void;
  /** Tells every board but the one that made the change to refetch. */
  broadcast(origin: string | null): void;
  close(): void;
}

export const createEventHub = (): EventHub => {
  const clients = new Set<ServerResponse>();

  const heartbeat = setInterval(() => {
    for (const client of clients) client.write(': ping\n\n');
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return {
    subscribe(res) {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      res.write('retry: 2000\n\n');
      clients.add(res);
      res.on('close', () => {
        clients.delete(res);
      });
    },

    broadcast(origin) {
      const payload = `data: ${JSON.stringify({ origin })}\n\n`;
      for (const client of clients) client.write(payload);
    },

    close() {
      clearInterval(heartbeat);
      for (const client of clients) client.end();
      clients.clear();
    },
  };
};
