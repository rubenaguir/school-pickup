# Aviso de privacidad

> **Nota de origen:** primer borrador razonado por Claude a partir de
> `docs/arquitectura.md` y la estructura que exige la LFPDPPP; revisado y
> confirmado por Rubén Aguirre. No sustituye una revisión legal formal si
> el proyecto pasa a operar con instituciones reales fuera de un entorno
> de prueba/tesis.

**Última actualización:** [fecha de publicación — se llena al desplegar
la versión 1 del aviso]

**Versión:** `2026-08`

---

## 1. Versión corta (formulario de registro)

Texto junto al checkbox obligatorio, antes del botón "Crear cuenta" en
`apps/portal` (registro de institución) y `apps/parent` (registro de
tutor):

> He leído y acepto el [**aviso de privacidad**](#) de CasiLlego. Entiendo
> que se recolectan datos de mis hijos y su ubicación durante la ventana
> de recogida.

El enlace abre el aviso integral (sección 2) en un modal, sin sacar al
usuario del formulario que está llenando.

---

## 2. Aviso de privacidad integral

### Responsable del tratamiento de tus datos personales

**Rubén Aguirre**, con domicilio en Ciudad de México, México, es
responsable del tratamiento de tus datos personales conforme a la Ley
Federal de Protección de Datos Personales en Posesión de los Particulares
(LFPDPPP).

### ¿Qué datos personales recabamos?

Según el rol con el que uses CasiLlego:

**Si te registras como institución:**
- Datos de la institución: nombre, tipo, dirección, ubicación geográfica.
- Datos del administrador: nombre completo, correo electrónico,
  teléfono, contraseña (almacenada cifrada, nunca en texto plano).

**Si te registras como tutor:**
- Nombre completo, correo electrónico, teléfono (opcional), contraseña
  (cifrada).
- Datos de tus hijos que registres: nombre completo, fecha de nacimiento
  (opcional).
- Datos de los vehículos que registres en tu perfil (descripción, placa),
  si aplica.

**Durante una recogida activa (ambos roles):**
- **Tu ubicación en tiempo real**, únicamente mientras tengas una
  recogida en curso — desde que inicias el trayecto hasta que se
  confirma la entrega o cancelas. **Nunca rastreamos tu ubicación fuera
  de ese momento.**

### Datos de menores de edad

Los datos de tus hijos (nombre, fecha de nacimiento) los proporcionas tú
como su tutor o la institución donde están inscritos — CasiLlego no
recaba datos directamente de menores de edad. Al registrar a un alumno,
declaras que tienes la patria potestad o tutela legal necesaria para
proporcionar y consentir el tratamiento de esos datos en su nombre.

### ¿Para qué usamos tus datos? (finalidades)

**Finalidades necesarias para el servicio** (sin estas, no podemos
ofrecerte CasiLlego):
- Coordinar el proceso de recogida escolar entre instituciones y
  tutores.
- Verificar tu identidad y la de las personas autorizadas a recoger a
  cada alumno.
- Calcular tiempos estimados de llegada y notificar a la institución
  cuando un tutor va en camino.
- Enviarte correos transaccionales (confirmación de cuenta, aprobación
  de solicitudes, restablecimiento de contraseña).
- Enviarte notificaciones push, si las activas, para avisarte cuando otro
  tutor autorizado ya recogió a un alumno en común.

**Finalidades secundarias** (opcionales — puedes oponerte sin que afecte
el servicio):
- Ninguna por ahora. CasiLlego no envía comunicación promocional ni
  comparte datos con fines de mercadotecnia. Si esto cambia en el
  futuro, este aviso se actualizará (nueva `Versión` arriba) y se te
  pedirá aceptar la versión actualizada.

### ¿Con quién compartimos tus datos?

No vendemos ni compartimos tus datos con terceros para fines comerciales.
Sí utilizamos los siguientes proveedores de infraestructura tecnológica,
que procesan datos estrictamente como parte de operar el servicio:

- **Resend** — envío de correos transaccionales.
- **Mapbox** — cálculo de rutas y tiempos estimados de llegada.
- Infraestructura de mensajería en tiempo real para transmitir tu
  ubicación durante una recogida activa a la institución correspondiente.

Ninguno de estos proveedores usa tus datos para fines distintos a prestar
el servicio contratado con nosotros.

### ¿Cuánto tiempo conservamos tus datos?

- **Ubicación durante recogidas** (`location_updates`): se elimina
  automáticamente 90 días después de completada cada recogida, mediante
  un proceso diario. No se conserva ubicación indefinidamente.
- **Datos de cuenta e historial de recogidas**: se conservan mientras tu
  cuenta esté activa. Puedes solicitar su eliminación (ver Derechos
  ARCO).

### Derechos ARCO y cómo ejercerlos

Tienes derecho a **Acceder** a tus datos personales, **Rectificarlos**
si son inexactos, **Cancelarlos** cuando consideres que no se requieren
para las finalidades señaladas, y **Oponerte** a su tratamiento para
fines específicos. También puedes revocar tu consentimiento en cualquier
momento.

Para ejercer cualquiera de estos derechos, escríbenos a
**privacidad@casillego.com.mx**.

### Cambios a este aviso

Si modificamos este aviso de forma sustancial, se te notificará y se te
pedirá aceptar la versión actualizada antes de seguir usando CasiLlego.

---

## 3. Notas de implementación (no forman parte del texto público)

- Este documento es la fuente de verdad del contenido — ver ADR-099 para
  el mecanismo técnico (columnas nuevas en `users`, dónde se embebe el
  texto, alcance).
- `privacidad@casillego.com.mx` es un buzón nuevo por crear en el
  proveedor de correo del dominio — no confundir con
  `no-reply@mail.casillego.com.mx` (transaccional, vía Resend, sin
  revisión humana).
- Cambiar este texto en el futuro implica: actualizar este archivo,
  incrementar `Versión` arriba, y actualizar el string `PRIVACY_NOTICE_VERSION`
  en el código (ver ADR-099) — no hace falta migración de esquema.
