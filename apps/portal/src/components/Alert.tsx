/**
 * Inline notice with the translated message and, for failures, the technical
 * code in mono underneath (.claude/rules/design-system.md). Portal-local for
 * the same reason as `Field`: `@casillego/ui` holds the ten components of the
 * design system (ADR-036), and this is not one of them.
 */
export type AlertTone = 'danger' | 'success';

/**
 * The success tint is mixed from `--success` instead of being a new hex: the
 * token stays the single source of the colour, and no pickup-status colour
 * gets reused for something that is not a pickup.
 */
const TONES: Record<AlertTone, { background: string; border: string; color: string }> = {
  danger: {
    background: 'var(--danger-bg)',
    border: 'var(--danger-border)',
    color: 'var(--danger)',
  },
  success: {
    background: 'color-mix(in srgb, var(--success) 12%, transparent)',
    border: 'color-mix(in srgb, var(--success) 35%, transparent)',
    color: 'var(--success)',
  },
};

export function Alert({
  message,
  code,
  tone = 'danger',
}: {
  message: string;
  code?: string;
  tone?: AlertTone;
}) {
  const palette = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      style={{
        background: palette.background,
        border: `1px solid ${palette.border}`,
        borderRadius: 'var(--radius-sm)',
        padding: '11px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: palette.color }}>{message}</span>
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
