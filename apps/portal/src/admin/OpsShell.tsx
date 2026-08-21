import { Outlet, useLocation, useNavigate } from 'react-router';
import { NavItem, pinMarkUrl } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useProfile } from '../profile/useProfile';
import { Icon, type IconName } from '../institution/icons';
import { useAdminMetrics } from './useAdminMetrics';
import { ADMIN_INSTITUTIONS_PATH, ADMIN_METRICS_PATH, PROFILE_PATH } from '../routes/paths';

interface NavEntry {
  path: string;
  label: string;
  icon: IconName;
}

/** 2 items (ADR-074 point 1) — not the kit's 4: "Usuarios"/"Configuración" are deferred indefinitely, not shown even disabled. */
const NAV: readonly NavEntry[] = [
  { path: ADMIN_METRICS_PATH, label: 'Resumen', icon: 'grid' },
  { path: ADMIN_INSTITUTIONS_PATH, label: 'Instituciones', icon: 'building' },
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
 * Sidebar + header shell of the Operador/OPS role (ADR-074) — same pattern as
 * `InstitutionShell` (ADR-072). Mounted as a React Router layout inside
 * `SuperAdminRoute`, which already guarantees `isSuperAdmin` by the time this
 * renders.
 *
 * Lifts `useAdminMetrics` here (the "Instituciones" nav counter needs
 * `institutionsByStatus.pending`, the same field `GlobalMetrics` renders) and
 * hands the whole hook value down through `<Outlet context>` so
 * `GlobalMetrics` reads it instead of issuing a second GET — same treatment
 * as `usePendingEnrollments` in `InstitutionShell` (ADR-072 §3).
 */
export function OpsShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout } = useAuth();
  const { profile } = useProfile();
  const adminMetrics = useAdminMetrics();

  const activeEntry = NAV.find((entry) => location.pathname.startsWith(entry.path)) ?? NAV[0];
  const pendingCount =
    adminMetrics.status === 'ready' ? (adminMetrics.metrics?.institutionsByStatus.pending ?? 0) : 0;

  const displayName = profile?.fullName ?? session?.email ?? '';

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
          <img src={pinMarkUrl} width={28} height={32} alt="" />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em' }}>
            Casi<span style={{ color: 'var(--brand)' }}>Llego</span>
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '.08em',
              color: 'var(--brand)',
              background: 'rgba(251,106,69,.16)',
              padding: '3px 7px',
              borderRadius: 6,
            }}
          >
            OPS
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
            Operador
          </div>
          <div
            style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginTop: 3 }}
          >
            Consola global
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
                entry.path === ADMIN_INSTITUTIONS_PATH && pendingCount > 0
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
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
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
            <span
              style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}
            >
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
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
                Operador CasiLlego
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span
              onClick={() => void navigate(PROFILE_PATH)}
              style={{ color: 'rgba(255,255,255,.5)', cursor: 'pointer' }}
            >
              Perfil
            </span>
            <span style={{ color: 'rgba(255,255,255,.3)' }}>·</span>
            <span onClick={logout} style={{ color: 'rgba(255,255,255,.5)', cursor: 'pointer' }}>
              Cerrar sesión
            </span>
          </div>
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
          {/* No search box (ADR-074 point 1, same criterion as ADR-072 point 1): nothing it would search exists yet. */}
          <span style={{ fontSize: 14, color: 'var(--ink-200)', fontWeight: 500 }}>
            Operador <span style={{ color: 'var(--ink-50)' }}>/</span>{' '}
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
          <Outlet context={adminMetrics} />
        </main>
      </div>
    </div>
  );
}
