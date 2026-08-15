import type { ReactNode } from 'react';
import { etaDisplay, STATUS_META } from './board-display';
import type { BoardRow } from './board-rows';

/** Andén's row cap (§8 of the ADR-071 prompt) — the rest is summarized in the footer count. */
const MAX_ROWS = 8;

export interface LastAnnounced {
  studentFullName: string;
  statusLabel: string;
}

export interface AndenBoardProps {
  institutionName: string;
  /** "Salida vespertina · 14:00–14:30", or `null` outside any dismissal window. */
  subtitle: string | null;
  clock: string;
  dateText: string;
  /** Already sorted (ADR-071 point 5), already filtered by delivery point. */
  rows: BoardRow[];
  lastAnnounced: LastAnnounced | null;
  deliveryPointFilter?: ReactNode;
  /**
   * Replaces the row list with a loading/error/empty block while keeping the
   * header (institution/clock/subtitle) visible — used instead of the
   * row-mapping below whenever the snapshot isn't ready yet (§11 of the
   * ADR-071 prompt: `packages/ui`'s light `ErrorState`/`SkeletonRow` don't
   * read on Andén's dark background, so the screen builds this block itself
   * rather than adding a dark variant to a design-system component with a
   * single consumer).
   */
  contentOverride?: ReactNode;
}

/**
 * Modo A · Andén — public, large-screen, dark (ADR-071 §1/§8). Values below
 * are transcribed from
 * `design/casillego-design-system/ui_kits/tablero-institucion/index.html`,
 * adapted to fill the viewport instead of the mockup's fixed 1300×731 card.
 */
export function AndenBoard({
  institutionName,
  subtitle,
  clock,
  dateText,
  rows,
  lastAnnounced,
  deliveryPointFilter,
  contentOverride,
}: AndenBoardProps) {
  const visible = rows.slice(0, MAX_ROWS);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A1622',
        color: '#fff',
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
          padding: '24px 38px 16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <img src="/pin-mark-inverse.svg" width={24} height={28} alt="" />
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>
              Casi<span style={{ color: 'var(--brand)' }}>Llego</span>
            </span>
          </span>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>
            {institutionName}
          </div>
          {subtitle && (
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>
              {subtitle}
            </div>
          )}
          {deliveryPointFilter}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 0.9,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-.02em',
            }}
          >
            {clock}
          </div>
          <div
            style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 500, marginTop: 6 }}
          >
            {dateText}
          </div>
        </div>
      </div>

      {contentOverride ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{contentOverride}</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 200px 140px',
              gap: 16,
              padding: '11px 38px',
              borderTop: '1px solid rgba(255,255,255,.09)',
              borderBottom: '1px solid rgba(255,255,255,.09)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.4)',
            }}
          >
            <div>Alumno</div>
            <div>Grupo</div>
            <div>Estado</div>
            <div style={{ textAlign: 'right' }}>Llegada</div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {visible.map((row) => {
              const meta = STATUS_META[row.status];
              const filled = row.status === 'arrived';
              return (
                <div
                  key={row.pickupRequestId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 200px 140px',
                    gap: 16,
                    alignItems: 'center',
                    padding: '18px 38px',
                    borderBottom: '1px solid rgba(255,255,255,.05)',
                    background: filled ? 'rgba(14,165,164,0.06)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>
                    {row.studentFullName}
                  </span>
                  <span style={{ fontSize: 16, color: 'rgba(255,255,255,.55)' }}>
                    {row.gradeOrGroup ?? 'Sin grupo'}
                  </span>
                  <span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 15px',
                        borderRadius: 999,
                        fontSize: 15,
                        fontWeight: 700,
                        background: filled ? meta.color : meta.soft,
                        color: filled ? '#04201E' : meta.color,
                        animation: filled ? 'yv-pulse 2.4s ease-in-out infinite' : 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: filled ? '#04201E' : meta.color,
                        }}
                      />
                      {meta.label}
                    </span>
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      fontSize: 20,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: filled ? meta.color : '#fff',
                    }}
                  >
                    {etaDisplay(row)}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '13px 38px',
              borderTop: '1px solid rgba(255,255,255,.09)',
              background: 'rgba(255,255,255,.025)',
            }}
          >
            <span style={{ fontSize: 15, color: 'rgba(255,255,255,.7)', fontWeight: 500 }}>
              {lastAnnounced ? (
                <>
                  Voceando:{' '}
                  <b style={{ color: '#fff', fontWeight: 700 }}>{lastAnnounced.studentFullName}</b>{' '}
                  — {lastAnnounced.statusLabel}
                </>
              ) : (
                'Voceando: —'
              )}
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', fontWeight: 500 }}>
              Mostrando {visible.length} de {rows.length} · se actualiza solo
            </span>
          </div>
        </>
      )}
    </div>
  );
}
