import { Outlet, useLocation, useNavigate } from 'react-router';
import { NavItem } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useProfile } from '../profile/useProfile';
import { usePendingEnrollments } from '../enrollments/usePendingEnrollments';
import { roleLabel } from './institution-labels';
import { useInstitution } from './InstitutionContext';
import { Icon, type IconName } from './icons';
import {
  DASHBOARD_PATH,
  DELIVERY_POINTS_PATH,
  DISMISSAL_SCHEDULE_PATH,
  INSTITUTION_PROFILE_PATH,
  PENDING_ENROLLMENTS_PATH,
  PERSONNEL_PATH,
  REPORTS_PATH,
} from '../routes/paths';

interface NavEntry {
  path: string;
  label: string;
  icon: IconName;
}

/** 7 items (ADR-072 point 2) — not the kit's 6: "Puntos de entrega" keeps its own screen. */
const NAV: readonly NavEntry[] = [
  { path: DASHBOARD_PATH, label: 'Dashboard', icon: 'grid' },
  { path: PENDING_ENROLLMENTS_PATH, label: 'Aprobaciones', icon: 'inbox' },
  { path: INSTITUTION_PROFILE_PATH, label: 'Institución', icon: 'school' },
  { path: DELIVERY_POINTS_PATH, label: 'Puntos de entrega', icon: 'pin' },
  { path: DISMISSAL_SCHEDULE_PATH, label: 'Horarios', icon: 'clock' },
  { path: PERSONNEL_PATH, label: 'Personal', icon: 'users' },
  { path: REPORTS_PATH, label: 'Reportes', icon: 'chart' },
];

function initialsOf(name: string): string {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return initials || '·';
}

/**
 * Sidebar + header shell of the Institución role (ADR-072). Mounted as a
 * React Router layout inside `InstitutionGate`, which already guarantees a
 * resolved `institutionId` by the time this renders — the sidebar never has
 * to show its own loading/error state.
 *
 * Lifts `usePendingEnrollments` here (for the "Aprobaciones" nav counter) and
 * hands the whole hook value down through `<Outlet context>` so
 * `PendingEnrollments` reads it instead of issuing a second GET
 * (ADR-072 prompt §3).
 */
export function InstitutionShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { current, institutionId } = useInstitution();
  const { session } = useAuth();
  const { profile } = useProfile();
  const pendingEnrollments = usePendingEnrollments(institutionId);

  const activeEntry = NAV.find((entry) => location.pathname.startsWith(entry.path)) ?? NAV[0];
  const pendingCount =
    pendingEnrollments.status === 'ready' ? pendingEnrollments.enrollments.length : 0;

  const displayName = profile?.fullName ?? session?.email ?? '';
  const roleText = current ? roleLabel(current.role) : '';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
      <aside
        style={{
          width: 250,
          flexShrink: 0,
          background: 'var(--ink-900)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px 22px 18px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/pin-mark.svg" width={28} height={32} alt="" />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em' }}>
            Casi<span style={{ color: 'var(--brand)' }}>Llego</span>
          </span>
        </div>

        <div style={{ padding: '0 22px 16px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.4)',
            }}
          >
            Institución
          </div>
          <div
            style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginTop: 3 }}
          >
            {current?.institutionName ?? 'Cargando…'}
          </div>
        </div>

        <nav
          style={{ flex: 1, padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          {NAV.map((entry) => (
            <NavItem
              key={entry.path}
              icon={<Icon name={entry.icon} />}
              label={entry.label}
              active={entry.path === activeEntry.path}
              count={
                entry.path === PENDING_ENROLLMENTS_PATH && pendingCount > 0
                  ? pendingCount
                  : undefined
              }
              onClick={() => void navigate(entry.path)}
            />
          ))}
        </nav>

        <div
          style={{
            padding: '16px 18px',
            borderTop: '1px solid rgba(255,255,255,.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 11,
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,.12)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initialsOf(displayName)}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{roleText}</span>
          </span>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            height: 68,
            flexShrink: 0,
            background: '#fff',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 28px',
          }}
        >
          {/* No search box (ADR-072 point 1): nothing it would search exists yet. */}
          <span style={{ fontSize: 14, color: 'var(--ink-200)', fontWeight: 500 }}>
            Institución <span style={{ color: 'var(--ink-50)' }}>/</span>{' '}
            <span style={{ color: 'var(--ink-900)', fontWeight: 700 }}>{activeEntry.label}</span>
          </span>
        </header>

        <main
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'var(--surface-sunken)',
            padding: '26px 28px',
          }}
        >
          <Outlet context={pendingEnrollments} />
        </main>
      </div>
    </div>
  );
}
