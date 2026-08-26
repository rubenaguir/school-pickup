import { useCallback, useState } from 'react';
import { ApiError, asApiError, readAccessToken } from '@casillego/shared';
import type { InstitutionStatus, InstitutionType } from '@casillego/shared';
import { useRealtimeChannel } from '@casillego/ui';
import { apiBaseUrl, apiClient, tokenStorage } from '../api/client';
import { institutionTransitionErrorMessage } from './institution-queue-error-messages';
import { buildInstitutionsAdminSocketUrl, fatalCloseReason } from './institutions-admin-socket';
import {
  mergeAdminInstitutionDelta,
  parseAdminInstitutionDelta,
  type AdminInstitutionDelta,
} from './admin-institution-rows';

/**
 * Fixed, non-null: this channel is global (ADR-087) — the super-admin queue
 * has no institution/tutor id to scope by, unlike every sibling realtime
 * hook. `useRealtimeChannel`'s `channelKey === null` means "don't connect
 * yet", which does not apply here — there is nothing to wait on.
 */
const ADMIN_INSTITUTIONS_CHANNEL_KEY = 'admin-institutions';

/**
 * One row of GET /admin/institutions (specs/api-contracts/admin-institutions.md).
 * Declared here rather than reusing the `Institution` type of `@casillego/shared`:
 * that one models the entity (address, geofence radii, timezone…), this one
 * models the list projection the endpoint actually returns. Same criterion as
 * `PendingEnrollment` in `enrollments/usePendingEnrollments.ts`.
 */
export interface AdminInstitutionListItem {
  id: string;
  name: string;
  type: InstitutionType;
  category: string | null;
  status: InstitutionStatus;
  joinCode: string;
}

export type StatusFilter = InstitutionStatus | 'all';

export type TransitionAction = 'approve' | 'suspend' | 'reactivate';

export type InstitutionsQueueStatus = 'loading' | 'ready' | 'error';

/** Screen-wide notice: the list moved under the user's feet, nothing to retry. */
export interface Banner {
  message: string;
  code: string;
}

/** Row-level failure: the request is still pending, the row stays put. */
export interface RowError {
  institutionId: string;
  message: string;
  code: string;
}

export interface InstitutionsQueueValue {
  status: InstitutionsQueueStatus;
  institutions: AdminInstitutionListItem[];
  /** Only set while `status === 'error'` — the whole list failed to load. */
  error: ApiError | null;
  banner: Banner | null;
  rowError: RowError | null;
  /** Id of the row whose approve/suspend/reactivate call is in flight, if any. */
  busyId: string | null;
  filter: StatusFilter;
  setFilter: (next: StatusFilter) => void;
  reload: () => void;
  transition: (institutionId: string, action: TransitionAction) => void;
}

interface AdminInstitutionsResponse {
  institutions: AdminInstitutionListItem[];
  limit: number;
  offset: number;
  total: number;
}

interface TransitionResponse {
  id: string;
  status: InstitutionStatus;
}

function fetchInstitutions(filter: StatusFilter): Promise<AdminInstitutionListItem[]> {
  const query = filter === 'all' ? '' : `?status=${filter}`;
  return apiClient
    .get<AdminInstitutionsResponse>(`/admin/institutions${query}`)
    .then((response) => response.institutions);
}

/**
 * A 409 (someone else already moved this institution) or a 404 (it vanished)
 * is not this screen's error: the queue itself is stale. Both are answered by
 * refreshing the list instead of by an inline row error — same pattern as
 * `isStaleRow` in `enrollments/usePendingEnrollments.ts`.
 */
function isStaleRow(error: ApiError): boolean {
  return error.status === 409 || error.status === 404;
}

/**
 * Loads the super-admin institution queue and resolves approve/suspend/
 * reactivate actions — REST snapshot plus WebSocket deltas (ADR-087), via the
 * generic `useRealtimeChannel` (ADR-075).
 */
export function useInstitutionsQueue(): InstitutionsQueueValue {
  const [filter, setFilterState] = useState<StatusFilter>('pending');
  const [banner, setBanner] = useState<Banner | null>(null);
  const [rowError, setRowError] = useState<RowError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const getSocketUrl = useCallback(() => {
    const accessToken = readAccessToken(tokenStorage) ?? '';
    return buildInstitutionsAdminSocketUrl(apiBaseUrl, { accessToken });
  }, []);

  const fetchSnapshot = useCallback(() => fetchInstitutions(filter), [filter]);

  const mergeDelta = useCallback(
    (current: AdminInstitutionListItem[], delta: AdminInstitutionDelta) =>
      mergeAdminInstitutionDelta(current, delta, filter),
    [filter],
  );

  const { status, state, error, reload } = useRealtimeChannel<
    AdminInstitutionListItem[],
    AdminInstitutionDelta
  >({
    channelKey: ADMIN_INSTITUTIONS_CHANNEL_KEY,
    getSocketUrl,
    fetchSnapshot,
    mergeDelta,
    parseDelta: parseAdminInstitutionDelta,
    fatalCloseReason,
  });

  const institutions = state ?? [];

  const reloadQueue = useCallback(() => {
    setBanner(null);
    setRowError(null);
    reload();
  }, [reload]);

  const setFilter = useCallback(
    (next: StatusFilter) => {
      setFilterState(next);
      setBanner(null);
      setRowError(null);
      // The channel is global and its key never changes (ADR-087), so
      // switching filters would otherwise leave `fetchSnapshot`/`mergeDelta`
      // bound to the *previous* filter's closure — `reload()` forces the
      // socket effect to re-run and pick up the fresh ones, same as
      // switching institutions does in usePendingEnrollments.
      reload();
    },
    [reload],
  );

  const transition = useCallback(
    (institutionId: string, action: TransitionAction) => {
      setBusyId(institutionId);
      setBanner(null);
      setRowError(null);

      void apiClient
        .patch<TransitionResponse>(`/institutions/${institutionId}/${action}`)
        .then(() => {
          // The row is NOT updated here. The realtime delta this same
          // mutation publishes (ADR-087) is what updates or removes it — the
          // WebSocket is the single source of truth for this queue, same
          // policy as useDeliveryPointQueue.deliver().
        })
        .catch((caught: unknown) => {
          const apiError = asApiError(caught);
          if (!isStaleRow(apiError)) {
            setRowError({
              institutionId,
              message: institutionTransitionErrorMessage(apiError.code),
              code: apiError.code,
            });
            return;
          }

          setBanner({
            message: institutionTransitionErrorMessage(apiError.code),
            code: apiError.code,
          });
          // Someone else already moved this institution — the realtime
          // channel's own reload() re-syncs both the REST snapshot and the
          // socket.
          reload();
        })
        .finally(() => {
          setBusyId((current) => (current === institutionId ? null : current));
        });
    },
    [reload],
  );

  return {
    status,
    institutions,
    error,
    banner,
    rowError,
    busyId,
    filter,
    setFilter,
    reload: reloadQueue,
    transition,
  };
}
