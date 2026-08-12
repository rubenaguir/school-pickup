# API Contract — Push Subscriptions

Registro de suscripciones Web Push del usuario autenticado. Cubre
`specs/features/028-notificacion-push-entrega.md`. Ver ADR-066.

## Autorización

Solo `JwtAuthGuard` — el usuario gestiona sus propias suscripciones,
identificadas por el JWT, mismo patrón que `GET/PATCH /users/me`.

## `POST /push-subscriptions`

Registra una suscripción nueva del navegador actual. El cuerpo es la
forma estándar que entrega `PushSubscription.toJSON()` del navegador — no
se reinterpreta ni se transforma.

**Request**
```json
{
  "endpoint": "string",
  "keys": {
    "p256dh": "string",
    "auth": "string"
  }
}
```

**Response 201**
```json
{ "id": "uuid" }
```

Si el mismo `endpoint` ya está registrado para este usuario (el mismo
navegador/dispositivo se suscribe de nuevo), se actualiza la fila
existente en vez de crear una duplicada (idempotente por `endpoint`).

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | `endpoint`/`keys.p256dh`/`keys.auth` ausentes o mal formados |
| 401 | — | no autenticado |

## `DELETE /push-subscriptions/:id`

Elimina una suscripción propia (ej. el usuario desactiva notificaciones
desde la UI, o el navegador invalida la suscripción).

**Request:** sin body.

**Response 204**

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | — | no autenticado |
| 403 | `NOT_SUBSCRIPTION_OWNER` | la suscripción no pertenece al usuario autenticado |
| 404 | `RESOURCE_NOT_FOUND` | no existe esa suscripción |

## Nota sobre `PATCH /pickup-requests/:id/deliver`

Este endpoint (ya documentado en
`specs/api-contracts/pickup-requests.md`) gana un efecto secundario best-
effort: envía notificación push a los demás tutores autorizados activos
del alumno con `notify_delivery_confirmed = true` (ADR-066). No cambia su
request/response ni sus códigos de error — el envío push nunca afecta la
respuesta de este endpoint, ni siquiera si falla por completo.

## Referencias

- `specs/features/028-notificacion-push-entrega.md`.
- ADR-066 (decisión completa).
- `specs/entities/user.md` (`notify_delivery_confirmed`).
