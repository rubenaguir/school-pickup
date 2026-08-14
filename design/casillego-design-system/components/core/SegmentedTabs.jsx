import React from 'react';

/** Segmented tab control used for role/status filters and demo switchers. */
export function SegmentedTabs({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 5, background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'max-content' }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <span
            key={opt}
            onClick={() => onChange && onChange(opt)}
            style={{
              padding: '7px 15px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              background: active ? 'var(--ink-900)' : 'transparent',
              color: active ? '#fff' : 'var(--ink-300)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {opt}
          </span>
        );
      })}
    </div>
  );
}
