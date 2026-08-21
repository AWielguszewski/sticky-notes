import { useCallback, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sticky-notes.theme.v1';

/** index.html settles the theme before the first paint; this only reads back what it chose. */
const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

export const useTheme = (): [Theme, () => void] => {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = useCallback(() => {
    setTheme((was) => {
      const next: Theme = was === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return [theme, toggle];
};
