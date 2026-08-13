import { Button, Card } from '@casillego/ui';
import { usePushSubscriptionPrompt } from './usePushSubscriptionPrompt';

/**
 * Dismissible, non-blocking (ADR-066 pt.7) — "outline", never "primary": the
 * dominant coral action on this screen is each student's "¡Ya voy!" button,
 * and the design system allows only one primary per view.
 */
export function PushSubscriptionPrompt() {
  const { status, activate, dismiss } = usePushSubscriptionPrompt();

  if (status === 'hidden') {
    return null;
  }

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
            Activa las notificaciones
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>
            Te avisamos cuando otro tutor recoja a tu hijo.
          </span>
        </div>

        {status === 'error' && (
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>
            No pudimos activar las notificaciones. Intenta de nuevo.
          </span>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" size="sm" onClick={activate} disabled={status === 'activating'}>
            Activar
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            Ahora no
          </Button>
        </div>
      </div>
    </Card>
  );
}
