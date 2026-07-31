# DismissalExceptions

## Propósito
Día puntual que sobreescribe el horario normal de `dismissal_windows` (ej.
"Fin de cursos", "Ensayo cívico"). Ver ADR-015.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `institution_id` | `uuid` | NOT NULL, FK → `institutions.id`, `ON DELETE CASCADE` | |
| `date` | `date` | NOT NULL | |
| `name` | `varchar(255)` | NOT NULL | ej. "Fin de cursos" |
| `level` | `varchar(100)` | nullable | nivel afectado, o "todos los niveles" |
| `time` | `time` | NOT NULL | hora de salida especial |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Restricción: único `(institution_id, date, level)`. Ver ADR-018.

## Relaciones

- `belongsTo Institution` (`institutions`) — vía `institution_id`.

## Índices

- Índice en `(institution_id, date)` para resolver rápido "¿hay una excepción de horario para esta institución hoy?" (consulta que se hace en cada cálculo de recordatorio de salida). Cubre además la restricción única `(institution_id, date, level)`.

## Invariantes de negocio

- Una `dismissal_exceptions` sobreescribe puntualmente lo definido en `dismissal_windows` para la fecha y (opcionalmente) el nivel indicados; no modifica ni reemplaza las filas de `dismissal_windows`, que se mantienen como la regla recurrente de fondo. Ver ADR-015.
- Se modela como entidad separada de `dismissal_windows` explícitamente para no mezclar "regla recurrente" con "excepción puntual" en la misma tabla. Ver ADR-015.
- Restricción única `(institution_id, date, level)`: no puede haber dos excepciones para la misma institución, fecha y nivel. El caso de un `level = NULL` ("todos los niveles") coexistiendo con una excepción de nivel específico en la misma fecha **no lo captura este constraint** (en Postgres, `NULL` nunca es igual a otro `NULL` a efectos de unicidad, así que varias filas con `level = NULL` en la misma fecha no violarían la restricción); se valida en la capa de aplicación al crear/editar una excepción. Ver ADR-018.
- La entidad TypeORM expone, además de la relación `institution`, una propiedad `institutionId` de solo lectura declarada con `@RelationId()` — no es una columna nueva ni una decisión de modelo de datos, es una segunda forma de leer el mismo FK sin cargar la relación completa. Existe para que `InstitutionMembershipGuard` pueda resolver el `institutionId` de este recurso en su modo `@InstitutionResource` sin un join a `institutions`. **El mecanismo cambió**: originalmente era una columna compañera `@Column({ insert: false, update: false })` sobre la misma columna física, pero TypeORM la fusionaba con el `@JoinColumn` de la relación y el `insert: false` ganaba, así que `institution_id` nunca se escribía y toda fila nueva quedaba con `NULL`. Ver ADR-044 para el mecanismo actual; ADR-029 sigue siendo la razón de fondo de exponer el escalar.

## Enums

Sin columnas enum.

## Referencias

- ADR-015 (configuración de institución y horarios; horarios recurrentes vs. excepciones en tablas separadas).
- ADR-018 (restricción única `(institution_id, date, level)` y su límite con `level = NULL`).
