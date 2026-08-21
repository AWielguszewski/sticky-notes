import { describe, expect, it } from 'vitest';
import { boundingRect, clamp, containsPoint, rectFromCorners, translate } from './geometry';

describe('clamp', () => {
  it('keeps the value inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });
});

describe('translate', () => {
  it('adds the offset', () => {
    expect(translate({ x: 10, y: 20 }, { x: -3, y: 4 })).toEqual({ x: 7, y: 24 });
  });
});

describe('rectFromCorners', () => {
  it('normalises corners dragged upwards and to the left', () => {
    expect(rectFromCorners({ x: 100, y: 100 }, { x: 40, y: 60 })).toEqual({
      x: 40,
      y: 60,
      width: 60,
      height: 40,
    });
  });
});

describe('containsPoint', () => {
  const rect = { x: 10, y: 10, width: 100, height: 50 };

  it('accepts points inside and on the edge', () => {
    expect(containsPoint(rect, { x: 50, y: 30 })).toBe(true);
    expect(containsPoint(rect, { x: 110, y: 60 })).toBe(true);
  });

  it('rejects points outside', () => {
    expect(containsPoint(rect, { x: 9, y: 30 })).toBe(false);
    expect(containsPoint(rect, { x: 50, y: 61 })).toBe(false);
  });
});

describe('boundingRect', () => {
  it('has nothing to cover when there are no rects', () => {
    expect(boundingRect([])).toBeNull();
  });

  it('covers every rect it is given', () => {
    expect(
      boundingRect([
        { x: 100, y: 50, width: 40, height: 40 },
        { x: -20, y: 200, width: 10, height: 10 },
        { x: 0, y: 0, width: 5, height: 5 },
      ]),
    ).toEqual({ x: -20, y: 0, width: 160, height: 210 });
  });
});
