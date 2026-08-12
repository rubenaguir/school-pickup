import { useParams } from 'react-router';
import { Card } from '@casillego/ui';

/**
 * Placeholder for the tracking screen (docs/design-brief.md, "App del
 * padre") — reached after creating a pickup request in `SelectInstitution`.
 * Only the route exists so navigation doesn't 404; its real content (map,
 * ETA, Wake Lock, "Ya llegué"/Cancelar) lands in a future session.
 */
export function Tracking() {
  const { pickupRequestId } = useParams<{ pickupRequestId: string }>();

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
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-400)' }}>
          Seguimiento — próximamente. Recogida {pickupRequestId}.
        </p>
      </Card>
    </main>
  );
}
