import { useEffect } from 'react';

type KeyMap = Partial<Record<string, (e: KeyboardEvent) => void>>;

function isFocusedOnInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.getAttribute('contenteditable') === 'true';
}

export function useKeyboardShortcuts(keyMap: KeyMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isFocusedOnInput()) return;
      const fn = keyMap[e.key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keyMap, enabled]);
}
