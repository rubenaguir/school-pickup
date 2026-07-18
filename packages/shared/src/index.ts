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

/**
 * PostGIS geography primitive. Not a domain entity type: it is the wire shape
 * the `geography(Point,4326)` columns map to, shared by the TypeORM entities
 * (which import it directly) and by `api`'s LatLng mapper. See ADR-033.
 *
 * The TypeORM entities themselves are deliberately NOT re-exported here — they
 * live behind the `@casillego/shared/entities` subpath so that `typeorm` never
 * enters the frontend bundles or type-checks. See ADR-033.
 */
export * from './types/geo-point';

export * from './pickup-request-status-machine';
export * from './pickup-request-payloads';
export * from './ports';
export * from './adapters/node-mqtt-client';

/**
 * `applyPickupRequestTransition` (status update + history row) is NOT
 * re-exported here: it imports TypeORM entity classes as values, same
 * concern as the entities themselves (ADR-033). It lives behind the
 * `@casillego/shared/pickup-request-transition` subpath instead.
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

/**
 * Delivery-point queue stream consumed by a delivery point's console:
 * `school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`.
 */
export function deliveryPointQueueTopic(institutionId: string, deliveryPointId: string): string {
  return `${institutionTopic(institutionId)}/delivery-point/${deliveryPointId}/queue`;
}

/**
 * Inverse of `pickupLocationTopic`: recovers `institutionId` and
 * `pickupRequestId` from a topic matched by the worker's wildcard
 * subscription (`school-pickup/institution/+/pickup/+/location`), since the
 * location payload itself does not carry either id (ADR-031 pt.4). Returns
 * `null` — never throws — for anything that isn't that exact shape, so the
 * worker can silently discard an unrecognized topic instead of crashing.
 */
export function parseLocationTopic(
  topic: string,
): { institutionId: string; pickupRequestId: string } | null {
  const match = /^school-pickup\/institution\/([^/]+)\/pickup\/([^/]+)\/location$/.exec(topic);
  if (!match) return null;
  return { institutionId: match[1], pickupRequestId: match[2] };
}
