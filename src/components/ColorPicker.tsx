import { useEffect, useRef, useState } from 'react';
import { NOTE_COLORS, type NoteColor } from '../model/note';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  value: NoteColor;
  label: string;
  onChange: (color: NoteColor) => void;
}

export function ColorPicker({ value, label, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={styles.picker}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={styles.trigger}
        data-color={value}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      />

      {open && (
        <div className={styles.panel} role="radiogroup" aria-label={label}>
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={color === value}
              aria-label={color}
              className={styles.swatch}
              data-color={color}
              data-active={color === value || undefined}
              onClick={() => {
                onChange(color);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
