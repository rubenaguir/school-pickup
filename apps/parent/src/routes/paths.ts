export const LOGIN_PATH = '/login';

/**
 * "Inicio / Mis hijos" (docs/design-brief.md, "App del padre"): list of the
 * tutor's students with the dominant "¡Ya voy!" action per student. Where a
 * signed-in user lands.
 */
export const HOME_PATH = '/';

/**
 * "Seleccionar institución" (docs/design-brief.md, "App del padre"), reached
 * by tapping "¡Ya voy!" for a student on `HOME_PATH`. Placeholder route only
 * — the screen itself lands in a future session — same pattern as
 * apps/portal's `associateInstitutionPath`.
 */
export const SELECT_INSTITUTION_PATH = '/students/:studentId/select-institution';

export function selectInstitutionPath(studentId: string): string {
  return `/students/${studentId}/select-institution`;
}

/**
 * Pantalla de seguimiento (docs/design-brief.md, "App del padre"), a la que
 * se navega tras crear una recogida en `SELECT_INSTITUTION_PATH`. Placeholder
 * route only — el contenido real (mapa, ETA, Wake Lock, "Ya llegué"/Cancelar)
 * lands in a future session.
 */
export const TRACKING_PATH = '/pickup-requests/:pickupRequestId/tracking';

export function trackingPath(pickupRequestId: string): string {
  return `/pickup-requests/${pickupRequestId}/tracking`;
}
