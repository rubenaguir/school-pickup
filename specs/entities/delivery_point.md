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
- Instituciones con un solo punto de entrega no necesitan asignar grupos (`assigned_groups` puede quedar `NULL`). `pickup_requests.delivery_point_id` sigue siendo nullable como tipo de columna, pero en la práctica ya no debe quedar `NULL` para ese caso: se resuelve al punto de entrega atrapa-todo (ver los dos invariantes siguientes). Ver ADR-083.
- `resolveDeliveryPointId()` (`apps/api/src/pickups/pickups.service.ts`) resuelve en dos pasos sobre los puntos **activos** de la institución: (1) match exacto — el `enrollments.grade_or_group` del alumno aparece en el `assigned_groups` de algún punto; (2) si no hay match (grupo `NULL`, o un grupo que ningún punto activo cubre), cae al punto atrapa-todo — el único punto activo sin `assigned_groups` configurado. Si la institución tampoco tiene punto atrapa-todo, el resultado es `NULL` (mismo comportamiento que antes de ADR-083 para ese caso). Ver ADR-083.
- Como máximo un punto de entrega **activo** sin `assigned_groups` (o con `assigned_groups` vacío) por institución — es el que actúa de atrapa-todo; dos lo volverían ambiguo. Se valida en capa de servicio (`DeliveryPointsService.assertNoGroupConflicts`), no en BD, mismo criterio que el invariante de `operator_user_id` de abajo. Ver ADR-083.
- Ningún grupo puede repetirse entre dos puntos de entrega **activos** de la misma institución — el match exacto del punto anterior dejaría de ser determinista. Misma capa de validación que el invariante anterior. Un punto `inactive` queda fuera de ambos chequeos, igual que queda fuera del pool de `resolveDeliveryPointId()`. Ver ADR-083.
- La entidad TypeORM expone, además de la relación `institution`, una propiedad `institutionId` de solo lectura declarada con `@RelationId()` — no es una columna nueva ni una decisión de modelo de datos, es una segunda forma de leer el mismo FK sin cargar la relación completa. Existe para que `InstitutionMembershipGuard` pueda resolver el `institutionId` de este recurso en su modo `@InstitutionResource` sin un join a `institutions`. **El mecanismo cambió**: originalmente era una columna compañera `@Column({ insert: false, update: false })` sobre la misma columna física, pero TypeORM la fusionaba con el `@JoinColumn` de la relación y el `insert: false` ganaba, así que `institution_id` nunca se escribía y toda fila nueva quedaba con `NULL`. Ver ADR-044 para el mecanismo actual; ADR-029 sigue siendo la razón de fondo de exponer el escalar.

## Enums

- `status`: `active` | `inactive`. No hay ciclo de vida más allá de activar/desactivar el punto.

## Referencias

- ADR-012 (puntos de entrega y asignación por grupo).
- ADR-011 (cualquier `institution_members`, sin restricción de `role`, puede operar la consola de puerta).
- ADR-017 (validaciones cruzadas en capa de servicio, no en base de datos).
- ADR-018 (validación de `operator_user_id` en capa de servicio, no con trigger).
- ADR-083 (matching en dos pasos con punto atrapa-todo; unicidad de atrapa-todo y de grupos entre puntos activos de la misma institución).
