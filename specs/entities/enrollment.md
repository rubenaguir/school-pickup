# Enrollments

## Propósito
Asociación alumno ↔ institución, sujeta a aprobación por parte de la
institución. Es el nexo que habilita a un `students` a tener `pickup_requests`
en una `institutions` concreta. Ver ADR-004.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `student_id` | `uuid` | NOT NULL, FK → `students.id`, `ON DELETE CASCADE` | |
| `institution_id` | `uuid` | NOT NULL, FK → `institutions.id`, `ON DELETE CASCADE` | |
| `status` | `enum` (`pending`, `approved`, `rejected`) | NOT NULL, default `pending` | |
| `grade_or_group` | `varchar(100)` | nullable | contexto escolar; usado para asignar `delivery_points`. Ver ADR-012 |
| `enrollment_code` | `varchar(50)` | NOT NULL, único | folio/matrícula visible en UI. Ver ADR-016 |
| `requested_by_user_id` | `uuid` | NOT NULL, FK → `users.id`, `ON DELETE RESTRICT` | tutor solicitante |
| `reviewed_by_user_id` | `uuid` | nullable, FK → `users.id`, `ON DELETE SET NULL` | miembro de la institución que revisó |
| `requested_at` | `timestamptz` | NOT NULL, default `now()` | |
| `reviewed_at` | `timestamptz` | nullable | |

Restricción: índice único parcial `(student_id, institution_id) WHERE status IN ('pending', 'approved')` — excluye el estado terminal `rejected`. Ver ADR-026 punto 1.

## Relaciones

- `belongsTo Student` (`students`) — vía `student_id`.
- `belongsTo Institution` (`institutions`) — vía `institution_id`.
- `belongsTo User` (`requestedBy`) — vía `requested_by_user_id`.
- `belongsTo User` (`reviewedBy`, nullable) — vía `reviewed_by_user_id`.
- `hasMany PickupRequest` (`pickupRequests`) — vía `pickup_requests.enrollment_id`. `ON DELETE RESTRICT` desde el hijo (no debe poder borrarse un `enrollments` con `pickup_requests` asociados; el histórico se conserva).

## Índices

- Índice único parcial `(student_id, institution_id) WHERE status IN ('pending', 'approved')` (es la constraint principal: un alumno no puede tener dos `enrollments` **no terminales** en la misma institución; una fila `rejected` previa no bloquea una solicitud nueva). Mismo patrón que el índice parcial de `vehicles.is_primary` (ADR-018) y la recogida activa única de `pickup_requests` (ADR-024). Ver ADR-026 punto 1.
- Único en `enrollment_code` (ya cubierto por la constraint).
- Índice en `(institution_id, status)` para la pantalla de aprobaciones pendientes del staff de institución.
- Índice en `grade_or_group` si el volumen de instituciones/alumnos lo justifica (soporta la resolución de `delivery_points` al crear un `pickup_requests`).

## Invariantes de negocio

- Un alumno no puede tener más de un `enrollments` **no terminal** con la misma institución. Se fuerza con el índice único parcial `(student_id, institution_id) WHERE status IN ('pending', 'approved')`: `pending` y `approved` son excluyentes, pero una fila `rejected` previa no bloquea una solicitud nueva (que se crea como una fila nueva, no reactivando la existente — `rejected` es terminal). Ver ADR-026 punto 1.
- `enrollment_code` es único globalmente (no solo por institución), y vive aquí — no en `students` — porque el folio es propio de la relación alumno–institución: un mismo alumno tiene folios distintos en su primaria y en su clase de taekwondo. Ver ADR-016.
- `grade_or_group` alimenta directamente la asignación automática de `pickup_requests.delivery_point_id` (match contra `delivery_points.assigned_groups`). Ver ADR-012.
- Un `enrollments` no puede pasar a `approved` si `institutions.status != approved` (institución aún no aprobada por el super-admin, o suspendida). Es una regla que cruza hacia `institutions`; **se valida en la capa de servicio** (NestJS) al aprobar, no con un constraint de base de datos, y su violación responde 422 en `specs/api-contracts/enrollments.md`. Ver ADR-018 y ADR-025 punto 5.
- `rejected` es terminal: no puede reactivarse in-place. Un tutor que quiera volver a intentarlo envía una **solicitud nueva**, que crea una **fila nueva** (no reutiliza la `rejected` previa). El índice único parcial `(student_id, institution_id) WHERE status IN ('pending', 'approved')` excluye deliberadamente `rejected` para permitirlo. Ver ADR-018 y ADR-026 punto 1.
- La entidad TypeORM expone, además de la relación `institution`, una propiedad `institutionId` de solo lectura declarada con `@RelationId()` — no es una columna nueva ni una decisión de modelo de datos, es una segunda forma de leer el mismo FK sin cargar la relación completa. Existe para que `InstitutionMembershipGuard` pueda resolver el `institutionId` de este recurso en su modo `@InstitutionResource` sin un join a `institutions`. **El mecanismo cambió**: originalmente era una columna compañera `@Column({ insert: false, update: false })` sobre la misma columna física, pero TypeORM la fusionaba con el `@JoinColumn` de la relación y el `insert: false` ganaba, así que `institution_id` nunca se escribía y toda fila nueva quedaba con `NULL`. Ver ADR-044 para el mecanismo actual; ADR-029 sigue siendo la razón de fondo de exponer el escalar.

## Enums

- `status`: `pending` | `approved` | `rejected`. Transición esperada: `pending → approved` o `pending → rejected`, decidida por un miembro de la institución (`reviewed_by_user_id` + `reviewed_at`). `rejected` es terminal (ver invariantes). Ver ADR-018.

## Referencias

- ADR-004 (multi-institución por alumno).
- ADR-012 (asignación automática de punto de entrega vía `grade_or_group`).
- ADR-016 (`enrollment_code` vive en `enrollments`, no en `students`).
- ADR-018 (condición de aprobación ligada a `institutions.status`; `rejected` terminal).
- ADR-025 (punto 5: aprobación con `institutions.status != approved` responde 422).
- ADR-026 (punto 1: índice único parcial que excluye `rejected`, para permitir una solicitud nueva tras un rechazo sin reactivar la fila terminal).
