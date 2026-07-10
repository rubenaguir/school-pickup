# StudentGuardians

## Propósito
Tutores autorizados por alumno (madre, padre, abuela, chofer). Modela la
relación muchos-a-muchos entre `students` y `users` que permite múltiples
tutores autorizados por alumno.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `student_id` | `uuid` | NOT NULL, FK → `students.id`, `ON DELETE CASCADE` | |
| `guardian_user_id` | `uuid` | NOT NULL, FK → `users.id`, `ON DELETE RESTRICT` | |
| `relationship` | `enum` (`mother`, `father`, `grandparent`, `driver`, `other`) | NOT NULL | |
| `is_primary` | `boolean` | NOT NULL, default `false` | tutor principal; ver invariantes |
| `status` | `enum` (`active`, `invited`, `revoked`) | NOT NULL, default `invited` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Restricción: índice único parcial `(student_id, guardian_user_id) WHERE status IN ('invited', 'active')` — excluye el estado terminal `revoked`. Ver ADR-026 punto 1.

## Relaciones

- `belongsTo Student` (`students`) — vía `student_id`.
- `belongsTo User` (`guardian`) — vía `guardian_user_id`.

## Índices

- Índice único parcial `(student_id, guardian_user_id) WHERE status IN ('invited', 'active')` (es la constraint principal: un tutor no puede tener dos vínculos **no terminales** con el mismo alumno; una fila `revoked` previa no bloquea una invitación nueva). Mismo patrón que el índice parcial de `is_primary`. Ver ADR-026 punto 1.
- Índice en `guardian_user_id` (pantalla "mis alumnos" del tutor: listar todos los `students` para los que es guardián).
- Índice en `(student_id, status)` para resolver rápido "tutores activos autorizados de este alumno" (usado al verificar autorización de un `pickup_requests`).
- Índice único parcial `UNIQUE INDEX ... ON student_guardians (student_id) WHERE is_primary = true` — fuerza en base de datos que solo un tutor por alumno sea el principal (ver invariantes). Ver ADR-018.

## Invariantes de negocio

- Un tutor no puede tener más de un vínculo **no terminal** con el mismo alumno. Se fuerza con el índice único parcial `(student_id, guardian_user_id) WHERE status IN ('invited', 'active')`: una fila `revoked` previa no bloquea una invitación nueva (que se crea como fila nueva, no reactivando la existente — `revoked` es terminal). Ver ADR-026 punto 1.
- Solo tutores en `status = active` deberían poder iniciar un `pickup_requests` para ese alumno; `invited` y `revoked` no están autorizados. Esta regla no está formalizada en ningún ADR como constraint de base de datos — se aplicaría a nivel de servicio/`feature`.
- `is_primary`: solo un `student_guardians` por `student_id` puede tener `is_primary = true`. Se fuerza con un índice único parcial de Postgres (no es solo convención de UI). Ver ADR-018.
- `status = revoked` es terminal, igual que `enrollments.rejected`: no puede reactivarse in-place. Restablecer el vínculo requiere una **nueva invitación** (feature 015), que crea una **fila nueva** — no reactiva la `revoked` previa. El índice único parcial excluye deliberadamente `revoked` para permitirlo. Ver ADR-018 y ADR-026 punto 1.
- **Estado inicial según cómo nace el vínculo** (el default de columna es `invited`, pero hay una excepción documentada):
  - **Guardián creador** (feature 004, alta de alumno): el tutor que registra al alumno queda con `is_primary = true` y `status = active` **directamente**, sin pasar por `invited`. No se auto-invita: es quien crea el vínculo sobre sí mismo. Sin esta fila `active`, el alumno recién creado sería invisible para su propio creador (ver regla de autorización de `specs/api-contracts/students.md`). Ver ADR-025 punto 8.
  - **Guardianes agregados después por invitación** (feature 015, ADR-023): nacen con `status = invited` (el default) y solo pasan a `active` cuando la persona acepta la invitación (feature 016). Ver ADR-023.

## Enums

- `relationship`: `mother` | `father` | `grandparent` | `driver` | `other`. Clasificación, no ciclo de vida.
- `status`: `active` | `invited` | `revoked`. Transición esperada: `invited → active` (el tutor acepta) y `active → revoked` (se le retira autorización). `revoked` es terminal — ver invariantes. Ver ADR-018.

## Referencias

- docs/modelo-datos.md (tutores autorizados múltiples por alumno).
- Visión general del proyecto en `CLAUDE.md` (alcance del MVP: "Tutores autorizados múltiples por alumno").
- ADR-018 (índice único parcial para `is_primary`; `revoked` terminal).
- ADR-023 (invitación de tutores autorizados: solo el guardián `is_primary` invita/revoca/reasigna; aceptación obligatoria; protección del guardián principal / último activo).
- ADR-025 (punto 8: excepción del guardián creador — nace `active`, no `invited`).
- ADR-026 (punto 1: índice único parcial que excluye `revoked`, para permitir una invitación nueva tras una revocación sin reactivar la fila terminal).
