import { useTheme, type Theme } from './ThemeProvider';

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: '☀' },
  { value: 'system', label: '⊙' },
  { value: 'dark', label: '☾' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center rounded-full border p-0.5 gap-0.5"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-section)' }}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setTheme(o.value)}
          title={o.value}
          className="w-7 h-7 rounded-full text-sm flex items-center justify-center transition-colors"
          style={
            theme === o.value
              ? { backgroundColor: 'var(--action-primary)', color: '#fff' }
              : { color: 'var(--text-tertiary)' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
