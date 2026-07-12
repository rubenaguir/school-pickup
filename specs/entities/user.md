# Users

## Propósito
Cuenta de autenticación para todos los roles de la plataforma (tutor, personal
de institución, super-admin). El rol operativo dentro de una institución vive
en `institution_members`, no en `users`; la condición de tutor se deriva de la
existencia de filas en `student_guardians`.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `email` | `varchar(255)` | NOT NULL, único | login |
| `password_hash` | `varchar(255)` | nullable | hash Argon2; `NULL` mientras el usuario está `invited` sin haber definido contraseña. Ver ADR-022 |
| `full_name` | `varchar(255)` | nullable | `NULL` mientras el usuario fue creado por invitación (`student_guardians`, feature 015, o `institution_members`, feature 012) y todavía no acepta — su nombre real recién se conoce en ese momento. Ver ADR-030 |
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

- `hasMany InstitutionMember` (`institutionMembers`) — vía `institution_members.user_id`. Cascade: `ON DELETE RESTRICT` desde el hijo (no se borra un usuario con membresías activas).
- `hasMany StudentGuardian` (`guardianOf`) — vía `student_guardians.guardian_user_id`. `ON DELETE RESTRICT`.
- `hasMany Vehicle` (`vehicles`) — vía `vehicles.guardian_user_id`. `ON DELETE RESTRICT`.
- `hasMany Student` (`studentsCreated`) — vía `students.created_by_user_id`. `ON DELETE RESTRICT`.
- `hasMany Enrollment` (`enrollmentsRequested`, `enrollmentsReviewed`) — vía `enrollments.requested_by_user_id` / `enrollments.reviewed_by_user_id`. `ON DELETE RESTRICT` / `ON DELETE SET NULL` (reviewer es nullable).
- `hasMany PickupRequest` (`pickupRequests`) — vía `pickup_requests.guardian_user_id`. `ON DELETE RESTRICT`.
- `hasMany PickupRequestStatusHistory` (`statusChangesMade`) — vía `pickup_request_status_history.changed_by_user_id`. `ON DELETE SET NULL` (nullable: transición automática).
- `hasMany DeliveryPoint` (`operatedDeliveryPoints`) — vía `delivery_points.operator_user_id`. `ON DELETE SET NULL`.
- `hasMany AuditLog` (`auditLogEntries`) — vía `audit_log.actor_user_id`. `ON DELETE SET NULL`.

## Índices

- Único en `email` (ya cubierto por la constraint de unicidad).
- Índice en `status` si el listado de super-admin necesita filtrar usuarios suspendidos/invitados con frecuencia (uso probable pero no confirmado en specs de features aún).

## Invariantes de negocio

- El rol dentro de una institución NO vive aquí: se resuelve consultando `institution_members`. `users` no tiene columna `role`.
- La condición de "tutor" no es un flag en `users`: se deriva de tener al menos una fila en `student_guardians` como `guardian_user_id`.
- La autenticación biométrica ("inicio con huella") es responsabilidad exclusiva del cliente (WebAuthn/plataforma) y no tiene representación en esta tabla. Ver ADR-016.
- La mayoría de los FK hacia `users` en el resto del modelo asumen borrado lógico (`status = suspended`), no borrado físico — de ahí que la mayoría de relaciones entrantes usen `ON DELETE RESTRICT`/`SET NULL` en vez de `CASCADE`.
- `password_hash` es nullable: es `NULL` para un `users` invitado por un admin (`institution_members`) o por otro tutor (`student_guardians`) que aún no define contraseña. Invariante: un `users` con `status = active` debe tener `password_hash` no nulo. No se implementa como `CHECK` constraint; se valida en la capa de servicio al activar la cuenta (auto-registro con contraseña de entrada, o aceptación de invitación que la define por primera vez), consistente con ADR-017. Ver ADR-022.
- `full_name` es nullable, mismo patrón y misma razón que `password_hash`: es `NULL` para un `users` creado por invitación (`student_guardians` o `institution_members`) cuyo nombre real todavía no se captura — se llena al aceptar la invitación. Invariante: un `users` con `status = active` debe tener `full_name` no nulo (misma validación en capa de servicio al activar, no `CHECK` de BD). Ver ADR-030.

## Enums

- `status`: `active` | `invited` | `suspended`. Transiciones válidas: `invited → active` (al completar registro/primer login), `active ⇄ suspended` (acción de administrador o super-admin), e `invited → suspended` (revocar una invitación antes de que se acepte). Ver ADR-018.

## Referencias

- ADR-016 (preferencias de notificación inline, biometría solo cliente).
- ADR-011 (el rol operativo vive en `institution_members`, no aquí).
- ADR-018 (transiciones válidas de `status`).
- ADR-022 (`password_hash` nullable; invariante `active` ⇒ `password_hash` no nulo).
