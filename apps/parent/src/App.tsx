import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { HOME_PATH, LOGIN_PATH, SELECT_INSTITUTION_PATH, TRACKING_PATH } from './routes/paths';
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
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
