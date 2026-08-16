export type Surface = 'movil' | 'web';

const SURFACE_STORAGE_KEY = 'casillego.parent.surface';
const WEB_BREAKPOINT_PX = 768;

/**
 * Decide una sola vez por sesión (ADR-078 punto 4): si ya hay una elección
 * guardada en `sessionStorage` (ya sea por una decisión previa de esta
 * misma sesión, o por un cambio deliberado vía `setSurface`), se respeta —
 * un refresh de página no debe regresar a alguien de Portal web a App
 * móvil. `sessionStorage`, no `localStorage`: una apertura nueva de la PWA
 * vuelve a evaluar el ancho desde cero, no recuerda para siempre.
 */
export function resolveInitialSurface(): Surface {
  const stored = window.sessionStorage.getItem(SURFACE_STORAGE_KEY);
  if (stored === 'movil' || stored === 'web') return stored;
  const surface: Surface = window.innerWidth >= WEB_BREAKPOINT_PX ? 'web' : 'movil';
  window.sessionStorage.setItem(SURFACE_STORAGE_KEY, surface);
  return surface;
}

/** Cambio deliberado (ícono de ajustes en Inicio, enlace de vuelta en TutorShell). */
export function setSurface(surface: Surface): void {
  window.sessionStorage.setItem(SURFACE_STORAGE_KEY, surface);
}
