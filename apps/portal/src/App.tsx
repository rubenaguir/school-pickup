import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { AuthenticatedLayout, InstitutionGate } from './routes/AuthenticatedLayout';
import { SuperAdminRoute } from './routes/SuperAdminRoute';
import {
  ADMIN_INSTITUTIONS_PATH,
  ADMIN_METRICS_PATH,
  DASHBOARD_PATH,
  DELIVERY_POINTS_PATH,
  DISMISSAL_SCHEDULE_PATH,
  GATE_CONSOLE_PATH,
  HOME_PATH,
  INSTITUTION_PROFILE_PATH,
  LOGIN_PATH,
  PENDING_ENROLLMENTS_PATH,
  PERSONNEL_PATH,
  PROFILE_PATH,
  REPORTS_PATH,
  VERIFY_EMAIL_PATH,
} from './routes/paths';
import { Dashboard } from './screens/Dashboard';
import { DeliveryPoints } from './screens/DeliveryPoints';
import { DismissalSchedule } from './screens/DismissalSchedule';
import { GateConsole } from './screens/GateConsole';
import { GlobalMetrics } from './screens/GlobalMetrics';
import { InstitutionApproval } from './screens/InstitutionApproval';
import { InstitutionProfile } from './screens/InstitutionProfile';
import { InstitutionShell } from './institution/InstitutionShell';
import { Login } from './screens/Login';
import { OpsShell } from './admin/OpsShell';
import { PendingEnrollments } from './screens/PendingEnrollments';
import { Personnel } from './screens/Personnel';
import { Profile } from './screens/Profile';
import { Reports } from './screens/Reports';
import { VerifyEmail } from './screens/VerifyEmail';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path={LOGIN_PATH} element={<Login />} />
          <Route path={VERIFY_EMAIL_PATH} element={<VerifyEmail />} />
          <Route element={<AuthenticatedLayout />}>
            {/* InstitutionGate wraps only the institution routes; PROFILE_PATH
                stays outside it since Profile.tsx applies to any signed-in
                institution session regardless of which screen it opens
                (ADR-078 point 1). */}
            <Route element={<InstitutionGate />}>
              {/* GateConsole stays outside the shell: it is a separate kiosk
                  screen, no sidebar in the kit either (ADR-072). */}
              <Route path={GATE_CONSOLE_PATH} element={<GateConsole />} />
              <Route element={<InstitutionShell />}>
                <Route path={DASHBOARD_PATH} element={<Dashboard />} />
                <Route path={PENDING_ENROLLMENTS_PATH} element={<PendingEnrollments />} />
                <Route path={INSTITUTION_PROFILE_PATH} element={<InstitutionProfile />} />
                <Route path={DELIVERY_POINTS_PATH} element={<DeliveryPoints />} />
                <Route path={DISMISSAL_SCHEDULE_PATH} element={<DismissalSchedule />} />
                <Route path={PERSONNEL_PATH} element={<Personnel />} />
                <Route path={REPORTS_PATH} element={<Reports />} />
              </Route>
            </Route>
            <Route path={PROFILE_PATH} element={<Profile />} />
          </Route>
          {/* Separate guard, no InstitutionProvider: a super-admin does not
              carry institution membership (ADR-055 point 2). */}
          <Route element={<SuperAdminRoute />}>
            <Route element={<OpsShell />}>
              <Route path={ADMIN_INSTITUTIONS_PATH} element={<InstitutionApproval />} />
              <Route path={ADMIN_METRICS_PATH} element={<GlobalMetrics />} />
            </Route>
          </Route>
          {/* Includes "/": every unknown path lands on the home route, which
              redirects to /login when there is no session. */}
          <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
