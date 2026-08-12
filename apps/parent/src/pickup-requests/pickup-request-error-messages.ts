/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Codes are the ones
 * documented for `POST /pickup-requests` (specs/api-contracts/pickup-requests.md).
 */
const PICKUP_REQUEST_ERROR_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'Revisa los datos que enviaste.',
  NOT_STUDENT_GUARDIAN: 'Ya no eres tutor autorizado de este alumno.',
  GUARDIAN_NOT_ACTIVE: 'Tu relación con este alumno todavía no está activa.',
  NOT_VEHICLE_OWNER: 'Ese vehículo no pertenece a tu catálogo.',
  RESOURCE_NOT_FOUND: 'No encontramos esa información. Intenta de nuevo.',
  ENROLLMENT_NOT_APPROVED: 'La asociación con esta institución ya no está aprobada.',
  INSTITUTION_NOT_APPROVED: 'Esta institución no está disponible en este momento.',
  ACTIVE_PICKUP_REQUEST_EXISTS:
    'Ya tienes una recogida en curso para este alumno en esta institución.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function pickupRequestErrorMessage(code: string): string {
  return PICKUP_REQUEST_ERROR_MESSAGES[code] ?? FALLBACK;
}
