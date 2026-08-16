import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { resolveFallbackSessionRole } from '../auth/login-outcome';
import { readSessionRole, writeSessionRole, type SessionRole } from '../auth/session-role';
import { InstitutionProvider, useInstitution } from '../institution/InstitutionContext';
import { TutorProvider } from '../tutor/TutorContext';
import { HOME_PATH, STUDENTS_PATH } from './paths';

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
 * Shown by whichever gate resolves a legacy session (one stored before
 * `sessionRole` existed, ADR-077 point 3) while its own async lookup is in
 * flight — same loading shape `InstitutionGateBody` already used.
 */
function GateLoadingPanel() {
  return (
    <CenteredPanel>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </CenteredPanel>
  );
}

/**
 * Resolves and persists `sessionRole` for a session that predates it
 * (ADR-077 point 3), then hands back the resolved role. `preferredWhenAmbiguous`
 * is only used for the rare case of a genuinely hybrid account with no stored
 * preference and no login-time chooser available at this point in the tree —
 * see `resolveFallbackSessionRole`.
 */
function useResolvedLegacySessionRole(preferredWhenAmbiguous: SessionRole): SessionRole | null {
  const [role, setRole] = useState<SessionRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveFallbackSessionRole(preferredWhenAmbiguous).then((resolved) => {
      if (cancelled) return;
      writeSessionRole(resolved);
      setRole(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [preferredWhenAmbiguous]);

  return role;
}

/**
 * Body of the institution gate, once `sessionRole` is known to be
 * `'institution'` (or resolved as the legacy fallback). Gates on the
 * institution lookup, not on authentication: by the time this renders there
 * is already a session. Zero memberships is an explanatory empty state,
 * never an error (ADR-042 point 5).
 */
function InstitutionGateBody() {
  const { status, error, retry } = useInstitution();

  if (status === 'loading') {
    return <GateLoadingPanel />;
  }

  if (status === 'error') {
    return (
      <CenteredPanel>
        <ErrorState
          title="No pudimos cargar tu institución"
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
          title="No perteneces a ninguna institución"
          description="Tu cuenta no está dada de alta como personal de ninguna institución. Pide a un administrador que te invite."
        />
      </CenteredPanel>
    );
  }

  return <Outlet />;
}

/**
 * A legacy session (no `sessionRole` stored yet, ADR-077 point 3) landing
 * directly on an institution route: resolves the role once, persists it, and
 * only then either renders the institution view or redirects to the tutor
 * one. `InstitutionProvider` is guaranteed mounted here — `AuthenticatedLayout`
 * mounts both providers for the null-role case.
 */
function InstitutionGateFallback() {
  const role = useResolvedLegacySessionRole('institution');

  if (role === null) {
    return <GateLoadingPanel />;
  }

  if (role === 'tutor') {
    return <Navigate to={STUDENTS_PATH} replace />;
  }

  return <InstitutionGateBody />;
}

/**
 * Gates the institution routes on `sessionRole` before anything else
 * (ADR-077 point 4): a `'tutor'` session redirects straight to
 * `STUDENTS_PATH` without ever calling `useInstitution()` — which would
 * throw, since `AuthenticatedLayout` does not mount `InstitutionProvider`
 * for a tutor session at all.
 */
export function InstitutionGate() {
  const sessionRole = readSessionRole();

  if (sessionRole === 'tutor') {
    return <Navigate to={STUDENTS_PATH} replace />;
  }

  if (sessionRole === null) {
    return <InstitutionGateFallback />;
  }

  return <InstitutionGateBody />;
}

/**
 * A legacy session landing directly on a tutor route: same resolution as
 * `InstitutionGateFallback`, mirrored. `TutorProvider` is guaranteed mounted
 * here for the same reason.
 */
function TutorRoleGateFallback() {
  const role = useResolvedLegacySessionRole('tutor');

  if (role === null) {
    return <GateLoadingPanel />;
  }

  if (role === 'institution') {
    return <Navigate to={HOME_PATH} replace />;
  }

  return <Outlet />;
}

/**
 * Guards the routes genuinely exclusive to the tutor view — `STUDENTS_PATH`,
 * `NEW_STUDENT_PATH`, `ASSOCIATE_INSTITUTION_PATH`, `STUDENT_GUARDIANS_PATH`,
 * `VEHICLES_PATH` (ADR-077 point 4). `PROFILE_PATH` is deliberately not
 * wrapped in this or `InstitutionGate`: `Profile.tsx` is generic, it applies
 * to any signed-in session regardless of chosen role.
 *
 * Unlike ADR-056's `TutorContext.status === 'empty'`, which never blocked
 * (a brand-new tutor account has zero children and must still reach these
 * screens), this gate only checks `sessionRole` — it does not read
 * `TutorContext` at all.
 */
export function TutorRoleGate() {
  const sessionRole = readSessionRole();

  if (sessionRole === 'institution') {
    return <Navigate to={HOME_PATH} replace />;
  }

  if (sessionRole === null) {
    return <TutorRoleGateFallback />;
  }

  return <Outlet />;
}

/**
 * Everything outside /login requires a session (ADR-042 point 1). Mounts only
 * the provider `sessionRole` calls for — reversing ADR-056 point 3, which
 * mounted both unconditionally — since route access is now actually gated by
 * that role (point 4 above) rather than merely deciding a landing screen.
 * A session stored before `sessionRole` existed mounts both, transiently,
 * for this one load only: the first gate to render resolves and persists the
 * real value (ADR-077 point 3), and every subsequent load takes one of the
 * two branches below. `SuperAdminRoute` remains its own tree with neither
 * provider (ADR-055 point 2).
 */
export function AuthenticatedLayout() {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const sessionRole = readSessionRole();

  if (sessionRole === 'institution') {
    return (
      <InstitutionProvider>
        <Outlet />
      </InstitutionProvider>
    );
  }

  if (sessionRole === 'tutor') {
    return (
      <TutorProvider>
        <Outlet />
      </TutorProvider>
    );
  }

  return (
    <InstitutionProvider>
      <TutorProvider>
        <Outlet />
      </TutorProvider>
    </InstitutionProvider>
  );
}
