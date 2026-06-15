import type { ReactNode } from 'react';

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border z-20"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      {children}
    </div>
  );
}

export function ToolbarDivider() {
  return <div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />;
}
