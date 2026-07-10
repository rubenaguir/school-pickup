# API Contract — Pickup Realtime (MQTT)

Contrato de **tiempo real** de la recogida. No es REST: define los topics MQTT,
la forma del payload de cada uno y quién publica/consume. Cubre el flujo de
tiempo real de `specs/features/018`–`022`. Complementa el contrato REST de
`specs/api-contracts/pickup-requests.md`.

Tanto `api` como `worker` publican/consumen a través del port **`MqttClient`**
(ADR-017), no del cliente MQTT concreto. Los nombres de topic y el modelo de
seguridad viven en `docs/arquitectura.md` (§"Estructura de topics MQTT y
seguridad"); este documento fija los topics y **una estimación** de los payloads.

> **Payloads: estimación, no congelados (ADR-024, punto 10).** La forma de los
> payloads de abajo es un conjunto mínimo derivable del modelo de datos, **sujeto
> a revisión en Fase 7–9**, cuando se construyan los consumidores reales
> (`board`, consola de puerta) y se sepa con certeza qué campos necesita cada
> pantalla. Los nombres de topic y el modelo de seguridad sí son definitivos; el
> detalle de campos de cada payload no se congela en este slice.

## Modelo de seguridad (resumen)

- Prefijo raíz de proyecto `school-pickup/` (el broker Mosquitto es compartido
  con otras apps; el prefijo aísla el namespace).
- **ACL por tenant** en el broker: cada cliente solo publica/consume topics de su
  propia institución. Un tutor de una institución NO puede suscribirse a los de
  otra. Cualquier `institution_member` puede suscribirse a cualquier topic de
  delivery-point de su institución (ADR-011).
- TLS obligatorio (WSS). Autenticación por usuario/token en el broker, nunca
  anónimo; los tokens los emite el `api` tras el login.

## Topic — ubicación entrante

```
school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location
```

- **Publica:** la app `parent` (el tutor en camino), vía MQTT.js sobre WSS.
- **Consume:** el `worker` (feature 019), que persiste cada lectura en
  `location_update` y recalcula el ETA con throttling vía `MapsProvider`.

**Payload** (una lectura de GPS; campos anclados a `location_update`)
```json
{
  "lat": "number",
  "lng": "number",
  "accuracyMeters": "number | null",
  "recordedAt": "string (timestamptz)"
}
```

## Topic — feed agregado del tablero

```
school-pickup/institution/{institutionId}/board
```

- **Publica:** el `api` (al crear, feature 018) y el `worker` (en cada
  actualización de estado/ETA, features 019–022).
- **Consume:** el `board` (kiosko) de la institución, que refresca el listado
  estilo "llegadas de aeropuerto".

**Payload** (estado de un `pickup_request` para el tablero; los campos marcados
"(join)" provienen de entidades relacionadas, no de columnas de `pickup_request`)
```json
{
  "pickupRequestId": "uuid",
  "status": "en_route | arriving | arrived | delivered | cancelled",
  "studentFullName": "string (join: student vía enrollment)",
  "gradeOrGroup": "string | null (join: enrollment)",
  "deliveryPointId": "uuid | null",
  "estimatedArrivalAt": "string (timestamptz) | null",
  "etaSeconds": "number | null",
  "arrivalMode": "vehicle | walking | null",
  "updatedAt": "string (timestamptz)"
}
```

El tablero hace la cuenta regresiva por aritmética entre recálculos usando
`etaSeconds`/`estimatedArrivalAt`, sin llamadas extra (ver `docs/arquitectura.md`
§ETA y costo). El `deliveryCode` **no** viaja en este payload (es visible solo en
la app del tutor).

## Topic — cola de un punto de entrega

```
school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue
```

- **Publica:** el `api`/`worker`, **solo** cuando el `pickup_request` tiene
  `delivery_point_id` no nulo (mismas transiciones que el feed agregado).
- **Consume:** la consola de puerta de ese `delivery_point` (cualquier
  `institution_member` de la institución, ADR-011), que ve solo los alumnos
  asignados a su punto.

**Payload** (igual forma que el del tablero, acotado a la cola de ese punto)
```json
{
  "pickupRequestId": "uuid",
  "status": "en_route | arriving | arrived | delivered | cancelled",
  "studentFullName": "string (join: student vía enrollment)",
  "gradeOrGroup": "string | null (join: enrollment)",
  "vehicleDescription": "string | null",
  "vehiclePlate": "string | null",
  "estimatedArrivalAt": "string (timestamptz) | null",
  "etaSeconds": "number | null",
  "updatedAt": "string (timestamptz)"
}
```

La consola muestra `vehicleDescription`/`vehiclePlate` (snapshot, ADR-014) para
reconocer al vehículo en la puerta. El `deliveryCode` no viaja por MQTT: se
verifica vía `PATCH /pickup-requests/:id/deliver` (el tutor lo muestra en su app,
el staff lo teclea).

## Cuándo se publica (por transición)

| Momento | Feature | Topics |
|---|---|---|
| Creación (`en_route`) | 018 | agregado; cola si hay `delivery_point_id` |
| Recálculo de ETA / posición | 019 | agregado; cola si aplica |
| `arriving` (automático) | 020 | agregado; cola si aplica |
| `arrived` (tutor) | 021 | agregado; cola si aplica |
| `delivered` (staff) | 021 | agregado; cola si aplica |
| `cancelled` (tutor) | 022 | agregado; cola si aplica |

## Referencias

- `specs/features/018-crear-pickup-request.md` … `022-cancelar-pickup-request.md`.
- `specs/api-contracts/pickup-requests.md` (contrato REST complementario).
- `specs/entities/pickup_request.md`, `specs/entities/location_update.md`,
  `specs/entities/enrollment.md`, `specs/entities/student.md`,
  `specs/entities/delivery_point.md`.
- ADR-011 (acceso a la consola de puerta no restringido por `role`).
- ADR-012 (segmentación por punto de entrega).
- ADR-017 (`MqttClient` y `MapsProvider` como ports).
- ADR-024 (punto 10: payloads como estimación, revisión en Fase 7–9; punto 3:
  umbral `arriving_lead_minutes`).
- `docs/arquitectura.md` (nombres de topic, ACL por tenant, flujo de tiempo
  real).

## Preguntas abiertas

Ninguna pendiente en este slice. **Diferido a Fase 7–9 (decisión, ADR-024 punto
10):** el conjunto exacto de campos de cada payload se revisa al construir los
consumidores reales (`board`, consola de puerta); aquí se documenta una
estimación mínima derivable del modelo. Los topics y la seguridad sí son
definitivos.
