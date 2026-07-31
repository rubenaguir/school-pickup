import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { HOME_PATH, LOGIN_PATH, PENDING_ENROLLMENTS_PATH } from './routes/paths';
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
          </Route>
          {/* Includes "/": every unknown path lands on the home route, which
              redirects to /login when there is no session. */}
          <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
