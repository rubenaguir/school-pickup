# Feature 026 — Perfil de tutor: datos personales, notificaciones y contraseña

## Propósito

Completa la sección "Perfil" del tutor (`docs/design-brief.md`) que
faltaba: datos personales editables, preferencias de notificación, y
cambio de contraseña. La parte de vehículos ya se resolvió en la feature
014; la de biometría queda confirmada fuera de alcance del backend
(`specs/entities/user.md`).

## Entidades involucradas

- `users` (leído, actualizado)

## Precondiciones

- El usuario debe estar autenticado. Sin restricción adicional — opera
  sobre su propia cuenta, identificada por el JWT (ADR-059).

## Postcondiciones

### Al editar datos personales/preferencias
- Se actualizan los campos indicados de `users` (`full_name`, `phone`,
  los cuatro booleanos de notificación). Edición parcial.

### Al cambiar contraseña
- Se verifica `currentPassword` contra `password_hash` antes de aceptar.
- Se guarda el hash de `newPassword` (mínimo 8 caracteres, misma regla que
  el registro).
- Ninguna sesión existente (`accessToken`/`refreshToken` ya emitidos) se
  revoca — siguen siendo válidos hasta expirar (ADR-059 punto 5,
  limitación aceptada).

## Casos Given/When/Then

### Caso de éxito — editar datos personales

```
Given un user autenticado
When actualiza fullName y/o phone
Then los campos se guardan
  And el resto de la cuenta no se modifica
```

### Caso de éxito — cambiar preferencias de notificación

```
Given un user autenticado
When cambia cualquiera de los cuatro booleanos de notificación
Then el valor se guarda
```

### Caso de éxito — cambiar contraseña

```
Given un user autenticado que conoce su contraseña actual
When envía currentPassword correcta y newPassword de al menos 8 caracteres
Then la contraseña se actualiza
  And puede iniciar sesión con la nueva contraseña en un login posterior
  And cualquier sesión ya iniciada (tokens ya emitidos) sigue funcionando
      hasta que expire por su cuenta (ADR-059 punto 5)
```

### Caso: contraseña actual incorrecta

```
Given un user autenticado
When envía una currentPassword que no coincide con la real
Then la operación se rechaza (401 INVALID_CURRENT_PASSWORD)
  And la contraseña no cambia
```

### Caso: nueva contraseña demasiado corta

```
Given un user autenticado con currentPassword correcta
When envía una newPassword de menos de 8 caracteres
Then la operación se rechaza (400 INVALID_PAYLOAD)
```

## Referencia a contrato de API

Ver `specs/api-contracts/users.md` — `GET /users/me`, `PATCH /users/me`,
`POST /users/me/change-password`.

## Referencia a MQTT

No aplica.

## Referencias

- ADR-059 (decisión completa de este slice).
- `specs/entities/user.md`.
- `specs/features/014-gestionar-vehiculos.md` (la otra mitad de "Perfil",
  ya resuelta).
- `docs/design-brief.md` (sección "Perfil" del tutor).

## Preguntas abiertas

Ninguna: el alcance (qué se edita, qué no, la separación de endpoints, y
la limitación de no revocar sesiones) se resolvió en ADR-059. La huella
dactilar sigue confirmada fuera de alcance del backend.
