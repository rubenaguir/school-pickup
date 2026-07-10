# API Contract — Auth

Recurso de autenticación y registro. Cubre las features
`specs/features/001-registro-institucion.md`,
`specs/features/002-registro-tutor.md`, `specs/features/003-login.md` y
`specs/features/007-verificacion-correo.md`.

## Autenticación de los endpoints de este documento

Ninguno de los endpoints requiere un access token existente (son de acceso
público): registro, login y verificación de correo son, por definición,
previos a tener sesión completa. `POST /auth/refresh` requiere un refresh
token válido en el body (no un access token). Los endpoints de verificación
reciben el token de verificación de correo (JWT de corta duración, ver
ADR-019) como credencial de un solo propósito, distinta del access/refresh
token de sesión.

## `POST /auth/register/institution`

Registra una institución junto con su primer administrador. Ver feature 001.

**Request**
```json
{
  "institution": {
    "name": "string",
    "type": "school | extracurricular",
    "category": "string | null",
    "address": "string",
    "location": { "lat": "number", "lng": "number" },
    "timezone": "string"
  },
  "admin": {
    "email": "string",
    "password": "string",
    "fullName": "string",
    "phone": "string | null"
  }
}
```

`joinCode` no se envía en el request: se autogenera en el servidor (ADR-019,
punto 1).

**Response 201**
```json
{
  "institution": { "id": "uuid", "name": "string", "status": "pending", "joinCode": "string" },
  "user": { "id": "uuid", "email": "string", "status": "invited" }
}
```

La respuesta indica `users.status = invited`: se envió un correo de
verificación (ver `POST /auth/verify-email` abajo).

**Errores**
| Código | Caso |
|---|---|
| 409 | `email` del administrador ya registrado |
| 400 | payload inválido (campos requeridos faltantes, `type` fuera del enum) |

## `POST /auth/register/guardian`

Registra un tutor. Ver feature 002.

**Request**
```json
{
  "email": "string",
  "password": "string",
  "fullName": "string",
  "phone": "string | null"
}
```

**Response 201**
```json
{
  "user": { "id": "uuid", "email": "string", "status": "invited" }
}
```

La respuesta indica `users.status = invited`: se envió un correo de
verificación (ver `POST /auth/verify-email` abajo).

**Errores**
| Código | Caso |
|---|---|
| 409 | `email` ya registrado |
| 400 | payload inválido |

## `POST /auth/login`

Ver feature 003.

**Request**
```json
{ "email": "string", "password": "string" }
```

**Response 200**
```json
{
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)"
}
```

**Claims del access token:**

| Claim | Tipo | Notas |
|---|---|---|
| `sub` | `string` (uuid) | `users.id` |
| `email` | `string` | |
| `isSuperAdmin` | `boolean` | copia de `users.is_super_admin` |

No incluye `institutionId` ni `role`: se resuelven por request contra
`institution_members` (ver `specs/api-contracts/enrollments.md` y la
justificación en `specs/features/003-login.md`).

**Errores**
| Código | Caso |
|---|---|
| 401 | credenciales inválidas (email no existe o password incorrecto — mensaje genérico) |
| 403 | `users.status = suspended` |
| 403 | `users.status = invited` — mensaje específico indicando que falta verificar el correo (distinto del 401 genérico de credenciales), con referencia a `POST /auth/resend-verification` |

## `POST /auth/refresh`

**Request**
```json
{ "refreshToken": "string" }
```

**Response 200**
```json
{ "accessToken": "string (JWT)" }
```

**Errores**
| Código | Caso |
|---|---|
| 401 | refresh token inválido, expirado o mal formado |

Nota: al ser stateless (ver feature 003), no existe un endpoint de logout
que invalide el refresh token del lado del servidor en este slice.

## `POST /auth/verify-email`

Ver feature 007. **Convención elegida: `POST` con el token en el body, no
`GET` con el token en la URL.** El link del correo de verificación apunta a
una ruta del frontend (ej. `app.casillego.com.mx/verificar-correo?token=...`
— fuera de alcance de este contrato), que a su vez llama a este endpoint con
el token extraído de la URL. Se evita así que la verificación (una
operación con efecto secundario: cambia `users.status`) ocurra como
consecuencia de un `GET`, y se evita también que el token quede expuesto en
logs de servidor/proxy que registran URLs completas de requests `GET`.

**Request**
```json
{ "token": "string (JWT de verificación)" }
```

**Response 200**
```json
{ "status": "active" }
```

Idempotente: si el `users` ya está `active`, responde 200 igual (ver caso
"verificación repetida" en feature 007).

**Errores**
| Código | Caso |
|---|---|
| 400 | token con firma inválida o malformado |
| 410 | token con firma válida pero expirado (más de 24h) |

## `POST /auth/resend-verification`

Reenvía el correo de verificación a un `users` en `status = invited`. Ver
feature 007.

**Límite de tasa: 3 solicitudes por hora por email**, con un cooldown
mínimo de 60 segundos entre solicitudes consecutivas para el mismo email
(throttling por email, sin persistencia adicional — ver feature 007).

**Request**
```json
{ "email": "string" }
```

**Response 200**
```json
{ "message": "string" }
```

Responde 200 genérico incluso si el email no existe o el `users` ya está
`active` (para no filtrar qué correos están registrados, mismo criterio que
`POST /auth/login`).

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido |
| 429 | límite de tasa excedido (más de 3 solicitudes en la última hora, o
      menos de 60 segundos desde la anterior, para el mismo email) |

## Referencias

- `specs/features/001-registro-institucion.md`,
  `specs/features/002-registro-tutor.md`,
  `specs/features/003-login.md`,
  `specs/features/007-verificacion-correo.md`.
- `specs/entities/user.md`, `specs/entities/institution.md`,
  `specs/entities/institution_member.md`.
- ADR-017 (`EmailProvider` como port).
- ADR-019 (autogeneración de `join_code`; `users.status = invited` hasta
  verificar correo; refresh token stateless aceptado).

## Preguntas abiertas

Ninguna.
