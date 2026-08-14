import type { DeliveryPointResponse } from './useDeliveryPoints';

export interface DeliveryPointFilterProps {
  deliveryPoints: DeliveryPointResponse[];
  value: string | null;
  onChange: (deliveryPointId: string | null) => void;
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
export function DeliveryPointFilter({ deliveryPoints, value, onChange }: DeliveryPointFilterProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 5,
        background: 'var(--surface-muted)',
        border: '1px solid var(--border)',
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
              background: active ? 'var(--ink-900)' : 'transparent',
              color: active ? '#fff' : 'var(--ink-300)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {option.label}
          </span>
        );
      })}
    </div>
  );
}
