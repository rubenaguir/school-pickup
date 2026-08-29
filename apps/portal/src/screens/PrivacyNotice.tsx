import { Card, PrivacyNoticeContent } from '@casillego/ui';

/**
 * Pantalla pública del aviso de privacidad integral (ADR-099). Enlazada
 * desde el checkbox de `RegisterInstitutionForm` y desde el pie de los
 * shells/Perfil con `target="_blank"` — nunca dentro de `AuthenticatedLayout`,
 * ya que se abre antes de tener sesión (durante el registro).
 */
export function PrivacyNotice() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-canvas-alt)',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ maxWidth: 720, width: '100%', margin: '0 auto' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-200)' }}>CasiLlego</div>
        <h1
          style={{
            margin: '6px 0 20px',
            fontSize: 30,
            fontWeight: 800,
            color: 'var(--ink-900)',
            letterSpacing: '-.02em',
          }}
        >
          Aviso de privacidad
        </h1>
        <Card>
          <PrivacyNoticeContent />
        </Card>
      </div>
    </main>
  );
}
