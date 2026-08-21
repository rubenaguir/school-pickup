# DeliveryPointGroups

## Propósito
Tabla de relación muchos-a-muchos entre `delivery_points` e
`institution_groups`: qué grupos del catálogo llegan por cada punto de
entrega. Reemplaza la columna `delivery_points.assigned_groups`
(`varchar(100)[]` de texto libre). Mismo criterio de tabla de relación que
`student_guardians` (el precedente ya existente en el proyecto), pero sin
columnas adicionales — solo las dos FK de la relación. Ver ADR-084 punto 4.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `delivery_point_id` | `uuid` | PK (compuesta), FK → `delivery_points.id`, `ON DELETE CASCADE` | |
| `group_id` | `uuid` | PK (compuesta), FK → `institution_groups.id`, `ON DELETE CASCADE` | |

No hay `id` propio ni `created_at` — a diferencia de `student_guardians`, esta
tabla no necesita historial ni metadatos propios de la relación.

## Relaciones

- `belongsTo DeliveryPoint` (`deliveryPoint`) — vía `delivery_point_id`.
- `belongsTo InstitutionGroup` (`group`) — vía `group_id`.

## Índices

- PK compuesta `(delivery_point_id, group_id)` — ya cubre las búsquedas por
  punto de entrega (matching en `resolveDeliveryPointId()`) y por grupo
  (conteo de uso en `GET /institutions/:id/groups`).
- Índice adicional en `group_id` para el conteo de uso por grupo sin
  depender del orden de la PK compuesta.

## Invariantes de negocio

- Un par `(delivery_point_id, group_id)` no puede repetirse — forzado por la
  PK compuesta.
- `delivery_point_id` y `group_id` deben pertenecer a la misma institución.
  Esta regla cruza dos tablas y no se puede expresar como FK simple; se
  valida en la capa de servicio (`DeliveryPointsService`), no con trigger de
  base de datos, consistente con ADR-017. Ver ADR-084 punto 7.
- El service **no** escribe ni borra filas de esta tabla directamente al
  borrar un `institution_groups` — el `ON DELETE CASCADE` de `group_id` hace
  ese trabajo. El service solo borra la fila del catálogo. Ver ADR-084
  punto 6.2.
- Como máximo un punto de entrega **activo** sin ninguna fila en esta tabla
  por institución — es el que actúa de atrapa-todo. Ningún grupo puede
  repetirse entre dos puntos de entrega **activos** de la misma institución.
  Mismos invariantes de ADR-083, ahora expresados sobre `group_id` en vez de
  strings — ver `specs/entities/delivery_point.md`.

## Referencias

- ADR-084 (creación de la tabla de relación, reemplaza `assigned_groups`).
- ADR-083 (invariantes de atrapa-todo y unicidad de grupo entre puntos activos, heredados sin cambio de lógica).
- `packages/shared/src/entities/student-guardian.entity.ts` (precedente de tabla de relación).
