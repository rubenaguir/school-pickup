# Feature 002 — Registro de tutor

## Propósito

Un tutor (padre, madre u otro adulto que eventualmente recogerá alumnos) crea
su cuenta de usuario. A diferencia del registro de institución, este flujo
**no requiere aprobación de nadie** (ningún humano revisa la solicitud): tras
verificar su correo (ver `specs/features/007-verificacion-correo.md`), el
tutor queda operativo para dar de alta alumnos y asociarlos a instituciones
(features 004 y 005).

## Entidades involucradas

- `users` (creado)

## Precondiciones

- `email` no debe existir ya en `users.email`.

## Postcondiciones

- Se crea una fila en `users` con los datos capturados (`email`,
  `password_hash`, `full_name`, `phone` opcional).
- Las columnas de preferencia de notificación quedan en sus defaults:
  `notify_enrollment_approved = true`, `notify_dismissal_reminder = true`,
  `notify_delivery_confirmed = true`, `notify_product_news = false` (ver
  ADR-016). El formulario de registro no las expone; se ajustan después
  desde el perfil (fuera de este slice).
- `is_super_admin = false` (no hay flujo de auto-registro como super-admin).
- **El `users` queda en `status = invited`** (ADR-019, punto 2), no `active`:
  al completar el registro se envía un correo de verificación vía el port
  `EmailProvider` (ADR-017) con un token firmado de corta duración (24h). El
  tutor no puede iniciar sesión hasta verificar su correo — ver
  `specs/features/007-verificacion-correo.md`.
- **Este feature NO crea ningún `students` ni ningún `enrollments`.** El alta
  de un alumno (feature 004) y su asociación a una institución (feature 005)
  son pasos posteriores, independientes, que el tutor realiza después de
  tener cuenta.

## Casos Given/When/Then

### Caso de éxito

```
Given no existe ningún user con el email capturado
When el tutor envía el formulario de registro (email, password, full_name,
     phone opcional)
Then se crea user con status = invited y los defaults de notificación de
     ADR-016
  And is_super_admin = false
  And se envía un correo de verificación al tutor vía EmailProvider
  And el tutor NO puede iniciar sesión hasta verificar su correo (ver
      feature 003 y feature 007)
```

### Caso: email ya registrado

```
Given ya existe un user con ese email
When el tutor envía el formulario de registro
Then la operación falla sin crear ningún registro
  And se devuelve un error indicando que el correo ya está en uso
```

## Referencia a contrato de API

Ver `specs/api-contracts/auth.md` — `POST /auth/register/guardian`.

## Referencia a MQTT

No aplica.

## Referencias

- ADR-016 (defaults de columnas de notificación inline en `users`).
- ADR-017 (`EmailProvider` como port).
- ADR-019 (`users.status = invited` en auto-registro hasta verificar correo).
- `specs/entities/user.md`.
- `specs/features/007-verificacion-correo.md`.

## Preguntas abiertas

Ninguna: la pregunta sobre el `status` inicial del `users` se resolvió en
ADR-019.
