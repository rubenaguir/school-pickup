import { randomInt } from 'node:crypto';

// pickup_requests.delivery_code is varchar(4), zero-padded — a 4-digit code,
// not an integer. Unlike enrollment-code.util.ts's generateUniqueEnrollmentCode,
// this has no isTaken() pre-check: the caller must attempt the INSERT and
// react to the partial unique index (23505) itself, since a SELECT-then-INSERT
// here would race two concurrent pickups of the same institution (see
// specs/entities/pickup_request.md).
export function randomDeliveryCode(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}
