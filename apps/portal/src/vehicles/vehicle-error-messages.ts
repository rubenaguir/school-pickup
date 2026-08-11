/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). One map per endpoint group,
 * same shape as `student-guardian-error-messages.ts`.
 */

/** Codes reachable from GET /vehicles. */
const LIST_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from POST /vehicles and PATCH /vehicles/:id. */
const SAVE_MESSAGES: Record<string, string> = {
  NOT_VEHICLE_OWNER: 'Ese vehículo no es tuyo.',
  RESOURCE_NOT_FOUND: 'Ese vehículo ya no existe.',
  INVALID_PAYLOAD: 'Revisa la descripción y la placa: alguna no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Codes reachable from PATCH /vehicles/:id (marcar como principal) and DELETE /vehicles/:id. */
const ROW_MESSAGES: Record<string, string> = {
  NOT_VEHICLE_OWNER: 'Ese vehículo ya no es tuyo.',
  RESOURCE_NOT_FOUND: 'Ese vehículo ya no existe.',
  // No debería ocurrir —el selector de reemplazo solo ofrece vehículos reales
  // del propio tutor—, pero entre que se cargó la lista y se actuó pudo haber
  // cambiado (mismo criterio que ADR-054 punto 3 para personal).
  NEW_PRIMARY_VEHICLE_REQUIRED: 'Elige qué vehículo queda como principal antes de borrar este.',
  NEW_PRIMARY_VEHICLE_INVALID: 'Ese reemplazo ya no es válido. Elige otro vehículo.',
  INVALID_PAYLOAD: 'Esa acción no es válida.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function listVehiclesErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function saveVehicleErrorMessage(code: string): string {
  return SAVE_MESSAGES[code] ?? FALLBACK;
}

export function vehicleRowErrorMessage(code: string): string {
  return ROW_MESSAGES[code] ?? FALLBACK;
}
