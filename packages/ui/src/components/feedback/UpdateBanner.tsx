import { Button } from '../core/Button';

export interface UpdateBannerProps {
  /** Override only for app-specific phrasing; the default is the standard copy. */
  message?: string;
  actionLabel?: string;
  onUpdate: () => void;
}

/**
 * Fixed top-of-viewport notice that a newer deploy is available (ADR-094).
 * Anchored to the top on purpose: `apps/parent`'s tracking screen owns the
 * bottom edge with its fixed "¡Ya llegué!" bar (ADR-092).
 *
 * Navy bar, one coral action — the coral lives only on the button, so the
 * banner still respects "one dominant coral element per screen".
 */
export function UpdateBanner({
  message = 'Hay una nueva versión disponible',
  actionLabel = 'Actualizar ahora',
  onUpdate,
}: UpdateBannerProps) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 0,
        zIndex: 900,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        padding:
          'calc(var(--space-4) + env(safe-area-inset-top, 0px)) var(--space-6) var(--space-4)',
        background: 'var(--ink-900)',
        color: '#fff',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-base)',
        fontWeight: 600,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <span>{message}</span>
      <Button variant="primary" size="sm" onClick={onUpdate}>
        {actionLabel}
      </Button>
    </div>
  );
}
