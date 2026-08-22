import { useId, useRef, useState } from 'react';
import { NOTE_COLORS, type NoteColor } from '../model/note';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  value: NoteColor;
  label: string;
  onChange: (color: NoteColor) => void;
}

const GAP = 8;

const MARGIN = 8;

/**
 * The swatches live in the top layer, which is what keeps them whole: the tag manager
 * scrolls, and a note is drawn inside a transformed layer. Either would otherwise clip
 * the panel or place it somewhere else entirely.
 */
export function ColorPicker({ value, label, onChange }: ColorPickerProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const place = (): void => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (panel === null || trigger === null) return;

    const anchor = trigger.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    // Below the swatch when there is room for it, above it when there is not.
    const below = anchor.bottom + GAP;
    const wanted =
      below + box.height <= window.innerHeight - MARGIN ? below : anchor.top - GAP - box.height;
    const onScreen = (value: number, size: number, within: number): number =>
      Math.min(Math.max(value, MARGIN), Math.max(within - size - MARGIN, MARGIN));

    panel.style.left = `${Math.round(
      onScreen(anchor.left + anchor.width / 2 - box.width / 2, box.width, window.innerWidth),
    )}px`;
    panel.style.top = `${Math.round(onScreen(wanted, box.height, window.innerHeight))}px`;
  };

  return (
    <div className={styles.picker}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        data-color={value}
        aria-label={label}
        aria-expanded={open}
        title={label}
        popoverTarget={panelId}
        onPointerDown={(event) => event.stopPropagation()}
      />

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        className={styles.panel}
        role="radiogroup"
        aria-label={label}
        onPointerDown={(event) => event.stopPropagation()}
        onToggle={(event) => {
          const opening = event.newState === 'open';
          setOpen(opening);
          if (opening) place();
        }}
      >
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
              panelRef.current?.hidePopover();
            }}
          />
        ))}
      </div>
    </div>
  );
}
