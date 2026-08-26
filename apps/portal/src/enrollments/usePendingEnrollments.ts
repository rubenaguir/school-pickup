import { useCallback, useState } from 'react';
import { ApiError, asApiError, readAccessToken } from '@casillego/shared';
import type { EnrollmentStatus } from '@casillego/shared';
import { useRealtimeChannel } from '@casillego/ui';
import { apiBaseUrl, apiClient, tokenStorage } from '../api/client';
import { enrollmentReviewErrorMessage } from './enrollment-error-messages';
import {
  buildEnrollmentsInstitutionSocketUrl,
  fatalCloseReason,
} from './enrollments-institution-socket';
import {
  mergePendingEnrollmentDelta,
  parsePendingEnrollmentDelta,
  type PendingEnrollmentDelta,
} from './pending-enrollment-rows';

/**
 * One row of GET /enrollments?status=pending&institutionId=...
 * (specs/api-contracts/enrollments.md). Declared here rather than reusing the
 * `Enrollment` type of `@casillego/shared`: that one models the entity, this
 * one models the list projection — it carries `studentFullName` and drops
 * `institutionId`. Same criterion as `Membership` in InstitutionContext.
 */
export interface PendingEnrollment {
  id: string;
  studentId: string;
  studentFullName: string;
  status: EnrollmentStatus;
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedByUserId: string;
  requestedAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  withdrawnByUserId: string | null;
  withdrawnAt: string | null;
}

export type ReviewAction = 'approve' | 'reject';

export type PendingEnrollmentsStatus = 'loading' | 'ready' | 'error';

/** Screen-wide notice: the list moved under the user's feet, nothing to retry. */
export interface Banner {
  message: string;
  code: string;
}

/** Row-level failure: the request is still pending, the row stays put. */
export interface RowError {
  enrollmentId: string;
  message: string;
  code: string;
}

export interface PendingEnrollmentsValue {
  status: PendingEnrollmentsStatus;
  enrollments: PendingEnrollment[];
  /** Only set while `status === 'error'` — the whole list failed to load. */
  error: ApiError | null;
  banner: Banner | null;
  rowError: RowError | null;
  /** Id of the row whose approve/reject call is in flight, if any. */
  busyId: string | null;
  reload: () => void;
  /**
   * `groupId` only applies to `action === 'approve'` (ADR-083) — sent as the
   * PATCH body so an institution can assign or correct the student's group in
   * the same step it approves the request, instead of depending only on the
   * catch-all delivery point. Ignored for `'reject'`. Renamed from
   * `gradeOrGroup` (free text) by ADR-084 — the response field keeps its name
   * (`gradeOrGroup: string | null` above), resolved by join now.
   */
  review: (enrollmentId: string, action: ReviewAction, groupId?: string | null) => void;
}

interface PendingEnrollmentsResponse {
  enrollments: PendingEnrollment[];
}

function fetchPending(institutionId: string): Promise<PendingEnrollmentsResponse> {
  return apiClient.get<PendingEnrollmentsResponse>(
    `/enrollments?status=pending&institutionId=${encodeURIComponent(institutionId)}`,
  );
}

/**
 * A resolved-elsewhere row (409) or a vanished one (404) is not this screen's
 * error: somebody else already decided. Both are answered by refreshing the
 * list instead of by an error state.
 *
 * Silent coupling to the API status codes — see ADR-022 point 5 ("Nota de
 * acoplamiento frontend") for the full reasoning. `approve` answers 422 when
 * the institution is not approved (a cross-entity rule), so that case falls
 * through to `setRowError` and the row stays visible with its inline error.
 * Renumbering `approve` to 409 to match `institutions.md` would silently turn
 * it into a refresh-and-vanish, and no API-layer test would catch it. Revisit
 * this file before changing the HTTP status of either endpoint.
 */
function isStaleRow(error: ApiError): boolean {
  return error.status === 409 || error.status === 404;
}

/**
 * Loads the pending-approval inbox of one institution and resolves its rows —
 * REST snapshot plus WebSocket deltas (ADR-087), via the generic
 * `useRealtimeChannel` (ADR-075), same pattern as `useDeliveryPointQueue`.
 *
 * `institutionId` comes from `useInstitution()`; it is null only while the
 * membership lookup is in flight, which `<InstitutionGate>` already gates on —
 * the null branch exists so this hook stays honest about its input, not
 * because the screen can render with it.
 */
export function usePendingEnrollments(institutionId: string | null): PendingEnrollmentsValue {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [rowError, setRowError] = useState<RowError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const getSocketUrl = useCallback(() => {
    // Read on every attempt, never captured once — same reasoning as
    // useDeliveryPointQueue.ts: a reconnection after the access token was
    // renewed must hand the gateway the renewed one.
    const accessToken = readAccessToken(tokenStorage) ?? '';
    return buildEnrollmentsInstitutionSocketUrl(apiBaseUrl, {
      accessToken,
      institutionId: institutionId ?? '',
    });
  }, [institutionId]);

  const fetchSnapshot = useCallback(() => {
    return fetchPending(institutionId ?? '').then((response) => response.enrollments);
  }, [institutionId]);

  const { status, state, error, reload } = useRealtimeChannel<
    PendingEnrollment[],
    PendingEnrollmentDelta
  >({
    channelKey: institutionId,
    getSocketUrl,
    fetchSnapshot,
    mergeDelta: mergePendingEnrollmentDelta,
    parseDelta: parsePendingEnrollmentDelta,
    fatalCloseReason,
    refreshToken: () => apiClient.refreshToken(),
  });

  const enrollments = state ?? [];

  const reloadInbox = useCallback(() => {
    setBanner(null);
    setRowError(null);
    reload();
  }, [reload]);

  const review = useCallback(
    (enrollmentId: string, action: ReviewAction, groupId?: string | null) => {
      if (!institutionId) return;
      setBusyId(enrollmentId);
      setBanner(null);
      setRowError(null);

      void apiClient
        .patch(
          `/enrollments/${enrollmentId}/${action}`,
          action === 'approve' ? { groupId } : undefined,
        )
        .then(() => {
          // The row is NOT removed here. The realtime delta this same
          // mutation publishes (ADR-087) is what takes it out — the
          // WebSocket is the single source of truth for this inbox, same
          // policy as useDeliveryPointQueue.deliver().
        })
        .catch((caught: unknown) => {
          const apiError = asApiError(caught);
          if (!isStaleRow(apiError)) {
            setRowError({
              enrollmentId,
              message: enrollmentReviewErrorMessage(apiError.code),
              code: apiError.code,
            });
            return;
          }

          setBanner({ message: enrollmentReviewErrorMessage(apiError.code), code: apiError.code });
          // Someone else already resolved it — the realtime channel's own
          // reload() re-syncs both the REST snapshot and the socket.
          reload();
        })
        .finally(() => {
          setBusyId((current) => (current === enrollmentId ? null : current));
        });
    },
    [institutionId, reload],
  );

  return { status, enrollments, error, banner, rowError, busyId, reload: reloadInbox, review };
}
