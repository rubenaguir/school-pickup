# Feature 020 — Transición automática a `arriving`

## Propósito

El `worker` evalúa, en cada actualización de ubicación, si un `pickup_requests`
debe pasar de `en_route` a `arriving` (el tutor está cerca de llegar). Es una
transición **automática del sistema**, sin acción humana, que avisa al tablero y
a la consola de puerta que preparen al alumno.

## Entidades involucradas

- `pickup_requests` (actualizado: `status` de `en_route` a `arriving`)
- `pickup_request_status_history` (creada una fila, `changed_by_user_id = null`)
- `institutions` (leído: `location`, `geofence_radius_meters` y
  `arriving_lead_minutes` para las dos condiciones de disparo)

## Precondiciones

- El `pickup_requests` está en `status = en_route`.
- La transición `en_route → arriving` es válida según la máquina de estados
  compartida en `packages/shared` (`pickup-request-status-machine.ts`, ADR-017,
  ADR-024 punto 8). El `worker` **invoca** `canTransition(en_route, arriving)`;
  no reimplementa la regla.

## Postcondiciones

- Se dispara la transición cuando se cumple **cualquiera** de estas dos
  condiciones (lo que ocurra primero), evaluadas en cada actualización de
  ubicación (feature 019) — ADR-024 punto 3:
  - **Umbral de tiempo:** el `eta_seconds` recalculado cae por debajo de
    `institutions.arriving_lead_minutes` (int, default 5; minutos de ETA restante
    a partir de los cuales se prepara al alumno). Configurable por institución
    porque el tiempo de preparación varía por plantel; **o**
  - **Proximidad geográfica:** la última posición entra al radio de arribo:
    comparar `pickup_requests.last_location` contra `institutions.location` con
    `geofence_radius_meters` (radio de **arribo**, ADR-013) mediante PostGIS
    (ej. `ST_DWithin`).
  Son condiciones distintas y complementarias (ADR-024 punto 3): el umbral de
  tiempo da margen para vocear antes de la llegada física; la geocerca detecta la
  llegada real. Nota: se usa `geofence_radius_meters` (arribo), no
  `activation_radius_meters` (activación del botón, otro radio — ADR-013).
- Al transicionar:
  - `pickup_requests.status` pasa a `arriving`.
  - Se crea una fila en `pickup_request_status_history` con `status = arriving` y
    **`changed_by_user_id = null`** (transición automática del sistema, no de una
    persona — invariante de `specs/entities/pickup_request_status_history.md`).
  - Se publica el estado actualizado (vía `MqttClient`) al feed agregado
    `school-pickup/institution/{institutionId}/board` y, si hay
    `delivery_point_id`, a la cola
    `school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`.

## Casos Given/When/Then

### Caso de éxito — entrada al radio de arribo

```
Given un pickup_request en status = en_route
When una actualización de ubicación coloca last_location dentro del
     geofence_radius_meters de institution.location (ST_DWithin)
  And la máquina de estados compartida permite en_route → arriving
Then status pasa a arriving
  And se crea la fila de historial con changed_by_user_id = null
  And se publica el estado a los topics correspondientes
```

### Caso de éxito — ETA por debajo de arriving_lead_minutes

```
Given un pickup_request en status = en_route
When el eta_seconds recalculado cae por debajo de
     institution.arriving_lead_minutes (default 5 min)
Then status pasa a arriving (mismos efectos de historial y publicación)
```

### Caso: aún lejos y con ETA alto

```
Given un pickup_request en status = en_route
When la ubicación está fuera del geofence_radius_meters y el eta_seconds sigue
     por encima de arriving_lead_minutes
Then no hay transición: el pickup_request permanece en en_route
```

### Caso: ya no está en en_route

```
Given un pickup_request en status = arriving, arrived, delivered o cancelled
When llega una nueva ubicación
Then no se vuelve a disparar la transición a arriving (la máquina de estados no
     valida en_route → arriving desde esos estados)
```

## Referencia a contrato de API

No expone REST propio (transición interna del `worker`). El payload publicado
está en `specs/api-contracts/pickup-realtime-mqtt.md`.

## Referencia a MQTT

Publica el estado actualizado (vía `MqttClient`) al feed agregado y, si hay
`delivery_point_id`, a la cola del punto de entrega. Ver
`specs/api-contracts/pickup-realtime-mqtt.md`.

## Referencias

- ADR-013 (ciclo de vida; `geofence_radius_meters` = radio de arribo, distinto
  de `activation_radius_meters`).
- ADR-017 (máquina de estados compartida en `packages/shared`; `MqttClient`
  como port).
- ADR-024 (punto 3: umbral de tiempo `arriving_lead_minutes` configurable, O la
  geocerca, lo que ocurra primero; punto 8: transiciones válidas).
- `specs/entities/pickup_request.md`,
  `specs/entities/pickup_request_status_history.md`,
  `specs/entities/institution.md`.
- `specs/features/019-ingesta-ubicacion-y-eta.md` (fuente de las actualizaciones
  de ubicación y del ETA que disparan esta evaluación).
- `docs/arquitectura.md` (flujo de tiempo real).

## Preguntas abiertas

Ninguna: el umbral de tiempo para `arriving` se resolvió como
`institutions.arriving_lead_minutes` (int, default 5), disparando la transición
junto con la geocerca —lo que ocurra primero— (ADR-024 punto 3).
