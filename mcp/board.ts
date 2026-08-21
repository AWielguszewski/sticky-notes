export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Note {
  id: string;
  rect: Rect;
  text: string;
  color: string;
  z: number;
  tagIds: string[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Board {
  listNotes(): Promise<Note[]>;
  listTags(): Promise<Tag[]>;
  saveNote(note: Note): Promise<void>;
  removeNote(id: string): Promise<void>;
  saveTag(tag: Tag): Promise<void>;
}

export const NOTE_SIZE = { width: 240, height: 210 };

const GAP = 24;

const COLUMNS = 6;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Lays new notes out in reading order, skipping whatever the board already holds. */
export const nextFreeRect = (taken: readonly Rect[]): Rect => {
  for (let row = 0; row < 500; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const rect = {
        x: column * (NOTE_SIZE.width + GAP),
        y: row * (NOTE_SIZE.height + GAP),
        ...NOTE_SIZE,
      };
      if (!taken.some((other) => overlaps(other, rect))) return rect;
    }
  }
  return { x: 0, y: 0, ...NOTE_SIZE };
};

export const topZ = (notes: readonly Note[]): number =>
  notes.reduce((highest, note) => Math.max(highest, note.z), 0);

/** Accepts tag names as people write them, or raw ids. */
export const resolveTagIds = (tags: readonly Tag[], wanted: readonly string[]): string[] => {
  const unknown: string[] = [];
  const ids = wanted.map((entry) => {
    const match = tags.find(
      (tag) => tag.id === entry || tag.name.toLocaleLowerCase() === entry.toLocaleLowerCase(),
    );
    if (match === undefined) {
      unknown.push(entry);
      return '';
    }
    return match.id;
  });

  if (unknown.length > 0) {
    throw new Error(
      `no such tag: ${unknown.join(', ')} — known tags: ${tags.map((tag) => tag.name).join(', ') || 'none'}`,
    );
  }
  return ids;
};

export const createBoard = (baseUrl: string): Board => {
  const call = async (path: string, init?: RequestInit): Promise<unknown> => {
    const response = await fetch(`${baseUrl}/api${path}`, {
      ...init,
      headers: { ...init?.headers, 'x-client-id': 'mcp' },
    });
    if (!response.ok) {
      throw new Error(`${init?.method ?? 'GET'} ${path} answered ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
  };

  const put = (path: string, body: unknown): Promise<unknown> =>
    call(path, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  return {
    listNotes: () => call('/notes') as Promise<Note[]>,
    listTags: () => call('/tags') as Promise<Tag[]>,
    saveNote: async (note) => {
      await put(`/notes/${note.id}`, note);
    },
    removeNote: async (id) => {
      await call(`/notes/${id}`, { method: 'DELETE' });
    },
    saveTag: async (tag) => {
      await put(`/tags/${tag.id}`, tag);
    },
  };
};
