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
- **Ningún navegador se conecta jamás directo al broker** (ADR-050, ADR-062
  — corrige el diseño original de este documento, que asumía conexión
  directa del cliente con token emitido por el `api`). Solo `apps/api` y
  `apps/worker` mantienen conexión real al broker, con sus propias
  credenciales de servidor.
- Los navegadores (`portal`, `board`, `parent`) acceden a datos en tiempo
  real vía un **puente WebSocket propio de `apps/api`** (ADR-050): el
  navegador se conecta por WSS al `api`, autenticado con el mismo JWT que
  usa para REST; el `api` reenvía server-side lo que recibe del broker,
  filtrado por institución/recurso según la misma autorización que ya usan
  los endpoints REST equivalentes (`InstitutionMembershipGuard` o
  verificación de propiedad, según el caso).
- Para el sentido inverso (un navegador que necesita **publicar** un dato,
  como la ubicación del tutor en camino), el patrón es el mismo pero al
  revés: el navegador llama un endpoint REST del `api` (autenticado igual
  que cualquier otro), y es el `api` quien publica al broker con su propia
  conexión (ADR-062) — nunca el navegador directo.
- TLS obligatorio (WSS) para la conexión `api`↔broker y para el puente
  WebSocket `navegador`↔`api`.

## Topic — ubicación entrante

```
school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location
```

- **Publica:** `apps/api`, en nombre del tutor, vía `MQTT_CLIENT` — nunca la
  app `parent` directo (ADR-050, ADR-062). El tutor llama
  `POST /pickup-requests/:id/location` (`specs/api-contracts/pickup-requests.md`);
  el `api` verifica que el `pickup_request` le pertenezca y republica al
  topic exacto de abajo. Un topic concreto por trayecto, construido con
  `pickupLocationTopic()` de `packages/shared` (misma función, ahora
  llamada desde el `api` en vez de imaginariamente desde el navegador).
- **Consume:** el `worker` (feature 019), que persiste cada lectura en
  `location_updates` y recalcula el ETA con throttling vía `MapsProvider`
  — sin cambios, el origen del mensaje le es transparente.

**Payload** (una lectura de GPS; campos anclados a `location_updates`)
```json
{
  "lat": "number",
  "lng": "number",
  "accuracyMeters": "number | null",
  "recordedAt": "string (timestamptz)"
}
```

### Suscripción del `worker`: comodín, no dinámica (ADR-031 punto 4)

El `worker` **no** se suscribe y desuscribe a un topic concreto por cada
`pickup_requests` que nace y termina. Se suscribe **una sola vez, al arrancar**, al
patrón con wildcards `+` (un solo nivel) que cubre todos los trayectos de todas
las instituciones:

```
school-pickup/institution/+/pickup/+/location
```

La alternativa dinámica obligaría al `worker` a enterarse de cada alta —que
ocurre en el `api`, otro proceso— y a reconstruir su set de suscripciones tras
cada reconexión o reinicio: complejidad y modos de falla nuevos sin beneficio
real, dado que el ACL del broker ya acota qué puede publicar cada cliente. Este
patrón es de **suscripción del servidor**, no un topic de publicación: ningún
cliente publica nunca a un topic con `+`.

### Parsers inversos en `packages/shared`

Consecuencia directa del comodín: el payload de ubicación **no lleva**
`institutionId` ni `pickupRequestId` (ambos viven solo en el string del topic),
así que el `worker` necesita recuperarlos del topic entrante. Hace falta un
parser inverso en `packages/shared`, compañero de los builders ya existentes
(`pickupLocationTopic`, `boardTopic`, `deliveryPointQueueTopic`):

```ts
parseLocationTopic(topic: string): { institutionId: string; pickupRequestId: string } | null
```

Devuelve `null` —no lanza— si el topic no matchea la forma esperada: el `worker`
descarta el mensaje y lo registra, en vez de caerse por un topic inesperado en un
broker compartido con otras aplicaciones.

Con ADR-050 hay un **segundo** consumidor por comodín, y por tanto un segundo
parser de la misma forma:

```ts
parseDeliveryPointQueueTopic(topic: string): { institutionId: string; deliveryPointId: string } | null
```

Lo usa el puente WebSocket del `api` (ver abajo), que se suscribe al comodín de
cola. Esto **corrige** lo que este documento afirmaba antes de ADR-050 ("es la
única función de este tipo prevista… la consola de puerta ya conoce su propio
`institutionId` y `deliveryPointId`"): ese razonamiento asumía que el navegador
se suscribía directo al broker a un topic concreto, escenario descartado por
ADR-050. Quien consume el topic de cola es el `api`, por comodín y para todas las
instituciones a la vez, así que sí necesita parsearlo.

## Topic — feed agregado del tablero

```
school-pickup/institution/{institutionId}/board
```

- **Publica:** el `api` (al crear, feature 018) y el `worker` (en cada
  actualización de estado/ETA, features 019–022).
- **Consume:** el `api` mismo, por comodín, para reenviarlo al `board`
  (kiosko) de cada institución vía `specs/api-contracts/board-ws.md`
  (ADR-050, ADR-068) — el navegador nunca se suscribe directo al broker.
  El tablero refresca así el listado estilo "llegadas de aeropuerto".

**Payload** (estado de un `pickup_requests` para el tablero; los campos marcados
"(join)" provienen de entidades relacionadas, no de columnas de `pickup_requests`)
```json
{
  "kind": "row",
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

`kind: 'row'` discrimina este payload del de "vocear" (ver abajo, ADR-073
pt.3): ambos viajan por el mismo puente WebSocket
(`specs/api-contracts/board-ws.md`), aunque son topics MQTT distintos.

El tablero hace la cuenta regresiva por aritmética entre recálculos usando
`etaSeconds`/`estimatedArrivalAt`, sin llamadas extra (ver `docs/arquitectura.md`
§ETA y costo).

El `deliveryCode` **no** viaja en este payload, y no debe agregarse nunca
(ADR-051 punto 2): el `board` es una pantalla pública en la recepción de la
institución, visible a cualquiera que pase — exponer ahí el código de
verificación es una categoría de exposición distinta de la que ADR-024 punto 11
autorizó (miembros autenticados). Que el payload de cola sí lo lleve no es
motivo para "emparejar" los dos: la asimetría es la decisión.
`buildBoardPayload()` tiene un test dedicado que falla si alguien lo arrastra.

## Topic — vocear (ADR-073)

```
school-pickup/institution/{institutionId}/board-announce
```

- **Publica:** el `api`, cuando un `institution_members` de la Consola de
  puerta llama `POST /pickup-requests/:id/announce`
  (`specs/api-contracts/pickup-requests.md`). A diferencia de los tres
  topics de arriba, no lo publica ninguna transición de estado del
  `worker` — "vocear" no es una transición de `pickup_request`.
- **Consume:** el `api` mismo, por comodín, para reenviarlo al `board`
  (kiosko) de cada institución vía `specs/api-contracts/board-ws.md`
  (ADR-073 pt.3) — mismo puente WebSocket que ya reenvía el feed agregado,
  **no** una conexión nueva. El tablero anuncia al alumno por voz con el
  mismo mecanismo (`useInstitutionBoard`/`onAnnounce`) que ya usa para las
  transiciones automáticas a `arriving`/`arrived` (ADR-069).

**Deliberadamente sin snapshot ni histórico** (ADR-073 pt.1): no es el
patrón "snapshot REST + deltas WS" de los demás canales — no tiene sentido
"reproducir" un anuncio de audio que ya pasó. Si un tablero se reconecta
justo después de un voceo, simplemente no lo escucha.

**Payload**
```json
{
  "kind": "announce",
  "pickupRequestId": "uuid",
  "studentFullName": "string (join: student vía enrollment)",
  "announcedAt": "string (timestamptz)"
}
```

`kind: 'announce'` discrimina este payload del de fila (arriba). **Sin
`guardianFullName` ni datos de vehículo** — mismo criterio de privacidad
que el feed agregado del tablero (ADR-051/068): un kiosko público nunca
recibe esos datos por el cable, ni siquiera sin pintarlos.

## Topic — cola de un punto de entrega

```
school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue
```

- **Publica:** el `api`/`worker`, **solo** cuando el `pickup_requests` tiene
  `delivery_point_id` no nulo (mismas transiciones que el feed agregado).
- **Consume:** la consola de puerta de ese `delivery_points` (cualquier
  `institution_members` de la institución, ADR-011), que ve solo los alumnos
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
  "deliveryCode": "string (4 dígitos)",
  "estimatedArrivalAt": "string (timestamptz) | null",
  "etaSeconds": "number | null",
  "updatedAt": "string (timestamptz)"
}
```

La consola muestra `vehicleDescription`/`vehiclePlate` (snapshot, ADR-014) para
reconocer al vehículo en la puerta.

**`deliveryCode` sí viaja en este payload, y solo en este** (ADR-051). La
consola no puede cumplir su función sin él: el staff compara el código que
muestra el tutor contra el que la consola despliega (feature 021). Esto **no
relaja a quién se expone** — sigue siendo lo que ADR-024 punto 11 ya
estableció, cualquier `institution_member` de la institución, sin restricción de
`role` — solo agrega **dónde**: antes únicamente en `GET
/pickup-requests/:id`. La verificación de la entrega sigue siendo server-side
vía `PATCH /pickup-requests/:id/deliver` (ADR-024 punto 4): que el código sea
visible no lo convierte en la autorización.

Nota de seguridad: quien consume este topic hoy es el `api`, que lo reenvía por
su puente WebSocket solo a `institution_members` autenticados (ADR-050). El
código nunca llega a un navegador sin autorizar.

### El navegador no consume este topic directamente (ADR-050)

La consola de puerta **no** se conecta al broker. El `api` se suscribe una sola
vez, al arrancar, al comodín de cola —

```
school-pickup/institution/+/delivery-point/+/queue
```

— mismo patrón de "suscripción del servidor" que el `worker` usa para ubicación,
y reenvía cada mensaje, **sin envoltura ni transformación**, por su propio
WebSocket a los clientes autorizados para ese `deliveryPointId`. El contrato de
ese WebSocket (handshake, autorización, códigos de cierre) vive en
`specs/api-contracts/delivery-point-queue-ws.md`. Desde la perspectiva del broker
no cambia nada: es la conexión que el `api` ya mantenía.

Esto acota también el modelo de seguridad descrito arriba: el ACL por tenant del
broker sigue siendo la intención de largo plazo, pero hoy la barrera real de
aislamiento multi-tenant para este topic es el puente del `api`, no el broker
(ADR-050, contexto).

## Topic — Carril (monitor de institución)

```
school-pickup/institution/{institutionId}/board-monitor
```

- **Publica:** el `api` (al crear, feature 018) y el `worker` (en cada
  actualización de estado/ETA, features 019–022) — mismos dos puntos que ya
  publican el feed agregado del tablero, mismo throttle de 20s del `worker`,
  sin mecanismo nuevo de frecuencia (ADR-071 pt.2).
- **Consume:** el `api` mismo, por comodín, para reenviarlo a Carril (el modo
  de staff del tablero de institución) vía
  `specs/api-contracts/board-monitor-ws.md` — el navegador nunca se
  suscribe directo al broker.

**Canal deliberadamente separado del feed agregado del tablero** (ADR-071
pt.2): si el payload de Carril viajara por `boardTopic`, cualquier kiosko
físico público (Andén/Sereno) recibiría datos de tutor/vehículo por la red
aunque la interfaz nunca los pinte — alcanzables por cualquiera con acceso
físico al dispositivo (DevTools, inspección de red). Mismo criterio
arquitectónico que ya separa este topic de la cola de la consola de puerta
(ADR-050/051): consumidor distinto, payload distinto, canal distinto.

**Payload** (mismos campos que el del tablero, más datos de tutor/vehículo)
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
  "guardianFullName": "string (join: student_guardians → guardian)",
  "guardianRelationship": "mother | father | grandparent | driver | other (join: student_guardians)",
  "vehicleDescription": "string | null",
  "vehiclePlate": "string | null",
  "updatedAt": "string (timestamptz)"
}
```

`guardianFullName`/`guardianRelationship` se resuelven con una consulta
adicional a `student_guardians` (mismo patrón ya usado por
`notifyOtherGuardiansOfDelivery`, ADR-066 punto 5), no con una relación
nueva. `deliveryCode` **no** viaja en este payload — mismo criterio que el
tablero público, ADR-051 no cambia para ningún modo del tablero, solo para la
consola de puerta. `buildBoardMonitorPayload()` tiene un test dedicado que
falla si alguien lo arrastra.

## Cuándo se publica (por transición)

| Momento | Feature | Topics |
|---|---|---|
| Creación (`en_route`) | 018 | agregado; cola si hay `delivery_point_id`; Carril |
| Recálculo de ETA / posición | 019 | agregado; cola si aplica; Carril |
| `arriving` (automático) | 020 | agregado; cola si aplica; Carril |
| `arrived` (tutor) | 021 | agregado; cola si aplica; Carril |
| `delivered` (staff) | 021 | agregado; cola si aplica; Carril |
| `cancelled` (tutor) | 022 | agregado; cola si aplica; Carril |

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
- ADR-031 (punto 4: suscripción del `worker` por comodín y parser inverso
  `parseLocationTopic` en `packages/shared`).
- ADR-050 (el navegador nunca se conecta al broker; puente WebSocket en el `api`,
  suscripción por comodín al topic de cola y `parseDeliveryPointQueueTopic`).
- ADR-051 (`deliveryCode` en el payload de cola, nunca en el de tablero).
- ADR-071 (punto 2: canal `board-monitor` separado para Carril, con datos de
  tutor/vehículo; punto 3: `relationshipLabel` promovido a
  `packages/shared`).
- ADR-073 (punto 1: "vocear" efímero, sin escritura en base de datos; punto
  3: topic `board-announce` multiplexado sobre `specs/api-contracts/board-ws.md`
  vía el discriminador `kind`).
- `specs/api-contracts/delivery-point-queue-ws.md` (contrato del puente).
- `specs/api-contracts/board-monitor-ws.md` (contrato del puente de Carril).
- `docs/arquitectura.md` (nombres de topic, ACL por tenant, flujo de tiempo
  real, estructura y ciclo de vida MQTT del `worker`).

## Preguntas abiertas

Ninguna pendiente en este slice. **Diferido a Fase 7–9 (decisión, ADR-024 punto
10):** el conjunto exacto de campos de cada payload se revisa al construir los
consumidores reales (`board`, consola de puerta); aquí se documenta una
estimación mínima derivable del modelo. Los topics y la seguridad sí son
definitivos.
