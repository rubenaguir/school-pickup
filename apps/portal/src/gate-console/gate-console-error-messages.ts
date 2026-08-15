/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `enrollments/enrollment-error-messages.ts` and
 * `delivery-points/delivery-point-error-messages.ts`, one map per endpoint
 * group — extended here with the WebSocket close codes, which follow the same
 * rule by design: the close `reason` carries the same English `code` the
 * equivalent REST error would (specs/api-contracts/delivery-point-queue-ws.md).
 */

/** Codes reachable from GET /pickup-requests?deliveryPointId=... */
const QUEUE_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'No perteneces a la institución de este punto de entrega.',
  RESOURCE_NOT_FOUND: 'Este punto de entrega ya no existe.',
  INVALID_PAYLOAD: 'No pudimos identificar el punto de entrega de esta cola.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from PATCH /pickup-requests/:id/deliver
 * (specs/api-contracts/pickup-requests.md). `INVALID_DELIVERY_CODE` es un 401
 * que no habla de la sesión sino del código tecleado (ADR-031 punto 2): sin
 * bloqueo y sin límite de reintentos, porque la verificación es presencial
 * (feature 021).
 */
const DELIVER_MESSAGES: Record<string, string> = {
  INVALID_DELIVERY_CODE: 'El código no coincide. Pídele al tutor que lo muestre otra vez.',
  INVALID_STATUS_TRANSITION:
    'Esta recogida ya no está en puerta. Actualiza la cola para ver su estado real.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a la institución de esta recogida.',
  RESOURCE_NOT_FOUND: 'Esta recogida ya no existe.',
  INVALID_PAYLOAD: 'El código de entrega son 4 dígitos.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from POST /pickup-requests/:id/announce (ADR-073 point 2,
 * specs/api-contracts/pickup-requests.md) — calco de autorización de
 * `deliver`, mismos códigos salvo `INVALID_DELIVERY_CODE`/`INVALID_PAYLOAD`,
 * que no aplican a un endpoint sin body.
 */
const ANNOUNCE_MESSAGES: Record<string, string> = {
  INVALID_STATUS_TRANSITION:
    'Esta recogida ya no está en puerta. Actualiza la cola para ver su estado real.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a la institución de esta recogida.',
  RESOURCE_NOT_FOUND: 'Esta recogida ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Close codes of the WebSocket bridge (4400/4401/4403/4404,
 * specs/api-contracts/delivery-point-queue-ws.md). Translated by the `reason`
 * string, not by the numeric code, for the same reason as everything else here.
 *
 * `UNAUTHENTICATED` is the one case the user cannot act on from this screen: the
 * access token expired or was rejected while the console was open, and the WS
 * handshake — unlike a REST call — has no refresh interceptor behind it.
 */
const SOCKET_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: 'No pudimos identificar el punto de entrega de esta cola.',
  UNAUTHENTICATED: 'Tu sesión expiró. Vuelve a iniciar sesión para seguir la cola en vivo.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a la institución de este punto de entrega.',
  RESOURCE_NOT_FOUND: 'Este punto de entrega ya no existe.',
};

const FALLBACK = 'Error desconocido';

export function queueListErrorMessage(code: string): string {
  return QUEUE_MESSAGES[code] ?? FALLBACK;
}

export function deliverErrorMessage(code: string): string {
  return DELIVER_MESSAGES[code] ?? FALLBACK;
}

export function announceErrorMessage(code: string): string {
  return ANNOUNCE_MESSAGES[code] ?? FALLBACK;
}

export function queueSocketErrorMessage(reason: string): string {
  return SOCKET_MESSAGES[reason] ?? FALLBACK;
}
