import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import {
  HOME_PATH,
  LOGIN_PATH,
  SELECT_INSTITUTION_PATH,
  TRACKING_PATH,
  TUTOR_PORTAL_ASSOCIATE_PATH,
  TUTOR_PORTAL_GUARDIANS_PATH,
  TUTOR_PORTAL_PROFILE_PATH,
  TUTOR_PORTAL_STUDENTS_PATH,
} from './routes/paths';
import { AssociateAndGuardians } from './portal-web/AssociateAndGuardians';
import { PortalStudents } from './portal-web/PortalStudents';
import { TutorPlaceholder } from './portal-web/TutorPlaceholder';
import { TutorShell } from './portal-web/TutorShell';
import { Home } from './screens/Home';
import { Login } from './screens/Login';
import { SelectInstitution } from './screens/SelectInstitution';
import { Tracking } from './screens/Tracking';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path={LOGIN_PATH} element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path={HOME_PATH} element={<Home />} />
            <Route path={SELECT_INSTITUTION_PATH} element={<SelectInstitution />} />
            <Route path={TRACKING_PATH} element={<Tracking />} />
            <Route element={<TutorShell />}>
              <Route path={TUTOR_PORTAL_STUDENTS_PATH} element={<PortalStudents />} />
              <Route path={TUTOR_PORTAL_ASSOCIATE_PATH} element={<AssociateAndGuardians />} />
              <Route path={TUTOR_PORTAL_GUARDIANS_PATH} element={<AssociateAndGuardians />} />
              <Route
                path={TUTOR_PORTAL_PROFILE_PATH}
                element={
                  <TutorPlaceholder description="Tu cuenta, vehículos y preferencias de aviso." />
                }
              />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
