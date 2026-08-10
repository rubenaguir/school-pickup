import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { AuthenticatedLayout, InstitutionGate } from './routes/AuthenticatedLayout';
import { SuperAdminRoute } from './routes/SuperAdminRoute';
import {
  ADMIN_INSTITUTIONS_PATH,
  ADMIN_METRICS_PATH,
  DELIVERY_POINTS_PATH,
  DISMISSAL_SCHEDULE_PATH,
  GATE_CONSOLE_PATH,
  HOME_PATH,
  INSTITUTION_PROFILE_PATH,
  LOGIN_PATH,
  PENDING_ENROLLMENTS_PATH,
  PERSONNEL_PATH,
  STUDENTS_PATH,
} from './routes/paths';
import { DeliveryPoints } from './screens/DeliveryPoints';
import { DismissalSchedule } from './screens/DismissalSchedule';
import { GateConsole } from './screens/GateConsole';
import { GlobalMetrics } from './screens/GlobalMetrics';
import { InstitutionApproval } from './screens/InstitutionApproval';
import { InstitutionProfile } from './screens/InstitutionProfile';
import { Login } from './screens/Login';
import { PendingEnrollments } from './screens/PendingEnrollments';
import { Personnel } from './screens/Personnel';

/**
 * Stand-in for the five tutor screens (docs/design-brief.md) — the next
 * slices replace this with the real screens, one at a time (ADR-056 point 7).
 */
function StudentsPlaceholder() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-10)',
        fontFamily: 'var(--font-sans)',
        color: 'var(--ink-400)',
        fontSize: 14,
      }}
    >
      Mis hijos — próximamente
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path={LOGIN_PATH} element={<Login />} />
          <Route element={<AuthenticatedLayout />}>
            {/* InstitutionGate wraps only the institution routes: the tutor
                route below has no institution membership to wait for and
                must not be blocked by it (ADR-056 point 3). */}
            <Route element={<InstitutionGate />}>
              <Route path={PENDING_ENROLLMENTS_PATH} element={<PendingEnrollments />} />
              <Route path={INSTITUTION_PROFILE_PATH} element={<InstitutionProfile />} />
              <Route path={DELIVERY_POINTS_PATH} element={<DeliveryPoints />} />
              <Route path={DISMISSAL_SCHEDULE_PATH} element={<DismissalSchedule />} />
              <Route path={GATE_CONSOLE_PATH} element={<GateConsole />} />
              <Route path={PERSONNEL_PATH} element={<Personnel />} />
            </Route>
            <Route path={STUDENTS_PATH} element={<StudentsPlaceholder />} />
          </Route>
          {/* Separate guard, no InstitutionProvider: a super-admin does not
              carry institution membership (ADR-055 point 2). */}
          <Route element={<SuperAdminRoute />}>
            <Route path={ADMIN_INSTITUTIONS_PATH} element={<InstitutionApproval />} />
            <Route path={ADMIN_METRICS_PATH} element={<GlobalMetrics />} />
          </Route>
          {/* Includes "/": every unknown path lands on the home route, which
              redirects to /login when there is no session. */}
          <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
