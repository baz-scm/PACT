import type { ReactNode } from 'react';

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1 rounded-full border transition-colors"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: active ? 'var(--bg-section)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}
