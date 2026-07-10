# PickupRequest

## Propósito
Evento central del dominio: el "voy en camino" del tutor. Referencia la terna
tutor–alumno–institución (a través de `enrollment` + `guardian_user_id`) y
concentra el estado en vivo del trayecto (ubicación, ETA, punto de entrega).

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `enrollment_id` | `uuid` | NOT NULL, FK → `enrollment.id`, `ON DELETE RESTRICT` | vincula alumno + institución aprobada |
| `institution_id` | `uuid` | NOT NULL, FK → `institution.id`, `ON DELETE RESTRICT` | denormalizado desde `enrollment.institution_id` al crear el registro; inmutable después. Ver ADR-018 |
| `guardian_user_id` | `uuid` | NOT NULL, FK → `user.id`, `ON DELETE RESTRICT` | tutor que va en camino |
| `delivery_point_id` | `uuid` | nullable, FK → `delivery_point.id`, `ON DELETE SET NULL` | resuelto automáticamente al crear el viaje. Ver ADR-012 |
| `status` | `enum` (`en_route`, `arriving`, `arrived`, `delivered`, `cancelled`) | NOT NULL, default `en_route` | validado vía máquina de estados compartida — ver Enums |
| `started_at` | `timestamptz` | NOT NULL, default `now()` | |
| `estimated_arrival_at` | `timestamptz` | nullable | |
| `eta_seconds` | `int` | nullable | último ETA calculado |
| `last_location` | `geography(Point,4326)` | nullable | última posición conocida |
| `delivery_code` | `varchar(4)` | NOT NULL | código de 4 dígitos, único solo entre viajes activos de la misma institución. Ver ADR-013 y ADR-018 |
| `arrival_mode` | `enum` (`vehicle`, `walking`) | nullable | varía por viaje. Ver ADR-013 |
| `vehicle_id` | `uuid` | nullable, FK → `vehicle.id`, `ON DELETE SET NULL` | referencia al vehículo guardado, si se seleccionó uno. Ver ADR-014 |
| `vehicle_description` | `varchar(255)` | nullable | snapshot denormalizado al momento del viaje. Ver ADR-014 |
| `vehicle_plate` | `varchar(20)` | nullable | snapshot denormalizado al momento del viaje. Ver ADR-014 |
| `completed_at` | `timestamptz` | nullable | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `belongsTo Enrollment` (`enrollment`) — vía `enrollment_id`.
- `belongsTo Institution` (`institution`) — vía `institution_id` (denormalizado, ver invariantes).
- `belongsTo User` (`guardian`) — vía `guardian_user_id`.
- `belongsTo DeliveryPoint` (`deliveryPoint`, nullable) — vía `delivery_point_id`.
- `belongsTo Vehicle` (`vehicle`, nullable) — vía `vehicle_id`.
- `hasMany PickupRequestStatusHistory` (`statusHistory`) — vía `pickup_request_status_history.pickup_request_id`. `ON DELETE CASCADE`.
- `hasMany LocationUpdate` (`locationUpdates`) — vía `location_update.pickup_request_id`. `ON DELETE CASCADE`.

## Índices

- Índice en `status` (el tablero y las consolas de puerta filtran por viajes activos).
- Índice en `delivery_point_id` (cola específica de cada consola de puerta).
- Índice compuesto `(institution_id, status)` (feed agregado del tablero: viajes activos de una institución). Ver ADR-018.
- Índice único parcial `(institution_id, delivery_code) WHERE status IN ('en_route', 'arriving', 'arrived')` — implementa el alcance de unicidad de `delivery_code` (ver invariantes). Ver ADR-018.
- Índice único parcial `(enrollment_id) WHERE status IN ('en_route', 'arriving', 'arrived')` — fuerza en base de datos que no exista más de un `pickup_request` no terminal por `enrollment_id` (ver invariantes). Mismo patrón que el índice parcial de `vehicles.is_primary`. Ver ADR-024 punto 1 y ADR-025.
- Índice GIST en `last_location` si en el futuro se necesitan consultas espaciales entre viajes (hoy la detección de arribo compara un solo punto contra `institution.location`, no requiere índice espacial de por sí).

## Invariantes de negocio

- `arrival_mode`, `vehicle_description` y `vehicle_plate` son opcionales porque el modo de llegada varía por viaje (no es un dato fijo del tutor): algunos tutores llegan caminando. Ver ADR-013.
- **Snapshot vs. referencia** (ADR-014): `vehicle_id` referencia el vehículo guardado si se usó uno; `vehicle_description` y `vehicle_plate` son una copia congelada de ese vehículo al momento del viaje (o captura libre si no se seleccionó uno guardado). Editar o borrar el `vehicle` del catálogo después NO debe alterar estos dos campos.
- `delivery_point_id` se resuelve automáticamente al crear el `pickup_request`, haciendo match entre `enrollment.grade_or_group` y `delivery_point.assigned_groups`. Es nullable para instituciones con un solo punto de entrega o cuando no hay match. El tutor NO puede cambiar el punto de entrega de su recogida individual una vez creada. Ver ADR-012.
- `delivery_code` es el mecanismo de verificación de identidad en la entrega: el tutor lo ve en su app al llegar a `arrived`, el staff lo verifica en la consola de puerta antes de confirmar la transición a `delivered`. Ver ADR-013. Su unicidad es **única solo entre registros en estado `en_route`/`arriving`/`arrived` de la misma institución**, no global ni permanente: se puede repetir en el tiempo y entre instituciones distintas. Ver ADR-018.
- `institution_id` es una columna denormalizada, copiada de `enrollment.institution_id` al crear el registro e **inmutable después**. Existe para evitar el join `pickup_request → enrollment → institution` en cada consulta del tablero y al resolver a qué topic MQTT publicar. La inmutabilidad **se garantiza en la capa de servicio** (NestJS): el campo se fija solo al crear el `pickup_request` y ningún caso de uso lo reescribe (no hay constraint de BD que lo fuerce). Ver ADR-018 y ADR-026 (nota de capa de servicio).
- Las transiciones de `status` **no se validan en la entidad ni con un constraint de base de datos**: se validan contra la máquina de estados compartida en `packages/shared` (ver ADR-017), consumida tanto por `api` como por `worker`, para que ambos procesos no diverjan en su validación.
- **Recogida activa única por `enrollment_id`:** no puede existir más de un `pickup_request` en estado no terminal (`en_route`/`arriving`/`arrived`) para el mismo `enrollment_id`. Se fuerza con el índice único parcial de arriba (no solo a nivel de servicio); un intento de crear una segunda recogida activa sobre la misma asociación se rechaza con 422. Ver ADR-024 punto 1 y ADR-025.

## Enums

- `status`: `en_route` → `arriving` → `arrived` → `delivered`, con `cancelled` alcanzable desde cualquiera de los tres primeros y con el **salto directo `en_route → arrived`** (el tutor confirma la llegada antes de que el `worker` detecte `arriving`, ADR-024 punto 8; ver diagrama en `docs/modelo-datos.md`). El conjunto completo de transiciones válidas está en ADR-024 punto 8. **Las transiciones válidas se validan contra la máquina de estados compartida en `packages/shared` (`pickup-request-status-machine.ts`, ver ADR-017), no en esta entidad ni con un `CHECK` de PostgreSQL.**
- `arrival_mode`: `vehicle` | `walking`. Opcional, no tiene ciclo de vida.

## Referencias

- ADR-012 (asignación automática de `delivery_point_id`).
- ADR-013 (ciclo de vida, `delivery_code`, `arrival_mode`, radios de geocerca/activación).
- ADR-014 (catálogo de vehículos y snapshot denormalizado).
- ADR-017 (máquina de estados compartida en `packages/shared`, no lógica de dominio en la entidad).
- ADR-018 (alcance de unicidad de `delivery_code`; `institution_id` denormalizado).
- ADR-024 (punto 1: recogida activa única por `enrollment_id`; punto 8: conjunto completo de transiciones válidas, incluido el salto directo `en_route → arrived`).
- ADR-025 (punto 1: transición `en_route → arrived` en el enum/diagrama; punto 2: índice único parcial de recogida activa).
- ADR-026 (nota de capa de servicio para la inmutabilidad de `institution_id`).
