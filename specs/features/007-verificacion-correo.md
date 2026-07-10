# Feature 007 — Verificación de correo

## Propósito

Completa el auto-registro (institución o tutor, features 001 y 002): un
usuario recién creado queda en `status = invited` hasta demostrar que
controla el correo electrónico con el que se registró. Esta feature es la
que realiza esa verificación y activa la cuenta.

## Entidades involucradas

- `users` (leído y actualizado)

## Precondiciones

- El `users` existe con `status = invited` (creado por feature 001 o 002).

## Postcondiciones

- Al verificar exitosamente: `users.status` pasa de `invited` a `active`. El
  usuario puede iniciar sesión (feature 003).
- El token de verificación es un JWT firmado de corta duración (24h),
  conteniendo `users.id`, **sin persistencia en base de datos**: no existe
  ninguna tabla para almacenarlo ni revocarlo (ver ADR-019, punto 2) — su
  validez se resuelve enteramente verificando firma y expiración.
- **El reenvío de correo de verificación está limitado a 3 solicitudes por
  hora por email**, con un cooldown mínimo de 60 segundos entre solicitudes
  consecutivas para el mismo email. Se aplica mediante throttling por
  email (e.g. `@nestjs/throttler`), sin tabla ni entidad nueva — consistente
  con el resto de esta feature (sin persistencia adicional).

## Casos Given/When/Then

### Caso de éxito

```
Given un user con status = invited
  And un token de verificación válido (firma correcta, no expirado) emitido
      para ese user.id
When se visita el link de verificación / se llama al endpoint con el token
Then user.status pasa a active
  And el usuario queda en condiciones de iniciar sesión (feature 003)
```

### Caso: token expirado

```
Given un token de verificación con firma válida pero expirado (más de 24h
      desde su emisión)
When se intenta verificar
Then la operación falla con un mensaje claro indicando que el enlace expiró
  And se ofrece la opción de reenviar un nuevo correo de verificación (ver
      specs/api-contracts/auth.md, POST /auth/resend-verification)
```

### Caso: usuario ya activo (verificación repetida)

```
Given un user con status = active (ya verificado antes, por ejemplo si el
      usuario hace clic en el mismo link dos veces)
When se intenta verificar de nuevo con un token válido para ese user.id
Then la operación es idempotente: responde éxito sin error confuso
  And no cambia nada (el user ya estaba active)
```

### Caso: token con firma inválida o malformado

```
Given un token que no fue emitido por el sistema (firma inválida) o está
      malformado
When se intenta verificar
Then la operación falla con un error genérico de token inválido
```

### Caso: límite de reenvíos excedido

```
Given un email que ya recibió 3 reenvíos de verificación en la última hora,
      o uno hace menos de 60 segundos
When se solicita un nuevo reenvío para ese email
Then la operación se rechaza por límite de tasa excedido
  And no se envía un nuevo correo
```

## Referencia a contrato de API

Ver `specs/api-contracts/auth.md` — endpoint de verificación y endpoint de
reenvío (`POST /auth/resend-verification`).

## Referencia a MQTT

No aplica.

## Referencias

- ADR-017 (`EmailProvider` como port; el correo de verificación se envía a
  través de él, no de una implementación concreta).
- ADR-019 (punto 2: `status = invited` en auto-registro; token de
  verificación JWT sin persistencia).
- `specs/entities/user.md`.
- `specs/features/001-registro-institucion.md`,
  `specs/features/002-registro-tutor.md`,
  `specs/features/003-login.md`.

## Preguntas abiertas

Ninguna.
