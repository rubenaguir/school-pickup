import type { EnrollmentStatus } from '@casillego/shared';
import { enrollmentStatusLabel } from './student-labels';

/**
 * `enrollments.status` (pending/approved/rejected) is not the 5-state pickup
 * system, so it must not borrow that palette (.claude/rules/design-system.md)
 * and does not fit `@casillego/ui`'s `Badge` tone set either. Portal-local
 * pill mixed from the semantic tokens, same approach as `components/Alert.tsx`.
 */
const TONES: Record<EnrollmentStatus, { color: string; background: string; border: string }> = {
  pending: {
    color: 'var(--warning)',
    background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
    border: 'color-mix(in srgb, var(--warning) 35%, transparent)',
  },
  approved: {
    color: 'var(--success)',
    background: 'color-mix(in srgb, var(--success) 12%, transparent)',
    border: 'color-mix(in srgb, var(--success) 35%, transparent)',
  },
  rejected: {
    color: 'var(--danger)',
    background: 'var(--danger-bg)',
    border: 'var(--danger-border)',
  },
};

export function EnrollmentStatusPill({ status }: { status: EnrollmentStatus }) {
  const tone = TONES[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        width: 'max-content',
        padding: '4px 10px',
        borderRadius: 'var(--radius-pill)',
        background: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: '50%', background: tone.color, flexShrink: 0 }}
      />
      {enrollmentStatusLabel(status)}
    </span>
  );
}
