# PickupRequestStatusHistory

## Propósito
Historial append-only de las transiciones de estado de un `pickup_request`.
Existe como tabla separada en lugar de timestamps individuales
(`arriving_at`, `arrived_at`, …) en `pickup_request`, para poder derivar
métricas (ej. "tiempo en puerta") restando `changed_at` entre filas
consecutivas. Ver ADR-013.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `pickup_request_id` | `uuid` | NOT NULL, FK → `pickup_requests.id`, `ON DELETE CASCADE` | |
| `status` | `enum` (`en_route`, `arriving`, `arrived`, `delivered`, `cancelled`) | NOT NULL | mismo enum que `pickup_request.status` |
| `changed_at` | `timestamptz` | NOT NULL, default `now()` | |
| `changed_by_user_id` | `uuid` | nullable, FK → `users.id`, `ON DELETE SET NULL` | `NULL` si la transición fue automática/del sistema |

## Relaciones

- `belongsTo PickupRequest` (`pickupRequest`) — vía `pickup_request_id`.
- `belongsTo User` (`changedBy`, nullable) — vía `changed_by_user_id`.

## Índices

- Índice en `(pickup_request_id, changed_at)` para reconstruir el historial ordenado de un viaje eficientemente (necesario para calcular métricas como "tiempo en puerta").

## Invariantes de negocio

- Tabla de solo inserción (append-only): no se actualizan ni borran filas existentes; cada transición de `pickup_request.status` genera una fila nueva. **El append-only se garantiza en la capa de servicio** (ningún endpoint ni caso de uso expone `UPDATE`/`DELETE` sobre esta tabla). A diferencia de `audit_log`, NO recibe protección de privilegios a nivel de BD: no es un log forense/legal, basta la disciplina de la capa de servicio, consistente con el resto del proyecto. Ver ADR-026 punto 4.
- `changed_by_user_id` es nullable específicamente para representar transiciones automáticas del sistema (ej. `arriving` disparada por el `worker` al detectar cercanía por geocerca, sin acción humana).
- Las métricas derivadas (ej. "tiempo en puerta") se calculan restando `changed_at` entre filas consecutivas de esta tabla — no hay campos de timestamp ad-hoc por estado en `pickup_request`.
- Las transiciones que generan estas filas deben ser válidas según la máquina de estados compartida en `packages/shared` (ver ADR-017); esta tabla registra el resultado de una transición ya validada, no valida por sí misma.

## Enums

- `status`: mismo dominio que `pickup_request.status` (`en_route`, `arriving`, `arrived`, `delivered`, `cancelled`). Ver `specs/entities/pickup_request.md` para el detalle de transiciones válidas.

## Referencias

- ADR-013 (historial en tabla separada en vez de timestamps individuales).
- ADR-017 (máquina de estados compartida en `packages/shared`).
- ADR-024 (punto 8: conjunto completo de transiciones válidas del enum de `status`, incluido el salto directo `en_route → arrived`).
- ADR-026 (punto 4: append-only garantizado en capa de servicio, sin protección de BD — a diferencia de `audit_log`).
