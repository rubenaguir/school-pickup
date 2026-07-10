# Feature 023 — Purga de `location_updates`

## Propósito

Job programado del `worker` que elimina la telemetría de ubicación antigua:
cumple la política de retención de 90 días y el principio de rastrear solo
durante la ventana de recogida (datos de menores + ubicación, LFPDPPP). No es un
flujo interactivo: corre de forma desatendida.

## Entidades involucradas

- `location_updates` (eliminadas las filas fuera de la ventana de retención)
- `pickup_requests` (leído: `completed_at` determina la elegibilidad)

## Precondiciones

- El job corre en el `worker` de forma programada, **una vez al día** (de
  madrugada, horario de bajo tráfico) — ADR-024, punto 6. Con una ventana de
  retención de 90 días, una cadencia diaria es suficiente.

## Postcondiciones

- Se eliminan las filas de `location_updates` cuyo `pickup_requests` asociado tiene
  `completed_at` no nulo (es decir, terminó por `delivered` o `cancelled`) con
  **más de 90 días** de antigüedad respecto a `completed_at` (ADR-018, punto 8;
  invariante de `specs/entities/location_update.md`).
- No se tocan las `location_updates` de trayectos aún activos (`completed_at`
  nulo): esos siguen en curso y su telemetría es necesaria.
- La eliminación es física (no hay borrado lógico para telemetría). El resto del
  `pickup_requests` y su `pickup_request_status_history` se conservan: la purga es
  solo de `location_updates` (la trazabilidad del viaje y sus métricas de estado
  no dependen del rastro fino de ubicación).
- Esta retención debe estar reflejada en el aviso de privacidad (LFPDPPP), ver
  `docs/arquitectura.md` §"Privacidad y marco legal".

## Casos Given/When/Then

### Caso de éxito — purga de telemetría vencida

```
Given un pickup_request con completed_at hace más de 90 días
  And filas de location_update asociadas a ese pickup_request
When corre el job de purga
Then se eliminan esas filas de location_update
  And el pickup_request y su pickup_request_status_history se conservan
```

### Caso: trayecto terminado hace menos de 90 días

```
Given un pickup_request con completed_at hace menos de 90 días
When corre el job de purga
Then sus location_update NO se eliminan (aún dentro de la ventana de retención)
```

### Caso: trayecto aún activo

```
Given un pickup_request con completed_at nulo (status no terminal)
When corre el job de purga
Then sus location_update NO se eliminan (el trayecto sigue en curso)
```

## Referencia a contrato de API

No aplica: es un job interno del `worker`, sin endpoint REST ni contrato MQTT.

## Referencia a MQTT

No aplica: la purga no publica ni consume topics MQTT.

## Referencias

- ADR-018 (punto 8: retención de 90 días de `location_updates` desde
  `pickup_requests.completed_at`; job de limpieza programado).
- ADR-024 (punto 6: cadencia diaria del job de purga).
- `specs/entities/location_update.md`, `specs/entities/pickup_request.md`.
- `docs/arquitectura.md` (§Privacidad y marco legal LFPDPPP: rastrear solo
  durante la ventana de recogida).

## Preguntas abiertas

Ninguna: la cadencia del job (diaria, de madrugada) se resolvió en ADR-024
(punto 6).
