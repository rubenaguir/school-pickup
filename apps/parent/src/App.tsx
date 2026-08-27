import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { AppUpdateBanner } from './update/AppUpdateBanner';
import { ProtectedRoute } from './routes/ProtectedRoute';
import {
  ACCEPT_INVITATION_PATH,
  HOME_PATH,
  LOGIN_PATH,
  SELECT_INSTITUTION_PATH,
  TRACKING_PATH,
  TUTOR_PORTAL_ASSOCIATE_PATH,
  TUTOR_PORTAL_GUARDIANS_PATH,
  TUTOR_PORTAL_PROFILE_PATH,
  TUTOR_PORTAL_STUDENTS_PATH,
  VERIFY_EMAIL_PATH,
} from './routes/paths';
import { AssociateAndGuardians } from './portal-web/AssociateAndGuardians';
import { PortalProfile } from './portal-web/PortalProfile';
import { PortalStudents } from './portal-web/PortalStudents';
import { TutorShell } from './portal-web/TutorShell';
import { AcceptInvitation } from './screens/AcceptInvitation';
import { Home } from './screens/Home';
import { Login } from './screens/Login';
import { SelectInstitution } from './screens/SelectInstitution';
import { Tracking } from './screens/Tracking';
import { VerifyEmail } from './screens/VerifyEmail';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppUpdateBanner />
        <Routes>
          <Route path={LOGIN_PATH} element={<Login />} />
          <Route path={VERIFY_EMAIL_PATH} element={<VerifyEmail />} />
          <Route path={ACCEPT_INVITATION_PATH} element={<AcceptInvitation />} />
          <Route element={<ProtectedRoute />}>
            <Route path={HOME_PATH} element={<Home />} />
            <Route path={SELECT_INSTITUTION_PATH} element={<SelectInstitution />} />
            <Route path={TRACKING_PATH} element={<Tracking />} />
            <Route element={<TutorShell />}>
              <Route path={TUTOR_PORTAL_STUDENTS_PATH} element={<PortalStudents />} />
              <Route path={TUTOR_PORTAL_ASSOCIATE_PATH} element={<AssociateAndGuardians />} />
              <Route path={TUTOR_PORTAL_GUARDIANS_PATH} element={<AssociateAndGuardians />} />
              <Route path={TUTOR_PORTAL_PROFILE_PATH} element={<PortalProfile />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
