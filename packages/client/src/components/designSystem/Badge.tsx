type BadgeVariant = 'pending' | 'approved' | 'rejected' | 'implemented';

const variantStyles: Record<BadgeVariant, { bg: string; fg: string; label: string }> = {
  pending:     { bg: 'var(--warn-bg)',    fg: 'var(--warn-fg)',        label: 'Pending' },
  approved:    { bg: 'var(--success-bg)', fg: 'var(--success-fg)',     label: 'Approved' },
  rejected:    { bg: 'var(--error-bg)',   fg: 'var(--error-fg)',       label: 'Rejected' },
  implemented: { bg: 'var(--bg-section)', fg: 'var(--text-tertiary)',  label: 'Implemented' },
};

export function Badge({ variant }: { variant: BadgeVariant }) {
  const { bg, fg, label } = variantStyles[variant];
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}
