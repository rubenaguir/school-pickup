export const LOGIN_PATH = '/login';

/**
 * Enrollment approval inbox — the first real screen of the portal
 * (specs/features/006-aprobacion-enrollment.md). Only a placeholder lives here
 * for now; the route exists so the next slice mounts onto a real path
 * (ADR-043 point 5).
 */
export const PENDING_ENROLLMENTS_PATH = '/enrollments/pending';

/** Where a signed-in user lands. */
export const HOME_PATH = PENDING_ENROLLMENTS_PATH;
