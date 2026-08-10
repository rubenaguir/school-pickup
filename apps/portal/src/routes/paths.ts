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
 * Gate console of one delivery point
 * (specs/features/021-confirmar-llegada-y-entrega.md). Unlike the three routes
 * above, it is not restricted by `role`: any `institution_member` operates it,
 * so a coordinator can cover for an absent gate operator (ADR-011).
 */
export const GATE_CONSOLE_PATH = '/gate-console';

/** Where a signed-in user lands. */
export const HOME_PATH = PENDING_ENROLLMENTS_PATH;
