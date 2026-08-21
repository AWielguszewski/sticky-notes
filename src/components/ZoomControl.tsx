import { useZoom } from '../state/useViewport';
import styles from './ZoomControl.module.css';

interface ZoomControlProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
}

export function ZoomControl({ onZoomIn, onZoomOut, onReset, onFit }: ZoomControlProps) {
  const zoom = useZoom();

  return (
    <div className={styles.zoom} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" className={styles.button} onClick={onZoomOut} aria-label="Zoom out">
        −
      </button>
      <button type="button" className={styles.level} onClick={onReset} title="Reset to 100% (Ctrl+0)">
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className={styles.button} onClick={onZoomIn} aria-label="Zoom in">
        +
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={onFit}
        aria-label="Fit all notes"
        title="Fit all notes (Shift+1)"
      >
        ⤢
      </button>
    </div>
  );
}
