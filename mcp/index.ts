import { readFileSync } from 'node:fs';
import {
  asJson,
  createBoard,
  describeNote,
  nextFreeRect,
  resolveTagIds,
  topZ,
  type Content,
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
  'white, amber, peach, rose, blush, violet, indigo, sky, teal, mint, lime, sand or slate';

/**
 * Handed to whoever connects, before they have called anything. It is here rather than only
 * in the tool descriptions because the mistakes worth heading off are about the board as a
 * whole: where it lives, and that a note can be carrying more than its text.
 */
const INSTRUCTIONS =
  'A personal board of sticky notes — the to-do and bug list its owner jots ' +
  'down while using their projects.\n\n' +
  'The board is a live one reached over the network. It is never files in a repository, ' +
  'so searching a project for notes, todo comments or markdown will not find it, and ' +
  'there is nothing to read from disk. These tools are the whole of it.\n\n' +
  'A tag says which project a note belongs to, and matches the folder name of that ' +
  'project, so scope work to one project with list_notes({ tag }) and leave notes ' +
  'carrying another tag alone.\n\n' +
  'A note can carry pictures. list_notes says which notes have them; read_note({ id }) ' +
  'answers with the note and every picture on it, to look at directly. There is no url ' +
  'to fetch and no http call to make of your own.';

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
      'The notes on the board, newest last. Pass a tag to see only the notes carrying it. ' +
      'Each note lists the pictures it carries; read_note fetches them.',
    inputSchema: {
      type: 'object',
      properties: { tag: { type: 'string', description: 'Tag name or id' } },
      additionalProperties: false,
    },
  },
  {
    name: 'read_note',
    description:
      'One note, with every picture attached to it. The pictures come back to be looked at, ' +
      'so this is the whole note: there is nothing further to fetch.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
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
    description:
      'Changes the text, colour or tags of a note that is already there. Its pictures stay.',
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

/** An answer is a list, because a note answers with its pictures alongside its text. */
const runTool = async (name: string, args: Record<string, unknown>): Promise<Content[]> => {
  switch (name) {
    case 'list_tags':
      return [asJson(await board.listTags())];

    case 'list_notes': {
      const [notes, tags] = await Promise.all([board.listNotes(), board.listTags()]);
      const wanted = asString(args.tag);
      const wantedId = wanted === undefined ? null : resolveTagIds(tags, [wanted])[0];
      const shown =
        wantedId === undefined || wantedId === null
          ? notes
          : notes.filter((note) => note.tagIds.includes(wantedId));
      return [asJson(shown.map((note) => describeNote(note, tags)))];
    }

    case 'read_note': {
      const id = asString(args.id);
      if (id === undefined) throw new Error('read_note needs an id');
      const [notes, tags] = await Promise.all([board.listNotes(), board.listTags()]);
      const note = notes.find((entry) => entry.id === id);
      if (note === undefined) throw new Error(`no note with id ${id}`);
      // Every picture on it comes too: a note is not read until they have been seen.
      const pictures = await Promise.all(note.images.map((image) => board.readImage(image)));
      return [asJson(describeNote(note, tags)), ...pictures];
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
        color: asString(args.color) ?? 'white',
        z: topZ(notes) + 1,
        tagIds,
        // Pictures are put on a note afterwards, from the board itself.
        images: [],
      };
      await board.saveNote(note);
      return [asJson(describeNote(note, tags))];
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
      return [asJson(describeNote(updated, tags))];
    }

    case 'delete_note': {
      const id = asString(args.id);
      if (id === undefined) throw new Error('delete_note needs an id');
      await board.removeNote(id);
      return [asJson({ deleted: id })];
    }

    case 'create_tag': {
      const name = asString(args.name);
      if (name === undefined) throw new Error('create_tag needs a name');
      const tags = await board.listTags();
      const existing = tags.find(
        (tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      if (existing !== undefined) return [asJson(existing)];

      const tag: Tag = { id: crypto.randomUUID(), name, color: asString(args.color) ?? 'violet' };
      await board.saveTag(tag);
      return [asJson(tag)];
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
        instructions: INSTRUCTIONS,
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
        const content = await runTool(asString(params.name) ?? '', asRecord(params.arguments));
        reply({ content });
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
