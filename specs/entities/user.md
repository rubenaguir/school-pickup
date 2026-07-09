# User

## Propósito
Cuenta de autenticación para todos los roles de la plataforma (tutor, personal
de institución, super-admin). El rol operativo dentro de una institución vive
en `institution_member`, no en `user`; la condición de tutor se deriva de la
existencia de filas en `student_guardian`.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `email` | `varchar(255)` | NOT NULL, único | login |
| `password_hash` | `varchar(255)` | nullable | hash Argon2; `NULL` mientras el usuario está `invited` sin haber definido contraseña. Ver ADR-022 |
| `full_name` | `varchar(255)` | NOT NULL | |
| `phone` | `varchar(30)` | nullable | |
| `status` | `enum` (`active`, `invited`, `suspended`) | NOT NULL, default `invited` | |
| `is_super_admin` | `boolean` | NOT NULL, default `false` | operador de la plataforma |
| `notify_enrollment_approved` | `boolean` | NOT NULL, default `true` | ver ADR-016 |
| `notify_dismissal_reminder` | `boolean` | NOT NULL, default `true` | ver ADR-016 |
| `notify_delivery_confirmed` | `boolean` | NOT NULL, default `true` | ver ADR-016 |
| `notify_product_news` | `boolean` | NOT NULL, default `false` | ver ADR-016 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `hasMany InstitutionMember` (`institutionMembers`) — vía `institution_member.user_id`. Cascade: `ON DELETE RESTRICT` desde el hijo (no se borra un usuario con membresías activas).
- `hasMany StudentGuardian` (`guardianOf`) — vía `student_guardian.guardian_user_id`. `ON DELETE RESTRICT`.
- `hasMany Vehicle` (`vehicles`) — vía `vehicle.guardian_user_id`. `ON DELETE RESTRICT`.
- `hasMany Student` (`studentsCreated`) — vía `student.created_by_user_id`. `ON DELETE RESTRICT`.
- `hasMany Enrollment` (`enrollmentsRequested`, `enrollmentsReviewed`) — vía `enrollment.requested_by_user_id` / `enrollment.reviewed_by_user_id`. `ON DELETE RESTRICT` / `ON DELETE SET NULL` (reviewer es nullable).
- `hasMany PickupRequest` (`pickupRequests`) — vía `pickup_request.guardian_user_id`. `ON DELETE RESTRICT`.
- `hasMany PickupRequestStatusHistory` (`statusChangesMade`) — vía `pickup_request_status_history.changed_by_user_id`. `ON DELETE SET NULL` (nullable: transición automática).
- `hasMany DeliveryPoint` (`operatedDeliveryPoints`) — vía `delivery_point.operator_user_id`. `ON DELETE SET NULL`.
- `hasMany AuditLog` (`auditLogEntries`) — vía `audit_log.actor_user_id`. `ON DELETE SET NULL`.

## Índices

- Único en `email` (ya cubierto por la constraint de unicidad).
- Índice en `status` si el listado de super-admin necesita filtrar usuarios suspendidos/invitados con frecuencia (uso probable pero no confirmado en specs de features aún).

## Invariantes de negocio

- El rol dentro de una institución NO vive aquí: se resuelve consultando `institution_member`. `user` no tiene columna `role`.
- La condición de "tutor" no es un flag en `user`: se deriva de tener al menos una fila en `student_guardian` como `guardian_user_id`.
- La autenticación biométrica ("inicio con huella") es responsabilidad exclusiva del cliente (WebAuthn/plataforma) y no tiene representación en esta tabla. Ver ADR-016.
- La mayoría de los FK hacia `user` en el resto del modelo asumen borrado lógico (`status = suspended`), no borrado físico — de ahí que la mayoría de relaciones entrantes usen `ON DELETE RESTRICT`/`SET NULL` en vez de `CASCADE`.
- `password_hash` es nullable: es `NULL` para un `user` invitado por un admin (`institution_member`) o por otro tutor (`student_guardian`) que aún no define contraseña. Invariante: un `user` con `status = active` debe tener `password_hash` no nulo. No se implementa como `CHECK` constraint; se valida en la capa de servicio al activar la cuenta (auto-registro con contraseña de entrada, o aceptación de invitación que la define por primera vez), consistente con ADR-017. Ver ADR-022.

## Enums

- `status`: `active` | `invited` | `suspended`. Transiciones válidas: `invited → active` (al completar registro/primer login), `active ⇄ suspended` (acción de administrador o super-admin), e `invited → suspended` (revocar una invitación antes de que se acepte). Ver ADR-018.

## Referencias

- ADR-016 (preferencias de notificación inline, biometría solo cliente).
- ADR-011 (el rol operativo vive en `institution_member`, no aquí).
- ADR-018 (transiciones válidas de `status`).
- ADR-022 (`password_hash` nullable; invariante `active` ⇒ `password_hash` no nulo).
