/**
 * Same convention as `../portal-web/guardian-error-messages.ts`. Codes taken
 * straight from `apps/api/src/vehicles/vehicles.service.ts` —
 * `specs/api-contracts/vehicles.md` doesn't list a `code` column for these.
 */

/** Codes reachable from GET /vehicles. */
const LIST_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from POST /vehicles. */
const CREATE_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'Revisa la descripción y la placa: alguna no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from PATCH /vehicles/:id. */
const UPDATE_MESSAGES: Record<string, string> = {
  NOT_VEHICLE_OWNER: 'Ese vehículo no te pertenece.',
  RESOURCE_NOT_FOUND: 'Ese vehículo ya no existe.',
  INVALID_PAYLOAD: 'Revisa la descripción y la placa: alguna no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from DELETE /vehicles/:id. */
const DELETE_MESSAGES: Record<string, string> = {
  NOT_VEHICLE_OWNER: 'Ese vehículo no te pertenece.',
  RESOURCE_NOT_FOUND: 'Ese vehículo ya no existe.',
  NEW_PRIMARY_VEHICLE_REQUIRED: 'Elige cuál será tu vehículo principal antes de eliminar este.',
  NEW_PRIMARY_VEHICLE_INVALID: 'Elige otro vehículo tuyo como principal.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function vehiclesListErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function vehicleCreateErrorMessage(code: string): string {
  return CREATE_MESSAGES[code] ?? FALLBACK;
}

export function vehicleUpdateErrorMessage(code: string): string {
  return UPDATE_MESSAGES[code] ?? FALLBACK;
}

export function vehicleDeleteErrorMessage(code: string): string {
  return DELETE_MESSAGES[code] ?? FALLBACK;
}
