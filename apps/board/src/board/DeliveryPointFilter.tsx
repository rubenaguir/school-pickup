import type { DeliveryPointResponse } from './useDeliveryPoints';

export interface DeliveryPointFilterProps {
  deliveryPoints: DeliveryPointResponse[];
  value: string | null;
  onChange: (deliveryPointId: string | null) => void;
  /**
   * `'light'` (default) is the original chip, meant for a light page (the
   * default board layout, Sereno). `'dark'` is a translucent-on-navy variant
   * for Andén/Carril's dark headers (ADR-071 §11) — same shape, different
   * tokens, so the filter reads on all 3 modes instead of floating a light
   * box on a dark bar.
   */
  variant?: 'light' | 'dark';
}

/**
 * Filter pastillas indexed by `deliveryPointId`, not `SegmentedTabs`
 * (ADR-069 point 8): `SegmentedTabs` treats each option's `string` as both
 * value and label, but `delivery_point.name` carries no uniqueness
 * constraint (`specs/entities/delivery_point.md`) — two doors named the same
 * would collide a label-keyed filter. Same visual tokens as `SegmentedTabs`
 * (`--surface-muted`, `--ink-900`, `--radius-lg`), a local component instead
 * of touching the design system for this one screen's need.
 */
export function DeliveryPointFilter({
  deliveryPoints,
  value,
  onChange,
  variant = 'light',
}: DeliveryPointFilterProps) {
  const dark = variant === 'dark';
  return (
    <div
      style={{
        display: 'flex',
        gap: 5,
        background: dark ? 'rgba(255,255,255,.08)' : 'var(--surface-muted)',
        border: dark ? '1px solid rgba(255,255,255,.15)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 4,
        width: 'max-content',
      }}
    >
      {[
        { id: null, label: 'Todos' },
        ...deliveryPoints.map((dp) => ({ id: dp.id, label: dp.name })),
      ].map((option) => {
        const active = option.id === value;
        return (
          <span
            key={option.id ?? '__all__'}
            onClick={() => onChange(option.id)}
            style={{
              padding: '7px 15px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              background: active ? (dark ? 'var(--brand)' : 'var(--ink-900)') : 'transparent',
              color: active ? '#fff' : dark ? 'rgba(255,255,255,.6)' : 'var(--ink-300)',
              boxShadow: active && !dark ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {option.label}
          </span>
        );
      })}
    </div>
  );
}
