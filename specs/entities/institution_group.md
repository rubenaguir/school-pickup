# InstitutionGroups

## Propósito
Catálogo curado de grupos/niveles por institución (ej. "1A", "3B"). Reemplaza
el texto libre que antes vivía directamente en `enrollments.grade_or_group` y
`delivery_points.assigned_groups`, para eliminar la clase de bug donde
renombrar/reconfigurar un grupo quedaba disperso en N lugares desconectados
sin ninguna forma de detectar matrículas huérfanas. Ver ADR-084.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `institution_id` | `uuid` | NOT NULL, FK → `institutions.id`, `ON DELETE CASCADE` | |
| `name` | `varchar(100)` | NOT NULL | recortado (`trim`) antes de guardar |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `belongsTo Institution` (`institution`) — vía `institution_id`.
- `hasMany Enrollment` (`enrollments`) — vía `enrollments.group_id`. `ON DELETE SET NULL` desde el hijo (borrar un grupo no bloquea, deja sin grupo a lo que lo usaba).
- `hasMany DeliveryPointGroup` (`deliveryPointGroups`) — vía `delivery_point_groups.group_id`. `ON DELETE CASCADE` desde el hijo (la fila de relación no tiene sentido sin el grupo).

## Índices

- Índice único funcional `(institution_id, lower(name))` — case-insensitive a
  propósito: el punto de este catálogo es eliminar la clase de ambigüedad
  "1A" vs "1a" que el texto libre permitía. Ver ADR-084 punto 2 y sección 9.

## Invariantes de negocio

- `name` es único por institución, comparado sin distinguir mayúsculas de
  minúsculas — forzado por el índice único funcional sobre `lower(name)`, no
  en capa de servicio. Una violación al crear/renombrar responde 422
  `DUPLICATE_GROUP_NAME` (ver `specs/api-contracts/institution-groups.md`).
- Borrar un grupo en uso (`enrollments.group_id` o `delivery_point_groups`
  apuntándolo) requiere confirmación explícita del cliente
  (`DELETE ?confirm=true`); sin ella responde 409 `GROUP_IN_USE` con los
  conteos de uso. Ver ADR-084 punto 6 y `specs/api-contracts/institution-groups.md`.
- La entidad TypeORM expone, además de la relación `institution`, una
  propiedad `institutionId` de solo lectura declarada con `@RelationId()` —
  mismo patrón que `DeliveryPoint`/`Enrollment` (ADR-029/044), para que
  `InstitutionMembershipGuard` pueda resolver el `institutionId` de este
  recurso sin cargar la relación completa.

## Referencias

- ADR-084 (creación del catálogo; contexto completo del problema que resuelve).
- ADR-012 (decisión original de texto libre en `delivery_points.assigned_groups`, con el riesgo ya declarado).
- ADR-083 (el caso real de mantenimiento que confirmó el riesgo).
- ADR-029/044 (`@RelationId`, mismo mecanismo para `institutionId`).
- ADR-022 punto 1 (rol `admin` para escritura, lectura abierta a cualquier miembro — mismo criterio para el CRUD de grupos).
