# DismissalWindow

## Propósito
Horario recurrente de salida de una institución (ej. "Salida vespertina"),
usado para calcular recordatorios de anticipación y validar la ventana en la
que un `pickup_request` tiene sentido. Ver ADR-015.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `institution_id` | `uuid` | NOT NULL, FK → `institution.id`, `ON DELETE CASCADE` | |
| `weekday` | `smallint` | NOT NULL | 0–6 |
| `start_time` | `time` | NOT NULL | |
| `end_time` | `time` | NOT NULL | |
| `label` | `varchar(255)` | NOT NULL | ej. "Salida vespertina". Ver ADR-015 |
| `level` | `varchar(100)` | nullable | nivel al que aplica. Ver ADR-015 |
| `status` | `enum` (`active`, `paused`) | NOT NULL, default `active` | Ver ADR-015 |

## Relaciones

- `belongsTo Institution` (`institution`) — vía `institution_id`.

## Índices

- Índice en `(institution_id, weekday, status)` para resolver rápido "ventanas activas de hoy para esta institución" (usado por `advance_notice_minutes` y por la validación de horario al crear un `pickup_request`).

## Invariantes de negocio

- `weekday` debe estar en el rango `0–6`; se recomienda `CHECK (weekday BETWEEN 0 AND 6)`.
- Permite múltiples ventanas nombradas por institución (ej. una para primaria, otra para preescolar), diferenciadas por `level` y `label`. Ver ADR-015.
- `status = paused` permite desactivar temporalmente una ventana sin borrarla (se conserva el historial de configuración).

## Enums

- `status`: `active` | `paused`. No es un ciclo de vida con transiciones documentadas más allá de alternar entre los dos valores.

## Referencias

- ADR-015 (configuración de institución y horarios).
