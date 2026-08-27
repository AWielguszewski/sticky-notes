import { describe, expect, it } from 'vitest';
import {
  MAX_INLINE_IMAGE_BYTES,
  NOTE_SIZE,
  describeNote,
  nextFreeRect,
  pictureFor,
  resolveTagIds,
  topZ,
  type Note,
  type Rect,
  type Tag,
} from './board.ts';

const tags: Tag[] = [
  { id: 't1', name: 'stkbot', color: 'violet' },
  { id: 't2', name: 'marketrunner', color: 'teal' },
];

const note = (id: string, z: number): Note => ({
  id,
  rect: { x: 0, y: 0, ...NOTE_SIZE },
  text: '',
  color: 'amber',
  z,
  tagIds: [],
  images: [],
});

describe('nextFreeRect', () => {
  it('starts at the origin on an empty board', () => {
    expect(nextFreeRect([])).toEqual({ x: 0, y: 0, ...NOTE_SIZE });
  });

  it('steps aside for a note that is already there', () => {
    const first = nextFreeRect([]);
    const second = nextFreeRect([first]);
    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBe(first.y);
  });

  it('wraps to the next row once the row is full', () => {
    const taken: Rect[] = [];
    for (let i = 0; i < 6; i += 1) taken.push(nextFreeRect(taken));
    const seventh = nextFreeRect(taken);
    expect(seventh.x).toBe(0);
    expect(seventh.y).toBeGreaterThan(0);
  });
});

describe('resolveTagIds', () => {
  it('takes names whatever the case, and ids as they are', () => {
    expect(resolveTagIds(tags, ['STKBot', 't2'])).toEqual(['t1', 't2']);
  });

  it('says which tag it does not know', () => {
    expect(() => resolveTagIds(tags, ['ghost'])).toThrowError(/no such tag: ghost/);
  });

  it('has nothing to resolve for an empty list', () => {
    expect(resolveTagIds(tags, [])).toEqual([]);
  });
});

describe('topZ', () => {
  it('is zero on an empty board', () => {
    expect(topZ([])).toBe(0);
  });

  it('finds the note on top', () => {
    expect(topZ([note('a', 3), note('b', 9), note('c', 1)])).toBe(9);
  });
});

describe('describeNote', () => {
  it('answers with tag names rather than the ids nobody can use', () => {
    expect(describeNote({ ...note('n1', 1), tagIds: ['t2'] }, tags).tags).toEqual(['marketrunner']);
  });

  it('carries the pictures a note holds, so it is plain they are there', () => {
    const carrying = { ...note('n1', 1), images: [{ id: 'i1', mime: 'image/png' }] };
    expect(describeNote(carrying, tags).images).toEqual([{ id: 'i1', mime: 'image/png' }]);
  });

  it('says a note has none rather than leaving the question open', () => {
    expect(describeNote(note('n1', 1), tags).images).toEqual([]);
  });
});

describe('pictureFor', () => {
  const image = { id: 'i1', mime: 'image/png' };

  it('hands over a picture to be looked at', () => {
    expect(pictureFor(image, new Uint8Array([1, 2, 3]), 'http://board/i1')).toEqual({
      type: 'image',
      data: Buffer.from([1, 2, 3]).toString('base64'),
      mimeType: 'image/png',
    });
  });

  it('names one too big to carry instead of dropping it', () => {
    const huge = new Uint8Array(MAX_INLINE_IMAGE_BYTES + 1);
    const answer = pictureFor(image, huge, 'http://board/i1');
    expect(answer.type).toBe('text');
    expect(answer.type === 'text' && JSON.parse(answer.text)).toEqual({
      image: 'i1',
      mime: 'image/png',
      bytes: huge.byteLength,
      tooLargeToShow: 'http://board/i1',
    });
  });
});
