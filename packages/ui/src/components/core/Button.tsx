import type { CSSProperties, ReactNode } from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  full?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
}

const SIZES: Record<NonNullable<ButtonProps['size']>, CSSProperties> = {
  sm: { padding: '8px 14px', fontSize: 13 },
  md: { padding: '11px 18px', fontSize: 14 },
  lg: { padding: '13px 22px', fontSize: 15 },
};

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  primary: {
    background: 'var(--brand)',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: 'var(--shadow-md)',
  },
  outline: {
    background: '#fff',
    color: 'var(--ink-600)',
    border: '1px solid var(--border-strong)',
  },
  ghost: { background: 'transparent', color: 'var(--ink-600)', border: '1px solid transparent' },
  destructive: {
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    border: '1px solid var(--danger-border)',
  },
  subtle: {
    background: 'var(--brand-soft)',
    color: 'var(--brand-strong)',
    border: '1px solid transparent',
  },
};

/** Primary/outline/ghost button in the CasiLlego coral system. */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  full,
  children,
  onClick,
  disabled,
}: ButtonProps) {
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  const s = SIZES[size] ?? SIZES.md;
  return (
    <span
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 'var(--radius-lg)',
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: full ? '100%' : undefined,
        whiteSpace: 'nowrap',
        ...s,
        ...v,
      }}
    >
      {icon}
      {children}
    </span>
  );
}
