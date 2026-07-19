import type { CSSProperties, ReactNode } from 'react';

export interface CardProps {
  padding?: number;
  radius?: 'xl' | '2xl' | '3xl';
  children: ReactNode;
  style?: CSSProperties;
}

const RADII: Record<NonNullable<CardProps['radius']>, string> = {
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  '3xl': 'var(--radius-3xl)',
};

/** White surface card — the base container for stats, lists and panels. */
export function Card({ padding = 22, radius = '2xl', children, style }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: RADII[radius] ?? RADII['2xl'],
        padding,
        boxShadow: 'var(--shadow-xs)',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
