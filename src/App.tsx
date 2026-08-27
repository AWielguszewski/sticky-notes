import { useRef, useState } from 'react';
import { Board } from './components/Board';
import { Toolbar } from './components/Toolbar';
import { useScreenFit } from './hooks/useScreenFit';
import type { NoteColor } from './model/note';
import styles from './App.module.css';

export function App() {
  const [draftColor, setDraftColor] = useState<NoteColor>('white');
  const shellRef = useRef<HTMLDivElement>(null);
  useScreenFit(shellRef);

  return (
    <div ref={shellRef} className={styles.app}>
      <Toolbar color={draftColor} onColorChange={setDraftColor} />
      <Board draftColor={draftColor} />
    </div>
  );
}
