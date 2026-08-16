import { useCallback, useState } from 'react';
import { ApiError, asApiError, readAccessToken } from '@casillego/shared';
import { useRealtimeChannel } from '@casillego/ui';
import { apiBaseUrl, apiClient, tokenStorage } from '../api/client';
import { mergeAndSortQueueRows, parseQueueDelta, type QueueRow } from './queue-rows';
import { buildQueueSocketUrl, fatalCloseReason } from './queue-socket';

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

/** Row-level failure of an announce call: the row stays where it was. */
export interface AnnounceError {
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
  announce: (pickupRequestId: string) => void;
  /** Id of the row whose announce call is in flight, if any. */
  announcingId: string | null;
  announceError: AnnounceError | null;
  /**
   * Last row announced — client-only, ephemeral state, no persistence
   * (ADR-073 point 1: "vocear" writes no `pickup_request` row). Cleared when
   * a new `announce()` fires on a different row, or when this row leaves
   * `rows` entirely (delivered/cancelled).
   */
  lastAnnouncedId: string | null;
}

interface ListDeliveryPointQueueResponse {
  pickupRequests: QueueRow[];
}

function fetchQueueSnapshot(deliveryPointId: string): Promise<QueueRow[]> {
  return apiClient
    .get<ListDeliveryPointQueueResponse>(
      `/pickup-requests?deliveryPointId=${encodeURIComponent(deliveryPointId)}&limit=${QUEUE_PAGE_SIZE}`,
    )
    .then((response) => response.pickupRequests);
}

/**
 * Live queue of one delivery point: REST snapshot plus WebSocket deltas
 * (feature 021, ADR-050), via the generic `useRealtimeChannel` (ADR-075).
 *
 * `deliver()`/`announce()` are not part of the realtime channel — they are
 * plain REST actions this screen owns on its own.
 */
export function useDeliveryPointQueue(deliveryPointId: string | null): DeliveryPointQueueValue {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deliverError, setDeliverError] = useState<DeliverError | null>(null);
  const [deliveredId, setDeliveredId] = useState<string | null>(null);
  const [announcingId, setAnnouncingId] = useState<string | null>(null);
  const [announceError, setAnnounceError] = useState<AnnounceError | null>(null);
  const [announcedId, setAnnouncedId] = useState<string | null>(null);

  const getSocketUrl = useCallback(() => {
    // Read on every attempt, never captured once: a reconnection that happens
    // after the REST client renewed the access token must hand the gateway
    // the renewed one. <AuthenticatedLayout> already gated on a session, so an
    // absent token here means it was cleared in another tab — the handshake
    // is then rejected (4400) and the channel closes for good, which is what
    // an emptied session deserves.
    const accessToken = readAccessToken(tokenStorage) ?? '';
    return buildQueueSocketUrl(apiBaseUrl, { accessToken, deliveryPointId: deliveryPointId ?? '' });
  }, [deliveryPointId]);

  const fetchSnapshot = useCallback(() => {
    return fetchQueueSnapshot(deliveryPointId ?? '');
  }, [deliveryPointId]);

  const { status, state, error, connection, connectionErrorReason, reload } = useRealtimeChannel<
    QueueRow[],
    QueueRow
  >({
    channelKey: deliveryPointId,
    getSocketUrl,
    fetchSnapshot,
    mergeDelta: mergeAndSortQueueRows,
    parseDelta: parseQueueDelta,
    fatalCloseReason,
  });

  const rows = state ?? [];

  // Derived during render rather than reset from an effect
  // (react-hooks/set-state-in-effect, same convention as `gateId` in
  // GateConsole.tsx): the announced row leaving the queue — delivered,
  // cancelled, or simply gone after a reconnect's fresh snapshot — means
  // the "Vocear" indicator has nothing left to point at (ADR-073 point 1:
  // ephemeral, client-only state, no timeout). One check covers both the
  // live-delta and the reconnect-snapshot cases, since `rows` is already the
  // merged result of either.
  const lastAnnouncedId =
    announcedId !== null && rows.some((row) => row.pickupRequestId === announcedId)
      ? announcedId
      : null;

  const reloadQueue = useCallback(() => {
    setDeliverError(null);
    reload();
  }, [reload]);

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

  const announce = useCallback((pickupRequestId: string) => {
    setAnnouncingId(pickupRequestId);
    setAnnounceError(null);

    // No `skipRefreshForCodes`, unlike `deliver()`: that exemption exists
    // only for `INVALID_DELIVERY_CODE` (ADR-052 point 1), which this endpoint
    // has no equivalent of. A 401 here is an ordinary expired session.
    void apiClient
      .post(`/pickup-requests/${encodeURIComponent(pickupRequestId)}/announce`)
      .then(() => {
        setAnnouncedId(pickupRequestId);
      })
      .catch((caught: unknown) => {
        setAnnounceError({ pickupRequestId, error: asApiError(caught) });
      })
      .finally(() => {
        setAnnouncingId((current) => (current === pickupRequestId ? null : current));
      });
  }, []);

  return {
    status,
    rows,
    error,
    connection,
    connectionErrorReason,
    reload: reloadQueue,
    deliver,
    busyId,
    deliverError,
    deliveredId,
    announce,
    announcingId,
    announceError,
    lastAnnouncedId,
  };
}
