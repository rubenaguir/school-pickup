# API Contract — Pickup Requests

Recurso del ciclo de vida de la recogida. Cubre
`specs/features/018-crear-pickup-request.md`,
`specs/features/021-confirmar-llegada-y-entrega.md` y
`specs/features/022-cancelar-pickup-request.md`. Las transiciones automáticas del
`worker` (`arriving`, ingesta de ubicación) no pasan por REST — ver
`specs/features/019-*`, `020-*` y `specs/api-contracts/pickup-realtime-mqtt.md`.

## Autenticación y autorización

Todos los endpoints requieren access token válido. La autorización combina dos
perspectivas, según el endpoint:
- **Tutor** (perspectiva del que va en camino): crear, confirmar llegada y
  cancelar exigen ser el `guardian_user_id` dueño del `pickup_requests` (para
  crear: ser `student_guardians` en `status = active` del alumno del
  `enrollments`).
- **Miembro de institución** (perspectiva de la puerta): confirmar la entrega
  exige ser `institution_members` de la `institution_id` del `pickup_requests`,
  con **cualquier `role`** (la consola de puerta no restringe por rol, ADR-011).
- **Lectura**: el tutor guardián del alumno o cualquier `institution_members` de
  la institución del `pickup_requests` pueden leerlo.

Como el access token no fija `institutionId` ni `role` (ver
`specs/api-contracts/auth.md`), cada endpoint valida la relación (propiedad del
tutor, o membresía a la institución) contra el `pickup_requests` en cuestión.

### Mecanismo por endpoint

| Endpoint | Mecanismo |
|---|---|
| `POST /pickup-requests` | verificación manual en el `service`: el usuario autenticado debe ser `student_guardians` en `status = active` del alumno del `enrollments` |
| `GET /pickup-requests/:id` | verificación manual en el `service`: **OR** entre tutor dueño y miembro de la institución (ver abajo) |
| `GET /pickup-requests?enrollmentId=` | verificación manual en el `service`: mismo **OR**, resuelto sobre el `enrollments` (ver abajo) |
| `GET /pickup-requests?deliveryPointId=` | verificación manual en el `service`: **solo** el lado `institution_member` del OR, resuelto sobre el `delivery_points` (ver abajo) |
| `GET /pickup-requests?institutionId=` | verificación manual en el `service`: `institution_member` de esa institución, sin restricción de `role` (ver abajo) |
| `PATCH /pickup-requests/:id/arrived` | verificación manual en el `service`: ser el `guardian_user_id` dueño |
| `PATCH /pickup-requests/:id/deliver` | **`InstitutionMembershipGuard`** en modo ruta por recurso: `@InstitutionResource({ entity: PickupRequest })` resuelve el `pickup_requests` por su `:id`, lee su `institution_id` (denormalizado, ADR-018 punto 4) y verifica la membresía antes de llegar al controller. Sin restricción de `role` (ADR-011) |
| `POST /pickup-requests/:id/announce` | **`InstitutionMembershipGuard`**, calco exacto del mecanismo de `deliver` (mismo `@InstitutionResource({ entity: PickupRequest })`). Sin restricción de `role` (ADR-011, ADR-073 punto 2) |
| `PATCH /pickup-requests/:id/cancel` | verificación manual en el `service`: ser el `guardian_user_id` dueño |
| `GET /institutions/:id/delivered-today` | **`InstitutionMembershipGuard`** en modo degenerado (`@InstitutionResource({ entity: Institution, idParam: 'id', institutionColumn: 'id' })`, mismo caso que `GET /institutions/:id/reports`): `institution_member` de esa `:id`, sin restricción de `role` (ver abajo) |

**`GET /pickup-requests/:id` y `GET /pickup-requests?enrollmentId=` usan el
patrón de verificación manual OR**, no el guard compartido: la lectura la permite
el tutor dueño **o** cualquier `institution_members` de la institución — una
disyunción que `InstitutionMembershipGuard` no expresa (solo sabe verificar
membresía, y rechazaría al tutor, que no es miembro de la institución). Es el
mismo patrón ya resuelto en `GET /enrollments?institutionId=`: la verificación se
hace a mano dentro del `service`, replicando los mismos `code` de error. Ver
`docs/arquitectura.md` § "Aislamiento multi-tenant vía
`InstitutionMembershipGuard`", tercer patrón ("colecciones filtradas por query
param, fuera del guard"), y `EnrollmentsService` como referencia.

**`GET /pickup-requests?deliveryPointId=` no usa ese OR**, sino solo su lado
`institution_member` (ADR-050 punto 6): un punto de entrega no tiene una
perspectiva de tutor individual — es una vista operativa de la puerta, no de un
alumno concreto, así que un tutor nunca lo lee aunque su hijo esté en esa cola.
El usuario debe ser `institution_members` de la institución dueña del
`delivery_points`, con cualquier `role` (ADR-011). La verificación sigue siendo
manual en el `service`, no con `InstitutionMembershipGuard`, por la misma razón
que el resto del endpoint: la institución llega por query param, no por ruta ni
por recurso `:id`.

**`GET /pickup-requests?institutionId=` tampoco usa el OR** (ADR-068 punto 2):
es la perspectiva del tablero de institución (`apps/board`), sin noción de un
tutor individual. El usuario debe ser `institution_members` de esa
`institutionId`, con cualquier `role` (ADR-011) — misma verificación manual que
el resto del contrato, no `InstitutionMembershipGuard`, porque la institución
llega por query param.

Toda transición de `status` se valida contra la máquina de estados compartida en
`packages/shared` (`pickup-request-status-machine.ts`, ADR-017); un intento de
transición inválida devuelve `409 INVALID_STATUS_TRANSITION`.

### Forma de los errores

Como en todo el API (ADR-028), el cuerpo de error es
`{ "code": "string", "message": "string" }`, con `code` en inglés y estable
(cada frontend traduce por `code`). Los `code` de este contrato se fijaron en
ADR-031 punto 1: cuatro nuevos (`ENROLLMENT_NOT_APPROVED`,
`ACTIVE_PICKUP_REQUEST_EXISTS`, `INVALID_STATUS_TRANSITION`,
`INVALID_DELIVERY_CODE`) y seis reutilizados de fases anteriores sin cambio
(`NOT_STUDENT_GUARDIAN`, `GUARDIAN_NOT_ACTIVE`, `NOT_INSTITUTION_MEMBER`,
`NOT_VEHICLE_OWNER`, `RESOURCE_NOT_FOUND`, `INVALID_PAYLOAD`).

`INVALID_PAYLOAD` de `POST /pickup-requests` incluye además el campo
`details` (uno por cada campo/regla de `class-validator` que falló) — shape
compartido con el resto del API, documentado una sola vez en
`specs/api-contracts/README.md`, no repetido aquí.

## `POST /pickup-requests`

Crea la recogida (`status = en_route`). Ver feature 018.

**Request**
```json
{
  "enrollmentId": "uuid",
  "arrivalMode": "vehicle | walking | null",
  "vehicleId": "uuid | null",
  "vehicleDescription": "string | null",
  "vehiclePlate": "string | null"
}
```

El vehículo del viaje se especifica por **una** de tres vías mutuamente
excluyentes (ADR-014, ADR-025):
- **`vehicleId`** — vehículo del catálogo del tutor: el servidor copia
  `vehicleDescription`/`vehiclePlate` como snapshot desde `vehicles` (ADR-014); los
  dos campos de texto no se envían en este caso.
- **`vehicleDescription` + `vehiclePlate` sin `vehicleId`** — **captura libre**: un
  vehículo no guardado en el catálogo (prestado, viaje puntual); el servidor los
  toma tal cual como snapshot, sin tocar `vehicles` (ADR-014).
- **`arrivalMode = walking`** — el tutor llega caminando: ninguno de los tres
  campos de vehículo aplica. Enviar cualquiera de los tres junto con
  `arrivalMode = walking` es un payload inválido (`400 INVALID_PAYLOAD`), no
  un valor que el servidor ignore.

`institutionId`, `deliveryPointId` y `deliveryCode` no se envían: se
derivan/generan en el servidor (denormalización de `institution_id`, resolución de
`delivery_point_id`, generación de `delivery_code`).

**Response 201**
```json
{
  "id": "uuid",
  "enrollmentId": "uuid",
  "institutionId": "uuid",
  "guardianUserId": "uuid",
  "deliveryPointId": "uuid | null",
  "status": "en_route",
  "deliveryCode": "string (4 dígitos)",
  "arrivalMode": "vehicle | walking | null",
  "vehicleDescription": "string | null",
  "vehiclePlate": "string | null",
  "startedAt": "string (timestamptz)"
}
```

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | payload inválido (`enrollmentId` faltante, `arrivalMode` fuera del enum, combinación de campos de vehículo inválida: `vehicleId` junto con `vehicleDescription`/`vehiclePlate`, o `arrivalMode = walking` junto con cualquiera de `vehicleId`/`vehicleDescription`/`vehiclePlate`) |
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `NOT_STUDENT_GUARDIAN` | el usuario autenticado no es `student_guardians` del alumno del `enrollments` |
| 403 | `GUARDIAN_NOT_ACTIVE` | el usuario autenticado es `student_guardians` del alumno pero su `status` es `invited`/`revoked`, no `active` |
| 403 | `NOT_VEHICLE_OWNER` | el `vehicleId` indicado existe pero pertenece al catálogo de otro tutor |
| 404 | `RESOURCE_NOT_FOUND` | el `enrollments` no existe, o el `vehicleId` indicado no existe |
| 422 | `ENROLLMENT_NOT_APPROVED` | el `enrollments` no está en `status = approved` (regla cruzada entre entidades; ADR-018 punto 2, ADR-025 punto 5) |
| 422 | `INSTITUTION_NOT_APPROVED` | la `institutions` del `enrollments` (denormalizada) no está en `status = approved`: puede haberse suspendido después de que el `enrollments` fue aprobado (ADR-032) |
| 422 | `ACTIVE_PICKUP_REQUEST_EXISTS` | ya existe un `pickup_requests` no terminal (`en_route`/`approaching`/`arriving`/`arrived`) para ese `enrollmentId` (ADR-024 punto 1, ADR-093) |

Los dos errores de `vehicleId` (`404 RESOURCE_NOT_FOUND` si no existe,
`403 NOT_VEHICLE_OWNER` si es de otro tutor) aplican **solo** a la vía de
catálogo. La captura libre (`vehicleDescription`/`vehiclePlate` sin `vehicleId`)
no consulta `vehicles` y no puede producirlos.

`activationRadiusMeters` no se valida en el servidor al crear la recogida: el
servidor no exige que el tutor esté dentro del radio. Su consumidor es el
`worker`, que lo usa para la transición automática `en_route → approaching`
(ADR-093, feature 020).

## `GET /pickup-requests/:id`

Devuelve el estado actual de una recogida. Ver features 018–022.

**Request:** sin body.

**Response 200**
```json
{
  "id": "uuid",
  "enrollmentId": "uuid",
  "institutionId": "uuid",
  "institutionLocation": { "lat": "number", "lng": "number" },
  "guardianUserId": "uuid",
  "deliveryPointId": "uuid | null",
  "status": "en_route | approaching | arriving | arrived | delivered | cancelled",
  "deliveryCode": "string (4 dígitos)",
  "arrivalMode": "vehicle | walking | null",
  "vehicleDescription": "string | null",
  "vehiclePlate": "string | null",
  "estimatedArrivalAt": "string (timestamptz) | null",
  "etaSeconds": "number | null",
  "startedAt": "string (timestamptz)",
  "completedAt": "string (timestamptz) | null"
}
```

`institutionLocation` (ADR-065): la ubicación de la institución
(`institutions.location`, misma forma `{ lat, lng }` que
`GET /institutions/:id`), para que la pantalla de seguimiento del tutor
pueda dibujar el mapa sin depender de `GET /institutions/:id` (bloqueado
para él por `InstitutionMembershipGuard`). No cambia durante la vida del
`pickup_requests`, así que no viaja en los deltas del canal WS de
seguimiento (`specs/api-contracts/pickup-request-tracking-ws.md`,
ADR-064) — solo en este snapshot.

`deliveryCode` se incluye para el `guardian_user_id` dueño (lo muestra en su app)
**y** para cualquier `institution_members` de la institución del `pickup_requests`
(vía `institution_id`, ADR-018 punto 4), sin restricción de `role` (ADR-011,
ADR-024 punto 11): la consola de puerta lo despliega directamente para que el
operador lo compare con el que muestra el tutor. La verificación de la entrega
sigue siendo server-side vía `PATCH .../deliver` (ADR-024 punto 4).

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `NOT_INSTITUTION_MEMBER` | el usuario no es el tutor dueño **ni** `institution_members` de la institución del `pickup_requests` (falla el OR; se replica el mismo `code` que usa el guard compartido, ADR-031 punto 1) |
| 404 | `RESOURCE_NOT_FOUND` | el `pickup_requests` no existe |

## `GET /pickup-requests?enrollmentId=...` · `?deliveryPointId=...` · `?institutionId=...`

Un mismo endpoint con **tres modos mutuamente excluyentes**, elegidos por el
query param que llega:
- **`enrollmentId`** — histórico de recogidas de un `enrollments`. Ver features
  018–022.
- **`deliveryPointId`** — cola operativa de un `delivery_points`: el snapshot
  inicial de la Consola de puerta, sobre el que después se aplican los deltas de
  tiempo real (ADR-050 punto 6). Ver feature 021.
- **`institutionId`** — feed agregado de una institución completa: el snapshot
  inicial del tablero (`apps/board`), sobre el que después se aplican los
  deltas de tiempo real (ADR-068 punto 2).

Hay que enviar **exactamente uno** de los tres: enviar más de uno, o ninguno, es
`400 INVALID_PAYLOAD`.

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `enrollmentId` | exactamente uno de los tres | debe corresponder a un alumno del que el usuario es guardián, o a una institución de la que es miembro |
| `deliveryPointId` | exactamente uno de los tres | debe corresponder a un `delivery_points` de una institución de la que el usuario es miembro (cualquier `role`) |
| `institutionId` | exactamente uno de los tres | debe corresponder a una institución de la que el usuario es miembro (cualquier `role`) |
| `view` | no | solo junto a `institutionId`; `board` (default) o `monitor` — ver abajo (ADR-071 pt.2) |
| `status` | no | filtra por uno de los valores del enum |
| `limit` | no | tamaño de página; default `20` (ADR-024 punto 9) |
| `offset` | no | desplazamiento; default `0` (ADR-024 punto 9) |

`view` **no** es un cuarto filtro mutuamente excluyente con
`enrollmentId`/`deliveryPointId`/`institutionId` — es un modificador de
*forma* de un request que ya está acotado por `institutionId` (ADR-071 pt.2,
pt.5). Si llega sin `institutionId`, la respuesta sigue siendo
`400 INVALID_PAYLOAD` porque ningún filtro válido está presente, no porque
`view` lo exija por sí mismo.

Paginación con `limit`/`offset`, orden `created_at DESC` (ADR-024 punto 9): un
`enrollments` acumula recogidas durante años.

### Diferencias del modo `deliveryPointId`

- **Solo estados activos** (`en_route`, `approaching`, `arriving`, `arrived`), nunca historial
  completo (ADR-050 punto 6, ADR-093): la cola de una puerta es una vista operativa del
  momento, no un registro histórico. Un `pickup_requests` `delivered` o
  `cancelled` desaparece de la cola.
- `status`, si se envía, **acota dentro** de ese conjunto activo; no lo amplía.
  Pedir `status=delivered` junto con `deliveryPointId` devuelve una página vacía
  (`total: 0`), no los entregados — no es un error de payload, es un filtro que
  no puede intersecar nada.
- Autorización distinta (solo `institution_member`, ver arriba).
- **Forma de respuesta distinta** (ADR-051 punto 3): `PickupRequestQueueSummary`,
  no el `PickupRequestSummary` genérico del modo `enrollmentId`. Ver abajo.

### Diferencias del modo `institutionId`

- **Solo estados activos** (`en_route`, `approaching`, `arriving`, `arrived`), mismo criterio
  que el modo `deliveryPointId` (ADR-068 punto 2, ADR-093): el tablero es una vista
  operativa del momento, no un registro histórico.
- `status`, si se envía, **acota dentro** de ese conjunto activo, igual que en
  el modo `deliveryPointId`.
- Autorización distinta (solo `institution_member`, ver arriba) — sin lado de
  tutor, igual que `deliveryPointId`.
- **Forma de respuesta distinta**: `PickupRequestBoardSummary` (ADR-068 punto
  3) — **sin `deliveryCode`**, a propósito (ADR-051): a diferencia de
  `PickupRequestQueueSummary`, esta vista alimenta una pantalla pública
  (`apps/board`, kiosko en la recepción de la institución), donde el código de
  verificación de la entrega nunca debe aparecer. Ver abajo.
- **`view=monitor` cambia la forma de respuesta a `PickupRequestBoardMonitorSummary`**
  (ADR-071 pt.2, pt.5): mismos campos que `PickupRequestBoardSummary` más
  `guardianFullName`/`guardianRelationship`/`vehicleDescription`/`vehiclePlate` —
  el snapshot inicial de Carril, el modo de staff del tablero de institución,
  antes de que el WebSocket de `specs/api-contracts/board-monitor-ws.md` tome
  el relevo con los deltas. Misma autorización que `view=board` (default):
  `institution_member` de esa `institutionId`, sin restricción de `role`.
  **Sin `deliveryCode`**, igual criterio que `view=board`: ADR-051 no cambia
  para ningún modo del tablero.

**Response 200 — modo `enrollmentId`** (`PickupRequestSummary`; sin cambios)
```json
{
  "pickupRequests": [
    {
      "id": "uuid",
      "status": "en_route | approaching | arriving | arrived | delivered | cancelled",
      "startedAt": "string (timestamptz)",
      "completedAt": "string (timestamptz) | null",
      "deliveryPointId": "uuid | null"
    }
  ],
  "limit": "number",
  "offset": "number",
  "total": "number"
}
```

**Response 200 — modo `deliveryPointId`** (`PickupRequestQueueSummary`)
```json
{
  "pickupRequests": [
    {
      "pickupRequestId": "uuid",
      "status": "en_route | approaching | arriving | arrived",
      "studentFullName": "string (join: student vía enrollment)",
      "gradeOrGroup": "string | null (join: enrollment)",
      "vehicleDescription": "string | null",
      "vehiclePlate": "string | null",
      "deliveryCode": "string (4 dígitos)",
      "estimatedArrivalAt": "string (timestamptz) | null",
      "etaSeconds": "number | null",
      "guardianFullName": "string (join: student_guardians → user)",
      "guardianRelationship": "mother | father | grandparent | driver | other",
      "updatedAt": "string (timestamptz)"
    }
  ],
  "limit": "number",
  "offset": "number",
  "total": "number"
}
```

`guardianFullName`/`guardianRelationship` (enmienda a ADR-073): mismos dos
campos y misma justificación que el payload MQTT equivalente
(`specs/api-contracts/pickup-realtime-mqtt.md`, § "Topic — cola de un punto
de entrega") — el snapshot REST y los deltas en tiempo real de este modo
deben mantenerse forma-idénticos (ADR-051 pt.3), o la consola no podría
fusionarlos sin transformación.

**Response 200 — modo `institutionId`** (`PickupRequestBoardSummary`)
```json
{
  "pickupRequests": [
    {
      "pickupRequestId": "uuid",
      "status": "en_route | approaching | arriving | arrived",
      "studentFullName": "string (join: student vía enrollment)",
      "gradeOrGroup": "string | null (join: enrollment)",
      "deliveryPointId": "uuid | null",
      "estimatedArrivalAt": "string (timestamptz) | null",
      "etaSeconds": "number | null",
      "arrivalMode": "vehicle | walking | null",
      "updatedAt": "string (timestamptz)"
    }
  ],
  "limit": "number",
  "offset": "number",
  "total": "number"
}
```

Campo por campo el mismo `PickupRequestBoardPayload` que ya construye
`buildBoardPayload()` (`packages/shared`) y que publica
`school-pickup/institution/{institutionId}/board`
(`specs/api-contracts/pickup-realtime-mqtt.md`) — mismo criterio de paridad de
nombres que el modo `deliveryPointId` frente a `buildQueuePayload()`, para que
`apps/board` fusione este snapshot con los deltas de
`specs/api-contracts/board-ws.md` sin transformar ninguno de los dos.

**Response 200 — modo `institutionId`, `view=monitor`** (`PickupRequestBoardMonitorSummary`)
```json
{
  "pickupRequests": [
    {
      "pickupRequestId": "uuid",
      "status": "en_route | approaching | arriving | arrived",
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
  ],
  "limit": "number",
  "offset": "number",
  "total": "number"
}
```

Campo por campo el mismo `PickupRequestBoardMonitorPayload` que ya construye
`buildBoardMonitorPayload()` (`packages/shared`) y que publica
`school-pickup/institution/{institutionId}/board-monitor`
(`specs/api-contracts/pickup-realtime-mqtt.md`), para que Carril fusione este
snapshot con los deltas de `specs/api-contracts/board-monitor-ws.md` sin
transformar ninguno de los dos.

**Por qué dos formas y no una** (ADR-051 punto 3). Cada fila de este modo replica
**campo por campo** el payload que `buildQueuePayload()` publica en
`deliveryPointQueueTopic` (`specs/api-contracts/pickup-realtime-mqtt.md`) más
nada: mismos nombres, incluido **`pickupRequestId` en vez de `id`** — a propósito
distinto de la convención genérica del resto de la API. Así la Consola de puerta
fusiona el snapshot inicial y los deltas del WebSocket sin ninguna
transformación intermedia; cualquier divergencia entre las dos formas
reintroduce justamente el desajuste que esta forma existe para eliminar.

`PickupRequestSummary` se mantiene deliberadamente delgado para el modo
`enrollmentId`: es la perspectiva del tutor sobre su histórico, sin necesidad
operativa de `deliveryCode`, vehículo ni nombre del alumno (que ya conoce).

`deliveryCode` se incluye aquí por la misma regla que ya rige en
`GET /pickup-requests/:id` (ADR-024 punto 11): visible para cualquier
`institution_member` de la institución, sin restricción de `role`. ADR-051
extiende **dónde** aparece, no **a quién** se expone. `startedAt`/`completedAt`
no aparecen: en una cola de estados activos `completedAt` es siempre `null`, y la
consola ordena por ETA, no por hora de inicio.

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | ninguno de `enrollmentId`/`deliveryPointId`/`institutionId`, más de uno a la vez, o cualquiera de ellos mal formado |
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `NOT_INSTITUTION_MEMBER` | modo `enrollmentId`: el usuario no es guardián del alumno **ni** miembro de la institución del `enrollments` (falla el OR). Modo `deliveryPointId`: el usuario no es `institution_members` de la institución dueña del `delivery_points`. Modo `institutionId`: el usuario no es `institution_members` de esa `institutionId` |
| 404 | `RESOURCE_NOT_FOUND` | el `enrollments`, el `delivery_points` o el `institutionId` indicado no existe |

## `POST /pickup-requests/:id/location`

El tutor envía una lectura de GPS mientras va en camino. Ver ADR-062 — el
`api` republica esta lectura al broker MQTT
(`school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location`)
con su propia conexión; el navegador nunca se conecta directo al broker
(ADR-050). Misma autorización que `PATCH .../arrived`/`.../cancel`
(`assertOwner` — el `guardian_user_id` dueño del `pickup_requests`).

**Request**
```json
{
  "lat": "number",
  "lng": "number",
  "accuracyMeters": "number | null",
  "recordedAt": "string (timestamptz, ISO 8601)"
}
```

**Response 202** — aceptado, sin cuerpo. La republicación al broker es
fire-and-forget desde la perspectiva del cliente (QoS 0, mismo criterio ya
documentado en `docs/arquitectura.md` para este topic — perder una lectura
no tiene consecuencia, llega otra en segundos).

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | `lat`/`lng`/`recordedAt` ausentes o mal formados |
| 401 | — | no autenticado |
| 403 | `NOT_STUDENT_GUARDIAN` | el usuario autenticado no es el `guardian_user_id` dueño |
| 404 | `RESOURCE_NOT_FOUND` | el `pickup_requests` no existe |
| 409 | `INVALID_STATUS_TRANSITION` | el `pickup_requests` ya está en un estado terminal (`delivered`/`cancelled`) — no tiene sentido seguir enviando ubicación de un trayecto terminado |

**Sin throttling en el `api`** (ADR-062 punto 5) — cada `POST` recibido se
republica tal cual; el throttling real de recálculo de ETA (20s/150m,
ADR-024 punto 2) sigue viviendo exclusivamente en el `worker`.

## `PATCH /pickup-requests/:id/arrived`

El tutor confirma "ya llegué". Ver feature 021. Transición a `arrived`.

**Request:** sin body.

**Response 200**
```json
{ "id": "uuid", "status": "arrived" }
```

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `NOT_STUDENT_GUARDIAN` | el usuario autenticado no es el `guardian_user_id` dueño |
| 404 | `RESOURCE_NOT_FOUND` | el `pickup_requests` no existe |
| 409 | `INVALID_STATUS_TRANSITION` | transición inválida según la máquina de estados compartida (ADR-017): ya está en `arrived`, o en un estado terminal |

## `PATCH /pickup-requests/:id/deliver`

El staff confirma la entrega verificando el `delivery_code`. Ver feature 021.
Transición a `delivered`.

**Efecto secundario best-effort (ADR-066, feature 028):** notifica por Web
Push a los demás `student_guardians` activos del alumno (excluyendo al
dueño del `pickup_requests`) con `notify_delivery_confirmed = true` — ver
`specs/api-contracts/push-subscriptions.md`. Nunca afecta la respuesta de
este endpoint, ni siquiera si el envío falla por completo.

Único endpoint del contrato protegido por **`InstitutionMembershipGuard`** (modo
ruta por recurso: el guard resuelve el `pickup_requests` por su `:id` y compara
la membresía contra su `institution_id` denormalizado, ADR-018 punto 4). El guard
absorbe el `404 RESOURCE_NOT_FOUND` y el `403 NOT_INSTITUTION_MEMBER`, y no impone
ninguna restricción por `role` (ADR-011).

**Request**
```json
{ "deliveryCode": "string (4 dígitos)" }
```

**Response 200**
```json
{ "id": "uuid", "status": "delivered", "completedAt": "string (timestamptz)" }
```

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | `deliveryCode` faltante o que no es una cadena de 4 dígitos |
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 401 | `INVALID_DELIVERY_CODE` | el `deliveryCode` ingresado no coincide con el del `pickup_requests` |
| 403 | `NOT_INSTITUTION_MEMBER` | el usuario no es `institution_members` de la institución del `pickup_requests` (cualquier `role` sirve, ADR-011) |
| 404 | `RESOURCE_NOT_FOUND` | el `pickup_requests` no existe |
| 409 | `INVALID_STATUS_TRANSITION` | transición inválida según la máquina de estados compartida (ADR-017): el `pickup_requests` no está en `arrived` |

**`INVALID_DELIVERY_CODE` es `401`, no `422`** (ADR-031 punto 2). Es una
categoría propia —verificación de una credencial o secreto compartido— y no
encaja en las dos anteriores: comparar el código tecleado contra
`pickup_requests.delivery_code` de la misma fila es autoconsulta (lo que por la
lectura estricta lo llevaría a `409`), pero el recurso **no está en conflicto con
su estado**: sigue en `arrived`, perfectamente válido, y lo que falló fue un
secreto que no coincide. Mismo principio que `INVALID_CREDENTIALS` en el login,
aplicado a una acción concreta en vez de a la sesión.

El orden de validación importa: el estado se valida **antes** que el código, de
modo que teclear un código sobre un `pickup_requests` ya `delivered` o
`cancelled` responde `409 INVALID_STATUS_TRANSITION`, no `401`.

Ante un `deliveryCode` incorrecto **no hay bloqueo ni límite de reintentos**
(verificación presencial, ADR-024 punto 4): el staff puede reintentar. El
`pickup_requests` permanece en `arrived`, no se fija `completed_at` y no se crea
fila de `pickup_request_status_history`. Cada intento fallido **sí** se registra
en `audit_log` con `action = pickup_request.delivery_code_mismatched`,
`entity_type = 'pickup_request'`, `entity_id` = el id del `pickup_requests` y
`metadata = null` — no se guarda el código incorrecto tecleado (minimización de
datos; ADR-031 puntos 7 y 8, `specs/entities/audit_log.md`).

## `POST /pickup-requests/:id/announce`

"Vocear" (ADR-073): un `institution_members` de la Consola de puerta pide
que el tablero anuncie al alumno por voz. **Acción efímera, sin transición
de estado** — no es una de las 5 transiciones de la máquina de estados
compartida (ADR-024 punto 8), no escribe la fila del `pickup_requests`, sin
tabla ni columna nueva. Ver ADR-073 punto 1.

Válido solo para un `pickup_requests` en estado activo (`en_route` /
`approaching` / `arriving` / `arrived`) — mismo `ACTIVE_STATUSES` que ya usa
`deliver()` (ADR-093).

**Efecto:** escribe `audit_log` (`action = pickup_request.announced`,
`entity_type = 'pickup_request'`, `entity_id` = el id del `pickup_requests`,
`metadata = null` — mismo criterio de minimización de datos que
`delivery_code_mismatched`) y publica al topic
`school-pickup/institution/{institutionId}/board-announce`
(`specs/api-contracts/pickup-realtime-mqtt.md`, § "Topic — vocear"), que el
puente WebSocket del tablero reenvía (`specs/api-contracts/board-ws.md`).
La publicación es best-effort: un fallo se registra y no afecta la
respuesta de este endpoint, mismo criterio que el resto de publicaciones
en tiempo real de este contrato.

Mismo mecanismo de autorización que `deliver`:
**`InstitutionMembershipGuard`** en modo ruta por recurso, sin restricción
de `role` (ADR-011).

**Request:** sin body — no hay nada que el cliente deba enviar más que el
`id` en la ruta.

**Response 204** — sin cuerpo (acción completada, nada que devolver; mismo
criterio que otros endpoints de acción sin contenido de este API, por
ejemplo `DELETE /institution-members/:id`).

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `NOT_INSTITUTION_MEMBER` | el usuario no es `institution_members` de la institución del `pickup_requests` (cualquier `role` sirve, ADR-011) |
| 404 | `RESOURCE_NOT_FOUND` | el `pickup_requests` no existe |
| 409 | `INVALID_STATUS_TRANSITION` | el `pickup_requests` ya está en un estado terminal (`delivered`/`cancelled`) |

**Sin límite de repetición ni debounce** (ADR-073 punto 4): un doble clic
en el operador simplemente repite el anuncio dos veces seguidas — no se
justifica lógica adicional para un caso de uso de bajo riesgo.

## `PATCH /pickup-requests/:id/cancel`

El tutor cancela la recogida. Ver feature 022. Transición a `cancelled`.

**Request:** sin body.

**Response 200**
```json
{ "id": "uuid", "status": "cancelled", "completedAt": "string (timestamptz)" }
```

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `NOT_STUDENT_GUARDIAN` | el usuario autenticado no es el `guardian_user_id` dueño |
| 404 | `RESOURCE_NOT_FOUND` | el `pickup_requests` no existe |
| 409 | `INVALID_STATUS_TRANSITION` | transición inválida (ya está en un estado terminal), según la máquina de estados compartida (ADR-017) |

## `GET /institutions/:id/delivered-today`

Línea base persistida de "entregados hoy" del Dashboard del rol Institución
(`apps/portal`) — enmienda a ADR-072 punto 3, ver `docs/decisiones.md`. Vive
en este contrato, no en `specs/api-contracts/institution-reports.md`, por
autorización distinta: `GET /institutions/:id/reports` exige `role = admin`
(ADR-060 punto 6), mientras que este endpoint es visible para cualquier
`institution_member` — mismo criterio que el resto de este contrato para el
modo `institutionId` (ADR-071 punto 1). No es un descuido de organización,
es la razón por la que existe un endpoint propio en vez de reutilizar el de
reportes.

Misma consulta que `InstitutionReportsService.get()` ya prueba para
`period = 'today'` (`status = 'delivered' AND completed_at BETWEEN` inicio
del día calendario `AND :asOf`), agrupada además por
`enrollment.grade_or_group` (mismo criterio que `dashboard-grouping.ts` del
frontend: sin inventar un campo "nivel" que no existe — una fila sin grupo
cuenta bajo `"Sin grupo"`).

**Request:** sin body ni query params.

**Response 200**
```json
{
  "asOf": "string (timestamptz, ISO 8601)",
  "total": "number",
  "byGroup": [{ "label": "string", "count": "number" }]
}
```

`asOf` es el instante en que el servidor ejecutó la consulta — nunca un
valor enviado por el cliente. El cliente lo usa para descartar, sin
contarlos dos veces, los deltas en vivo del canal `board-monitor`
(`specs/api-contracts/board-monitor-ws.md`) cuyo `updatedAt` sea anterior o
igual a `asOf`: esa entrega ya está incluida en `total`/`byGroup`.

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `NOT_INSTITUTION_MEMBER` | el usuario no es `institution_members` de esa `:id` |
| 404 | `RESOURCE_NOT_FOUND` | la institución no existe (caso degenerado del guard, ADR-022 punto 4) |

## `GET /institutions/:id/attention-items`

Panel "Requiere atención" del Dashboard (`apps/portal`) — ADR-105.
Reemplaza el contenido fijo de ejemplo que tenía el panel desde ADR-072 §6.
Mismo criterio de autorización que `delivered-today` (endpoint propio, no
folded en `institution-reports`): visible para cualquier
`institution_member`, sin restricción de `role`.

Consolida 3 condiciones independientes, cada una evaluada con su propia
consulta — no son variantes de una sola:

1. **`waiting_too_long`** — un `pickup_requests` en `status = 'arrived'`
   cuya transición a `arrived` (`pickup_request_status_history`, la fila
   más reciente con `status = 'arrived'` para ese viaje) ocurrió hace más
   de `institutions.attention_wait_minutes` minutos.
2. **`cancelled_no_followup`** — un `pickup_requests` en
   `status = 'cancelled'`, con `completed_at` de hoy, para el cual no
   existe ningún otro `pickup_requests` con el mismo `enrollment_id`
   creado después (`created_at` posterior), **y** todavía no pasó el
   cierre de la ventana de salida de hoy para el nivel de ese alumno.
   Cierre = `resolveDeadline(fecha_hoy, resolveDismissalWindowEnd(...),
   institutions.arrival_tolerance_minutes)` — mismas funciones que ya usa
   `InstitutionReportsService` para puntualidad
   (`apps/api/src/institution-reports/punctuality.ts`), reutilizadas tal
   cual, no reimplementadas. Si `resolveDismissalWindowEnd` devuelve
   `null` (institución sin ventana configurada ese día), el ítem no se
   excluye por esta condición — solo se excluye si sí hay ventana y ya
   se cerró.
3. **`first_time_guardian`** — un `pickup_requests` en estado activo
   (`en_route`, `approaching`, `arriving` o `arrived`) para el cual no
   existe ningún otro `pickup_requests` con el mismo `enrollment_id` **y**
   el mismo `guardian_user_id` en `status = 'delivered'`. No importa la
   `relationship` del tutor (chofer, abuela, etc.) — lo que importa es que
   el staff nunca ha visto a esa persona recoger a ese alumno
   específico. Decisión de producto (ADR-105): se descartó marcar *toda*
   recogida por chofer autorizado — demasiado ruido para una familia que
   usa el mismo chofer todos los días; esta condición solo dispara la
   primera vez.

**Request:** sin body ni query params.

**Response 200**
```json
{
  "asOf": "string (timestamptz, ISO 8601)",
  "items": [
    {
      "type": "waiting_too_long | cancelled_no_followup | first_time_guardian",
      "pickupRequestId": "string (uuid)",
      "studentFullName": "string",
      "guardianFullName": "string",
      "guardianRelationship": "mother | father | grandparent | driver | other",
      "waitingMinutes": "number | null"
    }
  ]
}
```

`waitingMinutes` solo se llena para `type = 'waiting_too_long'` (minutos
transcurridos desde la transición a `arrived`, redondeado hacia abajo);
`null` en los otros 2 tipos. El frontend arma el texto legible de cada
tarjeta a partir de estos campos — la respuesta no trae prosa
pre-armada, mismo criterio que el resto de este contrato y de
`institution-reports.md`.

Sin orden garantizado entre tipos distintos; dentro del mismo tipo,
`waiting_too_long` ordenado por `waitingMinutes` descendente (el más
urgente primero), los otros 2 por `pickupRequestId` sin significado
particular.

**Errores** — mismos 3 casos que `delivered-today` arriba
(`401`/`403 NOT_INSTITUTION_MEMBER`/`404 RESOURCE_NOT_FOUND`).

## Referencias

- `specs/features/018-crear-pickup-request.md`,
  `specs/features/021-confirmar-llegada-y-entrega.md`,
  `specs/features/022-cancelar-pickup-request.md`,
  `specs/features/032-panel-requiere-atencion.md`.
- `specs/api-contracts/pickup-realtime-mqtt.md` (tiempo real; publicación de cada
  transición).
- `specs/entities/pickup_request.md`,
  `specs/entities/pickup_request_status_history.md`,
  `specs/entities/enrollment.md`, `specs/entities/student_guardian.md`,
  `specs/entities/institution_member.md`.
- ADR-105 (`GET /institutions/:id/attention-items`, panel "Requiere
  atención").
- ADR-011 (entrega no restringida por `role`).
- ADR-012 (resolución de `delivery_point_id`).
- ADR-013 (`delivery_code`, ciclo de vida).
- ADR-014 (snapshot de vehículo).
- ADR-017 (máquina de estados compartida; ports).
- ADR-018 (punto 2: `enrollments` aprobado; punto 3: unicidad de `delivery_code`;
  punto 4: `institution_id` denormalizado).
- ADR-024 (punto 1: recogida activa duplicada → 422; punto 4: `deliveryCode`
  incorrecto sin bloqueo, con `audit_log`; punto 7: `activation_radius_meters`
  no se valida en servidor; punto 9: paginación `limit`/`offset`; punto 11:
  exposición del `deliveryCode` al dueño y a los miembros de la institución).
- ADR-025 (punto 3: captura libre de vehículo vía `vehicleDescription`/`vehiclePlate`;
  punto 5: `enrollments` no aprobado → 422).
- ADR-032 (institución no aprobada también bloquea la creación de
  `pickup_request`, reutilizando `INSTITUTION_NOT_APPROVED`).
- ADR-028 (forma de los errores: `{ code, message }` en inglés).
- ADR-031 (punto 1: `code` exacto de cada error, nuevos y reutilizados; punto 2:
  `INVALID_DELIVERY_CODE` como `401`, tercera categoría de la convención HTTP;
  puntos 7 y 8: nombre y contenido de la fila de `audit_log`).
- ADR-050 (punto 6: filtro `deliveryPointId` como snapshot REST de la Consola de
  puerta — solo estados activos, autorización solo por `institution_member`).
- ADR-051 (punto 3: `PickupRequestQueueSummary`, forma propia del modo
  `deliveryPointId`, espejo del payload de tiempo real, con `deliveryCode`).
- ADR-065 (`institutionLocation` en `GET /pickup-requests/:id`, sin
  restricción de `InstitutionMembershipGuard`).
- ADR-068 (punto 2: filtro `institutionId` como snapshot REST del tablero de
  institución; punto 3: `PickupRequestBoardSummary`, espejo de
  `PickupRequestBoardPayload`, sin `deliveryCode`; punto 4: canal WebSocket
  hermano).
- ADR-071 (punto 2: `view=monitor`, snapshot REST de Carril,
  `PickupRequestBoardMonitorSummary`, espejo de
  `PickupRequestBoardMonitorPayload`, sin `deliveryCode`; punto 5: `view` como
  modificador de forma, no un cuarto filtro).
- ADR-072 (enmienda al punto 3: `GET /institutions/:id/delivered-today`,
  línea base persistida de "entregados hoy" para el Dashboard del rol
  Institución, sin restricción de `role`).
- ADR-073 (`POST /pickup-requests/:id/announce`: acción efímera "vocear",
  punto 1: sin transición ni escritura de fila; punto 2: mecanismo de
  autorización calco de `deliver`; punto 3: topic MQTT y canal WebSocket).
- `specs/api-contracts/delivery-point-queue-ws.md` (los deltas de tiempo real que
  continúan el snapshot del modo `deliveryPointId`).
- `specs/api-contracts/board-ws.md` (los deltas de tiempo real que continúan el
  snapshot del modo `institutionId`, `view=board`).
- `specs/api-contracts/board-monitor-ws.md` (los deltas de tiempo real que
  continúan el snapshot del modo `institutionId`, `view=monitor`).
- `docs/arquitectura.md` (§`InstitutionMembershipGuard`: los tres patrones de
  resolución de `institutionId`, incluido el de verificación manual OR que usan
  los `GET` de este contrato).

## Preguntas abiertas

Ninguna: la exposición del `deliveryCode` en lectura (dueño + cualquier
`institution_members` de la institución, sin restricción de `role`) se resolvió en
ADR-024 (punto 11). El resto de dudas del contrato se resolvieron en ADR-024
(puntos 1, 4, 7 y 9) y en ADR-031 (códigos de error exactos, clasificación HTTP
del `deliveryCode` incorrecto, y mecanismo de autorización de cada endpoint).
