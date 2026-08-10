import type { InstitutionMemberRole, UserStatus } from '@casillego/shared';
import type { InstitutionMemberRow } from './useInstitutionMembers';
import type { InviteOutcome } from './personnel-rules';

/**
 * The API speaks English enums; every visible string in the portal is Spanish
 * (.claude/rules/design-system.md). Same shape as `institution-labels.ts`.
 */

/**
 * The four values of `institution_members.role`
 * (specs/entities/institution_member.md), in the order the selector offers
 * them. Mirrors the DTO enum of `apps/api` and nothing else — no extra value is
 * invented here.
 */
export const INSTITUTION_MEMBER_ROLES: readonly InstitutionMemberRole[] = [
  'admin',
  'coordinator',
  'teacher',
  'gate_operator',
];

/**
 * What each role can do, shown under the role selector of the invitation form.
 * Descriptive, not normative: the authority is ADR-011 and ADR-022 point 1.
 */
const ROLE_HINTS: Record<InstitutionMemberRole, string> = {
  admin: 'Gestiona personal, configuración y aprobaciones.',
  coordinator: 'Opera la salida diaria, sin acceso a la configuración.',
  teacher: 'Opera la salida diaria, sin acceso a la configuración.',
  gate_operator: 'Trabaja en la consola de puerta de un punto de entrega.',
};

/**
 * The state shown in the personnel list. Derived from `users.status`:
 * `institution_members` has no `status` column of its own (feature 012,
 * "Postcondiciones").
 */
const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Activo',
  invited: 'Invitado',
  suspended: 'Suspendido',
};

export function roleHint(role: InstitutionMemberRole): string {
  return ROLE_HINTS[role];
}

export function userStatusLabel(status: UserStatus): string {
  return USER_STATUS_LABELS[status];
}

/**
 * How a member reads on screen. `fullName` is null until an invited person
 * accepts (ADR-030), and the email is the only thing that identifies them
 * meanwhile.
 */
export function memberDisplayName(member: InstitutionMemberRow): string {
  return member.fullName ?? member.email;
}

/**
 * What to tell the admin after a successful invitation. The three branches of
 * the endpoint end differently for the person invited, so they cannot share one
 * message: only one of them actually sent an email, and only one of them means
 * "puede entrar ya" (feature 012, casos (a) y (b) y reenvío).
 */
export function inviteOutcomeMessage(outcome: InviteOutcome, email: string): string {
  if (outcome === 'added-active') {
    return `${email} ya tenía cuenta en CasiLlego y se agregó al personal de inmediato. Puede entrar con sus credenciales de siempre; no se envió ningún correo.`;
  }
  if (outcome === 'resent') {
    return `Reenviamos la invitación a ${email}. Seguirá como "Invitado" hasta que acepte y defina su contraseña.`;
  }
  return `Enviamos la invitación a ${email}. Aparecerá como "Invitado" hasta que acepte y defina su contraseña.`;
}
