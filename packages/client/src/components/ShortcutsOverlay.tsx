import React from 'react';

interface Shortcut {
  keys: string[];
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['a'], label: 'Approve plan' },
  { keys: ['r'], label: 'Submit review' },
  { keys: ['c'], label: 'Focus comment box' },
  { keys: [']'], label: 'Next comment anchor' },
  { keys: ['['], label: 'Previous comment anchor' },
  { keys: ['?'], label: 'Toggle this overlay' },
];

interface ShortcutsOverlayProps {
  onClose: () => void;
}

export const ShortcutsOverlay: React.FC<ShortcutsOverlayProps> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onClick={onClose}
  >
    <div
      className="bg-background border border-border rounded-xl shadow-xl p-6 min-w-[320px]"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base">Keyboard Shortcuts</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {SHORTCUTS.map((s) => (
          <div key={s.keys.join('+')} className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">{s.label}</span>
            <span className="flex gap-1">
              {s.keys.map(k => (
                <kbd
                  key={k}
                  className="px-2 py-0.5 rounded bg-muted border border-border text-xs font-mono"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
