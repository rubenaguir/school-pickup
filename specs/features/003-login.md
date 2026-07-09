# Feature 003 — Login

## Propósito

Autenticar a cualquiera de los tres tipos de usuario de la plataforma
(tutor, personal de institución, super-admin) con un mismo endpoint. No hay
formularios de login separados por rol: el rol y el contexto de institución
se resuelven después de autenticar, no antes.

## Entidades involucradas

- `user` (leído)
- `institution_member` (leído, para que el cliente sepa a qué instituciones
  pertenece el usuario tras el login — ver decisión de diseño sobre el JWT
  abajo)

## Precondiciones

- El `user` debe existir (por `email`).

## Postcondiciones

- Login exitoso: se emite un access token (JWT) y un refresh token.
- **Diseño del JWT (access token):** claims `sub` (user id), `email`,
  `isSuperAdmin`. **No incluye `institutionId` ni `role`.**
  `specs/entities/institution_member.md` documenta explícitamente que el
  índice en `user_id` existe "para el cambio de contexto de institución en
  el portal" — un mismo `user` puede pertenecer a varias instituciones (o a
  ninguna, si es solo tutor). Fijar una institución en el token la
  congelaría al momento del login; en su lugar, cada endpoint con alcance
  institucional recibe el `institutionId` explícitamente (query param o
  path) y lo valida contra las filas de `institution_member` del usuario
  autenticado (ver `specs/api-contracts/enrollments.md`).
- **Refresh token stateless (decisión aceptada, ADR-019 punto 3).** Ninguna
  de las 14 entidades del modelo persiste ni revoca refresh tokens; se emite
  como JWT firmado con su propia expiración (más larga que el access
  token), sin tabla de sesión ni revocación activa. Es una limitación
  consciente del MVP (no hay forma de invalidar un refresh token robado
  antes de que expire), aceptada explícitamente y anotada como ítem de
  backlog de seguridad, no como pregunta abierta.

## Casos Given/When/Then

### Caso de éxito

```
Given un user con status = active y credenciales correctas
When se envía email + password a /auth/login
Then se emite un access token y un refresh token
  And el access token lleva sub, email, isSuperAdmin
```

### Caso: credenciales inválidas

```
Given un email que no corresponde a ningún user, o un password incorrecto
When se intenta iniciar sesión
Then se rechaza con un error genérico de credenciales inválidas
  (no se distingue entre "email no existe" y "password incorrecto", para no
  filtrar qué correos están registrados)
```

### Caso: usuario suspendido

```
Given un user con status = suspended
When se envía email + password correctos
Then se rechaza el login con un error específico indicando que la cuenta
     está suspendida
```

### Caso: usuario invitado (correo sin verificar)

```
Given un user con status = invited (registro reciente, correo aún sin
      verificar — ver ADR-019 punto 2 y feature 007)
When se envía email + password correctos
Then se rechaza el login con un error específico indicando que falta
     verificar el correo electrónico (no el error genérico de
     credenciales inválidas)
  And la respuesta orienta a reenviar el correo de verificación si es
      necesario (ver specs/api-contracts/auth.md, POST /auth/resend-verification)
```

Este caso es alcanzable ya en este slice: todo auto-registro (institución o
tutor) deja al `user` en `invited` hasta verificar su correo (ADR-019, punto
2; ver `specs/features/001-registro-institucion.md`,
`specs/features/002-registro-tutor.md` y
`specs/features/007-verificacion-correo.md`).

## Referencia a contrato de API

Ver `specs/api-contracts/auth.md` — `POST /auth/login`, `POST /auth/refresh`.

## Referencia a MQTT

No aplica.

## Referencias

- ADR-018 (transiciones de `users.status`).
- ADR-019 (usuario `invited` no puede iniciar sesión hasta verificar correo;
  refresh token stateless aceptado como limitación del MVP).
- `specs/entities/user.md`, `specs/entities/institution_member.md`.
- `specs/features/007-verificacion-correo.md`.

## Preguntas abiertas

Ninguna: ambas preguntas que tenía este feature (alcanzabilidad del caso
`invited` y el refresh token stateless) se resolvieron en ADR-019.
