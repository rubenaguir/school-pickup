import type { EmailMessage } from '@casillego/shared';

export interface RenderedEmail {
  subject: string;
  html: string;
}

function wrapHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <body style="font-family: sans-serif; color: #1a1a1a; line-height: 1.5;">
    <h1 style="font-size: 1.25rem;">CasiLlego</h1>
    ${bodyHtml}
  </body>
</html>`;
}

function buildLink(baseUrl: string, path: string, token: string): string {
  return `${baseUrl}${path}?token=${encodeURIComponent(token)}`;
}

export function buildEmailTemplate(message: EmailMessage): RenderedEmail {
  switch (message.kind) {
    case 'email_verification': {
      const link = buildLink(process.env.PARENT_APP_URL ?? '', '/verificar-correo', message.token);
      return {
        subject: 'Confirma tu correo para activar tu cuenta en CasiLlego',
        html: wrapHtml(`
          <p>Gracias por registrarte en CasiLlego. Para activar tu cuenta, confirma tu correo:</p>
          <p><a href="${link}">Confirmar mi correo</a></p>
          <p>Este enlace es válido durante 24 horas. Si tú no creaste esta cuenta, puedes ignorar este mensaje.</p>
        `),
      };
    }
    case 'password_reset': {
      const link = buildLink(
        process.env.PARENT_APP_URL ?? '',
        '/restablecer-contrasena',
        message.token,
      );
      return {
        subject: 'Restablece tu contraseña de CasiLlego',
        html: wrapHtml(`
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Puedes hacerlo aquí:</p>
          <p><a href="${link}">Restablecer mi contraseña</a></p>
          <p>Si tú no solicitaste este cambio, puedes ignorar este mensaje: tu contraseña seguirá siendo la misma.</p>
        `),
      };
    }
    case 'institution_member_invitation': {
      const link = buildLink(
        process.env.PORTAL_APP_URL ?? '',
        '/aceptar-invitacion',
        message.token,
      );
      return {
        subject: `Te invitaron a unirte al personal de ${message.institutionName} en CasiLlego`,
        html: wrapHtml(`
          <p>Te invitaron a formar parte del personal de <strong>${message.institutionName}</strong> en CasiLlego.</p>
          <p><a href="${link}">Aceptar invitación</a></p>
          <p>Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
        `),
      };
    }
    case 'student_guardian_invitation': {
      const link = buildLink(
        process.env.PARENT_APP_URL ?? '',
        '/aceptar-invitacion',
        message.token,
      );
      return {
        subject: `${message.inviterName} te invitó a ser tutor autorizado de ${message.studentName} en CasiLlego`,
        html: wrapHtml(`
          <p><strong>${message.inviterName}</strong> te invitó a ser tutor autorizado de <strong>${message.studentName}</strong> en CasiLlego, para que puedas avisar cuando vas en camino a recogerlo.</p>
          <p><a href="${link}">Aceptar invitación</a></p>
          <p>Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
        `),
      };
    }
    case 'enrollment_approved': {
      return {
        subject: `La solicitud de ${message.studentName} en ${message.institutionName} fue aceptada`,
        html: wrapHtml(`
          <p>Buenas noticias: la solicitud de <strong>${message.studentName}</strong> en <strong>${message.institutionName}</strong> fue aceptada.</p>
          <p>Ya puedes avisar desde la app cuando vayas en camino a recogerlo.</p>
        `),
      };
    }
    case 'enrollment_rejected': {
      return {
        subject: `Actualización sobre la solicitud de ${message.studentName} en ${message.institutionName}`,
        html: wrapHtml(`
          <p>Te escribimos para informarte que la solicitud de <strong>${message.studentName}</strong> en <strong>${message.institutionName}</strong> no fue aprobada en esta ocasión.</p>
          <p>Si tienes dudas, te sugerimos ponerte en contacto directamente con la institución.</p>
        `),
      };
    }
    case 'institution_approved': {
      return {
        subject: `${message.institutionName} ya está aprobada en CasiLlego`,
        html: wrapHtml(`
          <p>La institución <strong>${message.institutionName}</strong> ya está aprobada en CasiLlego.</p>
          <p>Desde ahora puedes completar su perfil, dar de alta al personal y empezar a recibir solicitudes de asociación de los tutores.</p>
        `),
      };
    }
    case 'institution_suspended': {
      return {
        subject: `${message.institutionName} quedó suspendida en CasiLlego`,
        html: wrapHtml(`
          <p>La institución <strong>${message.institutionName}</strong> quedó suspendida en CasiLlego.</p>
          <p>Mientras dure la suspensión no se pueden aprobar solicitudes nuevas ni editar el perfil. Si crees que se trata de un error, responde a este correo.</p>
        `),
      };
    }
    case 'institution_reactivated': {
      return {
        subject: `${message.institutionName} vuelve a estar activa en CasiLlego`,
        html: wrapHtml(`
          <p>Levantamos la suspensión de <strong>${message.institutionName}</strong>: la institución vuelve a estar activa en CasiLlego.</p>
          <p>Su operación continúa donde se quedó, sin ningún cambio en los datos.</p>
        `),
      };
    }
    default: {
      const exhaustiveCheck: never = message;
      throw new Error(`Unhandled EmailMessage kind: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
