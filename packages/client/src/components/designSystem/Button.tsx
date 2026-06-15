import type { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'success' | 'danger' | 'ghost' | 'ghost-danger';
type ButtonSize = 'sm' | 'md';

const variantStyle: Record<ButtonVariant, React.CSSProperties> = {
  primary:      { backgroundColor: 'var(--action-primary)', color: '#fff' },
  success:      { backgroundColor: 'var(--success-fg)',     color: '#fff' },
  danger:       { backgroundColor: 'var(--error-bg)',       color: 'var(--error-fg)' },
  ghost:        { backgroundColor: 'transparent',           color: 'var(--text-secondary)', border: '1px solid var(--border)' },
  'ghost-danger': { backgroundColor: 'transparent',         color: 'var(--error-fg)' },
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'text-sm px-2.5 py-1',
  md: 'text-sm px-3 py-1.5',
};

interface ButtonProps {
  variant: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
}

export function Button({ variant, size = 'md', disabled, onClick, children, title }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${sizeClass[size]} font-medium rounded-lg transition-colors disabled:opacity-50`}
      style={variantStyle[variant]}
    >
      {children}
    </button>
  );
}
