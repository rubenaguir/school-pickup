import { useCallback, useEffect, useState } from 'react';
import { ApiError, readAccessToken, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import { apiBaseUrl, apiClient, tokenStorage } from '../api/client';
import { mergeQueueDelta, parseQueueDelta, sortQueueRows, type QueueRow } from './queue-rows';
import { buildQueueSocketUrl, fatalCloseReason, reconnectDelayMs } from './queue-socket';

/**
 * Page size of the snapshot. Above the API default of 20 (ADR-024 point 9) on
 * purpose: twenty is a sensible page of a guardian's history, but a gate at
 * dismissal time can hold more than twenty cars at once, and a console that
 * silently truncates the queue is worse than useless. There is no paging UI
 * here — a queue is worked from the top, not browsed.
 */
const QUEUE_PAGE_SIZE = 100;

/**
 * The one `code` whose 401 this screen must not read as an expired session
 * (ADR-052 point 1). Named here rather than inlined so the exemption is
 * visible as a list of one, and adding a second demands the same reasoning.
 */
const SKIP_REFRESH_CODES = ['INVALID_DELIVERY_CODE'] as const;

export type QueueStatus = 'loading' | 'ready' | 'error';

/**
 * State of the live channel, independent from `QueueStatus`: the queue on
 * screen stays perfectly readable while the socket is down, it just stops
 * moving, and saying so is the whole point of the indicator.
 */
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';

/** Row-level failure of a delivery confirmation: the row stays where it was. */
export interface DeliverError {
  pickupRequestId: string;
  error: ApiError;
}

export interface DeliveryPointQueueValue {
  status: QueueStatus;
  /** Active pickups of this gate, soonest ETA first. */
  rows: QueueRow[];
  /** Only set while `status === 'error'` — the whole snapshot failed to load. */
  error: ApiError | null;
  connection: ConnectionState;
  /**
   * `reason` of a close the client must not retry (4400/4401/4403/4404), or
   * null. Translated by the screen, like every other `code`.
   */
  connectionErrorReason: string | null;
  reload: () => void;
  deliver: (pickupRequestId: string, deliveryCode: string) => void;
  /** Id of the row whose deliver call is in flight, if any. */
  busyId: string | null;
  deliverError: DeliverError | null;
  /** Last row confirmed, until its delta takes it out of the queue. */
  deliveredId: string | null;
}

interface ListDeliveryPointQueueResponse {
  pickupRequests: QueueRow[];
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

function parseMessage(data: unknown): QueueRow | null {
  if (typeof data !== 'string') return null;
  try {
    return parseQueueDelta(JSON.parse(data));
  } catch {
    return null;
  }
}

/**
 * Live queue of one delivery point: REST snapshot plus WebSocket deltas
 * (feature 021, ADR-050).
 *
 * The two mechanisms stay separate, never hybrid (ADR-050 point 6). The socket
 * opens first and the snapshot is requested from its `open` handler, so the
 * order is always snapshot-then-deltas even on a reconnection: deltas that
 * arrive while the snapshot is in flight are buffered and folded in on top of
 * it afterwards, instead of being lost to a response that was already stale
 * when it was built.
 *
 * Everything the socket does lives inside one effect keyed on the delivery
 * point, so switching gates tears the old channel down before opening the new
 * one, and React's development double-mount cannot leave a socket behind.
 */
export function useDeliveryPointQueue(deliveryPointId: string | null): DeliveryPointQueueValue {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [connectionErrorReason, setConnectionErrorReason] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deliverError, setDeliverError] = useState<DeliverError | null>(null);
  const [deliveredId, setDeliveredId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Both tagged with the gate they belong to, so `status` below is derived
  // rather than reset by the effect: switching gates is already 'loading'
  // because the new gate has not loaded yet, not because something told it to
  // be. A reconnection, which reuses the same gate, leaves the queue on screen
  // exactly where it was instead of blanking it back into skeletons.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ deliveryPointId: string; error: ApiError } | null>(null);

  const status: QueueStatus =
    deliveryPointId === null
      ? 'loading'
      : failure?.deliveryPointId === deliveryPointId
        ? 'error'
        : loadedId === deliveryPointId
          ? 'ready'
          : 'loading';

  const error = status === 'error' ? (failure?.error ?? null) : null;

  const reload = useCallback(() => {
    setLoadedId(null);
    setFailure(null);
    setDeliverError(null);
    setConnectionErrorReason(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!deliveryPointId) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    /** Non-null only while a snapshot request is in flight. */
    let buffered: QueueRow[] | null = null;

    function applyDelta(delta: QueueRow) {
      if (buffered) {
        buffered.push(delta);
        return;
      }
      setRows((current) => sortQueueRows(mergeQueueDelta(current, delta)));
    }

    function loadSnapshot(id: string) {
      buffered = [];
      apiClient
        .get<ListDeliveryPointQueueResponse>(
          `/pickup-requests?deliveryPointId=${encodeURIComponent(id)}&limit=${QUEUE_PAGE_SIZE}`,
        )
        .then((response) => {
          if (cancelled) return;
          const pending = buffered ?? [];
          buffered = null;
          // The snapshot is the authority after a reconnection — the messages
          // published while the socket was down were never stored and are not
          // replayed (specs/api-contracts/delivery-point-queue-ws.md).
          const merged = pending.reduce(mergeQueueDelta, response.pickupRequests);
          setRows(sortQueueRows(merged));
          setFailure(null);
          setLoadedId(id);
        })
        .catch((caught: unknown) => {
          buffered = null;
          if (cancelled) return;
          // Without a snapshot there is no queue to apply deltas to, so the
          // channel comes down with it and "Reintentar" restarts both.
          setFailure({ deliveryPointId: id, error: asApiError(caught) });
          setLoadedId(null);
          setConnection('closed');
          socket?.close();
        });
    }

    function connect(id: string) {
      setConnection(retries === 0 ? 'connecting' : 'reconnecting');
      setConnectionErrorReason(null);

      // Read on every attempt, never captured once: a reconnection that happens
      // after the REST client renewed the access token must hand the gateway
      // the renewed one. <AuthenticatedLayout> already gated on a session, so an
      // absent token here means it was cleared in another tab — the handshake
      // is then rejected (4400) and the channel closes for good, which is what
      // an emptied session deserves.
      const accessToken = readAccessToken(tokenStorage) ?? '';
      const opened = new WebSocket(
        buildQueueSocketUrl(apiBaseUrl, { accessToken, deliveryPointId: id }),
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
        // A message that is not a queue payload is discarded, never applied:
        // one malformed publication cannot corrupt the gate's queue.
        if (delta) applyDelta(delta);
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

        // A transport drop: the queue on screen is frozen until the socket is
        // back, and the reconnection re-reads the snapshot from `onopen`
        // (ADR-050 point 7).
        setConnection('reconnecting');
        retryTimer = setTimeout(() => connect(id), reconnectDelayMs(retries));
        retries += 1;
      };
    }

    connect(deliveryPointId);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      // Nulled first: the handlers above would otherwise schedule a
      // reconnection for a channel nobody is listening to any more.
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [deliveryPointId, attempt]);

  const deliver = useCallback((pickupRequestId: string, deliveryCode: string) => {
    setBusyId(pickupRequestId);
    setDeliverError(null);
    setDeliveredId(null);

    void apiClient
      .patch(
        `/pickup-requests/${encodeURIComponent(pickupRequestId)}/deliver`,
        { deliveryCode },
        // Only this one code skips the refresh: it is a mistyped code, not an
        // expired session, and replaying it would log a second failed attempt in
        // `audit_log` for one typo (ADR-031 point 2, ADR-052 point 1). A 401
        // from this same call for any other reason — an actually expired token —
        // renews the session and replays the delivery like any other request.
        { skipRefreshForCodes: SKIP_REFRESH_CODES },
      )
      .then(() => {
        // The row is NOT removed here. The queue delta that follows the
        // transition is what takes it out (feature 021): the WebSocket is the
        // single source of truth for what the gate is holding, and an
        // optimistic removal would disagree with it the moment anything else
        // fails. Until it lands, the row is flagged as confirmed.
        setDeliveredId(pickupRequestId);
      })
      .catch((caught: unknown) => {
        setDeliverError({ pickupRequestId, error: asApiError(caught) });
      })
      .finally(() => {
        setBusyId((current) => (current === pickupRequestId ? null : current));
      });
  }, []);

  return {
    status,
    rows,
    error,
    connection,
    connectionErrorReason,
    reload,
    deliver,
    busyId,
    deliverError,
    deliveredId,
  };
}
