import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import {
  DELIVERY_POINTS_PATH,
  GATE_CONSOLE_PATH,
  HOME_PATH,
  INSTITUTION_PROFILE_PATH,
  LOGIN_PATH,
  PENDING_ENROLLMENTS_PATH,
} from './routes/paths';
import { DeliveryPoints } from './screens/DeliveryPoints';
import { GateConsole } from './screens/GateConsole';
import { InstitutionProfile } from './screens/InstitutionProfile';
import { Login } from './screens/Login';
import { PendingEnrollments } from './screens/PendingEnrollments';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path={LOGIN_PATH} element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path={PENDING_ENROLLMENTS_PATH} element={<PendingEnrollments />} />
            <Route path={INSTITUTION_PROFILE_PATH} element={<InstitutionProfile />} />
            <Route path={DELIVERY_POINTS_PATH} element={<DeliveryPoints />} />
            <Route path={GATE_CONSOLE_PATH} element={<GateConsole />} />
          </Route>
          {/* Includes "/": every unknown path lands on the home route, which
              redirects to /login when there is no session. */}
          <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
