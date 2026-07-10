# Vehicle

## Propósito
Lista reutilizable de vehículos guardados en el perfil del tutor. Catálogo
independiente del histórico de viajes: `pickup_request` guarda un snapshot
denormalizado del vehículo usado, no una referencia viva. Ver ADR-014.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `guardian_user_id` | `uuid` | NOT NULL, FK → `user.id`, `ON DELETE RESTRICT` | dueño del vehículo |
| `description` | `varchar(255)` | NOT NULL | ej. "Mazda CX-5 gris" |
| `plate` | `varchar(20)` | NOT NULL | |
| `is_primary` | `boolean` | NOT NULL, default `false` | vehículo principal del tutor; ver invariantes |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `belongsTo User` (`guardian`) — vía `guardian_user_id`.
- `hasMany PickupRequest` (`pickupRequests`) — vía `pickup_request.vehicle_id`. `ON DELETE SET NULL` desde el hijo (borrar/editar un vehículo del catálogo no debe afectar el histórico, que ya vive como snapshot).

## Índices

- Índice en `guardian_user_id` (listar vehículos guardados del tutor — pantalla de perfil, selector al iniciar un `pickup_request`).
- Índice único parcial `UNIQUE INDEX ... ON vehicles (guardian_user_id) WHERE is_primary = true` — fuerza en base de datos que solo un vehículo por tutor sea el principal (ver invariantes). Ver ADR-018.

## Invariantes de negocio

- El catálogo es libremente editable por el tutor sin efectos secundarios: editar o borrar un `vehicle` no altera el histórico de `pickup_requests` ya creados, porque estos guardan `vehicle_description`/`vehicle_plate` como snapshot denormalizado en el momento del viaje, no una referencia viva. Ver ADR-014.
- `is_primary`: solo un `vehicle` por `guardian_user_id` puede tener `is_primary = true`. Se fuerza con un índice único parcial de Postgres (no es solo convención de UI). Ver ADR-018.

## Enums

Sin columnas enum.

## Referencias

- ADR-014 (catálogo de vehículos del tutor; snapshot denormalizado en `pickup_request`).
- ADR-018 (índice único parcial para `is_primary`).
- ADR-023 (punto 1: al borrar el vehículo principal se promueve un reemplazo elegido por el tutor, o el catálogo queda sin principal si era el único).
