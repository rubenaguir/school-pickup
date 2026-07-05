# Enrollment

## Propósito
Asociación alumno ↔ institución, sujeta a aprobación por parte de la
institución. Es el nexo que habilita a un `student` a tener `pickup_requests`
en una `institution` concreta. Ver ADR-004.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `student_id` | `uuid` | NOT NULL, FK → `student.id`, `ON DELETE CASCADE` | |
| `institution_id` | `uuid` | NOT NULL, FK → `institution.id`, `ON DELETE CASCADE` | |
| `status` | `enum` (`pending`, `approved`, `rejected`) | NOT NULL, default `pending` | |
| `grade_or_group` | `varchar(100)` | nullable | contexto escolar; usado para asignar `delivery_point`. Ver ADR-012 |
| `enrollment_code` | `varchar(50)` | NOT NULL, único | folio/matrícula visible en UI. Ver ADR-016 |
| `requested_by_user_id` | `uuid` | NOT NULL, FK → `user.id`, `ON DELETE RESTRICT` | tutor solicitante |
| `reviewed_by_user_id` | `uuid` | nullable, FK → `user.id`, `ON DELETE SET NULL` | miembro de la institución que revisó |
| `requested_at` | `timestamptz` | NOT NULL, default `now()` | |
| `reviewed_at` | `timestamptz` | nullable | |

Restricción: único `(student_id, institution_id)`.

## Relaciones

- `belongsTo Student` (`student`) — vía `student_id`.
- `belongsTo Institution` (`institution`) — vía `institution_id`.
- `belongsTo User` (`requestedBy`) — vía `requested_by_user_id`.
- `belongsTo User` (`reviewedBy`, nullable) — vía `reviewed_by_user_id`.
- `hasMany PickupRequest` (`pickupRequests`) — vía `pickup_request.enrollment_id`. `ON DELETE RESTRICT` desde el hijo (no debe poder borrarse un `enrollment` con `pickup_requests` asociados; el histórico se conserva).

## Índices

- Único compuesto `(student_id, institution_id)` (ya es la constraint principal: un alumno no puede tener dos `enrollment` en la misma institución).
- Único en `enrollment_code` (ya cubierto por la constraint).
- Índice en `(institution_id, status)` para la pantalla de aprobaciones pendientes del staff de institución.
- Índice en `grade_or_group` si el volumen de instituciones/alumnos lo justifica (soporta la resolución de `delivery_point` al crear un `pickup_request`).

## Invariantes de negocio

- Un alumno no puede tener más de un `enrollment` con la misma institución (constraint única `(student_id, institution_id)`); una nueva relación con esa institución, si se necesitara, reutiliza la misma fila cambiando su `status`, no crea una segunda.
- `enrollment_code` es único globalmente (no solo por institución), y vive aquí — no en `student` — porque el folio es propio de la relación alumno–institución: un mismo alumno tiene folios distintos en su primaria y en su clase de taekwondo. Ver ADR-016.
- `grade_or_group` alimenta directamente la asignación automática de `pickup_requests.delivery_point_id` (match contra `delivery_point.assigned_groups`). Ver ADR-012.
- Un `enrollment` no puede pasar a `approved` si `institution.status != approved` (institución aún no aprobada por el super-admin, o suspendida). Ver ADR-018.
- `rejected` es terminal: no puede reactivarse. Un tutor que quiera volver a intentarlo debe enviar una nueva solicitud; el manejo de la constraint única `(student_id, institution_id)` frente a una fila `rejected` previa se define en `specs/features/` al detallar el flujo de solicitud. Ver ADR-018.

## Enums

- `status`: `pending` | `approved` | `rejected`. Transición esperada: `pending → approved` o `pending → rejected`, decidida por un miembro de la institución (`reviewed_by_user_id` + `reviewed_at`). `rejected` es terminal (ver invariantes). Ver ADR-018.

## Referencias

- ADR-004 (multi-institución por alumno).
- ADR-012 (asignación automática de punto de entrega vía `grade_or_group`).
- ADR-016 (`enrollment_code` vive en `enrollment`, no en `student`).
- ADR-018 (condición de aprobación ligada a `institution.status`; `rejected` terminal).
