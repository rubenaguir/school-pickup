# AuditLog

## Propósito
Trazabilidad de toda acción sensible del sistema (aprobaciones, alta/baja de
tutores, etc.), requerida por `CLAUDE.md` y por el marco legal (LFPDPPP: datos
de menores + ubicación).

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `actor_user_id` | `uuid` | nullable, FK → `users.id`, `ON DELETE SET NULL` | `NULL` si la acción fue del sistema |
| `action` | `varchar(100)` | NOT NULL | ej. `enrollment.approved`, `student_guardian.added` |
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

- Tabla de solo inserción (append-only): un registro de auditoría nunca se modifica ni se borra. **Se fuerza a nivel de base de datos** mediante un trigger (`BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW`) que rechaza la operación con `RAISE EXCEPTION` sin importar el rol que la ejecute, incluido el dueño de la tabla — un `REVOKE UPDATE/DELETE` no basta porque el rol de conexión de la aplicación es también el dueño de la tabla, y un dueño ignora los privilegios ACL sobre su propia tabla. El trigger bloquea todo `DELETE` sin condición; en `UPDATE` permite únicamente la forma exacta que produce el cascade `ON DELETE SET NULL` de `actor_user_id` (`actor_user_id` pasa de no nulo a nulo sin que cambie ninguna otra columna) — cualquier otro `UPDATE` sigue rechazado. Es una excepción deliberada al criterio general del proyecto (evitar mecanismos de BD y validar en capa de servicio, ADR-017/ADR-018): la inmutabilidad de un log forense/legal (LFPDPPP) debe sobrevivir incluso a un bug de la aplicación, no solo a la disciplina del código. Es el único caso del proyecto con protección a nivel de BD por encima de la capa de servicio. Ver ADR-026 punto 4 y su enmienda.
- `actor_user_id` es nullable para representar acciones automáticas del sistema (ej. una transición de `pickup_request.status` disparada por el `worker` sin intervención humana), de forma consistente con `pickup_request_status_history.changed_by_user_id`.
- Toda acción sensible mencionada en `CLAUDE.md` (aprobaciones, alta/baja de tutores) debe generar una fila aquí; es una obligación transversal del backend, no una regla que viva en el esquema de `audit_log` mismo.

## Enums

- `action` es `varchar` libre, no un enum de PostgreSQL: la lista de acciones auditables crece con cada nuevo módulo de dominio y no conviene fijarla como tipo de base de datos. Convención de nombres: `entity.verb`, donde `entity` es una **entidad real del dominio** (ej. `enrollment.approved`, `institution.suspended`, `student_guardian.added` — no `guardian.*`, que no es una tabla), sin catálogo cerrado — nuevos tipos de evento no requieren migración de esquema. Ver ADR-018 punto 9 y ADR-026 punto 5.

## Referencias

- `CLAUDE.md` (toda acción sensible se registra en `audit_log`).
- `docs/arquitectura.md` (privacidad y marco legal LFPDPPP; `audit_log` para trazabilidad).
- ADR-018 (convención de nombres `entity.verb` para `action`).
- ADR-026 (punto 4 y su enmienda: protección append-only a nivel de BD vía trigger; punto 5: prefijo canónico `student_guardian.*`, no `guardian.*`).
