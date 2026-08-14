import React from 'react';

/** Initials avatar, color-rotated from the accent palette by index. */
const PALETTE = ['blue', 'teal', 'violet', 'amber', 'pink', 'slate'];

export function Avatar({ name, index = 0, size = 40 }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const accent = PALETTE[index % PALETTE.length];
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `var(--accent-${accent}-bg)`, color: `var(--accent-${accent}-fg)`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 800, fontFamily: 'var(--font-sans)',
    }}>
      {initials}
    </span>
  );
}
