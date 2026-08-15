import { useCallback, useEffect, useState } from 'react';
import { ApiError, readAccessToken, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { apiBaseUrl, apiClient, tokenStorage } from '../api/client';
import {
  mergeBoardMonitorDelta,
  parseBoardMonitorDelta,
  type BoardMonitorRow,
} from './board-monitor-rows';
import { sortBoardRows } from './board-rows';
import {
  buildBoardMonitorSocketUrl,
  fatalCloseReason,
  reconnectDelayMs,
} from './board-monitor-socket';
import type { ConnectionState } from './useInstitutionBoard';

/** Page size of the snapshot — same whole-institution criterion as `useInstitutionBoard`. */
const BOARD_MONITOR_PAGE_SIZE = 200;

export type BoardMonitorStatus = 'loading' | 'ready' | 'error';

export interface InstitutionBoardMonitorValue {
  status: BoardMonitorStatus;
  rows: BoardMonitorRow[];
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
 * Carril's live channel: REST snapshot (`view=monitor`) plus its own
 * `/ws/board-monitor` deltas (ADR-071 pt.2) — same snapshot-then-deltas
 * skeleton as `useInstitutionBoard`, minus `onAnnounce`/`recentlyChangedIds`:
 * Carril doesn't animate or voice transitions.
 *
 * Callers must only mount this hook while Carril is the active mode (§6 of
 * the ADR-071 prompt) — unmounting closes the socket via the same cleanup
 * pattern as `useInstitutionBoard`, so the screen keeps Andén/Sereno free of
 * this connection by simply not rendering the component that calls it.
 */
export function useInstitutionBoardMonitor(
  institutionId: string | null,
): InstitutionBoardMonitorValue {
  const [rows, setRows] = useState<BoardMonitorRow[]>([]);
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

    function applyLiveDelta(delta: BoardMonitorRow) {
      if (buffered) {
        buffered.push(delta);
        return;
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

  return { status, rows, error, connection, connectionErrorReason, reload };
}
