# StudentGuardian

## Propósito
Tutores autorizados por alumno (madre, padre, abuela, chofer). Modela la
relación muchos-a-muchos entre `student` y `user` que permite múltiples
tutores autorizados por alumno.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `student_id` | `uuid` | NOT NULL, FK → `student.id`, `ON DELETE CASCADE` | |
| `guardian_user_id` | `uuid` | NOT NULL, FK → `user.id`, `ON DELETE RESTRICT` | |
| `relationship` | `enum` (`mother`, `father`, `grandparent`, `driver`, `other`) | NOT NULL | |
| `is_primary` | `boolean` | NOT NULL, default `false` | tutor principal; ver invariantes |
| `status` | `enum` (`active`, `invited`, `revoked`) | NOT NULL, default `invited` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Restricción: único `(student_id, guardian_user_id)`.

## Relaciones

- `belongsTo Student` (`student`) — vía `student_id`.
- `belongsTo User` (`guardian`) — vía `guardian_user_id`.

## Índices

- Único compuesto `(student_id, guardian_user_id)` (ya es la constraint principal).
- Índice en `guardian_user_id` (pantalla "mis alumnos" del tutor: listar todos los `student` para los que es guardián).
- Índice en `(student_id, status)` para resolver rápido "tutores activos autorizados de este alumno" (usado al verificar autorización de un `pickup_request`).
- Índice único parcial `UNIQUE INDEX ... ON student_guardians (student_id) WHERE is_primary = true` — fuerza en base de datos que solo un tutor por alumno sea el principal (ver invariantes). Ver ADR-018.

## Invariantes de negocio

- Un tutor no puede tener más de una relación con el mismo alumno (constraint única `(student_id, guardian_user_id)`).
- Solo tutores en `status = active` deberían poder iniciar un `pickup_request` para ese alumno; `invited` y `revoked` no están autorizados. Esta regla no está formalizada en ningún ADR como constraint de base de datos — se aplicaría a nivel de servicio/`feature`.
- `is_primary`: solo un `student_guardian` por `student_id` puede tener `is_primary = true`. Se fuerza con un índice único parcial de Postgres (no es solo convención de UI). Ver ADR-018.
- `status = revoked` es terminal, igual que `enrollment.rejected`: no puede reactivarse directamente. Restablecer el vínculo requiere una nueva invitación (nueva fila o reinicio explícito del flujo de invitación, a definir en `specs/features/`). Ver ADR-018.

## Enums

- `relationship`: `mother` | `father` | `grandparent` | `driver` | `other`. Clasificación, no ciclo de vida.
- `status`: `active` | `invited` | `revoked`. Transición esperada: `invited → active` (el tutor acepta) y `active → revoked` (se le retira autorización). `revoked` es terminal — ver invariantes. Ver ADR-018.

## Referencias

- docs/modelo-datos.md (tutores autorizados múltiples por alumno).
- Visión general del proyecto en `CLAUDE.md` (alcance del MVP: "Tutores autorizados múltiples por alumno").
- ADR-018 (índice único parcial para `is_primary`; `revoked` terminal).
