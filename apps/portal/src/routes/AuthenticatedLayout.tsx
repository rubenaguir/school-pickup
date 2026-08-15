import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { EmptyState, ErrorState, SegmentedTabs, SkeletonRow } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { InstitutionProvider, useInstitution } from '../institution/InstitutionContext';
import { TutorProvider, useTutor } from '../tutor/TutorContext';
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
 * Gates on the institution lookup, not on authentication: by the time this
 * renders there is already a session. Zero memberships is an explanatory empty
 * state, never an error (ADR-042 point 5).
 *
 * Nested only under the institution routes, not under `AuthenticatedLayout`
 * itself — the tutor view has no institution membership to wait for and must
 * not be blocked by this (ADR-056 point 3).
 */
export function InstitutionGate() {
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

const INSTITUTION_LABEL = 'Institución';
const TUTOR_LABEL = 'Tutor';

/**
 * Switches between the institution view and the tutor view, only shown when
 * there genuinely are two to switch between (ADR-056 point 4). Navigates
 * client-side to each view's landing route rather than gating routes — every
 * route stays reachable directly by URL regardless of this control.
 *
 * The active tab is derived from the URL rather than kept as separate state,
 * so it stays correct through direct navigation or the browser's back button,
 * not only through clicks on the switcher itself.
 */
function ModeSwitcher() {
  const institution = useInstitution();
  const tutor = useTutor();
  const location = useLocation();
  const navigate = useNavigate();

  const canSwitch =
    institution.status === 'ready' && (tutor.status === 'ready' || tutor.status === 'empty');

  if (!canSwitch) {
    return null;
  }

  const activeLabel = location.pathname.startsWith(STUDENTS_PATH) ? TUTOR_LABEL : INSTITUTION_LABEL;

  return (
    // `position: fixed` rather than a normal flow element: the institution
    // side now renders `InstitutionShell`, a full-viewport (minHeight: 100vh)
    // sidebar layout (ADR-072). A switcher in flow above it added its own
    // height on top of that 100vh, pushing the sidebar below the fold instead
    // of anchoring it to the top of the viewport. Floating it removes it from
    // flow entirely. Anchored top-right rather than top-center: centered, it
    // overlapped the top of the tutor screens' centered card (both share the
    // same horizontal middle of the viewport) — the top-right corner is empty
    // in both layouts (InstitutionShell's header has no right-side content by
    // design, ADR-072 point 1; the tutor cards are centered with margin to
    // spare on either side).
    <div
      style={{
        position: 'fixed',
        top: 'var(--space-6)',
        right: 'var(--space-6)',
        zIndex: 40,
      }}
    >
      <SegmentedTabs
        options={[INSTITUTION_LABEL, TUTOR_LABEL]}
        value={activeLabel}
        onChange={(next) => void navigate(next === TUTOR_LABEL ? STUDENTS_PATH : HOME_PATH)}
      />
    </div>
  );
}

/**
 * Everything outside /login requires a session (ADR-042 point 1). Mounts
 * `InstitutionProvider` and `TutorProvider` together and in parallel: neither
 * view depends on the other resolving first (ADR-056 point 3). `SuperAdminRoute`
 * is a separate tree with neither provider (ADR-055 point 2).
 */
export function AuthenticatedLayout() {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <InstitutionProvider>
      <TutorProvider>
        <ModeSwitcher />
        <Outlet />
      </TutorProvider>
    </InstitutionProvider>
  );
}
