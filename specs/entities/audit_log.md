# AuditLog

## Propósito
Trazabilidad de toda acción sensible del sistema (aprobaciones, alta/baja de
tutores, etc.), requerida por `CLAUDE.md` y por el marco legal (LFPDPPP: datos
de menores + ubicación).

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `actor_user_id` | `uuid` | nullable, FK → `user.id`, `ON DELETE SET NULL` | `NULL` si la acción fue del sistema |
| `action` | `varchar(100)` | NOT NULL | ej. `enrollment.approved`, `guardian.added` |
| `entity_type` | `varchar(100)` | NOT NULL | nombre de la entidad afectada |
| `entity_id` | `varchar(100)` | NOT NULL | id de la entidad afectada (texto para admitir `uuid` y `bigint`) |
| `metadata` | `jsonb` | nullable | detalle adicional específico de la acción |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `belongsTo User` (`actor`, nullable) — vía `actor_user_id`.
- No tiene FK tipado hacia `entity_type`/`entity_id`: es una referencia polimórfica genérica (registra acciones sobre cualquier entidad del dominio), por lo que `entity_id` se guarda como `varchar` en vez de `uuid` para admitir también los PK `bigserial` de tablas como `pickup_request_status_history` o `audit_log` mismo.

## Índices

- Índice en `(entity_type, entity_id)` para reconstruir el historial de auditoría de una entidad concreta.
- Índice en `actor_user_id` para reportes "¿qué hizo este usuario?".
- Índice en `created_at` para consultas por rango de fechas (reportes, auditorías).

## Invariantes de negocio

- Tabla de solo inserción (append-only): un registro de auditoría nunca se modifica ni se borra.
- `actor_user_id` es nullable para representar acciones automáticas del sistema (ej. una transición de `pickup_request.status` disparada por el `worker` sin intervención humana), de forma consistente con `pickup_request_status_history.changed_by_user_id`.
- Toda acción sensible mencionada en `CLAUDE.md` (aprobaciones, alta/baja de tutores) debe generar una fila aquí; es una obligación transversal del backend, no una regla que viva en el esquema de `audit_log` mismo.

## Enums

- `action` es `varchar` libre, no un enum de PostgreSQL: la lista de acciones auditables crece con cada nuevo módulo de dominio y no conviene fijarla como tipo de base de datos. Convención de nombres: `entity.verb` (ej. `enrollment.approved`, `institution.suspended`, `guardian.added`), sin catálogo cerrado — nuevos tipos de evento no requieren migración de esquema. Ver ADR-018.

## Referencias

- `CLAUDE.md` (toda acción sensible se registra en `audit_log`).
- `docs/arquitectura.md` (privacidad y marco legal LFPDPPP; `audit_log` para trazabilidad).
- ADR-018 (convención de nombres `entity.verb` para `action`).
