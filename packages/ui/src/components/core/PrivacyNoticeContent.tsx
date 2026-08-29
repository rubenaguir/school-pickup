import { PRIVACY_NOTICE_VERSION } from '@casillego/shared';

const H2_STYLE = {
  margin: '28px 0 10px',
  fontSize: 19,
  fontWeight: 800,
  color: 'var(--ink-900)',
  letterSpacing: '-.01em',
} as const;

const P_STYLE = {
  margin: '0 0 14px',
  fontSize: 15,
  color: 'var(--ink-400)',
  lineHeight: 1.6,
} as const;

const UL_STYLE = {
  margin: '0 0 14px',
  paddingLeft: 20,
  fontSize: 15,
  color: 'var(--ink-400)',
  lineHeight: 1.6,
} as const;

/**
 * Aviso de privacidad integral (ADR-099, sección 2 de `docs/aviso-privacidad.md`
 * — fuente de verdad del texto, transcrito aquí a JSX sin reescribirlo).
 * Contenido único compartido entre `apps/portal` y `apps/parent`: ambas
 * recolectan datos del mismo sistema, así que un solo texto evita que se
 * desincronicen (ADR-099 punto 2). `apps/board` no lo necesita — no registra
 * a nadie.
 */
export function PrivacyNoticeContent() {
  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      <h2 style={{ ...H2_STYLE, marginTop: 0 }}>
        Responsable del tratamiento de tus datos personales
      </h2>
      <p style={P_STYLE}>
        <b>Rubén Aguirre</b>, con domicilio en Ciudad de México, México, es responsable del
        tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos
        Personales en Posesión de los Particulares (LFPDPPP).
      </p>

      <h2 style={H2_STYLE}>¿Qué datos personales recabamos?</h2>
      <p style={P_STYLE}>Según el rol con el que uses CasiLlego:</p>
      <p style={{ ...P_STYLE, marginBottom: 6, fontWeight: 700, color: 'var(--ink-700)' }}>
        Si te registras como institución:
      </p>
      <ul style={UL_STYLE}>
        <li>Datos de la institución: nombre, tipo, dirección, ubicación geográfica.</li>
        <li>
          Datos del administrador: nombre completo, correo electrónico, teléfono, contraseña
          (almacenada cifrada, nunca en texto plano).
        </li>
      </ul>
      <p style={{ ...P_STYLE, marginBottom: 6, fontWeight: 700, color: 'var(--ink-700)' }}>
        Si te registras como tutor:
      </p>
      <ul style={UL_STYLE}>
        <li>Nombre completo, correo electrónico, teléfono (opcional), contraseña (cifrada).</li>
        <li>Datos de tus hijos que registres: nombre completo, fecha de nacimiento (opcional).</li>
        <li>Datos de los vehículos que registres en tu perfil (descripción, placa), si aplica.</li>
      </ul>
      <p style={{ ...P_STYLE, marginBottom: 6, fontWeight: 700, color: 'var(--ink-700)' }}>
        Durante una recogida activa (ambos roles):
      </p>
      <ul style={UL_STYLE}>
        <li>
          <b>Tu ubicación en tiempo real</b>, únicamente mientras tengas una recogida en curso —
          desde que inicias el trayecto hasta que se confirma la entrega o cancelas.{' '}
          <b>Nunca rastreamos tu ubicación fuera de ese momento.</b>
        </li>
      </ul>

      <h2 style={H2_STYLE}>Datos de menores de edad</h2>
      <p style={P_STYLE}>
        Los datos de tus hijos (nombre, fecha de nacimiento) los proporcionas tú como su tutor o la
        institución donde están inscritos — CasiLlego no recaba datos directamente de menores de
        edad. Al registrar a un alumno, declaras que tienes la patria potestad o tutela legal
        necesaria para proporcionar y consentir el tratamiento de esos datos en su nombre.
      </p>

      <h2 style={H2_STYLE}>¿Para qué usamos tus datos? (finalidades)</h2>
      <p style={{ ...P_STYLE, marginBottom: 6, fontWeight: 700, color: 'var(--ink-700)' }}>
        Finalidades necesarias para el servicio (sin estas, no podemos ofrecerte CasiLlego):
      </p>
      <ul style={UL_STYLE}>
        <li>Coordinar el proceso de recogida escolar entre instituciones y tutores.</li>
        <li>Verificar tu identidad y la de las personas autorizadas a recoger a cada alumno.</li>
        <li>
          Calcular tiempos estimados de llegada y notificar a la institución cuando un tutor va en
          camino.
        </li>
        <li>
          Enviarte correos transaccionales (confirmación de cuenta, aprobación de solicitudes,
          restablecimiento de contraseña).
        </li>
        <li>
          Enviarte notificaciones push, si las activas, para avisarte cuando otro tutor autorizado
          ya recogió a un alumno en común.
        </li>
      </ul>
      <p style={{ ...P_STYLE, marginBottom: 6, fontWeight: 700, color: 'var(--ink-700)' }}>
        Finalidades secundarias (opcionales — puedes oponerte sin que afecte el servicio):
      </p>
      <p style={P_STYLE}>
        Ninguna por ahora. CasiLlego no envía comunicación promocional ni comparte datos con fines
        de mercadotecnia. Si esto cambia en el futuro, este aviso se actualizará (nueva versión) y
        se te pedirá aceptar la versión actualizada.
      </p>

      <h2 style={H2_STYLE}>¿Con quién compartimos tus datos?</h2>
      <p style={P_STYLE}>
        No vendemos ni compartimos tus datos con terceros para fines comerciales. Sí utilizamos los
        siguientes proveedores de infraestructura tecnológica, que procesan datos estrictamente como
        parte de operar el servicio:
      </p>
      <ul style={UL_STYLE}>
        <li>
          <b>Resend</b> — envío de correos transaccionales.
        </li>
        <li>
          <b>Mapbox</b> — cálculo de rutas y tiempos estimados de llegada.
        </li>
        <li>
          Infraestructura de mensajería en tiempo real para transmitir tu ubicación durante una
          recogida activa a la institución correspondiente.
        </li>
      </ul>
      <p style={P_STYLE}>
        Ninguno de estos proveedores usa tus datos para fines distintos a prestar el servicio
        contratado con nosotros.
      </p>

      <h2 style={H2_STYLE}>¿Cuánto tiempo conservamos tus datos?</h2>
      <ul style={UL_STYLE}>
        <li>
          <b>Ubicación durante recogidas</b> (<code>location_updates</code>): se elimina
          automáticamente 90 días después de completada cada recogida, mediante un proceso diario.
          No se conserva ubicación indefinidamente.
        </li>
        <li>
          <b>Datos de cuenta e historial de recogidas</b>: se conservan mientras tu cuenta esté
          activa. Puedes solicitar su eliminación (ver Derechos ARCO).
        </li>
      </ul>

      <h2 style={H2_STYLE}>Derechos ARCO y cómo ejercerlos</h2>
      <p style={P_STYLE}>
        Tienes derecho a <b>Acceder</b> a tus datos personales, <b>Rectificarlos</b> si son
        inexactos, <b>Cancelarlos</b> cuando consideres que no se requieren para las finalidades
        señaladas, y <b>Oponerte</b> a su tratamiento para fines específicos. También puedes revocar
        tu consentimiento en cualquier momento.
      </p>
      <p style={P_STYLE}>
        Para ejercer cualquiera de estos derechos, escríbenos a <b>privacidad@casillego.com.mx</b>.
      </p>

      <h2 style={H2_STYLE}>Cambios a este aviso</h2>
      <p style={P_STYLE}>
        Si modificamos este aviso de forma sustancial, se te notificará y se te pedirá aceptar la
        versión actualizada antes de seguir usando CasiLlego.
      </p>

      <p
        style={{
          margin: '24px 0 0',
          paddingTop: 16,
          borderTop: '1px solid var(--border-hairline)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-2xs)',
          color: 'var(--ink-300)',
        }}
      >
        Versión vigente: {PRIVACY_NOTICE_VERSION}
      </p>
    </div>
  );
}
