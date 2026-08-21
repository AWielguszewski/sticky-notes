import { useState } from 'react';
import { Board } from './components/Board';
import { Toolbar } from './components/Toolbar';
import type { NoteColor } from './model/note';
import styles from './App.module.css';

export function App() {
  const [draftColor, setDraftColor] = useState<NoteColor>('amber');

  return (
    <div className={styles.app}>
      <Toolbar color={draftColor} onColorChange={setDraftColor} />
      <Board draftColor={draftColor} />
    </div>
  );
}
