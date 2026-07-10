# DeliveryPoints

## Propósito
Punto de entrega físico dentro de una institución (ej. "Puerta principal",
"Puerta vehicular"), cada uno con su propia consola de puerta. Ver ADR-012.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `institution_id` | `uuid` | NOT NULL, FK → `institutions.id`, `ON DELETE CASCADE` | |
| `name` | `varchar(255)` | NOT NULL | |
| `description` | `varchar(500)` | nullable | ej. "Av. Universidad · operador José Ramírez" |
| `operator_user_id` | `uuid` | nullable, FK → `users.id`, `ON DELETE SET NULL` | miembro de la institución asignado; ver invariantes |
| `assigned_groups` | `varchar(100)[]` | nullable | grupos/niveles que llegan por este punto. Ver ADR-012 |
| `status` | `enum` (`active`, `inactive`) | NOT NULL, default `active` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `belongsTo Institution` (`institutions`) — vía `institution_id`.
- `belongsTo User` (`operator`) — vía `operator_user_id`, nullable.
- `hasMany PickupRequest` (`pickupRequests`) — vía `pickup_requests.delivery_point_id`. `ON DELETE SET NULL` desde el hijo (un `pickup_requests` no debe perderse si se borra un punto de entrega).

## Índices

- Índice en `institution_id` (listar puntos de entrega de una institución — pantalla de configuración).
- Índice GIN en `assigned_groups` para resolver eficientemente el match `enrollments.grade_or_group` → `delivery_points.assigned_groups` al crear un `pickup_requests` (ver ADR-012).

## Invariantes de negocio

- La asignación de un `pickup_requests` a un `delivery_points` es automática y estructural: se resuelve al crear el viaje haciendo match entre `enrollments.grade_or_group` y `assigned_groups`. Un tutor NO puede elegir ni cambiar el punto de entrega de su recogida individual. Ver ADR-012.
- `assigned_groups` es texto libre (no catálogo curado) para no bloquear altas de grupos nuevos antes de tener un catálogo cerrado por institución. Ver ADR-012.
- `operator_user_id`, cuando no es nulo, debe corresponder a un `users` que sea `institution_members` de la misma `institution_id`. Esta regla cruza dos tablas y no se puede expresar como FK simple; se valida en la capa de servicio (NestJS), no con trigger de base de datos, consistente con ADR-017 (lógica de negocio en la capa de aplicación, base de datos simple). Ver ADR-018.
- Instituciones con un solo punto de entrega no necesitan asignar grupos (`assigned_groups` puede quedar `NULL`), y `pickup_requests.delivery_point_id` es nullable para ese caso.

## Enums

- `status`: `active` | `inactive`. No hay ciclo de vida más allá de activar/desactivar el punto.

## Referencias

- ADR-012 (puntos de entrega y asignación por grupo).
- ADR-011 (cualquier `institution_members`, sin restricción de `role`, puede operar la consola de puerta).
- ADR-017 (validaciones cruzadas en capa de servicio, no en base de datos).
- ADR-018 (validación de `operator_user_id` en capa de servicio, no con trigger).
