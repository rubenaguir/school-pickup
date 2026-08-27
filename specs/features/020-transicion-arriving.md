# Feature 020 — Transición automática a `approaching` / `arriving`

## Propósito

El `worker` evalúa, en cada actualización de ubicación, si un `pickup_requests`
debe pasar a `approaching` (el tutor entró al radio de activación) o a `arriving`
(el tutor está cerca de llegar). Son transiciones **automáticas del sistema**,
sin acción humana, que avisan al tablero y a la consola de puerta que preparen
al alumno. Ver ADR-093 para `approaching`.

## Orden de evaluación (ADR-093)

En cada actualización de ubicación, con el ETA ya recalculado:

1. Se evalúa primero `arriving` (condiciones abajo). Ahora es válido tanto desde
   `en_route` como desde `approaching`.
2. Si `arriving` no aplica y el `status` sigue en `en_route`, se evalúa
   `approaching`: la última posición cae dentro de
   `institutions.activation_radius_meters` (distancia haversine
   `last_location` ↔ `institutions.location`, mismo mecanismo que la mitad
   geográfica de `arriving`).

Un tutor que arranca ya muy cerca puede saltar `approaching` directo a
`arriving`/`arrived` — el estado nunca es obligatorio de pasar.

## Entidades involucradas

- `pickup_requests` (actualizado: `status` de `en_route` a `arriving`)
- `pickup_request_status_history` (creada una fila, `changed_by_user_id = null`)
- `institutions` (leído: `location`, `geofence_radius_meters`,
  `arriving_lead_minutes` para las condiciones de `arriving`, y
  `activation_radius_meters` para la condición de `approaching`)

## Precondiciones

- Para `arriving`: el `pickup_requests` está en `status = en_route` o
  `status = approaching`.
- Para `approaching`: el `pickup_requests` está en `status = en_route`.
- Las transiciones son válidas según la máquina de estados compartida en
  `packages/shared` (`pickup-request-status-machine.ts`, ADR-017, ADR-024 punto
  8, ADR-093). El `worker` **invoca** `canTransition(...)` / la máquina de
  estados; no reimplementa la regla.

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
  llegada real. Para `arriving` se usa `geofence_radius_meters` (arribo), no
  `activation_radius_meters` (radio de activación, que dispara `approaching`).
- Se dispara la transición a `approaching` cuando, no habiéndose cumplido
  `arriving` y con el `status` aún en `en_route`, la distancia haversine
  `last_location` ↔ `institutions.location` es `<= activation_radius_meters`
  (ADR-093).
- Al transicionar a `arriving`:
  - `pickup_requests.status` pasa a `arriving`.
  - Se crea una fila en `pickup_request_status_history` con `status = arriving` y
    **`changed_by_user_id = null`** (transición automática del sistema, no de una
    persona — invariante de `specs/entities/pickup_request_status_history.md`).
  - Se publica el estado actualizado (vía `MqttClient`) al feed agregado
    `school-pickup/institution/{institutionId}/board` y, si hay
    `delivery_point_id`, a la cola
    `school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`.
- Al transicionar a `approaching`: mismos efectos (fila de historial con
  `changed_by_user_id = null`, publicación a los mismos topics). El tablero lo
  usa para un tono breve de activación (sin voz, sin nombre de alumno) — ADR-093.

## Casos Given/When/Then

### Caso de éxito — entrada al radio de activación

```
Given un pickup_request en status = en_route
When una actualización de ubicación coloca last_location dentro del
     activation_radius_meters de institution.location (pero fuera del
     geofence_radius_meters y con eta_seconds por encima de arriving_lead_minutes)
Then status pasa a approaching
  And se crea la fila de historial con changed_by_user_id = null
  And se publica el estado a los topics correspondientes
```

### Caso — approaching a arriving

```
Given un pickup_request en status = approaching
When una actualización de ubicación cumple cualquiera de las condiciones de
     arriving (geocerca o umbral de ETA)
Then status pasa a arriving
```

### Caso — salto directo, sin pasar por approaching

```
Given un pickup_request en status = en_route
When en su primera actualización de ubicación ya cumple una condición de arriving
Then status pasa a arriving directamente (approaching no es obligatorio)
```

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

### Caso: ya no es candidato

```
Given un pickup_request en status = arrived, delivered o cancelled
When llega una nueva ubicación
Then no se dispara ninguna transición (la máquina de estados no valida
     arriving/approaching desde esos estados)
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
- ADR-093 (estado `approaching`: `activation_radius_meters` como disparador,
  orden de evaluación arriving-primero, `arriving` válido también desde
  `approaching`).
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
