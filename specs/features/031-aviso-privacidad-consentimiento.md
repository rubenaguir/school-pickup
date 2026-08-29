# Feature 031 — Aviso de privacidad y consentimiento explícito en registro

## Propósito

Registra el consentimiento explícito del usuario al aviso de privacidad
(`docs/aviso-privacidad.md`) en el momento del registro, tanto de
institución (`POST /auth/register/institution`) como de tutor
(`POST /auth/register/guardian`). `docs/arquitectura.md` ya declaraba
esto como principio de diseño obligatorio (datos de menores + ubicación,
LFPDPPP) desde el inicio del proyecto, pero nunca se implementó — gap
encontrado en la auditoría exhaustiva de Fase 10.

Aplica **solo a registros nuevos de aquí en adelante** — decisión de
producto explícita, confirmada con el humano: no hay ningún mecanismo
retroactivo (bloqueante ni de recordatorio) para cuentas ya existentes.

## Entidades involucradas

- `users` (`privacy_accepted_at`, `privacy_notice_version` — ver ADR-099)

## Precondiciones

- El usuario está llenando el formulario de registro (institución o
  tutor) y marcó el checkbox obligatorio de aceptación.

## Postcondiciones

- `users.privacy_accepted_at = now()` y
  `users.privacy_notice_version = PRIVACY_NOTICE_VERSION` (constante del
  código, valor inicial `"2026-08"`, ver `docs/aviso-privacidad.md`) se
  escriben en el mismo `INSERT`/`UPDATE` que crea o reutiliza el `users`
  del registro — nunca una escritura separada.
- Caso de **reutilización de cuenta existente** (ADR-028 punto 2, registro
  de institución): ambos campos se actualizan sobre el `users` existente
  también, sin importar si ya tenían valor — es un evento de
  consentimiento genuino ocurriendo en este envío, no se omite por
  reutilización.
- No se toca ningún `users` fuera de un envío de registro — en particular,
  no hay ninguna tarea, migración de datos ni pantalla que le pida esto a
  una cuenta que ya existía antes de este feature.

## Casos Given/When/Then

### Caso de éxito: registro de tutor

```
Given un formulario de registro de tutor válido
  And el checkbox de aviso de privacidad está marcado
When se envía POST /auth/register/guardian con acceptedPrivacyNotice: true
Then se crea el users con privacy_accepted_at = now() y privacy_notice_version fijados
  And el resto del flujo de registro (feature 002) no cambia
```

### Caso de éxito: registro de institución, cuenta nueva

```
Given un formulario de registro de institución válido
  And el checkbox de aviso de privacidad está marcado
When se envía POST /auth/register/institution con admin.acceptedPrivacyNotice: true
Then se crea el users administrador con privacy_accepted_at y privacy_notice_version fijados
  And el resto del flujo de registro (feature 001) no cambia
```

### Caso de éxito: registro de institución, reutilización de cuenta (ADR-028 punto 2)

```
Given admin.email ya existe en users con la misma contraseña
  And el checkbox de aviso de privacidad está marcado
When se envía POST /auth/register/institution
Then se reutiliza el users existente (comportamiento ya definido en feature 001)
  And privacy_accepted_at/privacy_notice_version se actualizan sobre ese users, aunque ya tuvieran valor
```

### Caso: checkbox no marcado

```
Given un formulario de registro (institución o tutor)
  And el checkbox de aviso de privacidad NO está marcado
When se intenta enviar
Then el frontend bloquea el envío (atributo required del checkbox)
  And si de todos modos llega al backend sin acceptedPrivacyNotice: true, responde 400 INVALID_PAYLOAD
```

### Caso: cuenta creada antes de este feature

```
Given un users creado antes de ADR-099 (privacy_accepted_at = NULL)
When ese usuario inicia sesión o usa la app normalmente
Then no ocurre nada relacionado a este feature — sin bloqueo, sin aviso, sin recordatorio
  And privacy_accepted_at permanece NULL indefinidamente, a propósito
```

## Referencia a contrato de API

Ver `specs/api-contracts/auth.md` — `POST /auth/register/institution`
(`admin.acceptedPrivacyNotice`), `POST /auth/register/guardian`
(`acceptedPrivacyNotice`).

## Referencias

- ADR-099 (decisión completa: mecanismo de columnas, alcance solo-nuevos,
  contenido del aviso, enlace persistente post-registro).
- ADR-028 punto 2 (reutilización de cuenta, caso que este feature
  también cubre).
- `docs/arquitectura.md` § "Privacidad y marco legal (LFPDPPP)" — el
  principio de diseño que este feature finalmente implementa.
- `docs/aviso-privacidad.md` — contenido íntegro del aviso.
- `specs/entities/user.md`.
- `specs/features/001-registro-institucion.md`,
  `specs/features/002-registro-tutor.md`.

## Preguntas abiertas

Ninguna.
