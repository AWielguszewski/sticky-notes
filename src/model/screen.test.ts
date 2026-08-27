import { describe, expect, it } from 'vitest';
import { screenBox, type Screen } from './screen';

const plain: Screen = { offsetLeft: 0, offsetTop: 0, width: 390, height: 844, scale: 1 };

describe('screenBox', () => {
  it('leaves the stylesheet alone while the browser shows the page plainly', () => {
    expect(screenBox(plain, 844)).toBeNull();
  });

  it('leaves it alone through a resize the page has already followed', () => {
    expect(screenBox({ ...plain, width: 360, height: 640 }, 640)).toBeNull();
  });

  it('follows a browser that has zoomed in and scrolled its own viewport', () => {
    expect(screenBox({ offsetLeft: 30, offsetTop: 120, width: 195, height: 422, scale: 2 }, 844))
      .toEqual({ x: 30, y: 120, width: 195, height: 422 });
  });

  it('shrinks to the room a keyboard has left, which the page never hears about', () => {
    expect(screenBox({ ...plain, height: 480 }, 844)).toEqual({
      x: 0,
      y: 0,
      width: 390,
      height: 480,
    });
  });

  it('ignores the fraction of a pixel a screen can be off by', () => {
    expect(screenBox({ ...plain, height: 843.5 }, 844)).toBeNull();
  });
});
