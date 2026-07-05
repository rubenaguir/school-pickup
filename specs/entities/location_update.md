# LocationUpdate

## Propósito
Histórico de telemetría de ubicación de un `pickup_request` (alto volumen).
Alimenta el recálculo de ETA en el `worker` y el rastro de la trayectoria del
tutor durante el viaje.

## Campos

| Campo | Tipo TypeORM/PostgreSQL | Constraints | Notas |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `pickup_request_id` | `uuid` | NOT NULL, FK → `pickup_request.id`, `ON DELETE CASCADE` | |
| `location` | `geography(Point,4326)` | NOT NULL | |
| `accuracy_meters` | `float` | nullable | |
| `recorded_at` | `timestamptz` | NOT NULL, default `now()` | |

## Relaciones

- `belongsTo PickupRequest` (`pickupRequest`) — vía `pickup_request_id`.

## Índices

- Índice en `(pickup_request_id, recorded_at)` para reconstruir la trayectoria ordenada de un viaje.
- Índice GIST en `location` si se necesitan consultas espaciales agregadas (ej. análisis de rutas); no requerido para el flujo operativo actual (el `worker` procesa punto a punto por `pickup_request_id`).

## Invariantes de negocio

- Tabla de solo inserción (append-only), de alto volumen: cada lectura de GPS publicada por la app del padre genera una fila, sin throttling en la escritura (el throttling aplica al recálculo de ETA en el `worker`, no a la ingesta de `location_update`).
- `pickup_request.last_location` es la última posición conocida (desnormalizada para lectura rápida); `location_update` es el histórico completo del que se deriva.
- **Retención de 90 días.** Las filas se purgan 90 días después de `pickup_request.completed_at` (ya sea `delivered` o `cancelled`), vía job programado (implementación pendiente de especificar en `specs/features/` para el `worker`). Debe mencionarse explícitamente en el aviso de privacidad (LFPDPPP). Ver ADR-018.

## Enums

Sin columnas enum.

## Referencias

- ADR-013 (ciclo de vida de `pickup_request`, del que depende este historial).
- ADR-018 (política de retención de 90 días y job de limpieza).
- `docs/arquitectura.md` (privacidad y marco legal LFPDPPP: rastrear solo durante la ventana de recogida).
