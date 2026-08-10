import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { HOME_PATH } from './paths';

/**
 * Everything under the `/admin/` namespace requires `isSuperAdmin` (ADR-055
 * point 2). Parallel to `AuthenticatedLayout`, deliberately without
 * `InstitutionProvider`: a super-admin does not carry institution membership,
 * so `GET /institution-members/mine` has nothing to fetch for these screens.
 *
 * No session redirects to `/login`, same as `AuthenticatedLayout`. A session
 * without the flag redirects to `HOME_PATH` rather than showing a "forbidden"
 * screen — this route is simply unreachable by the normal path for anyone who
 * does not have it, not a permission wall to explain (ADR-055 point 2).
 */
export function SuperAdminRoute() {
  const { session, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isSuperAdmin) {
    return <Navigate to={HOME_PATH} replace />;
  }

  return <Outlet />;
}
