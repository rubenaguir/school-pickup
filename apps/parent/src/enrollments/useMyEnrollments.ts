import { useCallback } from 'react';
import { ApiError, readAccessToken } from '@casillego/shared';
import type { EnrollmentStatus, InstitutionType } from '@casillego/shared';
import { useRealtimeChannel } from '@casillego/ui';
import { apiBaseUrl, apiClient, tokenStorage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { buildEnrollmentsGuardianSocketUrl, fatalCloseReason } from './enrollments-guardian-socket';
import { mergeMyEnrollmentDelta, parseMyEnrollmentDelta } from './my-enrollment-rows';

/** One row of GET /enrollments/mine (specs/api-contracts/enrollments.md, ADR-057). */
export interface MyEnrollment {
  id: string;
  studentId: string;
  studentFullName: string;
  institutionId: string;
  institutionName: string;
  institutionType: InstitutionType;
  institutionCategory: string | null;
  status: EnrollmentStatus;
  gradeOrGroup: string | null;
  enrollmentCode: string;
  requestedAt: string;
  reviewedAt: string | null;
}

export type MyEnrollmentsStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface MyEnrollmentsValue {
  status: MyEnrollmentsStatus;
  enrollments: MyEnrollment[];
  error: ApiError | null;
  retry: () => void;
}

interface MyEnrollmentsResponse {
  enrollments: MyEnrollment[];
}

function fetchMine(): Promise<MyEnrollment[]> {
  return apiClient
    .get<MyEnrollmentsResponse>('/enrollments/mine')
    .then((response) => response.enrollments);
}

/**
 * Loads every enrollment the authenticated tutor can see — not scoped to a
 * single student, since the endpoint has no such filter — REST snapshot plus
 * WebSocket deltas (ADR-087), via the generic `useRealtimeChannel` (ADR-075).
 * Same status/retry shape as `useMyStudents`; callers filter by
 * `studentId`/`status` themselves (see `SelectInstitution`, which needs only
 * the `approved` ones for one student).
 *
 * `channelKey` is the tutor's own `sub` from the access token — not a fixed
 * literal — so a different account signing in within the same tab (no full
 * reload) tears down the previous tutor's channel instead of quietly
 * inheriting it. `useRealtimeChannel` itself has no concept of "empty":
 * `'empty'` is derived here from `status === 'ready'` plus an empty list, same
 * derivation the pre-ADR-087 version of this hook already made off the REST
 * response.
 */
export function useMyEnrollments(): MyEnrollmentsValue {
  const { session } = useAuth();

  const getSocketUrl = useCallback(() => {
    const accessToken = readAccessToken(tokenStorage) ?? '';
    return buildEnrollmentsGuardianSocketUrl(apiBaseUrl, { accessToken });
  }, []);

  const {
    status: channelStatus,
    state,
    error,
    reload,
  } = useRealtimeChannel<MyEnrollment[], MyEnrollment>({
    channelKey: session?.sub ?? null,
    getSocketUrl,
    fetchSnapshot: fetchMine,
    mergeDelta: mergeMyEnrollmentDelta,
    parseDelta: parseMyEnrollmentDelta,
    fatalCloseReason,
  });

  const enrollments = state ?? [];
  const status: MyEnrollmentsStatus =
    channelStatus === 'ready' ? (enrollments.length === 0 ? 'empty' : 'ready') : channelStatus;

  return { status, enrollments, error, retry: reload };
}
