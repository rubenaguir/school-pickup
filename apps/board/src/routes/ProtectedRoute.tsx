import { Navigate, Outlet, useLocation } from 'react-router';
import { EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { InstitutionProvider, useInstitution } from '../institution/InstitutionContext';
import { LOGIN_PATH } from './paths';

function CenteredPanel({ children }: { children: React.ReactNode }) {
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
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>{children}</div>
    </main>
  );
}

const NO_MEMBERSHIP_ICON = (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M3 21h18M5 21V8l7-4 7 4v13" />
    <path d="M9 21v-5h6v5" />
  </svg>
);

/**
 * Gates on the institution lookup, not on authentication: by the time this
 * renders there is already a session. Zero memberships is an explanatory
 * empty state, never an error (same criterion as `apps/portal`'s
 * `InstitutionGate`, ADR-042 point 5) — a kiosk logged in with an account
 * that was later removed from the institution ends up here.
 */
function InstitutionGate() {
  const { status, error, retry } = useInstitution();

  if (status === 'loading') {
    return (
      <CenteredPanel>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </CenteredPanel>
    );
  }

  if (status === 'error') {
    return (
      <CenteredPanel>
        <ErrorState
          title="No pudimos cargar la institución"
          message={error?.message}
          code={error?.code}
          onRetry={retry}
        />
      </CenteredPanel>
    );
  }

  if (status === 'empty') {
    return (
      <CenteredPanel>
        <EmptyState
          icon={NO_MEMBERSHIP_ICON}
          title="Esta cuenta no pertenece a ninguna institución"
          description="La cuenta con la que se inició sesión en este tablero no está dada de alta como personal de ninguna institución. Pide a un administrador que la invite, o inicia sesión con otra cuenta."
        />
      </CenteredPanel>
    );
  }

  return <Outlet />;
}

/**
 * Everything outside /login requires a session (ADR-068 point 1) — no
 * further split by role: the board is open to any `institution_member`
 * (ADR-011). Mounts `InstitutionProvider` so the resolved `institutionId`
 * (first membership, no switcher) is available to every protected screen.
 */
export function ProtectedRoute() {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname }} />;
  }

  return (
    <InstitutionProvider>
      <InstitutionGate />
    </InstitutionProvider>
  );
}
