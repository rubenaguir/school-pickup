/**
 * Sidebar/nav icon set of `InstitutionShell` — transcribed from `Icon()`
 * in `design/casillego-design-system/ui_kits/portal-admin/index.html` (line
 * ~19). `pin` is not one of the kit's `Icon()` names: it is the same marker
 * glyph the kit draws inline for a "Puntos de entrega" row (line ~378), since
 * the kit's own `NAV` has no item for that screen (ADR-072 point 2 keeps it
 * as its own nav item, unlike the kit). No icon library exists in any
 * frontend of this project (ADR-036 criterion: no new dependency without a
 * clear need) — raw SVG, same as the rest of the project.
 */
import type { SVGProps } from 'react';

export type IconName = 'inbox' | 'users' | 'grid' | 'school' | 'clock' | 'chart' | 'pin';

interface IconProps {
  name: IconName;
  size?: number;
}

const COMMON: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
};

export function Icon({ name, size = 20 }: IconProps) {
  const props = { ...COMMON, width: size, height: size };

  if (name === 'inbox') {
    return (
      <svg {...props}>
        <path d="M3 12h4l2 3h6l2-3h4M5 12l1.4-7A2 2 0 0 1 8.35 3h7.3a2 2 0 0 1 1.95 2l1.4 7v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6z" />
      </svg>
    );
  }

  if (name === 'users') {
    return (
      <svg {...props}>
        <circle cx={9} cy={8} r={3.2} />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 5.5a3 3 0 0 1 0 5.5M19 20a6 6 0 0 0-3.5-5.5" />
      </svg>
    );
  }

  if (name === 'grid') {
    return (
      <svg {...props}>
        <rect x={3} y={3} width={7} height={9} rx={1.5} />
        <rect x={14} y={3} width={7} height={5} rx={1.5} />
        <rect x={14} y={12} width={7} height={9} rx={1.5} />
        <rect x={3} y={16} width={7} height={5} rx={1.5} />
      </svg>
    );
  }

  if (name === 'school') {
    return (
      <svg {...props}>
        <path d="M3 21h18M5 21V7l8-4 7 4v13" />
        <path d="M9 9v.01M9 13v.01M9 17v.01" />
      </svg>
    );
  }

  if (name === 'clock') {
    return (
      <svg {...props}>
        <rect x={3} y={4} width={18} height={18} rx={2.5} />
        <path d="M3 10h18M8 2v4M16 2v4" />
      </svg>
    );
  }

  if (name === 'chart') {
    return (
      <svg {...props}>
        <path d="M3 3v18h18" />
        <rect x={7} y={11} width={3} height={6} rx={1} />
        <rect x={13} y={7} width={3} height={10} rx={1} />
      </svg>
    );
  }

  return (
    <svg {...props}>
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" />
      <circle cx={12} cy={10} r={3} />
    </svg>
  );
}
