import { describe, expect, it } from 'vitest';
import { NOTE_SIZE, nextFreeRect, resolveTagIds, topZ, type Note, type Tag } from './board.ts';

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
    const taken = [];
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
