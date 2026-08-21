import { useTheme } from '../state/theme';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={dark ? 'Switch to the light board' : 'Switch to the dark board'}
      title={dark ? 'Light' : 'Dark'}
      aria-pressed={dark}
      onClick={toggle}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
