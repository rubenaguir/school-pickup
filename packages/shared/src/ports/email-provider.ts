export type EmailMessage =
  | { kind: 'email_verification'; to: string; token: string; audience: 'portal' | 'parent' }
  | { kind: 'password_reset'; to: string; token: string }
  | { kind: 'institution_member_invitation'; to: string; token: string; institutionName: string }
  | {
      kind: 'student_guardian_invitation';
      to: string;
      token: string;
      studentName: string;
      inviterName: string;
    }
  | { kind: 'enrollment_approved'; to: string; studentName: string; institutionName: string }
  | { kind: 'enrollment_rejected'; to: string; studentName: string; institutionName: string }
  // Las tres transiciones de institutions.status (ADR-040 punto 4). Van a
  // cada institution_member con role = admin, de ahi que no lleven mas
  // contexto que el nombre de la institucion.
  | { kind: 'institution_approved'; to: string; institutionName: string }
  | { kind: 'institution_suspended'; to: string; institutionName: string }
  | { kind: 'institution_reactivated'; to: string; institutionName: string };

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EmailProvider');
