import { useCallback, useEffect, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE, readAccessToken } from '@casillego/shared';
import type { ArrivalMode, PickupRequestStatus } from '@casillego/shared';
import { apiClient, apiBaseUrl, tokenStorage } from '../api/client';
import {
  buildTrackingSocketUrl,
  fatalCloseReason,
  reconnectDelayMs,
} from './pickup-request-tracking-socket';

/** `GET /pickup-requests/:id` (specs/api-contracts/pickup-requests.md, ADR-065). */
interface TrackingSnapshotResponse {
  id: string;
  enrollmentId: string;
  institutionId: string;
  institutionLocation: { lat: number; lng: number };
  deliveryPointId: string | null;
  status: PickupRequestStatus;
  deliveryCode: string;
  arrivalMode: ArrivalMode | null;
  vehicleDescription: string | null;
  vehiclePlate: string | null;
  estimatedArrivalAt: string | null;
  etaSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
}

/**
 * Shape of `school-pickup/institution/{id}/board`, forwarded verbatim by the
 * tracking WS bridge (specs/api-contracts/pickup-request-tracking-ws.md).
 * Only the fields that can actually change over the life of a pickup_request
 * are read from it — `studentFullName`/`gradeOrGroup` are not, the screen
 * gets those from `useMyEnrollments` instead.
 */
interface BoardDelta {
  pickupRequestId: string;
  status: PickupRequestStatus;
  deliveryPointId: string | null;
  estimatedArrivalAt: string | null;
  etaSeconds: number | null;
  arrivalMode: ArrivalMode | null;
}

/** The full picture the tracking screen renders: REST snapshot fields, kept live by WS deltas. */
export interface TrackingPickupRequest {
  id: string;
  enrollmentId: string;
  institutionId: string;
  institutionLocation: { lat: number; lng: number };
  deliveryPointId: string | null;
  status: PickupRequestStatus;
  deliveryCode: string;
  arrivalMode: ArrivalMode | null;
  vehicleDescription: string | null;
  vehiclePlate: string | null;
  estimatedArrivalAt: string | null;
  etaSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
}

export type TrackingStatus = 'loading' | 'ready' | 'error';
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';

export interface TrackingActionError {
  action: 'arrived' | 'cancel';
  error: ApiError;
}

export interface TrackingValue {
  status: TrackingStatus;
  pickupRequest: TrackingPickupRequest | null;
  error: ApiError | null;
  connection: ConnectionState;
  connectionErrorReason: string | null;
  reload: () => void;
  markArrived: () => void;
  cancel: () => void;
  actionBusy: boolean;
  actionError: TrackingActionError | null;
}

function asApiError(caught: unknown): ApiError {
  return caught instanceof ApiError
    ? caught
    : new ApiError({ code: UNKNOWN_ERROR_CODE, message: 'Error desconocido', status: 0 });
}

function isTrackingStatus(value: unknown): value is PickupRequestStatus {
  return (
    value === 'en_route' ||
    value === 'arriving' ||
    value === 'arrived' ||
    value === 'delivered' ||
    value === 'cancelled'
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** Never throws — one malformed broker message must not break the screen. */
function parseBoardDelta(raw: unknown): BoardDelta | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const payload = raw as Record<string, unknown>;

  if (typeof payload.pickupRequestId !== 'string') return null;
  if (!isTrackingStatus(payload.status)) return null;
  if (!isNullableString(payload.deliveryPointId)) return null;
  if (!isNullableString(payload.estimatedArrivalAt)) return null;
  if (!isNullableNumber(payload.etaSeconds)) return null;
  if (
    payload.arrivalMode !== null &&
    payload.arrivalMode !== 'vehicle' &&
    payload.arrivalMode !== 'walking'
  ) {
    return null;
  }

  return {
    pickupRequestId: payload.pickupRequestId,
    status: payload.status,
    deliveryPointId: payload.deliveryPointId,
    estimatedArrivalAt: payload.estimatedArrivalAt,
    etaSeconds: payload.etaSeconds,
    arrivalMode: payload.arrivalMode,
  };
}

function applyDelta(current: TrackingPickupRequest, delta: BoardDelta): TrackingPickupRequest {
  return {
    ...current,
    status: delta.status,
    deliveryPointId: delta.deliveryPointId,
    estimatedArrivalAt: delta.estimatedArrivalAt,
    etaSeconds: delta.etaSeconds,
    arrivalMode: delta.arrivalMode,
  };
}

function parseMessage(data: unknown): BoardDelta | null {
  if (typeof data !== 'string') return null;
  try {
    return parseBoardDelta(JSON.parse(data));
  } catch {
    return null;
  }
}

/**
 * Live state of one `pickup_request`: REST snapshot plus WebSocket deltas
 * (ADR-064). Same architecture as the gate console's `useDeliveryPointQueue`
 * — the socket opens first and the snapshot is requested from its `open`
 * handler, so a reconnection always re-establishes snapshot-then-deltas.
 * Unlike the queue, this tracks a single resource: the latest delta simply
 * replaces the live fields, no per-row `updatedAt` bookkeeping needed.
 */
export function useTrackingPickupRequest(pickupRequestId: string): TrackingValue {
  const [pickupRequest, setPickupRequest] = useState<TrackingPickupRequest | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [connectionErrorReason, setConnectionErrorReason] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; error: ApiError } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<TrackingActionError | null>(null);

  const status: TrackingStatus =
    failure?.id === pickupRequestId ? 'error' : loadedId === pickupRequestId ? 'ready' : 'loading';
  const error = status === 'error' ? (failure?.error ?? null) : null;

  const reload = useCallback(() => {
    setLoadedId(null);
    setFailure(null);
    setConnectionErrorReason(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    /** Non-null only while the snapshot request is in flight — latest delta wins, single resource. */
    let bufferedDelta: BoardDelta | null | 'none' = 'none';

    function onDelta(delta: BoardDelta) {
      if (bufferedDelta !== 'none') {
        bufferedDelta = delta;
        return;
      }
      setPickupRequest((current) => (current ? applyDelta(current, delta) : current));
    }

    function loadSnapshot(id: string) {
      bufferedDelta = null;
      apiClient
        .get<TrackingSnapshotResponse>(`/pickup-requests/${encodeURIComponent(id)}`)
        .then((snapshot) => {
          if (cancelled) return;
          const pending = bufferedDelta;
          bufferedDelta = 'none';
          const base: TrackingPickupRequest = snapshot;
          setPickupRequest(pending && pending !== 'none' ? applyDelta(base, pending) : base);
          setFailure(null);
          setLoadedId(id);
        })
        .catch((caught: unknown) => {
          bufferedDelta = 'none';
          if (cancelled) return;
          setFailure({ id, error: asApiError(caught) });
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
        buildTrackingSocketUrl(apiBaseUrl, { accessToken, pickupRequestId: id }),
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
        if (delta) onDelta(delta);
      };

      opened.onclose = (event: CloseEvent) => {
        if (cancelled) return;
        bufferedDelta = 'none';

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

    connect(pickupRequestId);

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
  }, [pickupRequestId, attempt]);

  const markArrived = useCallback(() => {
    setActionBusy(true);
    setActionError(null);
    apiClient
      .patch<{ id: string; status: PickupRequestStatus }>(
        `/pickup-requests/${encodeURIComponent(pickupRequestId)}/arrived`,
      )
      .then((response) => {
        setPickupRequest((current) =>
          current ? { ...current, status: response.status } : current,
        );
      })
      .catch((caught: unknown) => {
        setActionError({ action: 'arrived', error: asApiError(caught) });
      })
      .finally(() => {
        setActionBusy(false);
      });
  }, [pickupRequestId]);

  const cancel = useCallback(() => {
    setActionBusy(true);
    setActionError(null);
    apiClient
      .patch<{ id: string; status: PickupRequestStatus; completedAt: string }>(
        `/pickup-requests/${encodeURIComponent(pickupRequestId)}/cancel`,
      )
      .then((response) => {
        setPickupRequest((current) =>
          current
            ? { ...current, status: response.status, completedAt: response.completedAt }
            : current,
        );
      })
      .catch((caught: unknown) => {
        setActionError({ action: 'cancel', error: asApiError(caught) });
      })
      .finally(() => {
        setActionBusy(false);
      });
  }, [pickupRequestId]);

  return {
    status,
    pickupRequest,
    error,
    connection,
    connectionErrorReason,
    reload,
    markArrived,
    cancel,
    actionBusy,
    actionError,
  };
}
