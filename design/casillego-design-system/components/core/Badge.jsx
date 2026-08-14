import React from 'react';

/** Status pill for the 5-state pickup system, or a neutral/role tag. */
export function Badge({ tone = 'neutral', dot = true, children }) {
  const map = {
    'en-route': { bg: 'var(--status-en-route-bg)', fg: 'var(--status-en-route-fg)', dc: 'var(--status-en-route)' },
    'arriving': { bg: 'var(--status-arriving-bg)', fg: 'var(--status-arriving-fg)', dc: 'var(--status-arriving)' },
    'arrived': { bg: 'var(--status-arrived-bg)', fg: 'var(--status-arrived-fg)', dc: 'var(--status-arrived)' },
    'delivered': { bg: 'var(--status-delivered-bg)', fg: 'var(--status-delivered-fg)', dc: 'var(--status-delivered)' },
    'cancelled': { bg: 'var(--status-cancelled-bg)', fg: 'var(--status-cancelled-fg)', dc: 'var(--status-cancelled)' },
    'brand': { bg: 'var(--brand-soft)', fg: 'var(--brand-strong)', dc: 'var(--brand)' },
    'neutral': { bg: 'var(--surface-muted)', fg: 'var(--ink-500)', dc: 'var(--ink-300)' },
  };
  const c = map[tone] || map.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, width: 'max-content',
      padding: '5px 11px', borderRadius: 'var(--radius-pill)', background: c.bg, color: c.fg,
      fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dc, flexShrink: 0 }} />}
      {children}
    </span>
  );
}
