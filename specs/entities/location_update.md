# LocationUpdates

## Propósito
Histórico de telemetría de ubicación de un `pickup_requests` (alto volumen).
Alimenta el recálculo de ETA en el `worker` y el rastro de la trayectoria del
tutor durante el viaje.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `pickup_request_id` | `uuid` | NOT NULL, FK → `pickup_requests.id`, `ON DELETE CASCADE` | |
| `location` | `geography(Point,4326)` | NOT NULL | |
| `accuracy_meters` | `float` | nullable | |
| `recorded_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `belongsTo PickupRequest` (`pickupRequest`) — vía `pickup_request_id`.

## Índices

- Índice en `(pickup_request_id, recorded_at)` para reconstruir la trayectoria ordenada de un viaje.
- Índice GIST en `location` si se necesitan consultas espaciales agregadas (ej. análisis de rutas); no requerido para el flujo operativo actual (el `worker` procesa punto a punto por `pickup_request_id`).

## Invariantes de negocio

- Tabla de solo inserción (append-only), de alto volumen: cada lectura de GPS publicada por la app del padre genera una fila, sin throttling en la escritura (el throttling aplica al recálculo de ETA en el `worker`, no a la ingesta de `location_updates`). **El append-only se garantiza en la capa de servicio** (ningún endpoint ni caso de uso expone `UPDATE`/`DELETE` sobre esta tabla; la única baja es la purga por retención). A diferencia de `audit_log`, NO recibe protección de privilegios a nivel de BD: no es un log forense/legal, basta la disciplina de la capa de servicio, consistente con el resto del proyecto. Ver ADR-026 punto 4.
- `pickup_requests.last_location` es la última posición conocida (desnormalizada para lectura rápida); `location_updates` es el histórico completo del que se deriva.
- **Retención de 90 días.** Las filas se purgan 90 días después de `pickup_requests.completed_at` (ya sea `delivered` o `cancelled`), vía job programado del `worker` — especificado en `specs/features/023-purga-location-updates.md` (cadencia fijada en ADR-024 punto 6). Debe mencionarse explícitamente en el aviso de privacidad (LFPDPPP). Ver ADR-018 y ADR-024 punto 6.

## Enums

Sin columnas enum.

## Referencias

- ADR-013 (ciclo de vida de `pickup_requests`, del que depende este historial).
- ADR-018 (política de retención de 90 días y job de limpieza).
- ADR-024 (punto 6: cadencia del job de purga; especificado en feature 023).
- ADR-026 (punto 4: append-only garantizado en capa de servicio, sin protección de BD — a diferencia de `audit_log`).
- `docs/arquitectura.md` (privacidad y marco legal LFPDPPP: rastrear solo durante la ventana de recogida).
