import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppVersionLabel, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { boardListErrorMessage, boardSocketErrorMessage } from '../board/board-error-messages';
import { AndenBoard, type LastAnnounced } from '../board/AndenBoard';
import { SerenoBoard } from '../board/SerenoBoard';
import { CarrilBoard } from '../board/CarrilBoard';
import { ModeSwitcher } from '../board/ModeSwitcher';
import { DeliveryPointFilter } from '../board/DeliveryPointFilter';
import { STATUS_META } from '../board/board-display';
import { pickupAnnouncementText } from '../board/tts';
import { boardAudioQueue } from '../board/audio-queue';
import {
  consumeStashedSelectedDeliveryPoint,
  rememberSelectedDeliveryPoint,
} from '../board/board-reload-state';
import { readStoredBoardMode, writeStoredBoardMode, type BoardMode } from '../board/board-mode';
import { useClock } from '../board/useClock';
import { useDismissalWindow } from '../board/useDismissalWindow';
import { useInstitutionProfile } from '../board/useInstitutionProfile';
import { useDeliveryPoints } from '../board/useDeliveryPoints';
import { useInstitutionBoard, type ManualAnnouncePayload } from '../board/useInstitutionBoard';
import { useInstitutionBoardMonitor } from '../board/useInstitutionBoardMonitor';
import type { BoardRow } from '../board/board-rows';

const EMPTY_BOARD_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M3 17h2l1-5h12l1 5h2" />
    <path d="M5 17v2h3v-2M16 17v2h3v-2" />
    <path d="M8 12V7a4 4 0 0 1 8 0v5" />
  </svg>
);

const EMPTY_TITLE = 'Sin recogidas en curso';
const EMPTY_DESCRIPTION =
  'Las recogidas activas aparecerán aquí en cuanto un tutor avise que va en camino.';

/**
 * Andén's own loading/error/empty look (dark) — `packages/ui`'s `ErrorState`/
 * `EmptyState`/`SkeletonRow` assume a light surface (`.claude/rules/design-system.md`
 * doesn't define a dark variant, ADR-071 §7/§11: no dark tokens added to
 * `packages/ui` for a single consumer), so Andén builds its own instead of a
 * light block floating unreadably on `#0A1622`.
 */
function DarkLoading() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 15, color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>
        Cargando…
      </span>
    </div>
  );
}

function DarkError({
  title,
  message,
  code,
  onRetry,
}: {
  title: string;
  message?: string;
  code?: string;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{title}</span>
      <span style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', maxWidth: 360, lineHeight: 1.5 }}>
        {message ?? 'Error desconocido'}
      </span>
      {code && (
        <span
          style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', fontFamily: 'var(--font-mono)' }}
        >
          {code}
        </span>
      )}
      <span
        onClick={onRetry}
        style={{
          marginTop: 10,
          padding: '10px 18px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--brand)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Reintentar
      </span>
    </div>
  );
}

function DarkEmpty() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{EMPTY_TITLE}</span>
      <span style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', maxWidth: 340, lineHeight: 1.5 }}>
        {EMPTY_DESCRIPTION}
      </span>
    </div>
  );
}

/** Shared shape a live channel (public board or Carril's monitor) exposes for the loading/error/empty override below. */
interface ChannelState {
  status: 'loading' | 'ready' | 'error';
  error: { code: string } | null;
  connectionErrorReason: string | null;
  reload: () => void;
}

function contentOverrideFor(
  channel: ChannelState,
  visibleCount: number,
  dark: boolean,
): ReactNode | undefined {
  if (channel.connectionErrorReason && channel.status !== 'ready') {
    const message = boardSocketErrorMessage(channel.connectionErrorReason);
    return dark ? (
      <DarkError
        title="No pudimos abrir el tablero en vivo"
        message={message}
        code={channel.connectionErrorReason}
        onRetry={channel.reload}
      />
    ) : (
      <ErrorState
        title="No pudimos abrir el tablero en vivo"
        message={message}
        code={channel.connectionErrorReason}
        onRetry={channel.reload}
      />
    );
  }

  if (channel.status === 'loading') {
    return dark ? (
      <DarkLoading />
    ) : (
      <>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </>
    );
  }

  if (channel.status === 'error') {
    const message = channel.error ? boardListErrorMessage(channel.error.code) : undefined;
    return dark ? (
      <DarkError
        title="No pudimos cargar las recogidas de esta institución"
        message={message}
        code={channel.error?.code}
        onRetry={channel.reload}
      />
    ) : (
      <ErrorState
        title="No pudimos cargar las recogidas de esta institución"
        message={message}
        code={channel.error?.code}
        onRetry={channel.reload}
      />
    );
  }

  if (visibleCount === 0) {
    return dark ? (
      <DarkEmpty />
    ) : (
      <EmptyState icon={EMPTY_BOARD_ICON} title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
    );
  }

  return undefined;
}

/**
 * The board's single screen, now orchestrating the 3 real modes of the kit
 * (ADR-071): Andén (public, dark), Sereno (public, light), Carril (staff).
 * Andén/Sereno share the public feed (`useInstitutionBoard`); Carril opens
 * its own channel (`useInstitutionBoardMonitor`) only while active, by
 * simply not handing it an `institutionId` otherwise — same pattern the
 * public hook already uses while the institution itself is still loading.
 */
export function Home() {
  const { logout } = useAuth();
  const { current, institutionId } = useInstitution();
  const institutionName = current?.institutionName ?? 'Institución';

  const [mode, setMode] = useState<BoardMode>(() => readStoredBoardMode());
  const changeMode = useCallback((next: BoardMode) => {
    setMode(next);
    writeStoredBoardMode(next);
  }, []);

  // Lazy init from a stash left by an ADR-094 auto-update reload (single-use);
  // normally `null`. Kept in sync via the effect below so the next reload can
  // save it again.
  const [selectedDeliveryPointId, setSelectedDeliveryPointId] = useState<string | null>(
    consumeStashedSelectedDeliveryPoint,
  );
  useEffect(() => {
    rememberSelectedDeliveryPoint(selectedDeliveryPointId);
  }, [selectedDeliveryPointId]);
  const [lastAnnounced, setLastAnnounced] = useState<LastAnnounced | null>(null);

  const { clock, dateText } = useClock();
  const dismissalWindow = useDismissalWindow(institutionId);
  const subtitle = dismissalWindow.window
    ? `${dismissalWindow.window.label} · ${dismissalWindow.window.startTime}–${dismissalWindow.window.endTime}`
    : null;

  const profile = useInstitutionProfile(institutionId);
  const points = useDeliveryPoints(institutionId);

  const onAnnounce = useCallback((row: BoardRow) => {
    // `approaching` (ADR-093): a wordless activation chime, no student name, no
    // "Voceando:" footer update — nothing was spoken.
    if (row.status === 'approaching') {
      boardAudioQueue.enqueueActivationChime();
      return;
    }
    if (row.status !== 'arriving' && row.status !== 'arrived') return;
    boardAudioQueue.enqueueVoice(
      pickupAnnouncementText({ studentFullName: row.studentFullName, status: row.status }),
    );
    setLastAnnounced({
      studentFullName: row.studentFullName,
      statusLabel: STATUS_META[row.status].label,
    });
  }, []);

  const onManualAnnounce = useCallback((payload: ManualAnnouncePayload) => {
    // The manual "vocear" jumps the queue (ADR-093): it is explicit, must never
    // sit behind a backlog of automatic announcements, but does not cut off
    // whatever is already playing.
    boardAudioQueue.enqueueVoice(
      pickupAnnouncementText({ studentFullName: payload.studentFullName, status: 'arrived' }),
      { priority: true },
    );
    setLastAnnounced({
      studentFullName: payload.studentFullName,
      statusLabel: STATUS_META.arrived.label,
    });
  }, []);

  // Carril opens its own channel only while it's the active mode (ADR-071
  // point 6) — passing `null` the rest of the time lets each hook's own
  // `useEffect` no-op, the exact mechanism `useInstitutionBoard` already uses
  // while the institution is still loading.
  const board = useInstitutionBoard(
    mode === 'carril' ? null : institutionId,
    onAnnounce,
    onManualAnnounce,
  );
  const monitor = useInstitutionBoardMonitor(mode === 'carril' ? institutionId : null);

  const visibleBoardRows = useMemo(
    () =>
      selectedDeliveryPointId === null
        ? board.rows
        : board.rows.filter((row) => row.deliveryPointId === selectedDeliveryPointId),
    [board.rows, selectedDeliveryPointId],
  );
  const visibleMonitorRows = useMemo(
    () =>
      selectedDeliveryPointId === null
        ? monitor.rows
        : monitor.rows.filter((row) => row.deliveryPointId === selectedDeliveryPointId),
    [monitor.rows, selectedDeliveryPointId],
  );

  const deliveryPointFilter =
    points.status === 'ready' && points.deliveryPoints.length > 0 ? (
      <DeliveryPointFilter
        deliveryPoints={points.deliveryPoints}
        value={selectedDeliveryPointId}
        onChange={setSelectedDeliveryPointId}
        variant={mode === 'sereno' ? 'light' : 'dark'}
      />
    ) : undefined;

  let screen: ReactNode;

  if (mode === 'anden') {
    screen = (
      <AndenBoard
        institutionName={institutionName}
        subtitle={subtitle}
        clock={clock}
        dateText={dateText}
        rows={visibleBoardRows}
        lastAnnounced={lastAnnounced}
        deliveryPointFilter={deliveryPointFilter}
        contentOverride={contentOverrideFor(board, visibleBoardRows.length, true)}
      />
    );
  } else if (mode === 'sereno') {
    screen = (
      <SerenoBoard
        institutionName={institutionName}
        subtitle={subtitle}
        clock={clock}
        dateText={dateText}
        rows={visibleBoardRows}
        deliveryPointFilter={deliveryPointFilter}
        contentOverride={contentOverrideFor(board, visibleBoardRows.length, false)}
      />
    );
  } else {
    screen = (
      <CarrilBoard
        institutionName={institutionName}
        subtitle={subtitle}
        clock={clock}
        rows={visibleMonitorRows}
        advanceNoticeMinutes={profile.advanceNoticeMinutes}
        deliveryPointFilter={deliveryPointFilter}
        contentOverride={contentOverrideFor(monitor, visibleMonitorRows.length, false)}
        onLogout={logout}
      />
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {screen}
      <ModeSwitcher value={mode} onChange={changeMode} />
      {/*
       * ADR-096: deliberately parked in the bottom-left corner (ModeSwitcher
       * owns bottom-right), `--ink-100` and tiny — near-invisible to a parent
       * or student at the gate, legible for whoever looks for it on purpose.
       */}
      <div style={{ position: 'fixed', left: 8, bottom: 56, zIndex: 1, pointerEvents: 'none' }}>
        <AppVersionLabel buildId={__APP_BUILD_ID__} tone="faint" />
      </div>
    </div>
  );
}
