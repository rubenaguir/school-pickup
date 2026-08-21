import type { ReactNode } from 'react';
import { pinMarkUrl } from '@casillego/ui';
import { etaDisplay, horaText, STATUS_META } from './board-display';
import { isActiveBoardStatus, type BoardRow } from './board-rows';

/** Sereno's card cap (§9 of the ADR-071 prompt). */
const MAX_ROWS = 4;

export interface SerenoBoardProps {
  institutionName: string;
  subtitle: string | null;
  clock: string;
  dateText: string;
  /** Already sorted (ADR-071 point 5), already filtered by delivery point. */
  rows: BoardRow[];
  deliveryPointFilter?: ReactNode;
  /** Replaces the card list with a loading/error/empty block — light theme, so `packages/ui`'s own components fit here unmodified (§11). */
  contentOverride?: ReactNode;
}

/**
 * Modo B · Sereno — public kiosk, light, card rows (ADR-071 §1/§9). Values
 * transcribed from
 * `design/casillego-design-system/ui_kits/tablero-institucion/index.html`.
 */
export function SerenoBoard({
  institutionName,
  subtitle,
  clock,
  dateText,
  rows,
  deliveryPointFilter,
  contentOverride,
}: SerenoBoardProps) {
  // Redundant with the merge already dropping delivered/cancelled
  // (ADR-069 point 3) but kept for clarity/defensiveness (§9).
  const visible = rows.filter((row) => isActiveBoardStatus(row.status)).slice(0, MAX_ROWS);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#EAF1F7',
        color: 'var(--ink-900)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <style>
        {
          '@keyframes yv-pulse{0%,100%{box-shadow:0 0 0 0 rgba(14,165,164,0)}50%{box-shadow:0 0 0 7px rgba(14,165,164,.20)}}'
        }
      </style>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
          padding: '28px 38px 20px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <img src={pinMarkUrl} width={24} height={28} alt="" />
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>
              Casi<span style={{ color: 'var(--brand)' }}>Llego</span>
            </span>
          </span>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>
            {institutionName}
          </div>
          {subtitle && (
            <div style={{ fontSize: 14, color: 'var(--ink-300)', fontWeight: 500 }}>{subtitle}</div>
          )}
          {deliveryPointFilter}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 0.9,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-.02em',
            }}
          >
            {clock}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-300)', fontWeight: 500, marginTop: 6 }}>
            {dateText}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: '0 38px 28px',
        }}
      >
        {contentOverride ??
          visible.map((row, index) => {
            const meta = STATUS_META[row.status];
            const filled = row.status === 'arrived';
            return (
              <div
                key={row.pickupRequestId}
                style={{
                  background: index % 2 ? 'rgba(14,31,48,0.025)' : '#fff',
                  borderRadius: 22,
                  boxShadow: '0 8px 20px rgba(14,31,48,.06)',
                  display: 'flex',
                  overflow: 'hidden',
                  animation: filled ? 'yv-pulse 2.4s ease-in-out infinite' : 'none',
                }}
              >
                <span style={{ width: 9, background: meta.color }} />
                <span
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '0 36px',
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '.10em',
                        textTransform: 'uppercase',
                        color: meta.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: meta.color,
                        }}
                      />
                      {meta.label}
                    </span>
                    <span
                      style={{
                        fontSize: 36,
                        fontWeight: 700,
                        letterSpacing: '-.02em',
                        lineHeight: 1,
                      }}
                    >
                      {row.studentFullName}
                    </span>
                    <span style={{ fontSize: 16, color: 'var(--ink-300)', fontWeight: 500 }}>
                      {row.gradeOrGroup ?? 'Sin grupo'}
                    </span>
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      alignItems: 'flex-end',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-200)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '.07em',
                      }}
                    >
                      {filled ? 'Ya en puerta' : 'Llegada estimada'}
                    </span>
                    <span
                      style={{
                        fontSize: 44,
                        fontWeight: 800,
                        letterSpacing: '-.02em',
                        lineHeight: 1,
                        color: meta.color,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {etaDisplay(row)}
                    </span>
                    <span style={{ fontSize: 15, color: 'var(--ink-200)', fontWeight: 500 }}>
                      {horaText(row)}
                    </span>
                  </span>
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
