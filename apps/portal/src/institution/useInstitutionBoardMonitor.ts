import { useCallback, useEffect, useState } from 'react';
import { ApiError, readAccessToken, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { apiBaseUrl, apiClient, tokenStorage } from '../api/client';
import {
  mergeBoardMonitorDelta,
  parseBoardMonitorDelta,
  sortBoardRows,
  type BoardMonitorRow,
} from './board-monitor-rows';
import {
  buildBoardMonitorSocketUrl,
  fatalCloseReason,
  reconnectDelayMs,
} from './board-monitor-socket';

const BOARD_MONITOR_PAGE_SIZE = 200;

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';
export type BoardMonitorStatus = 'loading' | 'ready' | 'error';

export interface InstitutionBoardMonitorValue {
  status: BoardMonitorStatus;
  rows: BoardMonitorRow[];
  /**
   * Deliveries observed live since this hook connected — NOT a full-day
   * total. The REST snapshot (`view=monitor`) only ever returns the active
   * statuses (`en_route`/`arriving`/`arrived`, ADR-071 pt.2's
   * "active-statuses-only" rule on `listByInstitutionMonitor`), and
   * `mergeBoardMonitorDelta` removes a row the instant a delta marks it
   * `delivered` — by design, so Carril's table never shows a stale finished
   * pickup. That leaves no snapshot and no persisted row to count "delivered
   * today" from; the only signal that ever exists is the delta itself, in
   * the instant it arrives. The Dashboard's "Entregados" KPI and "Por nivel"
   * panel (ADR-072 §6) are built on this list instead of a full-day count for
   * that reason — captured here, once, rather than in the screen.
   */
  deliveredSinceConnect: BoardMonitorRow[];
  error: ApiError | null;
  connection: ConnectionState;
  connectionErrorReason: string | null;
  reload: () => void;
}

interface ListInstitutionBoardMonitorResponse {
  pickupRequests: BoardMonitorRow[];
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

function parseMessage(data: unknown): BoardMonitorRow | null {
  if (typeof data !== 'string') return null;
  try {
    return parseBoardMonitorDelta(JSON.parse(data));
  } catch {
    return null;
  }
}

/**
 * The Dashboard's live channel (ADR-072 §5/§7): REST snapshot (`view=monitor`)
 * plus Carril's `/ws/board-monitor` deltas (ADR-071 pt.2) — same
 * snapshot-then-deltas skeleton as `apps/board`'s `useInstitutionBoardMonitor`,
 * a fifth reimplementation kept deliberately un-extracted this round (see the
 * comment on `BoardMonitorRow`). No `onAnnounce`: the Dashboard doesn't
 * animate or voice transitions, same as Carril.
 *
 * Connects while the Dashboard screen is mounted, disconnects on unmount —
 * same cleanup pattern as every other socket hook in this project.
 */
export function useInstitutionBoardMonitor(
  institutionId: string | null,
): InstitutionBoardMonitorValue {
  const [rows, setRows] = useState<BoardMonitorRow[]>([]);
  const [deliveredSinceConnect, setDeliveredSinceConnect] = useState<BoardMonitorRow[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [connectionErrorReason, setConnectionErrorReason] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ institutionId: string; error: ApiError } | null>(null);

  const status: BoardMonitorStatus =
    institutionId === null
      ? 'loading'
      : failure?.institutionId === institutionId
        ? 'error'
        : loadedId === institutionId
          ? 'ready'
          : 'loading';

  const error = status === 'error' ? (failure?.error ?? null) : null;

  const reload = useCallback(() => {
    setLoadedId(null);
    setFailure(null);
    setConnectionErrorReason(null);
    setDeliveredSinceConnect([]);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!institutionId) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    let buffered: BoardMonitorRow[] | null = null;
    let localRows: BoardMonitorRow[] = [];
    let localDelivered: BoardMonitorRow[] = [];

    function applyLiveDelta(delta: BoardMonitorRow) {
      if (buffered) {
        buffered.push(delta);
        return;
      }
      if (delta.status === 'delivered') {
        localDelivered = [...localDelivered, delta];
        setDeliveredSinceConnect(localDelivered);
      }
      localRows = sortBoardRows(mergeBoardMonitorDelta(localRows, delta));
      setRows(localRows);
    }

    function loadSnapshot(id: string) {
      buffered = [];
      apiClient
        .get<ListInstitutionBoardMonitorResponse>(
          `/pickup-requests?institutionId=${encodeURIComponent(id)}&view=monitor&limit=${BOARD_MONITOR_PAGE_SIZE}`,
        )
        .then((response) => {
          if (cancelled) return;
          const pending = buffered ?? [];
          buffered = null;
          const deliveredWhileBuffering = pending.filter((delta) => delta.status === 'delivered');
          if (deliveredWhileBuffering.length > 0) {
            localDelivered = [...localDelivered, ...deliveredWhileBuffering];
            setDeliveredSinceConnect(localDelivered);
          }
          const merged = pending.reduce(
            (acc, delta) => mergeBoardMonitorDelta(acc, delta),
            response.pickupRequests,
          );
          localRows = sortBoardRows(merged);
          setRows(localRows);
          setFailure(null);
          setLoadedId(id);
        })
        .catch((caught: unknown) => {
          buffered = null;
          if (cancelled) return;
          setFailure({ institutionId: id, error: asApiError(caught) });
          setLoadedId(null);
          setConnection('closed');
          socket?.close();
        });
    }

    function connect(id: string) {
      setConnection(retries === 0 ? 'connecting' : 'reconnecting');
      setConnectionErrorReason(null);

      const accessToken = readAccessToken(tokenStorage) ?? '';
      const opened = new WebSocket(
        buildBoardMonitorSocketUrl(apiBaseUrl, { accessToken, institutionId: id }),
      );
      socket = opened;

      opened.onopen = () => {
        if (cancelled) return;
        retries = 0;
        setConnection('live');
        loadSnapshot(id);
      };

      opened.onmessage = (event: MessageEvent) => {
        if (cancelled) return;
        const delta = parseMessage(event.data);
        if (delta) applyLiveDelta(delta);
      };

      opened.onclose = (event: CloseEvent) => {
        if (cancelled) return;
        buffered = null;

        const fatal = fatalCloseReason(event.code, event.reason);
        if (fatal) {
          setConnection('closed');
          setConnectionErrorReason(fatal);
          return;
        }

        setConnection('reconnecting');
        retryTimer = setTimeout(() => connect(id), reconnectDelayMs(retries));
        retries += 1;
      };
    }

    connect(institutionId);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [institutionId, attempt]);

  return {
    status,
    rows,
    deliveredSinceConnect,
    error,
    connection,
    connectionErrorReason,
    reload,
  };
}
