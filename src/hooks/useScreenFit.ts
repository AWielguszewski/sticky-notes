import { useEffect, type RefObject } from 'react';
import { screenBox } from '../model/screen';

/**
 * Holds the shell over exactly what is on screen. The board draws a camera of its own, but
 * the browser has one too — a pinch that lands on the toolbar, the on-screen keyboard, an
 * accessibility zoom — and a shell laid out in the page rides along with it: the toolbar
 * leaves the top, the bin and the zoom buttons leave the edges. So fingers are not allowed
 * to zoom the page, and where the browser moves its viewport anyway, the shell follows.
 */
export function useScreenFit(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    // Safari asks about a pinch through gestures of its own and honours no touch-action.
    const block = (event: Event): void => event.preventDefault();
    element.addEventListener('gesturestart', block, { passive: false });
    element.addEventListener('gesturechange', block, { passive: false });

    // Where there is no visual viewport to read, the stylesheet is left to the page alone.
    const screen = window.visualViewport ?? null;

    // Written straight through rather than batched into a frame: these arrive once a frame
    // as it is, and a frame of lag is the toolbar sliding along behind the fingers.
    const fit = (): void => {
      if (screen === null) return;
      const box = screenBox(screen, window.innerHeight);
      if (box === null) {
        for (const name of ['x', 'y', 'width', 'height']) {
          element.style.removeProperty(`--screen-${name}`);
        }
        return;
      }
      element.style.setProperty('--screen-x', `${box.x}px`);
      element.style.setProperty('--screen-y', `${box.y}px`);
      element.style.setProperty('--screen-width', `${box.width}px`);
      element.style.setProperty('--screen-height', `${box.height}px`);
    };

    fit();
    screen?.addEventListener('resize', fit);
    screen?.addEventListener('scroll', fit);
    // A window that changes size does not always say so through the visual viewport, and a
    // shell still pinned to a screen that has since moved on is the very thing this is here
    // to stop: a toolbar or a bin against an edge that is no longer where the edge is.
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      element.removeEventListener('gesturestart', block);
      element.removeEventListener('gesturechange', block);
      screen?.removeEventListener('resize', fit);
      screen?.removeEventListener('scroll', fit);
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, [ref]);
}
