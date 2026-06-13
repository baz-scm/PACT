interface Props {
  expiresAt: string;
}

export function ExpiryBanner({ expiresAt }: Props) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.ceil(ms / 3600000);
  const label = hours < 2 ? `${Math.ceil(ms / 60000)} minutes` : `${hours} hours`;
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2 rounded-md">
      Expires in {label}
    </div>
  );
}
