import { useCallback, useState } from 'react';
import { ApiError, UNKNOWN_ERROR_CODE, readAccessToken } from '@casillego/shared';
import type { ArrivalMode, PickupRequestStatus } from '@casillego/shared';
import { useRealtimeChannel } from '@casillego/ui';
import { apiClient, apiBaseUrl, tokenStorage } from '../api/client';
import { buildTrackingSocketUrl, fatalCloseReason } from './pickup-request-tracking-socket';

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

/**
 * Live state of one `pickup_request`: REST snapshot plus WebSocket deltas
 * (ADR-064), via the generic `useRealtimeChannel` (ADR-075). Proves the
 * generic hook does not assume `TState` is a list: `TState` here is a single
 * `TrackingPickupRequest`, and `applyDelta` — unchanged, still the same pure
 * function — replaces its live fields wholesale on every delta rather than
 * merging into an array by id, no per-row `updatedAt` bookkeeping needed.
 *
 * `markArrived()`/`cancel()` are not part of the channel — plain REST
 * actions this screen owns on its own, same as `deliver()`/`announce()` in
 * the gate console. Same as `deliver()` there, they do **not** update
 * `pickupRequest` optimistically from the `PATCH` response: the channel is
 * the only source of truth for `status` (ADR-052 point 4's rule, which this
 * hook had not actually followed before this migration — `transitionAndPublish`
 * awaits the MQTT publish before the `PATCH` handler returns, so the board
 * delta reaches this already-open socket at essentially the same time as the
 * REST response, same as it already does for the gate console's `deliver()`).
 */
export function useTrackingPickupRequest(pickupRequestId: string): TrackingValue {
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<TrackingActionError | null>(null);

  const getSocketUrl = useCallback(() => {
    const accessToken = readAccessToken(tokenStorage) ?? '';
    return buildTrackingSocketUrl(apiBaseUrl, { accessToken, pickupRequestId });
  }, [pickupRequestId]);

  const fetchSnapshot = useCallback(() => {
    return apiClient.get<TrackingSnapshotResponse>(
      `/pickup-requests/${encodeURIComponent(pickupRequestId)}`,
    );
  }, [pickupRequestId]);

  const { status, state, error, connection, connectionErrorReason, reload } = useRealtimeChannel<
    TrackingPickupRequest,
    BoardDelta
  >({
    channelKey: pickupRequestId,
    getSocketUrl,
    fetchSnapshot,
    mergeDelta: applyDelta,
    parseDelta: parseBoardDelta,
    fatalCloseReason,
  });

  const markArrived = useCallback(() => {
    setActionBusy(true);
    setActionError(null);
    apiClient
      .patch<{ id: string; status: PickupRequestStatus }>(
        `/pickup-requests/${encodeURIComponent(pickupRequestId)}/arrived`,
      )
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
      .catch((caught: unknown) => {
        setActionError({ action: 'cancel', error: asApiError(caught) });
      })
      .finally(() => {
        setActionBusy(false);
      });
  }, [pickupRequestId]);

  return {
    status,
    pickupRequest: state,
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
