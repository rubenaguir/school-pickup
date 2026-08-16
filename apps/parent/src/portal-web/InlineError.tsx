/**
 * Danger-only inline notice with the technical code in mono underneath
 * (.claude/rules/design-system.md) — same shape as apps/portal's `Alert.tsx`,
 * portal-local for the same reason: `@casillego/ui` holds the ten components
 * of the design system (ADR-036), and this is not one of them.
 */
export function InlineError({ message, code }: { message: string; code?: string }) {
  return (
    <div
      role="alert"
      style={{
        background: 'var(--danger-bg)',
        border: '1px solid var(--danger-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '11px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>{message}</span>
      {code && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-2xs)',
            color: 'var(--ink-300)',
          }}
        >
          {code}
        </span>
      )}
    </div>
  );
}
