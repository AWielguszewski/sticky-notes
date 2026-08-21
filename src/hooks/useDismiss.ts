import { useEffect, type RefObject } from 'react';

/** Closes a panel on Escape, or on a press anywhere outside it. */
export const useDismiss = (
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  dismiss: () => void,
): void => {
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node) || !ref.current?.contains(target)) dismiss();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dismiss, open, ref]);
};
