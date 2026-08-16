/**
 * Icon set of `TutorShell`. `kid`/`link`/`shield`/`user` are transcribed
 * verbatim from `TIcon()` in
 * `design/casillego-design-system/ui_kits/app-padre/index.html` (line
 * ~451) — same paths, not reinterpreted. `building`/`menu`/`close`/`mobile`
 * have no kit source (chrome this step needed that the kit doesn't draw:
 * the institution row icon, the mobile nav toggle, and the "App móvil"
 * link) — same raw-SVG stroke style as the rest of the project (no icon
 * library, ADR-036 criterion).
 */
import type { SVGProps } from 'react';

export type IconName =
  'kid' | 'link' | 'shield' | 'user' | 'building' | 'menu' | 'close' | 'mobile';

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

  if (name === 'kid') {
    return (
      <svg {...props}>
        <circle cx={9} cy={8} r={3.2} />
        <path d="M3 20a6 6 0 0112 0" />
        <path d="M16 5.5a3 3 0 010 5.5M19 20a6 6 0 00-3.5-5.5" />
      </svg>
    );
  }

  if (name === 'link') {
    return (
      <svg {...props}>
        <path d="M9 12h6M10.5 8H8a4 4 0 000 8h2.5M13.5 8H16a4 4 0 010 8h-2.5" />
      </svg>
    );
  }

  if (name === 'shield') {
    return (
      <svg {...props}>
        <path d="M12 3l7 3v5c0 4.4-3 8.2-7 9.5C8 19.2 5 15.4 5 11V6l7-3z" />
        <path d="M9.5 11.5l1.8 1.8 3.5-3.5" />
      </svg>
    );
  }

  if (name === 'user') {
    return (
      <svg {...props}>
        <circle cx={12} cy={8} r={3.5} />
        <path d="M5 20a7 7 0 0114 0" />
      </svg>
    );
  }

  if (name === 'building') {
    return (
      <svg {...props}>
        <path d="M3 21h18M5 21V8l7-4 7 4v13" />
        <path d="M9 21v-5h6v5" />
      </svg>
    );
  }

  if (name === 'menu') {
    return (
      <svg {...props} strokeLinecap="round">
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    );
  }

  if (name === 'close') {
    return (
      <svg {...props} strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }

  return (
    <svg {...props}>
      <rect x={7} y={2} width={10} height={20} rx={2} />
      <path d="M11 18h2" strokeLinecap="round" />
    </svg>
  );
}
