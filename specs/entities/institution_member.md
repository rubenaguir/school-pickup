# InstitutionMember

## Propósito
Relación usuario ↔ institución con un rol organizacional. Es la base del
acceso operativo a la institución (portal admin, consola de puerta). Ver
ADR-011.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `institution_id` | `uuid` | NOT NULL, FK → `institution.id`, `ON DELETE CASCADE` | |
| `user_id` | `uuid` | NOT NULL, FK → `user.id`, `ON DELETE RESTRICT` | |
| `role` | `enum` (`admin`, `gate_operator`, `coordinator`, `teacher`) | NOT NULL | ver ADR-011 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Restricción: único `(institution_id, user_id)`.

## Relaciones

- `belongsTo Institution` (`institution`) — vía `institution_id`.
- `belongsTo User` (`user`) — vía `user_id`.
- Referenciada por `DeliveryPoint.operator_user_id` (indirectamente, vía `user_id` — ver invariante de `delivery_point`).

## Índices

- Único compuesto `(institution_id, user_id)` (ya es la constraint principal).
- Índice en `user_id` para resolver "¿a qué instituciones pertenece este usuario?" (necesario para el login y para el cambio de contexto de institución en el portal).

## Invariantes de negocio

- Un usuario no puede tener más de una membresía por institución (constraint única `(institution_id, user_id)`).
- El campo `role` es informativo/organizacional (reportes, directorio de personal) y base para permisos futuros más finos, pero **no restringe hoy** el acceso a la consola de puerta: cualquier `institution_member` de la institución puede operarla, sin importar su `role`. Ver ADR-011.

## Enums

- `role`: `admin` | `gate_operator` | `coordinator` | `teacher`. No es un ciclo de vida (no hay transiciones); un miembro puede cambiar de rol por actualización directa del campo.

## Referencias

- ADR-011 (roles de personal de institución y acceso operativo a la consola de puerta).
