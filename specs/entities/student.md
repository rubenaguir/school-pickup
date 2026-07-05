# Student

## Propósito
Alumno. Es una entidad independiente de institución: un mismo alumno puede
asociarse a varias instituciones (primaria + extracurriculares) a través de
`enrollment`. Ver ADR-004.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `full_name` | `varchar(255)` | NOT NULL | |
| `birth_date` | `date` | nullable | |
| `photo_url` | `varchar(1000)` | nullable | |
| `created_by_user_id` | `uuid` | NOT NULL, FK → `user.id`, `ON DELETE RESTRICT` | tutor que lo registró |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `belongsTo User` (`createdBy`) — vía `created_by_user_id`.
- `hasMany StudentGuardian` (`guardians`) — vía `student_guardian.student_id`. `ON DELETE CASCADE`.
- `hasMany Enrollment` (`enrollments`) — vía `enrollment.student_id`. `ON DELETE CASCADE`.

## Índices

- Índice en `created_by_user_id` (listar alumnos registrados por un tutor — pantalla de perfil).

## Invariantes de negocio

- `student` no tiene relación directa con `institution`: la asociación pasa siempre por `enrollment`, lo que permite multi-institución por alumno sin duplicar el registro del alumno. Ver ADR-004.
- El tutor que crea el registro (`created_by_user_id`) no es necesariamente el único tutor autorizado: los tutores autorizados viven en `student_guardian` y pueden incluir a otros (madre, padre, abuela, chofer). Ver docs/modelo-datos.md.

## Enums

Sin columnas enum.

## Referencias

- ADR-004 (modelo "institution", multi-institución por alumno).
