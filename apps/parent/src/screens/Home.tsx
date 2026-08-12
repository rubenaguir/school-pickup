import { Button, Card } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';

/**
 * Placeholder for the protected root — no business screen exists yet ("Mis
 * hijos", seguimiento, etc. land in the next session, ADR-063).
 */
export function Home() {
  const { session, logout } = useAuth();

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
      <Card style={{ width: 380, maxWidth: '100%' }}>
        <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--ink-400)' }}>Sesión activa</p>
        <p style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
          {session?.email}
        </p>
        <Button variant="outline" onClick={logout}>
          Cerrar sesión
        </Button>
      </Card>
    </main>
  );
}
