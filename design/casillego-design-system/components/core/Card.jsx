import React from 'react';

/** White surface card — the base container for stats, lists and panels. */
export function Card({ padding = 22, radius = '2xl', children, style }) {
  const radii = { xl: 'var(--radius-xl)', '2xl': 'var(--radius-2xl)', '3xl': 'var(--radius-3xl)' };
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: radii[radius] || radii['2xl'], padding, boxShadow: 'var(--shadow-xs)',
      fontFamily: 'var(--font-sans)', ...style,
    }}>
      {children}
    </div>
  );
}
