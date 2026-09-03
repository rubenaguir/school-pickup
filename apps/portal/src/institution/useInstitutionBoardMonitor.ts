import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError, readAccessToken } from '@casillego/shared';
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
import {
  addDeliveredToday,
  EMPTY_DELIVERED_TODAY,
  type DeliveredToday,
} from './dashboard-grouping';

const BOARD_MONITOR_PAGE_SIZE = 200;

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';
export type BoardMonitorStatus = 'loading' | 'ready' | 'error';

export interface InstitutionBoardMonitorValue {
  status: BoardMonitorStatus;
  rows: BoardMonitorRow[];
  /**
   * Full-day "delivered today" accumulator behind the Dashboard's
   * "Entregados" KPI and "Por nivel" panel (ADR-072 §6 amendment). Seeded
   * from `GET /institutions/:id/delivered-today` on connect and on every
   * reconnect, then incremented in place — never rebuilt from a growing row
   * list — as live `delivered` deltas arrive on `/ws/board-monitor`. Survives
   * a page refresh because the baseline it seeds from is a real persisted
   * count (`pickup_requests.completed_at`), not something only ever observed
   * while this hook was connected.
   */
  deliveredToday: DeliveredToday;
  /**
   * Individual rows observed going `delivered` live since this hook
   * connected — NOT a full-day list, and NOT the source of `deliveredToday`
   * (see above). Exists only so the Dashboard's "Actividad en vivo" table can
   * keep showing a just-delivered pickup, dimmed, for the rest of the
   * session: the REST snapshot (`view=monitor`) only ever returns active
   * statuses (ADR-071 pt.2), and `mergeBoardMonitorDelta` removes a row the
   * instant a delta marks it `delivered` — by design, so the table never
   * shows a stale finished pickup on its own. Resets to empty on `reload()`,
   * same as before this accumulator was split in two.
   */
  deliveredRows: BoardMonitorRow[];
  error: ApiError | null;
  connection: ConnectionState;
  connectionErrorReason: string | null;
  reload: () => void;
}

interface ListInstitutionBoardMonitorResponse {
  pickupRequests: BoardMonitorRow[];
}

interface DeliveredTodayApiResponse {
  asOf: string;
  total: number;
  byGroup: DeliveredToday['byGroup'];
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
  const [deliveredToday, setDeliveredToday] = useState<DeliveredToday>(EMPTY_DELIVERED_TODAY);
  const [deliveredRows, setDeliveredRows] = useState<BoardMonitorRow[]>([]);
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
    setDeliveredToday(EMPTY_DELIVERED_TODAY);
    setDeliveredRows([]);
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
    let localDeliveredRows: BoardMonitorRow[] = [];
    let localDeliveredToday: DeliveredToday = EMPTY_DELIVERED_TODAY;
    // Gates delivered deltas until the delivered-today baseline (with its
    // `asOf` cutoff) is known — reopened on every reconnect, since a fresh
    // reconnect re-seeds the baseline and any stale `asOf` from before it
    // would double- or under-count. `null` asOf (baseline fetch failed) means
    // "no cutoff, count everything live" — the pre-amendment behavior.
    let deliveredTodayReady = false;
    let asOf: string | null = null;
    let pendingDeliveredDeltas: BoardMonitorRow[] = [];

    function applyDeliveredToAggregate(delta: BoardMonitorRow) {
      if (!deliveredTodayReady) {
        pendingDeliveredDeltas.push(delta);
        return;
      }
      if (asOf !== null && delta.updatedAt <= asOf) return;
      localDeliveredToday = addDeliveredToday(localDeliveredToday, delta);
      setDeliveredToday(localDeliveredToday);
    }

    function loadDeliveredToday(id: string) {
      deliveredTodayReady = false;
      apiClient
        .get<DeliveredTodayApiResponse>(`/institutions/${encodeURIComponent(id)}/delivered-today`)
        .then((response) => {
          if (cancelled) return;
          asOf = response.asOf;
          localDeliveredToday = { total: response.total, byGroup: response.byGroup };
          settleDeliveredToday();
        })
        .catch(() => {
          // Best-effort (ADR-072 §6 amendment): a failed baseline must not
          // take down the rest of the Dashboard — falls back to the
          // pre-amendment behavior, an accumulator starting at 0 from here.
          if (cancelled) return;
          asOf = null;
          settleDeliveredToday();
        });
    }

    function settleDeliveredToday() {
      deliveredTodayReady = true;
      const pending = pendingDeliveredDeltas;
      pendingDeliveredDeltas = [];
      for (const delta of pending) {
        if (asOf === null || delta.updatedAt > asOf) {
          localDeliveredToday = addDeliveredToday(localDeliveredToday, delta);
        }
      }
      setDeliveredToday(localDeliveredToday);
    }

    function applyLiveDelta(delta: BoardMonitorRow) {
      if (buffered) {
        buffered.push(delta);
        return;
      }
      if (delta.status === 'delivered') {
        localDeliveredRows = [...localDeliveredRows, delta];
        setDeliveredRows(localDeliveredRows);
        applyDeliveredToAggregate(delta);
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
            localDeliveredRows = [...localDeliveredRows, ...deliveredWhileBuffering];
            setDeliveredRows(localDeliveredRows);
            for (const delta of deliveredWhileBuffering) {
              applyDeliveredToAggregate(delta);
            }
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
      // El estado se marca de inmediato al arrancar la conexión — es la
      // señal correcta de "iniciando" en el momento en que el efecto
      // arranca (ej. institutionId cambió), no un efecto secundario
      // evitable. Ver ADR-110.
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setConnection(retries === 0 ? 'connecting' : 'reconnecting');
      // eslint-disable-next-line @eslint-react/set-state-in-effect
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
        loadDeliveredToday(id);
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
    deliveredToday,
    deliveredRows,
    error,
    connection,
    connectionErrorReason,
    reload,
  };
}
