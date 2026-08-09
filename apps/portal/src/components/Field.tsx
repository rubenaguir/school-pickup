import type { CSSProperties, ReactNode } from 'react';

/**
 * Label + framed input, matching the `Field` of `ui_kits/acceso`. Lives in the
 * portal, not in `@casillego/ui`: that package is the port of the ten
 * components of the design system (ADR-036) and gaining an eleventh is a
 * design-system decision, not something a screen decides on its own. Shared
 * here so `Login` and `InstitutionProfile` do not each keep a copy.
 */
export function Field({
  label,
  action,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  action?: ReactNode;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-600)' }}>
          {label}
        </label>
        {action}
      </span>
      <span
        style={{
          height: 46,
          border: '1px solid var(--border-strong)',
          borderRadius: 10,
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {children}
      </span>
      {hint && <span style={{ fontSize: 12, color: 'var(--ink-200)' }}>{hint}</span>}
    </span>
  );
}

export const INPUT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  color: 'var(--ink-900)',
};
