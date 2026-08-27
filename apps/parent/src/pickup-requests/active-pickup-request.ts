/**
 * The `pickup_request` states a tutor can still act on — the non-terminal
 * states of the ADR-024 / ADR-093 machine
 * (`en_route`/`approaching`/`arriving`/`arrived`). Shared by `SelectInstitution`
 * (reroute after `ACTIVE_PICKUP_REQUEST_EXISTS`) and `useActivePickupRequest`
 * (the "Mis hijos" banner, ADR-092) so the two paths never drift apart.
 */
export const ACTIVE_PICKUP_STATUSES = new Set<string>([
  'en_route',
  'approaching',
  'arriving',
  'arrived',
]);

/** Shape of `GET /pickup-requests?enrollmentId=X` (specs/api-contracts/pickup-requests.md). */
export interface PickupRequestsByEnrollmentResponse {
  pickupRequests: { id: string; status: string }[];
}

/** Id of the first still-active `pickup_request` in the response, or `null`. */
export function findActivePickupRequestId(
  response: PickupRequestsByEnrollmentResponse,
): string | null {
  return response.pickupRequests.find((p) => ACTIVE_PICKUP_STATUSES.has(p.status))?.id ?? null;
}
