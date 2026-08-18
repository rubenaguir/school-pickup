export const LOGIN_PATH = '/login';

/**
 * "Verificar correo" (ADR-080 punto 3), enlazada desde el correo de
 * verificación con `?token=...`. Fuera de `ProtectedRoute`: quien llega aquí
 * todavía no tiene sesión.
 */
export const VERIFY_EMAIL_PATH = '/verificar-correo';

/**
 * "Aceptar invitación" (ADR-082 punto 3), enlazada desde el correo de
 * invitación (tutor autorizado) con `?token=...`. Fuera de `ProtectedRoute`:
 * mismo criterio que `VERIFY_EMAIL_PATH` — quien llega aquí no tiene sesión
 * todavía. Coincide con el link real que arma
 * `apps/api/src/email/email-templates.ts` para las dos clases de invitación
 * (personal de institución/tutor autorizado); solo cambia el dominio base.
 */
export const ACCEPT_INVITATION_PATH = '/aceptar-invitacion';

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

/**
 * "Mis hijos" del Portal web (docs/decisiones.md ADR-078 punto 3) — landing
 * de la superficie de escritorio, análogo de HOME_PATH para App móvil.
 */
export const TUTOR_PORTAL_STUDENTS_PATH = '/portal/students';

/**
 * "Asociar institución" del Portal web (docs/decisiones.md ADR-078 punto 3).
 * Comparte componente (`AssociateAndGuardians`) con TUTOR_PORTAL_GUARDIANS_PATH
 * — un selector de alumno en memoria, no dos rutas por `:studentId`.
 */
export const TUTOR_PORTAL_ASSOCIATE_PATH = '/portal/associate';

/**
 * "Tutores autorizados" del Portal web. Misma nota que
 * TUTOR_PORTAL_ASSOCIATE_PATH — comparten componente.
 */
export const TUTOR_PORTAL_GUARDIANS_PATH = '/portal/guardians';

/**
 * "Perfil" del Portal web (docs/decisiones.md ADR-078 punto 3): cuenta,
 * cambio de contraseña, vehículos y notificaciones.
 */
export const TUTOR_PORTAL_PROFILE_PATH = '/portal/profile';
