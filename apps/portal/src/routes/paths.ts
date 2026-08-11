export const LOGIN_PATH = '/login';

/**
 * Enrollment approval inbox — the first real screen of the portal
 * (specs/features/006-aprobacion-enrollment.md). Only a placeholder lives here
 * for now; the route exists so the next slice mounts onto a real path
 * (ADR-043 point 5).
 */
export const PENDING_ENROLLMENTS_PATH = '/enrollments/pending';

/**
 * Institution profile and geofence
 * (specs/features/008-editar-perfil-institucion.md). Protected like the
 * approval inbox: any member may read it, only `admin` may save.
 */
export const INSTITUTION_PROFILE_PATH = '/institution';

/**
 * Delivery points of the institution
 * (specs/features/009-gestionar-puntos-entrega.md). Protected like the other
 * two: any member may read the list, only `admin` may create, edit or
 * deactivate.
 */
export const DELIVERY_POINTS_PATH = '/delivery-points';

/**
 * Recurring dismissal windows and special days
 * (specs/features/010-gestionar-horarios-recurrentes.md and
 * 011-gestionar-dias-especiales.md). One route for the two entities: they are
 * the rule and its exceptions, and reading either alone is misleading
 * (ADR-053). Protected like the other configuration screens: any member may
 * read, only `admin` may write.
 */
export const DISMISSAL_SCHEDULE_PATH = '/dismissal-schedule';

/**
 * Gate console of one delivery point
 * (specs/features/021-confirmar-llegada-y-entrega.md). Unlike the three routes
 * above, it is not restricted by `role`: any `institution_member` operates it,
 * so a coordinator can cover for an absent gate operator (ADR-011).
 */
export const GATE_CONSOLE_PATH = '/gate-console';

/**
 * Staff directory of the institution (specs/features/012-invitar-personal.md).
 * Protected like the other configuration screens: any member may read the
 * list, only `admin` may invite, change a role or remove someone.
 */
export const PERSONNEL_PATH = '/personnel';

/**
 * Institution approval queue, for the platform operator
 * (specs/features/025-aprobacion-suspension-institucion.md). Under
 * `SuperAdminRoute`, not `AuthenticatedLayout`: a super-admin does not carry
 * institution membership (ADR-055 point 2). Where a super-admin lands after
 * login (ADR-055 point 4) — the same role `PENDING_ENROLLMENTS_PATH` plays
 * for an institution admin.
 */
export const ADMIN_INSTITUTIONS_PATH = '/admin/institutions';

/**
 * Global metrics for the platform operator
 * (specs/features/024-metricas-globales-super-admin.md). Same guard as
 * `ADMIN_INSTITUTIONS_PATH` (ADR-055 point 2).
 */
export const ADMIN_METRICS_PATH = '/admin/metrics';

/**
 * Reportes operativos de la institución (specs/features/027-reportes-institucion.md).
 * Unlike the other configuration screens, the read itself is `role = admin`
 * (ADR-060 point 6) — a non-admin member cannot view it at all, not only edit it.
 */
export const REPORTS_PATH = '/reports';

/** Where a signed-in user lands. */
export const HOME_PATH = PENDING_ENROLLMENTS_PATH;

/**
 * Landing screen of the tutor (parent) view — "Mis hijos", the first of the
 * five tutor screens (docs/design-brief.md, "Rol: tutor (padre)"). Where
 * anyone without an institution membership lands after login, including a
 * brand-new tutor account with zero children yet (ADR-056 point 5).
 */
export const STUDENTS_PATH = '/students';

/**
 * Alta de alumno (specs/features/004-alta-alumno.md), linked from the
 * "Agregar alumno" button on "Mis hijos". No photo field — deliberate,
 * ADR-058.
 */
export const NEW_STUDENT_PATH = '/students/new';

/**
 * Associate one student to an institution (specs/features/005-asociar-institucion.md),
 * linked per-student from "Mis hijos".
 */
export const ASSOCIATE_INSTITUTION_PATH = '/students/:studentId/associate';

export function associateInstitutionPath(studentId: string): string {
  return `/students/${studentId}/associate`;
}

/**
 * Tutores autorizados de un alumno
 * (specs/features/015-invitar-tutor-autorizado.md,
 * specs/features/017-gestionar-tutores-autorizados.md), linked per-student
 * from "Mis hijos". Own route rather than an expandable panel inside
 * "Mis hijos": it carries its own form (invitar), row-level actions
 * (revocar, reasignar principal) and error states, same shape as
 * `ASSOCIATE_INSTITUTION_PATH`.
 */
export const STUDENT_GUARDIANS_PATH = '/students/:studentId/guardians';

export function studentGuardiansPath(studentId: string): string {
  return `/students/${studentId}/guardians`;
}

/**
 * "Mis vehículos" (specs/features/014-gestionar-vehiculos.md), the vehicle
 * half of the "Perfil" tutor screen — the rest (`PROFILE_PATH`) is feature 026.
 * Global to the tutor, not per-student: no route param, unlike
 * `STUDENT_GUARDIANS_PATH`.
 */
export const VEHICLES_PATH = '/vehicles';

/**
 * Rest of "Perfil" (specs/features/026-perfil-tutor.md, ADR-059): datos
 * personales, preferencias de notificación y cambio de contraseña. "Mis
 * vehículos" (`VEHICLES_PATH`) stays its own route — the other half of the
 * same design-brief section, already shipped in feature 014. No biometría:
 * confirmed out of backend scope (ADR-059 point 6).
 */
export const PROFILE_PATH = '/profile';
