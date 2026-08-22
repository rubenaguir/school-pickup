/**
 * The API answers `{ code, message }` where `message` is English developer text
 * that is never shown to an end user — each frontend translates by `code`
 * (specs/api-contracts/README.md, ADR-028 point 1). Same shape as
 * `institution/institution-error-messages.ts`, one map per endpoint group.
 */

/** Codes reachable from GET /institutions/:id/delivery-points. */
const LIST_MESSAGES: Record<string, string> = {
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/**
 * Codes reachable from POST /institutions/:id/delivery-points and
 * PATCH /delivery-points/:id (specs/api-contracts/delivery-points.md). Ambos
 * comparten mapa: el formulario crea y edita con los mismos campos, y los dos
 * endpoints devuelven exactamente los mismos códigos salvo el 404, que solo
 * llega desde el PATCH.
 */
const SAVE_MESSAGES: Record<string, string> = {
  ADMIN_ROLE_REQUIRED: 'Solo un administrador puede gestionar los puntos de entrega.',
  NOT_INSTITUTION_MEMBER: 'No perteneces a esta institución.',
  // El selector solo ofrece miembros reales de la institución, así que este
  // código solo puede llegar si el miembro fue removido entre que se cargó el
  // selector y se guardó el formulario.
  OPERATOR_NOT_INSTITUTION_MEMBER:
    'La persona que elegiste como operador ya no es personal de esta institución. Vuelve a cargar la lista y elige a alguien más.',
  RESOURCE_NOT_FOUND: 'Este punto de entrega ya no existe.',
  INVALID_PAYLOAD: 'Revisa los datos del formulario: alguno no tiene el formato esperado.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
  // ADR-083: hacen determinista al punto atrapa-todo — se validan en capa de
  // servicio, mismo criterio que OPERATOR_NOT_INSTITUTION_MEMBER.
  DUPLICATE_CATCH_ALL_DELIVERY_POINT:
    'Ya existe otro punto activo sin grupos asignados. Solo puede haber uno: es el que recibe a los alumnos sin grupo.',
  DUPLICATE_ASSIGNED_GROUP:
    'Uno o más de estos grupos ya están asignados a otro punto activo. Quítalos de ahí primero.',
  // ADR-084: el selector solo ofrece grupos reales de la institución, así que
  // este código solo puede llegar si un grupo fue borrado entre que se cargó
  // el selector y se guardó el formulario.
  GROUP_NOT_IN_INSTITUTION:
    'Uno de los grupos que elegiste ya no existe en esta institución. Vuelve a cargar la lista y elige de nuevo.',
};

// Los códigos de GET /institutions/:id/members —la fuente del selector de
// operador— viven con su hook, en `institution-personnel/`: la pantalla de
// personal carga el mismo listado y traducirlo dos veces los dejaría diverger.
// Ver `institutionMembersErrorMessage`.

const FALLBACK = 'Error desconocido';

export function deliveryPointListErrorMessage(code: string): string {
  return LIST_MESSAGES[code] ?? FALLBACK;
}

export function deliveryPointSaveErrorMessage(code: string): string {
  return SAVE_MESSAGES[code] ?? FALLBACK;
}
