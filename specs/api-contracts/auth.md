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

**Forma de los errores (ADR-028, punto 1).** Toda respuesta de error de
este contrato es `{ "code": "string", "message": "string" }`. `code` es un
identificador machine-readable en inglés (ver las tablas de cada endpoint
abajo); `message` es texto de desarrollo/logs en inglés, no una traducción
lista para mostrar al usuario final. Cada frontend traduce por `code` en su
propia capa de i18n — la API no decide en qué idioma habla a 3 frontends
distintos.

`INVALID_PAYLOAD` de este contrato incluye además el campo `details` (uno
por cada campo/regla de `class-validator` que falló) — shape compartido con
el resto del API, documentado una sola vez en
`specs/api-contracts/README.md`, no repetido aquí.

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
verificación (ver `POST /auth/verify-email` abajo) — salvo en el caso de
reutilización de cuenta descrito abajo, donde `user.status` refleja el
estado ya existente de esa cuenta (`invited` o `active`) y no se envía un
correo nuevo.

**Reutilización de cuenta existente (ADR-028, punto 2).** Si `admin.email`
ya existe en `users` y `admin.password` coincide con el hash guardado, la
cuenta se reutiliza: se crea la `institution` y el `institution_member`
(`role = admin`) sobre ese `users` existente, y la respuesta es 201 igual
que en el caso de alta nueva, sin enviar un nuevo correo de verificación (la
contraseña correcta ya prueba posesión de la cuenta). Si `admin.email` ya
existe pero `admin.password` **no** coincide, la operación falla con 409
(ver tabla de errores).

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 409 | `EMAIL_ALREADY_REGISTERED` | `email` del administrador ya registrado con una contraseña distinta a la enviada |
| 400 | `INVALID_PAYLOAD` | payload inválido (campos requeridos faltantes, `type` fuera del enum) |

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
| Código | `code` | Caso |
|---|---|---|
| 409 | `EMAIL_ALREADY_REGISTERED` | `email` ya registrado |
| 400 | `INVALID_PAYLOAD` | payload inválido |

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
| Código | `code` | Caso |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | credenciales inválidas (email no existe o password incorrecto — mensaje genérico) |
| 403 | `ACCOUNT_SUSPENDED` | `users.status = suspended` |
| 403 | `EMAIL_NOT_VERIFIED` | `users.status = invited` — mensaje específico indicando que falta verificar el correo (distinto del 401 genérico de credenciales), con referencia a `POST /auth/resend-verification` |

## `POST /auth/refresh`

**Request**
```json
{ "refreshToken": "string" }
```

**Response 200**
```json
{ "accessToken": "string (JWT)", "refreshToken": "string (JWT)" }
```

**Rotación (ADR-067):** cada llamada exitosa emite un `refreshToken`
**nuevo**, con TTL fresco de 30 días desde ese momento — el cliente debe
descartar el que usó para pedir el refresh y guardar el nuevo. Es
longevidad de sesión para uso activo continuo, no un endurecimiento de
seguridad: sigue sin existir lista de revocación (stateless, mismo
criterio que el resto del sistema), así que un `refreshToken` robado sigue
siendo utilizable hasta su propio TTL sin que el original quede invalidado
del lado del servidor.

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | `INVALID_REFRESH_TOKEN` | refresh token inválido, expirado o mal formado; o con firma y expiración válidas pero cuyo `users` referido (`sub`) ya no existe |
| 403 | `ACCOUNT_SUSPENDED` | token con firma y expiración válidas, pero el `users` referido (`sub`) tiene `status = suspended` — mismo `code` que usa `POST /auth/login` para el mismo caso |

Nota: al ser stateless (ver feature 003), no existe un endpoint de logout
que invalide el refresh token del lado del servidor en este slice. Sin
embargo, cada uso de este endpoint sí revalida `users.status` contra la
base de datos (no solo la firma/expiración del JWT): una suspensión
posterior a la emisión del refresh token bloquea la renovación en el
siguiente intento, con un retraso máximo igual al TTL del access token
vigente. Ver ADR-019, punto 3 (enmienda).

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
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_VERIFICATION_TOKEN` | token con firma inválida o malformado |
| 410 | `VERIFICATION_TOKEN_EXPIRED` | token con firma válida pero expirado (más de 24h) |

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
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | payload inválido |
| 429 | `RATE_LIMIT_EXCEEDED` | límite de tasa excedido (más de 3 solicitudes en la última hora, o
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
- ADR-028 (forma de los errores con `code` en inglés; reutilización de
  cuenta existente condicionada a contraseña coincidente en registro de
  institución).

## Preguntas abiertas

Ninguna.
