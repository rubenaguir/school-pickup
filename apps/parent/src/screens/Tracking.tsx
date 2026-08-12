import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge, Button, Card, ErrorState, SkeletonRow, TrackingMap } from '@casillego/ui';
import type { PickupRequestStatus } from '@casillego/shared';
import { useMyEnrollments } from '../enrollments/useMyEnrollments';
import { useLocationReporting } from '../location/useLocationReporting';
import { useWakeLock } from '../wake-lock/useWakeLock';
import { useIsVisible } from '../visibility/useIsVisible';
import {
  trackingActionErrorMessage,
  trackingSnapshotErrorMessage,
  trackingSocketErrorMessage,
} from '../pickup-requests/pickup-request-tracking-error-messages';
import { useTrackingPickupRequest } from '../pickup-requests/useTrackingPickupRequest';
import { HOME_PATH } from '../routes/paths';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

/**
 * The five-state system, shared by the three frontends and never recoloured
 * (`.claude/rules/design-system.md`) — wording matches `docs/design-brief.md`
 * exactly, since this is the screen that brief describes.
 */
const STATUS_LABELS: Record<PickupRequestStatus, string> = {
  en_route: 'En camino',
  arriving: 'Llegando',
  arrived: 'En puerta',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_TONES: Record<
  PickupRequestStatus,
  'en-route' | 'arriving' | 'arrived' | 'delivered' | 'cancelled'
> = {
  en_route: 'en-route',
  arriving: 'arriving',
  arrived: 'arrived',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

/** The trip is still moving — the only window where location is watched/sent and "Ya llegué" applies. */
const TRACKING_STATUSES = new Set<PickupRequestStatus>(['en_route', 'arriving']);
/** The tutor can still back out from any of these (ADR-017 state machine). */
const CANCELLABLE_STATUSES = new Set<PickupRequestStatus>(['en_route', 'arriving', 'arrived']);

function etaLabel(etaSeconds: number | null): string {
  if (etaSeconds === null) return 'Calculando tiempo estimado…';
  const minutes = Math.max(1, Math.round(etaSeconds / 60));
  return `Llegas en ~${minutes} min`;
}

/**
 * "Seguimiento" (docs/design-brief.md, hero ★ de `apps/parent`, ADR-064).
 *
 * `key={pickupRequestId}` on the outer wrapper is the same defensive pattern
 * already used twice this session (`SelectInstitution`, and the route param
 * that drives it): the URL pattern does not change between two tracking
 * screens for two different pickups, so React would otherwise keep this
 * component mounted and its local state (the cancel confirmation, the
 * throttled location watch) would leak from one trip into the next.
 */
export function Tracking() {
  const { pickupRequestId } = useParams<{ pickupRequestId: string }>();
  if (!pickupRequestId) return null;
  return <TrackingForPickupRequest key={pickupRequestId} pickupRequestId={pickupRequestId} />;
}

function TrackingForPickupRequest({ pickupRequestId }: { pickupRequestId: string }) {
  const navigate = useNavigate();
  const tracking = useTrackingPickupRequest(pickupRequestId);
  const enrollments = useMyEnrollments();
  const wakeLockStatus = useWakeLock();
  const isVisible = useIsVisible();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const status = tracking.pickupRequest?.status ?? null;
  const isTracking = status !== null && TRACKING_STATUSES.has(status);
  const locationReporting = useLocationReporting(pickupRequestId, isTracking);

  const enrollment = enrollments.enrollments.find(
    (e) => e.id === tracking.pickupRequest?.enrollmentId,
  );

  if (tracking.status === 'loading') {
    return (
      <TrackingShell>
        <Card padding={0}>
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      </TrackingShell>
    );
  }

  if (tracking.status === 'error' || !tracking.pickupRequest) {
    return (
      <TrackingShell>
        <Card>
          <ErrorState
            title="No pudimos cargar esta recogida"
            message={tracking.error ? trackingSnapshotErrorMessage(tracking.error.code) : undefined}
            code={tracking.error?.code}
            onRetry={tracking.reload}
          />
        </Card>
      </TrackingShell>
    );
  }

  const pickupRequest = tracking.pickupRequest;
  const tutorPosition = locationReporting.position
    ? { lat: locationReporting.position.latitude, lng: locationReporting.position.longitude }
    : null;

  return (
    <TrackingShell
      institutionName={enrollment?.institutionName}
      studentFullName={enrollment?.studentFullName}
      status={pickupRequest.status}
    >
      {/*
        The map/ETA/actions below stay mounted regardless of `isVisible` —
        toggling them in and out of the tree on every focus change tears down
        and rebuilds the Mapbox GL instance, which is not just wasteful but
        can crash it outright (mapbox-gl throws "Invalid LngLat"/"failed to
        invert matrix" when its container is remounted before the browser has
        settled layout, confirmed against the real dev build). The paused
        state is a banner layered on top instead: it still satisfies "no
        finjas datos frescos" (the reader sees the notice, not silently stale
        numbers) without destroying and recreating the map every time the tab
        loses and regains focus.
      */}
      {!isVisible && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
              Seguimiento en pausa
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>
              Los datos en pantalla pueden no estar actualizados. Vuelve a esta pantalla para
              reanudar el seguimiento en vivo.
            </span>
          </div>
        </Card>
      )}

      {tracking.connectionErrorReason && (
        <div
          role="alert"
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '11px 13px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
            El seguimiento en vivo se detuvo.{' '}
            {trackingSocketErrorMessage(tracking.connectionErrorReason)}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xs)',
              color: 'var(--ink-300)',
            }}
          >
            {tracking.connectionErrorReason}
          </span>
        </div>
      )}

      {pickupRequest.status === 'arriving' && (
        <Card style={{ background: 'var(--status-arriving-bg)', border: '1px solid transparent' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-arriving-fg)' }}>
            Tu hijo ya está en el área de entrega.
          </span>
        </Card>
      )}

      <TrackingMap
        accessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        institutionPosition={pickupRequest.institutionLocation}
        tutorPosition={tutorPosition}
      />

      {locationReporting.error && (
        <span style={{ fontSize: 12, color: 'var(--ink-300)' }}>
          {locationReporting.error.message}
        </span>
      )}

      {isTracking && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={EYEBROW_STYLE}>ETA</span>
            <span
              style={{
                fontSize: 'var(--text-display-lg)',
                fontWeight: 800,
                color: 'var(--ink-900)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {etaLabel(pickupRequest.etaSeconds)}
            </span>
          </div>
        </Card>
      )}

      {pickupRequest.status === 'arrived' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <span style={EYEBROW_STYLE}>Código de entrega</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-display-lg)',
                fontWeight: 800,
                letterSpacing: '.18em',
                color: 'var(--ink-900)',
              }}
            >
              {pickupRequest.deliveryCode}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-400)', textAlign: 'center' }}>
              Muéstralo al personal en la puerta para confirmar la entrega.
            </span>
          </div>
        </Card>
      )}

      {isTracking && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--ink-300)',
            textAlign: 'center',
            display: 'block',
          }}
        >
          {wakeLockStatus === 'active' &&
            'Mantenemos esta pantalla encendida mientras vas en camino.'}
          {wakeLockStatus === 'unavailable' &&
            'No pudimos mantener la pantalla encendida automáticamente. Evita que se bloquee mientras conduces.'}
        </span>
      )}

      {pickupRequest.status === 'delivered' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
              Recogida completada
            </span>
            <Button variant="outline" onClick={() => void navigate(HOME_PATH)}>
              Volver a mis hijos
            </Button>
          </div>
        </Card>
      )}

      {pickupRequest.status === 'cancelled' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
              Recogida cancelada
            </span>
            <Button variant="outline" onClick={() => void navigate(HOME_PATH)}>
              Volver a mis hijos
            </Button>
          </div>
        </Card>
      )}

      {tracking.actionError && (
        <div
          role="alert"
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '11px 13px',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
            {trackingActionErrorMessage(tracking.actionError.error.code)}
          </span>
        </div>
      )}

      {isTracking && (
        <Button
          variant="primary"
          size="lg"
          full
          disabled={tracking.actionBusy}
          onClick={() => tracking.markArrived()}
        >
          {tracking.actionBusy ? 'Confirmando…' : '¡Ya llegué!'}
        </Button>
      )}

      {CANCELLABLE_STATUSES.has(pickupRequest.status) && !confirmingCancel && (
        <Button variant="ghost" onClick={() => setConfirmingCancel(true)}>
          Cancelar recogida
        </Button>
      )}

      {CANCELLABLE_STATUSES.has(pickupRequest.status) && confirmingCancel && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--ink-600)' }}>
              ¿Seguro que quieres cancelar esta recogida?
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                variant="destructive"
                disabled={tracking.actionBusy}
                onClick={() => {
                  setConfirmingCancel(false);
                  tracking.cancel();
                }}
              >
                {tracking.actionBusy ? 'Cancelando…' : 'Sí, cancelar'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingCancel(false)}>
                Mantener recogida
              </Button>
            </div>
          </div>
        </Card>
      )}
    </TrackingShell>
  );
}

function TrackingShell({
  institutionName,
  studentFullName,
  status,
  children,
}: {
  institutionName?: string;
  studentFullName?: string;
  status?: PickupRequestStatus;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={EYEBROW_STYLE}>Recogida</span>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-display-sm)',
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-.02em',
              }}
            >
              {institutionName ?? 'Seguimiento'}
            </h1>
            {studentFullName && (
              <span style={{ fontSize: 14, color: 'var(--ink-400)', fontWeight: 600 }}>
                {studentFullName}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {status && <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>}
            <Button variant="ghost" size="sm" onClick={() => void navigate(HOME_PATH)}>
              Volver
            </Button>
          </div>
        </div>

        {children}
      </div>
    </main>
  );
}
