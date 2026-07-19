import type { ReactNode } from 'react';

export interface NavItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

/** Sidebar navigation item with icon, active state and optional count badge. */
export function NavItem({ icon, label, active, count, onClick }: NavItemProps) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 14px',
        borderRadius: 'var(--radius-lg)',
        fontSize: 15,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontWeight: active ? 700 : 600,
        background: active ? 'rgba(251,106,69,.16)' : 'transparent',
        color: active ? '#fff' : 'rgba(255,255,255,.72)',
      }}
    >
      {icon}
      {label}
      {count != null && (
        <span
          style={{
            marginLeft: 'auto',
            background: 'var(--status-arriving)',
            color: '#1a1205',
            fontSize: 12,
            fontWeight: 800,
            minWidth: 22,
            height: 22,
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
          }}
        >
          {count}
        </span>
      )}
    </span>
  );
}
