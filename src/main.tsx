import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { NotesProvider } from './state/NotesProvider';
import './styles/global.css';

const container = document.getElementById('root');
if (container === null) throw new Error('Root container #root is missing');

createRoot(container).render(
  <StrictMode>
    <NotesProvider>
      <App />
    </NotesProvider>
  </StrictMode>,
);
