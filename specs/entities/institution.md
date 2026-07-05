# Institution

## Propósito
Representa un plantel: una escuela o una actividad extracurricular. Es la
entidad multi-tenant raíz: casi todo el resto del dominio cuelga, directa o
indirectamente, de una `institution`. Ver ADR-004 (por qué "institution" y no
"school").

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `varchar(255)` | NOT NULL | |
| `type` | `enum` (`school`, `extracurricular`) | NOT NULL | ver ADR-004 |
| `category` | `varchar(100)` | nullable | solo cuando `type = extracurricular`; ver invariantes. Ver ADR-015 |
| `address` | `varchar(500)` | NOT NULL | |
| `location` | `geography(Point,4326)` | NOT NULL | punto de la institución |
| `geofence_radius_meters` | `int` | NOT NULL | radio de arribo. Ver ADR-013 |
| `activation_radius_meters` | `int` | NOT NULL | radio de activación del botón "ya voy". Ver ADR-013 |
| `timezone` | `varchar(50)` | NOT NULL | ej. `America/Mexico_City` |
| `cct_code` | `varchar(20)` | nullable | clave de centro de trabajo (SEP). Ver ADR-015 |
| `levels` | `varchar(50)[]` | NOT NULL, default `{}` | ver ADR-015 |
| `arrival_tolerance_minutes` | `int` | NOT NULL | ver ADR-015 |
| `advance_notice_minutes` | `int` | NOT NULL | ver ADR-015 |
| `join_code` | `varchar(20)` | NOT NULL, único | ver ADR-015 |
| `status` | `enum` (`pending`, `approved`, `suspended`) | NOT NULL, default `pending` | aprobado por super-admin |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `hasMany InstitutionMember` (`members`) — vía `institution_member.institution_id`. `ON DELETE CASCADE`.
- `hasMany DeliveryPoint` (`deliveryPoints`) — vía `delivery_point.institution_id`. `ON DELETE CASCADE`.
- `hasMany Enrollment` (`enrollments`) — vía `enrollment.institution_id`. `ON DELETE CASCADE`.
- `hasMany DismissalWindow` (`dismissalWindows`) — vía `dismissal_window.institution_id`. `ON DELETE CASCADE`.
- `hasMany DismissalException` (`dismissalExceptions`) — vía `dismissal_exception.institution_id`. `ON DELETE CASCADE`.

## Índices

- Único en `join_code` (ya cubierto por la constraint).
- Índice GIST en `location` para consultas de distancia/cercanía.
- Índice en `status` (listado de super-admin: instituciones pendientes de aprobación).

## Invariantes de negocio

- `category` debe ser `NULL` cuando `type = 'school'`; solo puede tener valor cuando `type = 'extracurricular'`. Documentado explícitamente en `docs/modelo-datos.md`. No implementado como `CHECK` constraint en la tabla — se recomienda `CHECK (type = 'extracurricular' OR category IS NULL)`.
- `geofence_radius_meters` (arribo) y `activation_radius_meters` (activación del botón "ya voy") son conceptualmente distintos y coexisten como dos campos independientes; no deben colapsarse en uno solo. Ver ADR-013.
- `levels` y `category` son texto libre (arrays/varchar), no catálogo curado, para no bloquear altas de niveles/disciplinas nuevas antes de tener un catálogo cerrado. Ver ADR-015.

## Enums

- `type`: `school` | `extracurricular`. No es un ciclo de vida, es una clasificación fija por institución.
- `status`: `pending` | `approved` | `suspended`. Transiciones válidas: `pending → approved` (aprobación de super-admin) y `approved ⇄ suspended` (bidireccional, acción de super-admin). No existe camino de `suspended` de vuelta a `pending`. No hay estado de rechazo explícito: una institución no aprobada permanece en `pending` indefinidamente hasta que el super-admin decida. Ver ADR-018.

## Referencias

- ADR-004 (modelo "institution", multi-institución por alumno).
- ADR-012 (puntos de entrega y asignación por grupo).
- ADR-013 (radios de geocerca y activación).
- ADR-015 (configuración operativa y horarios).
- ADR-018 (transiciones válidas de `status`).
