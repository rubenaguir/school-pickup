import { EmptyState } from '@casillego/ui';

const ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.8 2.8-2-2 2.8-2.8z" />
  </svg>
);

/**
 * Contenido de las 3 rutas del Portal web sin pantalla real todavía
 * (Asociar institución / Tutores autorizados / Perfil, ADR-078 punto 3) —
 * mismo criterio que ADR-056 punto 7 usó para dejar una ruta con
 * placeholder simple, con `EmptyState` en vez de una pantalla en blanco.
 */
export function TutorPlaceholder({ description }: { description: string }) {
  return <EmptyState icon={ICON} title="Próximamente" description={description} />;
}
