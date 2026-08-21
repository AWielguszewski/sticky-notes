import { CLIENT_ID } from './notesApi';

/** Listens for boards other than this one changing something, and says so. */
export const subscribeToChanges = (onChange: () => void): (() => void) => {
  const source = new EventSource('/api/events');

  source.addEventListener('message', (event: MessageEvent<string>) => {
    try {
      const { origin } = JSON.parse(event.data) as { origin: string | null };
      if (origin !== CLIENT_ID) onChange();
    } catch {
      onChange();
    }
  });

  return () => source.close();
};
