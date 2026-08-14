import { Button, Card } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

/**
 * Placeholder landing for the protected area — proves session + institution
 * resolution end to end. The real "llegadas de aeropuerto" board (feed,
 * TTS voceo) lands in a future session.
 */
export function Home() {
  const { session, logout } = useAuth();
  const { current } = useInstitution();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Card style={{ width: 420, maxWidth: '100%' }} padding={32}>
        <span style={EYEBROW_STYLE}>Tablero</span>
        <h1
          style={{
            margin: '6px 0 4px',
            fontSize: 'var(--text-display-sm)',
            fontWeight: 800,
            color: 'var(--ink-900)',
            letterSpacing: '-.02em',
          }}
        >
          {current?.institutionName ?? 'Institución'}
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-400)' }}>
          Sesión de {session?.email}. El listado de recogidas llega en una próxima sesión.
        </p>
        <Button variant="outline" onClick={logout}>
          Cerrar sesión
        </Button>
      </Card>
    </main>
  );
}
