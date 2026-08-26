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
| `status` | `enum` (`pending`, `approved`, `rejected`, `withdrawn`) | NOT NULL, default `pending` | `withdrawn` agregado por ADR-088 |
| `group_id` | `uuid` | nullable, FK → `institution_groups.id`, `ON DELETE SET NULL` | contexto escolar; usado para asignar `delivery_points`. La respuesta de API sigue exponiendo el campo de solo lectura `gradeOrGroup: string \| null`, resuelto por join a `group.name` — no se renombra en lectura. Ver ADR-084 |
| `enrollment_code` | `varchar(50)` | NOT NULL, único | folio/matrícula visible en UI. Ver ADR-016 |
| `requested_by_user_id` | `uuid` | NOT NULL, FK → `users.id`, `ON DELETE RESTRICT` | tutor solicitante |
| `reviewed_by_user_id` | `uuid` | nullable, FK → `users.id`, `ON DELETE SET NULL` | miembro de la institución que revisó |
| `requested_at` | `timestamptz` | NOT NULL, default `now()` | |
| `reviewed_at` | `timestamptz` | nullable | |
| `withdrawn_by_user_id` | `uuid` | nullable, FK → `users.id`, `ON DELETE SET NULL` | tutor **o** miembro de la institución que dio de baja — mismo patrón que `reviewed_by_user_id`. Ver ADR-088 |
| `withdrawn_at` | `timestamptz` | nullable | Ver ADR-088 |

Restricción: índice único parcial `(student_id, institution_id) WHERE status IN ('pending', 'approved')` — excluye los estados terminales `rejected` y `withdrawn`. Ver ADR-026 punto 1 y ADR-088.

## Relaciones

- `belongsTo Student` (`students`) — vía `student_id`.
- `belongsTo Institution` (`institutions`) — vía `institution_id`.
- `belongsTo InstitutionGroup` (`group`, nullable) — vía `group_id`, `ON DELETE SET NULL`. Ver ADR-084.
- `belongsTo User` (`requestedBy`) — vía `requested_by_user_id`.
- `belongsTo User` (`reviewedBy`, nullable) — vía `reviewed_by_user_id`.
- `belongsTo User` (`withdrawnBy`, nullable) — vía `withdrawn_by_user_id`. Ver ADR-088.
- `hasMany PickupRequest` (`pickupRequests`) — vía `pickup_requests.enrollment_id`. `ON DELETE RESTRICT` desde el hijo (no debe poder borrarse un `enrollments` con `pickup_requests` asociados; el histórico se conserva).

## Índices

- Índice único parcial `(student_id, institution_id) WHERE status IN ('pending', 'approved')` (es la constraint principal: un alumno no puede tener dos `enrollments` **no terminales** en la misma institución; una fila `rejected` previa no bloquea una solicitud nueva). Mismo patrón que el índice parcial de `vehicles.is_primary` (ADR-018) y la recogida activa única de `pickup_requests` (ADR-024). Ver ADR-026 punto 1.
- Único en `enrollment_code` (ya cubierto por la constraint).
- Índice en `(institution_id, status)` para la pantalla de aprobaciones pendientes del staff de institución.
- Índice en `group_id` (FK) — soporta la resolución de `delivery_points` al crear un `pickup_requests` y el conteo de uso por grupo en `GET /institutions/:id/groups`.

## Invariantes de negocio

- Un alumno no puede tener más de un `enrollments` **no terminal** con la misma institución. Se fuerza con el índice único parcial `(student_id, institution_id) WHERE status IN ('pending', 'approved')`: `pending` y `approved` son excluyentes, pero una fila `rejected`/`withdrawn` previa no bloquea una solicitud nueva (que se crea como una fila nueva, no reactivando la existente — ambos son terminales). Ver ADR-026 punto 1 y ADR-088.
- Un `enrollments` en `pending` se puede **cancelar**: la fila se borra de verdad (no hay valor de enum para este caso — nunca llegó a generar un `pickup_requests`, la FK `pickup_requests.enrollment_id → enrollments.id` es `ON DELETE RESTRICT` y solo referencia enrollments `approved`, así que el `DELETE` nunca puede chocar con ella). Solo el propio `requested_by_user_id` puede cancelar su solicitud. Ver ADR-088.
- Un `enrollments` en `approved` se puede **dar de baja** (`status = 'withdrawn'`, `withdrawn_at`/`withdrawn_by_user_id` fijados): a diferencia de cancelar, la fila se conserva como historial, igual que `rejected`. Puede darla de baja el propio `requested_by_user_id` (tutor) o un `institution_member` con `role = admin` de la institución del enrollment (mismo nivel de privilegio que aprobar/rechazar). `withdrawn` es terminal: no se reactiva in-place, igual que `rejected`. Ver ADR-088.
- `enrollment_code` es único globalmente (no solo por institución), y vive aquí — no en `students` — porque el folio es propio de la relación alumno–institución: un mismo alumno tiene folios distintos en su primaria y en su clase de taekwondo. Ver ADR-016.
- `group_id` alimenta directamente la asignación automática de `pickup_requests.delivery_point_id` (match contra las filas de `delivery_point_groups` de los puntos activos, comparación de UUID). Ver ADR-012 (decisión original) y ADR-084 (matching pasa de comparar strings a comparar IDs).
- `group_id` es editable después de creada la matrícula por dos vías: opcionalmente al aprobar (`PATCH /enrollments/:id/approve`, DTO `groupId`), y mediante `PATCH /enrollments/:id/group` para matrículas ya `approved` (esta segunda vía exige `status = approved` y, a diferencia de reintentar `approve()`, no reenvía el correo de aprobación; DTO `UpdateEnrollmentGroupDto.groupId`). Ambas vías validan que `groupId` pertenezca a la misma institución que la matrícula → 422 `GROUP_NOT_IN_INSTITUTION` si no. El endpoint y los DTOs se renombraron desde `.../grade`/`gradeOrGroup` — la respuesta de lectura sigue llamándose `gradeOrGroup`. Ver ADR-083 (decisión original del endpoint) y ADR-084 (renombre a `groupId`/`/group`).
- Un `enrollments` no puede pasar a `approved` si `institutions.status != approved` (institución aún no aprobada por el super-admin, o suspendida). Es una regla que cruza hacia `institutions`; **se valida en la capa de servicio** (NestJS) al aprobar, no con un constraint de base de datos, y su violación responde 422 en `specs/api-contracts/enrollments.md`. Ver ADR-018 y ADR-025 punto 5.
- `rejected` es terminal: no puede reactivarse in-place. Un tutor que quiera volver a intentarlo envía una **solicitud nueva**, que crea una **fila nueva** (no reutiliza la `rejected` previa). El índice único parcial `(student_id, institution_id) WHERE status IN ('pending', 'approved')` excluye deliberadamente `rejected` para permitirlo. Ver ADR-018 y ADR-026 punto 1.
- La entidad TypeORM expone, además de la relación `institution`, una propiedad `institutionId` de solo lectura declarada con `@RelationId()` — no es una columna nueva ni una decisión de modelo de datos, es una segunda forma de leer el mismo FK sin cargar la relación completa. Existe para que `InstitutionMembershipGuard` pueda resolver el `institutionId` de este recurso en su modo `@InstitutionResource` sin un join a `institutions`. **El mecanismo cambió**: originalmente era una columna compañera `@Column({ insert: false, update: false })` sobre la misma columna física, pero TypeORM la fusionaba con el `@JoinColumn` de la relación y el `insert: false` ganaba, así que `institution_id` nunca se escribía y toda fila nueva quedaba con `NULL`. Ver ADR-044 para el mecanismo actual; ADR-029 sigue siendo la razón de fondo de exponer el escalar.

## Enums

- `status`: `pending` | `approved` | `rejected` | `withdrawn`. Transiciones esperadas: `pending → approved` o `pending → rejected`, decidida por un miembro de la institución (`reviewed_by_user_id` + `reviewed_at`); `pending → ` (fila borrada, "cancelar") por el propio tutor; `approved → withdrawn` ("dar de baja", `withdrawn_by_user_id` + `withdrawn_at`) por el tutor o por un miembro de la institución. `rejected` y `withdrawn` son terminales (ver invariantes). Ver ADR-018 y ADR-088.

## Referencias

- ADR-004 (multi-institución por alumno).
- ADR-012 (asignación automática de punto de entrega vía `grade_or_group`).
- ADR-016 (`enrollment_code` vive en `enrollments`, no en `students`).
- ADR-018 (condición de aprobación ligada a `institutions.status`; `rejected` terminal).
- ADR-025 (punto 5: aprobación con `institutions.status != approved` responde 422).
- ADR-026 (punto 1: índice único parcial que excluye `rejected`, para permitir una solicitud nueva tras un rechazo sin reactivar la fila terminal).
- ADR-083 (`grade_or_group` editable al aprobar y, para matrículas ya `approved`, vía el endpoint que ADR-084 renombra).
- ADR-084 (`grade_or_group`→`group_id` con FK a `institution_groups`; endpoint y DTOs de escritura renombrados a `group`/`groupId`; respuesta de lectura sin cambio).
- ADR-088 (estado `withdrawn` + columnas `withdrawn_at`/`withdrawn_by_user_id`; cancelar un `pending` es un `DELETE` real, sin valor de enum propio).
