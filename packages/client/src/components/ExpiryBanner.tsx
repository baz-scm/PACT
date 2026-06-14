interface Props {
  expiresAt: string;
}

export function ExpiryBanner({ expiresAt }: Props) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0 || ms > 30 * 24 * 3600 * 1000) return null;
  const hours = Math.ceil(ms / 3600000);
  const label = hours < 2 ? `${Math.ceil(ms / 60000)} minutes` : `${hours} hours`;
  return (
    <div className="text-sm px-4 py-2 rounded-md" style={{ backgroundColor: 'var(--warn-bg)', border: '1px solid var(--warn-fg)', color: 'var(--warn-fg)' }}>
      Expires in {label}
    </div>
  );
}
