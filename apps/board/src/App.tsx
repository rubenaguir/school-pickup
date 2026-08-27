import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { BoardAutoUpdate } from './update/BoardAutoUpdate';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { HOME_PATH, LOGIN_PATH } from './routes/paths';
import { Home } from './screens/Home';
import { Login } from './screens/Login';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BoardAutoUpdate />
        <Routes>
          <Route path={LOGIN_PATH} element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path={HOME_PATH} element={<Home />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
