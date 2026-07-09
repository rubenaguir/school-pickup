/**
 * @casillego/shared — types and constants shared across api, worker and frontends.
 *
 * Skeleton stage: only MQTT topic helpers are defined here. Domain types
 * (entities, DTOs, enums) are added in later phases.
 *
 * Everything is exported directly from this entry file (no wildcard re-exports)
 * so that bundlers can statically detect the named exports from the CommonJS
 * build consumed by the React frontends.
 */

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
