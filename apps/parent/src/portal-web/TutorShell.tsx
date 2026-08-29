import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { NavItem, pinMarkUrl } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { setSurface } from '../surface/surface';
import {
  HOME_PATH,
  TUTOR_PORTAL_ASSOCIATE_PATH,
  TUTOR_PORTAL_GUARDIANS_PATH,
  TUTOR_PORTAL_PROFILE_PATH,
  TUTOR_PORTAL_STUDENTS_PATH,
} from '../routes/paths';
import { Icon, type IconName } from './icons';

interface NavEntry {
  path: string;
  label: string;
  icon: IconName;
}

const NAV: readonly NavEntry[] = [
  { path: TUTOR_PORTAL_STUDENTS_PATH, label: 'Mis hijos', icon: 'kid' },
  { path: TUTOR_PORTAL_ASSOCIATE_PATH, label: 'Asociar institución', icon: 'link' },
  { path: TUTOR_PORTAL_GUARDIANS_PATH, label: 'Tutores autorizados', icon: 'shield' },
  { path: TUTOR_PORTAL_PROFILE_PATH, label: 'Perfil', icon: 'user' },
];

// No hay `useProfile` en apps/parent (ADR-078 punto 3 solo reutiliza
// useMyStudents/useMyEnrollments) — el único dato de cuenta disponible es el
// email del JWT, a diferencia de InstitutionShell que sí tiene `fullName`.
function initialsOf(email: string): string {
  const local = email.split('@')[0] ?? '';
  return (local.slice(0, 2) || '·').toUpperCase();
}

const SHELL_STYLE = `
.tutor-shell-topbar { display: none; }
@media (max-width: 767px) {
  .tutor-shell-sidebar { display: none !important; }
  .tutor-shell-sidebar.tutor-shell-sidebar-open {
    display: flex !important;
    position: fixed;
    inset: 0;
    z-index: 30;
    width: 100% !important;
    height: 100vh;
    overflow: auto;
  }
  .tutor-shell-topbar { display: flex !important; }
}
`;

/**
 * Sidebar + header shell de la superficie "Portal web" de tutor (ADR-078
 * punto 3), calco de `InstitutionShell`/`OpsShell` en apps/portal (250px,
 * `var(--ink-900)`, mismo patrón de ítem activo) con las adaptaciones del
 * kit real: eyebrow "Tutor" + "Cuenta familiar" en vez del nombre de una
 * institución, y "App móvil" como ítem más de la lista de navegación
 * (ADR-098), no en el pie.
 *
 * Primera pieza responsive del proyecto (ADR-078 punto 3): por debajo de
 * 768px la sidebar se oculta y aparece una barra superior compacta con un
 * botón de menú que despliega los mismos ítems como panel de pantalla
 * completa — decisión de implementación simple sobre elegante, sin
 * precedente que copiar.
 */
export function TutorShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeEntry = NAV.find((entry) => location.pathname.startsWith(entry.path)) ?? NAV[0];
  const displayName = session?.email ?? '';

  function goTo(path: string) {
    setMenuOpen(false);
    void navigate(path);
  }

  function backToMobile() {
    setSurface('movil');
    setMenuOpen(false);
    void navigate(HOME_PATH);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
      <style>{SHELL_STYLE}</style>

      <aside
        className={`tutor-shell-sidebar${menuOpen ? ' tutor-shell-sidebar-open' : ''}`}
        style={{
          width: 250,
          flexShrink: 0,
          background: 'var(--ink-900)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {menuOpen && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px 0' }}>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Cerrar menú"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                padding: 6,
                display: 'inline-flex',
              }}
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        )}

        <div style={{ padding: '24px 22px 18px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src={pinMarkUrl} width={28} height={32} alt="" />
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
            Tutor
          </div>
          <div
            style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginTop: 3 }}
          >
            Cuenta familiar
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
              onClick={() => goTo(entry.path)}
            />
          ))}
          {/* "App móvil" no es una ruta de este shell (llama a setSurface y
              navega fuera), por eso vive tras el .map() y nunca lleva estado
              activo — pero como ítem normal de la lista, no en el pie (ADR-098). */}
          <NavItem icon={<Icon name="mobile" />} label="App móvil" onClick={backToMobile} />
        </nav>

        <div
          style={{
            padding: '14px 18px 16px',
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
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Tutor</span>
            </span>
          </div>
          <span
            onClick={logout}
            style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', cursor: 'pointer' }}
          >
            Cerrar sesión
          </span>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          className="tutor-shell-topbar"
          style={{
            height: 56,
            flexShrink: 0,
            background: 'var(--ink-900)',
            color: '#fff',
            alignItems: 'center',
            padding: '0 16px',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              padding: 6,
              cursor: 'pointer',
              display: 'inline-flex',
            }}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 800 }}>
            Casi<span style={{ color: 'var(--brand)' }}>Llego</span>
          </span>
        </div>

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
          {/* Sin botón "Agregar alumno" del kit en esta topbar: la acción
              vive dentro de `PortalStudents.tsx` (ADR-082 punto 4), no aquí. */}
          <span style={{ fontSize: 14, color: 'var(--ink-200)', fontWeight: 500 }}>
            Tutor <span style={{ color: 'var(--ink-50)' }}>/</span>{' '}
            <span style={{ color: 'var(--ink-900)', fontWeight: 700 }}>{activeEntry.label}</span>
          </span>
        </header>

        <main
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'var(--surface-sunken)',
            padding: '26px 28px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
