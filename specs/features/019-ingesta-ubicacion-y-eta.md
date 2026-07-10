# Feature 019 — Ingesta de ubicación y cálculo de ETA

## Propósito

Proceso del `worker`: consume las ubicaciones que la app del padre publica por
MQTT durante un trayecto activo, las persiste como histórico de telemetría y
recalcula el ETA (con throttling) para alimentar el tablero y las cuentas
regresivas. Es el motor de tiempo real de la recogida, del lado del servidor.

## Entidades involucradas

- `location_updates` (creada una fila por cada lectura recibida)
- `pickup_requests` (actualizado: `last_location`, `estimated_arrival_at`,
  `eta_seconds`)

## Precondiciones

- El `worker` está suscrito, vía el port `MqttClient`, al topic de ubicación
  entrante de cada trayecto
  `school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location`
  (`docs/arquitectura.md`). La publicación la hace la app `parent`; el ACL por
  tenant del broker garantiza que solo clientes de esa institución publican ahí.
- El `pickup_requests` está en un `status` no terminal (`en_route`/`arriving`/
  `arrived`): recibir ubicación de un trayecto ya `delivered`/`cancelled` no
  alimenta ni ETA ni tablero (principio de "rastrear solo durante la ventana de
  recogida", `docs/arquitectura.md` §Privacidad).

## Postcondiciones

### Ingesta (sin throttling)
- Por **cada** lectura de GPS recibida se inserta una fila en `location_updates`
  con `pickup_request_id`, `location` (geography Point 4326), `accuracy_meters`
  (si viene) y `recorded_at`. La escritura del histórico **no** se estrangula:
  el throttling aplica solo al recálculo de ETA, no a la ingesta (invariante de
  `specs/entities/location_update.md`).

### Recálculo de ETA (con throttling)
- El recálculo de ETA **no** ocurre en cada lectura: se aplica throttling —
  **cada 20 segundos o cada 150 metros recorridos, lo que ocurra primero**
  (ADR-024, punto 2). El recálculo llama al port **`MapsProvider`** (ETA con
  tráfico en vivo); la implementación concreta (Google/Mapbox) está fuera de
  alcance y no se referencia aquí (ADR-017).
- Al recalcular se actualiza en `pickup_requests`: `last_location` (última
  posición conocida, desnormalizada para lectura rápida del tablero),
  `estimated_arrival_at` y `eta_seconds`.
- Tras actualizar, el `worker` publica el estado (ver feature 020 para la
  posible transición a `arriving`, y `pickup-realtime-mqtt.md` para el payload).
  Esta feature cubre la ingesta y el ETA; la evaluación de transición de estado
  vive en la feature 020.

## Casos Given/When/Then

### Caso de éxito — ingesta y recálculo

```
Given un pickup_request en status no terminal
  And el worker suscrito al topic de ubicación de ese pickup_request
When la app parent publica una lectura de ubicación
Then se inserta una fila en location_update con esa posición y recorded_at
  And si el throttling lo permite, se recalcula el ETA vía MapsProvider
  And se actualizan last_location, estimated_arrival_at y eta_seconds del
      pickup_request
```

### Caso: lectura dentro de la ventana de throttling

```
Given la última lectura procesada hace menos de 20 segundos y a menos de 150
      metros de desplazamiento (ADR-024 punto 2)
When el worker procesa una nueva lectura
Then se inserta la fila en location_update igualmente (la ingesta no se
     estrangula)
  And NO se llama a MapsProvider para recalcular ETA en esta lectura
```

### Caso: ubicación de un trayecto ya terminado

```
Given un pickup_request en status delivered o cancelled
When llega una lectura de ubicación tardía para ese pickup_request
Then no se recalcula ETA ni se actualiza el tablero (el rastreo se detiene al
     finalizar la ventana de recogida, docs/arquitectura.md §Privacidad)
```

## Referencia a contrato de API

No expone REST propio. El contrato del topic de ubicación entrante y de la
publicación de estado está en `specs/api-contracts/pickup-realtime-mqtt.md`.

## Referencia a MQTT

- **Consume** (vía `MqttClient`):
  `school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location`
  (publicado por `parent`).
- **Publica** el estado actualizado (feed agregado y, si aplica, cola de puerta)
  tras el recálculo — ver feature 020 y `pickup-realtime-mqtt.md`.

## Referencias

- ADR-013 (ciclo de vida de `pickup_requests`, del que depende esta telemetría).
- ADR-017 (`MapsProvider` y `MqttClient` como ports; el `worker` no se acopla a
  implementaciones concretas).
- ADR-018 (contexto de retención de `location_updates`, ver feature 023).
- ADR-024 (punto 2: throttling de recálculo de ETA en 20 s / 150 m).
- `specs/entities/location_update.md`, `specs/entities/pickup_request.md`.
- `docs/arquitectura.md` (flujo de tiempo real; ETA y costo; privacidad).

## Preguntas abiertas

Ninguna: el valor del throttling (20 s o 150 m, lo que ocurra primero) se
resolvió en ADR-024 (punto 2).
