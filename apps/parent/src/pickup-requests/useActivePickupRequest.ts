import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useMyEnrollments } from '../enrollments/useMyEnrollments';
import {
  findActivePickupRequestId,
  type PickupRequestsByEnrollmentResponse,
} from './active-pickup-request';

export interface ActivePickupRequest {
  pickupRequestId: string;
  enrollmentId: string;
  studentFullName: string;
  institutionName: string;
}

/**
 * Best-effort scan for a `pickup_request` the tutor still has in flight, so
 * "Mis hijos" can offer a genuine way back to its tracking screen (ADR-092
 * punto 3) rather than relying on the `SelectInstitution` reroute as a side
 * effect. Reuses the very `GET /pickup-requests?enrollmentId=X` that
 * `SelectInstitution.lookupActivePickupRequest` calls after
 * `ACTIVE_PICKUP_REQUEST_EXISTS` — no backend change, same active-status list.
 *
 * Deliberate simplification: it returns only the first active pickup found; a
 * rare "two children on the way at once" surfaces a single banner, not a list.
 * Each probe is best-effort — a failed request just means no banner for that
 * enrollment.
 */
export function useActivePickupRequest(): ActivePickupRequest | null {
  const enrollments = useMyEnrollments();
  const [active, setActive] = useState<ActivePickupRequest | null>(null);

  const enrollmentsReady = enrollments.status === 'ready';
  const enrollmentRows = enrollments.enrollments;

  useEffect(() => {
    if (!enrollmentsReady) return;
    const approved = enrollmentRows.filter((e) => e.status === 'approved');
    let cancelled = false;

    void (async () => {
      for (const enrollment of approved) {
        let response: PickupRequestsByEnrollmentResponse;
        try {
          response = await apiClient.get<PickupRequestsByEnrollmentResponse>(
            `/pickup-requests?enrollmentId=${enrollment.id}`,
          );
        } catch {
          continue;
        }
        if (cancelled) return;
        const activeId = findActivePickupRequestId(response);
        if (activeId) {
          setActive({
            pickupRequestId: activeId,
            enrollmentId: enrollment.id,
            studentFullName: enrollment.studentFullName,
            institutionName: enrollment.institutionName,
          });
          return;
        }
      }
      if (!cancelled) setActive(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [enrollmentsReady, enrollmentRows]);

  return active;
}
