import type { CSSProperties, ReactNode } from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  full?: boolean;
  disabled?: boolean;
  /**
   * Defaults to 'button' so no existing usage starts submitting a form by
   * accident. Use 'submit' for the primary action of a real <form>. See
   * ADR-043 point 2.
   */
  type?: 'button' | 'submit';
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

/**
 * Primary/outline/ghost button in the CasiLlego coral system.
 *
 * Renders a real <button>: a <span> cannot submit a form, is not reachable by
 * keyboard, and does not expose `disabled` to assistive technology. The
 * matching prototype in the Claude Design project is still a <span> on
 * purpose — it is a static canvas with no real forms. See ADR-043 point 2.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  full,
  children,
  onClick,
  disabled,
  type = 'button',
}: ButtonProps) {
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  const s = SIZES[size] ?? SIZES.md;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
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
        appearance: 'none',
        ...s,
        ...v,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
