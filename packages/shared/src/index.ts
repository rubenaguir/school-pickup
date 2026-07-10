/**
 * @casillego/shared — types and constants shared across api, worker and frontends.
 *
 * Domain types are re-exported per entity file below, one explicit
 * `export * from` per module so bundlers can statically detect the named
 * exports from the CommonJS build consumed by the React frontends.
 */

export * from './types/user';
export * from './types/institution';
export * from './types/institution-member';
export * from './types/delivery-point';
export * from './types/student';
export * from './types/student-guardian';
export * from './types/vehicle';
export * from './types/enrollment';
export * from './types/pickup-request';
export * from './types/pickup-request-status-history';
export * from './types/location-update';
export * from './types/dismissal-window';
export * from './types/dismissal-exception';
export * from './types/audit-log';
export * from './pickup-request-status-machine';
export * from './ports';

/**
 * MQTT topic helpers.
 *
 * The broker is shared with other applications, so every CasiLlego topic hangs from
 * a single project root prefix to avoid namespace collisions. Within that root,
 * topics are segmented per institution (tenant), enforced by broker ACLs.
 */

/** Project root prefix for all CasiLlego MQTT topics. */
export const MQTT_TOPIC_ROOT = 'school-pickup';

/** Base topic for an institution: `school-pickup/institution/{institutionId}`. */
export function institutionTopic(institutionId: string): string {
  return `${MQTT_TOPIC_ROOT}/institution/${institutionId}`;
}

/**
 * Location stream published by the parent app for a pickup request:
 * `school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location`.
 */
export function pickupLocationTopic(institutionId: string, pickupRequestId: string): string {
  return `${institutionTopic(institutionId)}/pickup/${pickupRequestId}/location`;
}

/**
 * Board state stream consumed by the institution board:
 * `school-pickup/institution/{institutionId}/board`.
 */
export function boardTopic(institutionId: string): string {
  return `${institutionTopic(institutionId)}/board`;
}

/**
 * Delivery-point queue stream consumed by a delivery point's console:
 * `school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`.
 */
export function deliveryPointQueueTopic(institutionId: string, deliveryPointId: string): string {
  return `${institutionTopic(institutionId)}/delivery-point/${deliveryPointId}/queue`;
}
