import { useImperativeHandle, useRef, type Ref } from 'react';
import { rectFromDomRect, type Rect } from '../model/geometry';
import styles from './TrashZone.module.css';

export interface TrashZoneHandle {
  measure(): Rect | null;
  setActive(active: boolean): void;
}

export function TrashZone({ ref }: { ref: Ref<TrashZoneHandle> }) {
  const elementRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      measure: () => {
        const element = elementRef.current;
        return element === null ? null : rectFromDomRect(element.getBoundingClientRect());
      },
      setActive: (active) => {
        elementRef.current?.toggleAttribute('data-active', active);
      },
    }),
    [],
  );

  return (
    <div ref={elementRef} className={styles.trash} aria-hidden="true">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7h16" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        <path d="M6.5 7l.8 12.1a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7" />
        <path d="M10 11v6M14 11v6" />
      </svg>
      <span className={styles.label}>Drop to delete</span>
    </div>
  );
}
