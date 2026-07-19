export interface ErrorStateProps {
  title: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
}

/** Error block: backend message + technical code + Retry — always give the user a way out. */
export function ErrorState({ title, message, code, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 6,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        style={{
          width: 68,
          height: 68,
          borderRadius: '50%',
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)' }}>{title}</span>
      <span
        style={{
          fontSize: 14,
          color: 'var(--ink-400)',
          fontWeight: 500,
          maxWidth: 340,
          lineHeight: 1.5,
        }}
      >
        {message || 'Error desconocido'}
      </span>
      {code && (
        <span style={{ fontSize: 12, color: 'var(--ink-100)', fontFamily: 'var(--font-mono)' }}>
          {code}
        </span>
      )}
      <span
        onClick={onRetry}
        style={{
          marginTop: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 20px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--brand)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Reintentar
      </span>
    </div>
  );
}
