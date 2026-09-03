import type { BoardMode } from './board-mode';

const MODES: ReadonlyArray<{ mode: BoardMode; label: string }> = [
  { mode: 'anden', label: 'A · Andén' },
  { mode: 'sereno', label: 'B · Sereno' },
  { mode: 'carril', label: 'C · Carril' },
];

export interface ModeSwitcherProps {
  value: BoardMode;
  onChange: (mode: BoardMode) => void;
}

/**
 * Floating pastillas, bottom-right, over any of the 3 modes — the semi-dark
 * translucent background (exact values from the kit) is what lets it sit
 * legibly on Andén's `#0A1622`, Sereno's `#EAF1F7`, and Carril's
 * `var(--surface-muted)` alike, without a per-theme variant.
 */
export function ModeSwitcher({ value, onChange }: ModeSwitcherProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 68,
        right: 18,
        display: 'flex',
        gap: 4,
        background: 'rgba(10,22,34,.62)',
        borderRadius: 999,
        padding: 5,
        boxShadow: '0 8px 22px rgba(0,0,0,.30)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {MODES.map(({ mode, label }) => {
        const active = mode === value;
        return (
          <span
            key={mode}
            onClick={() => onChange(mode)}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              background: active ? 'var(--brand)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,.7)',
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
