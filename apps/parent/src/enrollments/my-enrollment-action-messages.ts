/**
 * Same convention as `../portal-web/associate-error-messages.ts`. Codes taken
 * from `apps/api/src/enrollments/enrollments.service.ts`
 * (`DELETE /enrollments/:id`, `PATCH /enrollments/:id/withdraw`, ADR-088).
 */
const ACTION_MESSAGES: Record<string, string> = {
  ENROLLMENT_NOT_OWNED: 'Esta solicitud ya no es tuya.',
  ENROLLMENT_NOT_PENDING: 'Esta solicitud ya fue resuelta.',
  ENROLLMENT_NOT_APPROVED: 'Esta asociación ya no está aprobada.',
  ENROLLMENT_WITHDRAW_FORBIDDEN: 'No puedes dar de baja esta asociación.',
  RESOURCE_NOT_FOUND: 'Esta solicitud ya no existe.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

const FALLBACK = 'Error desconocido';

export function myEnrollmentActionErrorMessage(code: string): string {
  return ACTION_MESSAGES[code] ?? FALLBACK;
}
