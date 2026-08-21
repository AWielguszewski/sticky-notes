import { NOTE_COLORS, type NoteColor } from '../model/note';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  value: NoteColor;
  label: string;
  onChange: (color: NoteColor) => void;
}

export function ColorPicker({ value, label, onChange }: ColorPickerProps) {
  return (
    <div className={styles.picker} role="radiogroup" aria-label={label}>
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
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
