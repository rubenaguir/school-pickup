import { Button } from '@casillego/ui';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_INSTITUTIONS_PATH, ADMIN_METRICS_PATH } from '../routes/paths';

/**
 * Nav shared by the two super-admin screens. Deliberately not the sidebar
 * `NavItem` pattern of the six institution screens: this context has no
 * institution to show in a header, and only two destinations (feature 025 §
 * "Navegación entre las dos").
 */
export function AdminNav({ active }: { active: 'institutions' | 'metrics' }) {
  const navigate = useNavigate();
  const { session, logout } = useAuth();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant={active === 'institutions' ? 'subtle' : 'outline'}
          size="sm"
          onClick={() => void navigate(ADMIN_INSTITUTIONS_PATH)}
        >
          Aprobación de instituciones
        </Button>
        <Button
          variant={active === 'metrics' ? 'subtle' : 'outline'}
          size="sm"
          onClick={() => void navigate(ADMIN_METRICS_PATH)}
        >
          Métricas globales
        </Button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>Sesión de {session?.email}</span>
        <Button variant="outline" size="sm" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
