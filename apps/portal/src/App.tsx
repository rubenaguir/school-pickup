import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { AuthenticatedLayout, InstitutionGate } from './routes/AuthenticatedLayout';
import { SuperAdminRoute } from './routes/SuperAdminRoute';
import {
  ADMIN_INSTITUTIONS_PATH,
  ADMIN_METRICS_PATH,
  ASSOCIATE_INSTITUTION_PATH,
  DELIVERY_POINTS_PATH,
  DISMISSAL_SCHEDULE_PATH,
  GATE_CONSOLE_PATH,
  HOME_PATH,
  INSTITUTION_PROFILE_PATH,
  LOGIN_PATH,
  NEW_STUDENT_PATH,
  PENDING_ENROLLMENTS_PATH,
  PERSONNEL_PATH,
  PROFILE_PATH,
  STUDENTS_PATH,
  STUDENT_GUARDIANS_PATH,
  VEHICLES_PATH,
} from './routes/paths';
import { AssociateInstitution } from './screens/AssociateInstitution';
import { DeliveryPoints } from './screens/DeliveryPoints';
import { DismissalSchedule } from './screens/DismissalSchedule';
import { GateConsole } from './screens/GateConsole';
import { GlobalMetrics } from './screens/GlobalMetrics';
import { InstitutionApproval } from './screens/InstitutionApproval';
import { InstitutionProfile } from './screens/InstitutionProfile';
import { Login } from './screens/Login';
import { NewStudent } from './screens/NewStudent';
import { PendingEnrollments } from './screens/PendingEnrollments';
import { Personnel } from './screens/Personnel';
import { Profile } from './screens/Profile';
import { StudentGuardians } from './screens/StudentGuardians';
import { Students } from './screens/Students';
import { Vehicles } from './screens/Vehicles';

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
            <Route path={STUDENTS_PATH} element={<Students />} />
            <Route path={NEW_STUDENT_PATH} element={<NewStudent />} />
            <Route path={ASSOCIATE_INSTITUTION_PATH} element={<AssociateInstitution />} />
            <Route path={STUDENT_GUARDIANS_PATH} element={<StudentGuardians />} />
            <Route path={VEHICLES_PATH} element={<Vehicles />} />
            <Route path={PROFILE_PATH} element={<Profile />} />
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
