import type { Rect } from './geometry';

/** The part of the page the browser is actually showing, as the browser reports it. */
export interface Screen {
  readonly offsetLeft: number;
  readonly offsetTop: number;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

/**
 * Where to hold the shell so it covers what is on screen, or null while the browser is
 * showing the page plainly. Plainly is the ordinary case, and there the stylesheet has the
 * size right on its own and goes on having it right through every resize and rotation
 * without being told. Only a browser that has zoomed, scrolled its own viewport, or made
 * room for a keyboard is worth pinning to, and only for as long as it stays that way.
 */
export const screenBox = (screen: Screen, pageHeight: number): Rect | null =>
  screen.scale === 1 &&
  screen.offsetLeft === 0 &&
  screen.offsetTop === 0 &&
  // The keyboard takes its room out of the screen without the page hearing about it.
  Math.abs(screen.height - pageHeight) < 1
    ? null
    : {
        x: screen.offsetLeft,
        y: screen.offsetTop,
        width: screen.width,
        height: screen.height,
      };
