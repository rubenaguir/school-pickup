import React from 'react';

/** Flat, factual empty-state block — never "Oops!". */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '48px 24px', gap: 6, fontFamily: 'var(--font-sans)',
    }}>
      <span style={{
        width: 68, height: 68, borderRadius: '50%', background: 'var(--surface-muted)', color: 'var(--ink-100)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
      }}>{icon}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)' }}>{title}</span>
      <span style={{ fontSize: 14, color: 'var(--ink-400)', fontWeight: 500, maxWidth: 340, lineHeight: 1.5 }}>{description}</span>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
