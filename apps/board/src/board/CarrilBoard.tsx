import type { ReactNode } from 'react';
import { relationshipLabel } from '@casillego/shared';
import type { BoardMonitorRow } from './board-monitor-rows';
import { etaShort, horaText, progressPercent, STATUS_META } from './board-display';

export interface CarrilBoardProps {
  institutionName: string;
  subtitle: string | null;
  clock: string;
  /** Already sorted (ADR-071 point 5 — same priority order, no re-priority of its own), already filtered by delivery point. */
  rows: BoardMonitorRow[];
  advanceNoticeMinutes: number;
  deliveryPointFilter?: ReactNode;
  /** Replaces the row list with a loading/error/empty block — light theme, so `packages/ui`'s own components fit here unmodified (§11). */
  contentOverride?: ReactNode;
  /**
   * Carril is the only mode with a sign-out control: Andén/Sereno are public
   * kiosk displays with no interactive controls beyond the mode switcher
   * (the kit never puts one there either), while Carril is staff-authenticated
   * — confirmed with the human, since the kit doesn't show this control in
   * any mode but a kiosk needs some way to sign out.
   */
  onLogout: () => void;
}

/**
 * Modo C · Carril — staff view, dense, with tutor/vehicle data (ADR-071
 * §1/§2/§10). No row cap (the kit shows everything active on purpose — this
 * is the operator's view) and no pulse/voice, the kit doesn't do either
 * here. Values transcribed from
 * `design/casillego-design-system/ui_kits/tablero-institucion/index.html`.
 */
export function CarrilBoard({
  institutionName,
  subtitle,
  clock,
  rows,
  advanceNoticeMinutes,
  deliveryPointFilter,
  contentOverride,
  onLogout,
}: CarrilBoardProps) {
  const countActive = rows.filter(
    (row) => row.status === 'en_route' || row.status === 'arriving',
  ).length;
  const countPuerta = rows.filter((row) => row.status === 'arrived').length;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-muted)',
        color: 'var(--ink-900)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          background: 'var(--ink-900)',
          color: '#fff',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <img src="/pin-mark-inverse.svg" width={22} height={26} alt="" />
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em' }}>
              Casi<span style={{ color: 'var(--brand)' }}>Llego</span>
            </span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>
              {institutionName}
            </span>
            {subtitle && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>
                {subtitle}
              </span>
            )}
          </span>
          {deliveryPointFilter}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(59,130,246,.18)',
              color: '#93C5FD',
              padding: '6px 12px',
              borderRadius: 999,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--status-en-route)',
              }}
            />
            {countActive} en ruta
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(14,165,164,.18)',
              color: '#5EEAD4',
              padding: '6px 12px',
              borderRadius: 999,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--status-arrived)',
              }}
            />
            {countPuerta} en puerta
          </span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-.02em',
            }}
          >
            {clock}
          </span>
          <span
            onClick={onLogout}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(255,255,255,.55)',
              cursor: 'pointer',
            }}
          >
            Cerrar sesión
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr .7fr 1.2fr 1.1fr 1.5fr .9fr',
          gap: 14,
          padding: '11px 32px',
          background: 'var(--border)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.10em',
          textTransform: 'uppercase',
          color: 'var(--ink-300)',
        }}
      >
        <div>Alumno</div>
        <div>Grupo</div>
        <div>Tutor</div>
        <div>Vehículo</div>
        <div>Estado</div>
        <div style={{ textAlign: 'right' }}>ETA</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {contentOverride ??
          rows.map((row, i) => {
            const meta = STATUS_META[row.status];
            const progress = progressPercent(row.etaSeconds, advanceNoticeMinutes);
            return (
              <div
                key={row.pickupRequestId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr .7fr 1.2fr 1.1fr 1.5fr .9fr',
                  gap: 14,
                  alignItems: 'center',
                  padding: '10px 32px',
                  background: i % 2 ? 'rgba(14,31,48,0.025)' : '#fff',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>
                    {row.studentFullName}
                  </span>
                </span>
                <span>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--ink-600)',
                      background: 'var(--border-hairline)',
                      padding: '3px 9px',
                      borderRadius: 6,
                    }}
                  >
                    {row.gradeOrGroup ?? 'Sin grupo'}
                  </span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-700)' }}>
                    {row.guardianFullName}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-200)' }}>
                    {relationshipLabel(row.guardianRelationship)}
                  </span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-600)', fontWeight: 500 }}>
                    {row.vehicleDescription ?? '—'}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-200)',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '.04em',
                    }}
                  >
                    {row.vehiclePlate ?? '—'}
                  </span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 13,
                      fontWeight: 700,
                      color: meta.color,
                    }}
                  >
                    <span
                      style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }}
                    />
                    {meta.label}
                  </span>
                  <span
                    style={{
                      height: 5,
                      width: 160,
                      background: 'var(--border)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${progress}%`,
                        background: meta.color,
                        borderRadius: 3,
                      }}
                    />
                  </span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 18,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {etaShort(row)}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      color: 'var(--ink-200)',
                      fontWeight: 500,
                    }}
                  >
                    {horaText(row)}
                  </span>
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
