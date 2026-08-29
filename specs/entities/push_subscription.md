# PushSubscriptions

## Propósito
Suscripción Web Push (VAPID) de un dispositivo/navegador concreto de un
`users`. Habilita el envío de notificaciones push nativas — hoy, solo
`notify_delivery_confirmed` (avisar a los demás tutores autorizados de un
alumno que la recogida ya se resolvió, excluyendo a quien recogió). Un
`users` puede tener varias filas: cada dispositivo/navegador donde acepte
notificaciones genera la suya. Ver ADR-066.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | NOT NULL, FK → `users.id`, `ON DELETE CASCADE` | |
| `endpoint` | `text` | NOT NULL | URL del endpoint push que entrega el navegador — puede ser larga, de ahí `text` en vez de `varchar` |
| `p256dh_key` | `varchar(255)` | NOT NULL | clave pública de cifrado de la suscripción, tal cual la entrega `PushSubscription.toJSON().keys.p256dh` del navegador |
| `auth_key` | `varchar(255)` | NOT NULL | secreto de autenticación de la suscripción, `keys.auth` del navegador |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Sin columna `updated_at`: un `p256dh_key`/`auth_key` que cambian para el
mismo `(user_id, endpoint)` se sobreescriben en el `UPDATE` (ver
Invariantes de negocio), no ameritan su propio rastro temporal separado de
`created_at`.

## Relaciones

- `belongsTo User` (`users`) — vía `user_id`, `ON DELETE CASCADE`: al
  borrar un usuario desaparecen todas sus suscripciones, sin necesidad de
  limpieza manual.

## Índices

- Índice simple en `user_id` (`IDX_6771f119f1c06d2ccf38f23866`) — resolver
  "todas las suscripciones de este tutor" al enviar una notificación de
  entrega.
- Índice único `(user_id, endpoint)` (`IDX_push_subscriptions_user_endpoint`)
  — un mismo navegador/dispositivo no puede quedar registrado dos veces
  para el mismo usuario. Ver Invariantes de negocio.

## Invariantes de negocio

- **Upsert por `(user_id, endpoint)`, nunca error de duplicado.**
  `POST /push-subscriptions` busca primero una fila existente con el mismo
  `user_id`+`endpoint`; si existe, sobreescribe `p256dh_key`/`auth_key` en
  vez de intentar un `INSERT` que chocaría con el índice único. Esto
  cubre el caso real de que el navegador rote las claves de una
  suscripción ya registrada sin cambiar de endpoint — no es un caso de
  error, es el camino esperado. Ver `push-subscriptions.service.ts`
  (`create()`).
- **Borrado solo por el dueño.** `DELETE /push-subscriptions/:id` verifica
  `subscription.user.id === userId` del JWT antes de borrar — `404
  RESOURCE_NOT_FOUND` si el id no existe, `403 NOT_SUBSCRIPTION_OWNER` si
  existe pero pertenece a otro usuario. Mismo patrón de autorización que
  el resto de recursos "propios" del tutor (`vehicles`), sin
  `InstitutionMembershipGuard` — no hay tenant institucional involucrado.
- **El envío es best-effort y no bloquea la operación que lo dispara.**
  `PickupsService.deliver()` intenta el push fuera de la transacción
  principal, tras la transición ya persistida; un fallo de envío (endpoint
  caducado, red, etc.) se registra en log y no revierte ni bloquea la
  entrega. Esta entidad no tiene ninguna columna de estado de envío
  (`sent`, `failed`, etc.) porque no existe reintento ni cola — un envío
  fallido simplemente no llega, sin rastro persistido más allá del log.
  Ver ADR-066 punto 4.
- **Solo se envía a quien tiene la preferencia activa.** Antes de leer las
  suscripciones de un `users`, el servicio de envío ya filtró por
  `notify_delivery_confirmed = true` (`users`, ADR-059) — esta entidad no
  vuelve a validar la preferencia, asume que quien la invoca ya lo hizo.

## Enums

Sin columnas enum.

## Referencias

- ADR-066 (Web Push con VAPID; entidad, disparo best-effort, contenido del
  mensaje, cambio de `apps/parent` a `injectManifest`).
- ADR-059 (`notify_delivery_confirmed`, la preferencia que controla el
  envío, sin cambios aquí).
- ADR-064 (por qué se excluye al guardián que ejecutó la recogida — ya lo
  supo en tiempo real).
- `specs/features/028-notificacion-push-entrega.md`,
  `specs/api-contracts/push-subscriptions.md`.
