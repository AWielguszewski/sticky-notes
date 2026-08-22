import { useImperativeHandle, useRef, type Ref } from 'react';
import type { Rect } from '../model/geometry';
import styles from './Marquee.module.css';

export interface MarqueeHandle {
  show(rect: Rect): void;
  hide(): void;
}

/** The rectangle drawn while notes are being lassoed; it never takes part in a React render. */
export function Marquee({ ref }: { ref: Ref<MarqueeHandle> }) {
  const elementRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      show: (rect) => {
        const element = elementRef.current;
        if (element === null) return;
        element.style.left = `${rect.x}px`;
        element.style.top = `${rect.y}px`;
        element.style.width = `${rect.width}px`;
        element.style.height = `${rect.height}px`;
        element.hidden = false;
      },
      hide: () => {
        if (elementRef.current !== null) elementRef.current.hidden = true;
      },
    }),
    [],
  );

  return <div ref={elementRef} className={styles.marquee} hidden aria-hidden="true" />;
}
