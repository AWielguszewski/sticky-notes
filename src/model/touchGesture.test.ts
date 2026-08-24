import { describe, expect, it } from 'vitest';
import { createTouchGesture, type TouchGesture } from './touchGesture';

const BACKGROUND = true;

const ON_A_NOTE = false;

const FIRST = true;

const ALONGSIDE = false;

/** Two fingers on the background, a hundred apart. */
const pinching = (): TouchGesture => {
  const gesture = createTouchGesture();
  gesture.down(1, { x: 0, y: 0 }, BACKGROUND, FIRST);
  gesture.down(2, { x: 100, y: 0 }, BACKGROUND, ALONGSIDE);
  return gesture;
};

describe('one finger', () => {
  it('drags the board when it is on the background', () => {
    const gesture = createTouchGesture();
    gesture.down(1, { x: 10, y: 10 }, BACKGROUND, FIRST);

    expect(gesture.move(1, { x: 25, y: 4 })).toEqual({ kind: 'pan', by: { x: 15, y: -6 } });
  });

  it('leaves the board alone when it landed on a note', () => {
    const gesture = createTouchGesture();
    gesture.down(1, { x: 10, y: 10 }, ON_A_NOTE, FIRST);

    expect(gesture.move(1, { x: 25, y: 4 })).toEqual({ kind: 'none' });
  });

  it('is ignored when it was never written down', () => {
    expect(createTouchGesture().move(9, { x: 1, y: 1 })).toEqual({ kind: 'none' });
  });
});

describe('two fingers', () => {
  it('report how far apart they have moved, even when both are on a note', () => {
    const gesture = createTouchGesture();
    gesture.down(1, { x: 0, y: 0 }, ON_A_NOTE, FIRST);
    gesture.down(2, { x: 100, y: 0 }, ON_A_NOTE, ALONGSIDE);

    expect(gesture.move(2, { x: 200, y: 0 })).toEqual({
      kind: 'pinch',
      centre: { x: 100, y: 0 },
      factor: 2,
      by: { x: 50, y: 0 },
    });
  });

  it('carry the board along when the pinch also travels', () => {
    const gesture = pinching();

    const action = gesture.move(1, { x: 20, y: 0 });
    expect(action.kind === 'pinch' && action.factor).toBe(0.8);
    expect(action.kind === 'pinch' && action.by).toEqual({ x: 10, y: 0 });
  });

  it('are measured from where they landed, so the first move already counts', () => {
    const gesture = pinching();

    expect(gesture.move(2, { x: 140, y: 0 })).toEqual({
      kind: 'pinch',
      centre: { x: 70, y: 0 },
      factor: 1.4,
      by: { x: 20, y: 0 },
    });
  });

  it('hand the board back to the finger that stays when the other lifts', () => {
    const gesture = pinching();

    gesture.up(2);

    expect(gesture.move(1, { x: 5, y: 5 })).toEqual({ kind: 'pan', by: { x: 5, y: 5 } });
  });
});

describe('three fingers', () => {
  it('do not pinch: the board is dragged by whichever of them is on it', () => {
    const gesture = pinching();
    gesture.down(3, { x: 50, y: 50 }, BACKGROUND, ALONGSIDE);

    expect(gesture.move(2, { x: 200, y: 0 })).toEqual({ kind: 'pan', by: { x: 100, y: 0 } });
  });

  it('pinch again once one of them lifts', () => {
    const gesture = pinching();
    gesture.down(3, { x: 50, y: 50 }, BACKGROUND, ALONGSIDE);
    gesture.up(3);

    expect(gesture.move(2, { x: 200, y: 0 }).kind).toBe('pinch');
  });
});

/**
 * A finger whose release never arrives — the note holding its implicit capture was dropped
 * on the bin and unmounted — used to leave two touches on the books forever, and every
 * later drag came out as a pinch.
 */
describe('a touch that is never released', () => {
  it('is dropped when the browser says the glass was clear', () => {
    const gesture = pinching();

    gesture.down(7, { x: 10, y: 10 }, BACKGROUND, FIRST);

    expect(gesture.size).toBe(1);
    expect(gesture.move(7, { x: 30, y: 10 })).toEqual({ kind: 'pan', by: { x: 20, y: 0 } });
  });

  it('survives a finger that lands alongside it, so a real pinch still works', () => {
    const gesture = createTouchGesture();
    gesture.down(1, { x: 0, y: 0 }, BACKGROUND, FIRST);
    gesture.down(2, { x: 100, y: 0 }, BACKGROUND, ALONGSIDE);

    expect(gesture.size).toBe(2);
  });

  it('is dropped when the page is put aside', () => {
    const gesture = pinching();

    gesture.clear();

    expect(gesture.size).toBe(0);
    expect(gesture.move(1, { x: 40, y: 0 })).toEqual({ kind: 'none' });
  });
});
