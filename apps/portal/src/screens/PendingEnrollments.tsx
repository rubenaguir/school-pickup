import { Badge, Button, Card } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';

/**
 * Placeholder. The real approval inbox (feature 006) replaces this body in the
 * next slice; it exists now so the plumbing of this layer is verifiable end to
 * end — session resolved, institution resolved.
 */
export function PendingEnrollments() {
  const { session, logout } = useAuth();
  const { current, memberships } = useInstitution();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        padding: 'var(--space-10)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 'var(--text-2xs)',
                  letterSpacing: 'var(--tracking-eyebrow)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--ink-200)',
                }}
              >
                Aprobaciones
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--text-display-sm)',
                  fontWeight: 800,
                  color: 'var(--ink-900)',
                  letterSpacing: '-.02em',
                }}
              >
                {current?.institutionName ?? 'Institución'}
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                Sesión de {session?.email}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              Cerrar sesión
            </Button>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Badge tone="brand">{current?.role}</Badge>
              <Badge tone="neutral">{current?.institutionStatus}</Badge>
              {memberships.length > 1 && (
                <Badge tone="neutral">{memberships.length} membresías</Badge>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
              La bandeja de aprobación de alumnos se construye en el siguiente cambio. Esta pantalla
              solo confirma que la sesión y la institución ya se resuelven de punta a punta.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
