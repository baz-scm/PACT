export function Footer() {
  return (
    <footer
      className="mt-16 pb-8 flex items-center justify-center gap-1.5 text-xs"
      style={{ color: 'var(--text-tertiary)' }}
    >
      Built by
      <a
        href="https://baz.co"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium transition-colors"
        style={{ color: 'var(--action-primary)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--action-primary-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--action-primary)')}
      >
        baz
      </a>
    </footer>
  );
}
