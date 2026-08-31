# API Contract — Users (Perfil propio)

Perspectiva del usuario autenticado sobre su propia cuenta. Cubre
`specs/features/026-perfil-tutor.md`. Ver ADR-059.

## Autorización

Todos los endpoints de este documento exigen solo `JwtAuthGuard` — sin
restricción de institución ni rol, mismo patrón que `GET /enrollments/mine`
y `GET /institution-members/mine`: el usuario opera sobre su propia cuenta,
identificada por el JWT, no por un `:id` de ruta.

## `GET /users/me`

**Request:** sin body.

**Response 200**
```json
{
  "id": "uuid",
  "email": "string",
  "fullName": "string | null",
  "phone": "string | null",
  "notifyEnrollmentApproved": "boolean",
  "notifyDismissalReminder": "boolean",
  "notifyDeliveryConfirmed": "boolean",
  "notifyProductNews": "boolean"
}
```

`email` es de solo lectura (ADR-059 punto 4) — no aparece en el `PATCH` de
abajo.

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |

## `PATCH /users/me`

Edición parcial de datos personales y preferencias de notificación. Todos
los campos son opcionales.

**Request**
```json
{
  "fullName": "string",
  "phone": "string",
  "notifyEnrollmentApproved": "boolean",
  "notifyDismissalReminder": "boolean",
  "notifyDeliveryConfirmed": "boolean",
  "notifyProductNews": "boolean"
}
```

**Response 200** — misma forma que `GET /users/me`.

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | tipos incorrectos (ej. `fullName` vacío si se envía) |
| 401 | — | no autenticado |

## `POST /users/me/change-password`

Endpoint separado del `PATCH` de arriba (ADR-059 punto 3) — acción de
seguridad, exige la contraseña actual.

**Request**
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

`newPassword` sigue la misma regla que el registro: mínimo 8 caracteres,
sin requisito de complejidad adicional (ADR-059 punto 3).

**Response 200**
```json
{ "success": true }
```

**Efecto secundario (ADR-103):** un cambio de contraseña exitoso
incrementa `users.token_version`, lo que invalida de golpe todo refresh
token ya emitido para esta cuenta — la próxima vez que cualquier sesión
(propia u otra, si alguien más tenía un token robado) intente
`POST /auth/refresh`, recibe `401 INVALID_REFRESH_TOKEN`. No afecta el
access token ya en uso en la sesión actual, que sigue vivo hasta su
propio TTL de 15 min. Ver `specs/api-contracts/auth.md`.

**Nota sobre sesiones existentes (ADR-059 punto 5):** cambiar la
contraseña no revoca ningún `accessToken`/`refreshToken` ya emitido —
siguen siendo válidos hasta su expiración natural. Limitación aceptada, no
un descuido.

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | `newPassword` con menos de 8 caracteres |
| 401 | `INVALID_CURRENT_PASSWORD` | `currentPassword` no coincide con la contraseña actual |
| 401 | — | no autenticado (JWT ausente/inválido — distinto del caso anterior, que sí tiene sesión válida pero contraseña incorrecta) |

## Referencias

- `specs/features/026-perfil-tutor.md`.
- ADR-059 (decisión completa: por qué dos endpoints, por qué `email` no se
  edita aquí, limitación de revocación de sesiones).
- `specs/entities/user.md`.
