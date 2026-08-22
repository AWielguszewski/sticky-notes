import type { NoteColor } from '../model/note';
import type { SyncStatus } from '../state/noteSyncer';
import { useSyncStatus } from '../state/useNotes';
import { ColorPicker } from './ColorPicker';
import { TagBar } from './TagBar';
import { ThemeToggle } from './ThemeToggle';
import styles from './Toolbar.module.css';

const SYNC_LABEL: Record<SyncStatus, string> = {
  synced: 'Saved',
  syncing: 'Saving…',
  failed: 'Not saved',
};

interface ToolbarProps {
  color: NoteColor;
  onColorChange: (color: NoteColor) => void;
}

export function Toolbar({ color, onColorChange }: ToolbarProps) {
  const syncStatus = useSyncStatus();

  return (
    <header className={styles.toolbar}>
      <h1 className={styles.title}>Sticky Notes</h1>

      <TagBar />

      <div className={styles.tools}>
        <ColorPicker value={color} label="New note color" onChange={onColorChange} />
        <ThemeToggle />
        <p className={styles.sync} data-status={syncStatus} aria-live="polite">
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.syncLabel}>{SYNC_LABEL[syncStatus]}</span>
        </p>
      </div>
    </header>
  );
}
