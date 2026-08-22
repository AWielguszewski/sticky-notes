import { readFileSync } from 'node:fs';
import {
  createBoard,
  nextFreeRect,
  resolveTagIds,
  topZ,
  type Note,
  type Tag,
} from './board.ts';

/** For boards that do not run on this machine: local/board.env is never committed. */
const configuredUrl = (): string | null => {
  try {
    const text = readFileSync(new URL('../local/board.env', import.meta.url), 'utf8');
    return /^\s*BOARD_URL\s*=\s*(\S+)/m.exec(text)?.[1] ?? null;
  } catch {
    return null;
  }
};

const BASE_URL = process.env.STICKYNOTES_URL ?? configuredUrl() ?? 'http://127.0.0.1:8787';

const PROTOCOL_VERSION = '2025-06-18';

const COLORS =
  'amber, peach, rose, blush, violet, indigo, sky, teal, mint, lime, sand or slate';

const board = createBoard(BASE_URL);

const TOOLS = [
  {
    name: 'list_tags',
    description: 'Every tag on the board, with its colour.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_notes',
    description:
      'The notes on the board, newest last. Pass a tag to see only the notes carrying it.',
    inputSchema: {
      type: 'object',
      properties: { tag: { type: 'string', description: 'Tag name or id' } },
      additionalProperties: false,
    },
  },
  {
    name: 'create_note',
    description:
      'Puts a new note on the board, in the first free spot unless a position is given.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tag names or ids' },
        color: { type: 'string', description: COLORS },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_note',
    description: 'Changes the text, colour or tags of a note that is already there.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        text: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        color: { type: 'string', description: COLORS },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_note',
    description: 'Takes a note off the board.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_tag',
    description: 'Adds a tag. Its colour paints every note that carries it first.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, color: { type: 'string', description: COLORS } },
      required: ['name'],
      additionalProperties: false,
    },
  },
];

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asStrings = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? (value as string[])
    : undefined;

/** Notes are answered with tag names, which are what a conversation can actually use. */
const withTagNames = (note: Note, tags: readonly Tag[]) => ({
  id: note.id,
  text: note.text,
  color: note.color,
  tags: note.tagIds.map((id) => tags.find((tag) => tag.id === id)?.name ?? id),
  position: { x: note.rect.x, y: note.rect.y },
});

const runTool = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
  switch (name) {
    case 'list_tags':
      return board.listTags();

    case 'list_notes': {
      const [notes, tags] = await Promise.all([board.listNotes(), board.listTags()]);
      const wanted = asString(args.tag);
      const wantedId = wanted === undefined ? null : resolveTagIds(tags, [wanted])[0];
      const shown =
        wantedId === undefined || wantedId === null
          ? notes
          : notes.filter((note) => note.tagIds.includes(wantedId));
      return shown.map((note) => withTagNames(note, tags));
    }

    case 'create_note': {
      const text = asString(args.text);
      if (text === undefined) throw new Error('create_note needs text');
      const [notes, tags] = await Promise.all([board.listNotes(), board.listTags()]);
      const tagIds = resolveTagIds(tags, asStrings(args.tags) ?? []);
      const placed = nextFreeRect(notes.map((note) => note.rect));
      const note: Note = {
        id: crypto.randomUUID(),
        rect: {
          ...placed,
          ...(typeof args.x === 'number' ? { x: args.x } : {}),
          ...(typeof args.y === 'number' ? { y: args.y } : {}),
        },
        text,
        color: asString(args.color) ?? 'amber',
        z: topZ(notes) + 1,
        tagIds,
      };
      await board.saveNote(note);
      return withTagNames(note, tags);
    }

    case 'update_note': {
      const id = asString(args.id);
      const [notes, tags] = await Promise.all([board.listNotes(), board.listTags()]);
      const note = notes.find((entry) => entry.id === id);
      if (note === undefined) throw new Error(`no note with id ${String(id)}`);

      const wanted = asStrings(args.tags);
      const updated: Note = {
        ...note,
        text: asString(args.text) ?? note.text,
        color: asString(args.color) ?? note.color,
        tagIds: wanted === undefined ? note.tagIds : resolveTagIds(tags, wanted),
      };
      await board.saveNote(updated);
      return withTagNames(updated, tags);
    }

    case 'delete_note': {
      const id = asString(args.id);
      if (id === undefined) throw new Error('delete_note needs an id');
      await board.removeNote(id);
      return { deleted: id };
    }

    case 'create_tag': {
      const name = asString(args.name);
      if (name === undefined) throw new Error('create_tag needs a name');
      const tags = await board.listTags();
      const existing = tags.find(
        (tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      if (existing !== undefined) return existing;

      const tag: Tag = { id: crypto.randomUUID(), name, color: asString(args.color) ?? 'violet' };
      await board.saveTag(tag);
      return tag;
    }

    default:
      throw new Error(`no such tool: ${name}`);
  }
};

const send = (message: unknown): void => {
  process.stdout.write(`${JSON.stringify(message)}\n`);
};

const handle = async (request: Record<string, unknown>): Promise<void> => {
  const { id, method } = request;
  const params = asRecord(request.params);
  if (id === undefined) return;

  const reply = (result: unknown): void => send({ jsonrpc: '2.0', id, result });

  switch (method) {
    case 'initialize':
      reply({
        protocolVersion: asString(params.protocolVersion) ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'stickynotes', version: '1.0.0' },
      });
      return;

    case 'ping':
      reply({});
      return;

    case 'tools/list':
      reply({ tools: TOOLS });
      return;

    case 'tools/call':
      try {
        const result = await runTool(asString(params.name) ?? '', asRecord(params.arguments));
        reply({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        reply({
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        });
      }
      return;

    default:
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown method ${String(method)}` } });
  }
};

let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
    const line = buffer.slice(0, end).trim();
    buffer = buffer.slice(end + 1);
    if (line === '') continue;
    try {
      void handle(asRecord(JSON.parse(line)));
    } catch {
      // A line that is not json is not something this server can answer.
    }
  }
});

// Nothing to shut down by hand: once stdin is closed and the last answer is out, node is done.
