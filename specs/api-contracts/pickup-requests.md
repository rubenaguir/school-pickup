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
| `PATCH /pickup-requests/:id/arrived` | verificación manual en el `service`: ser el `guardian_user_id` dueño |
| `PATCH /pickup-requests/:id/deliver` | **`InstitutionMembershipGuard`** en modo ruta por recurso: `@InstitutionResource({ entity: PickupRequest })` resuelve el `pickup_requests` por su `:id`, lee su `institution_id` (denormalizado, ADR-018 punto 4) y verifica la membresía antes de llegar al controller. Sin restricción de `role` (ADR-011) |
| `PATCH /pickup-requests/:id/cancel` | verificación manual en el `service`: ser el `guardian_user_id` dueño |

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
| 422 | `ACTIVE_PICKUP_REQUEST_EXISTS` | ya existe un `pickup_requests` no terminal (`en_route`/`arriving`/`arrived`) para ese `enrollmentId` (ADR-024 punto 1) |

Los dos errores de `vehicleId` (`404 RESOURCE_NOT_FOUND` si no existe,
`403 NOT_VEHICLE_OWNER` si es de otro tutor) aplican **solo** a la vía de
catálogo. La captura libre (`vehicleDescription`/`vehiclePlate` sin `vehicleId`)
no consulta `vehicles` y no puede producirlos.

`activationRadiusMeters` no se valida en el servidor: es afordance de cliente
(ADR-024 punto 7). El servidor no exige que el tutor esté dentro del radio para
crear la recogida.

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
  "status": "en_route | arriving | arrived | delivered | cancelled",
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

## `GET /pickup-requests?enrollmentId=...` · `?deliveryPointId=...`

Un mismo endpoint con **dos modos mutuamente excluyentes**, elegidos por el query
param que llega:
- **`enrollmentId`** — histórico de recogidas de un `enrollments`. Ver features
  018–022.
- **`deliveryPointId`** — cola operativa de un `delivery_points`: el snapshot
  inicial de la Consola de puerta, sobre el que después se aplican los deltas de
  tiempo real (ADR-050 punto 6). Ver feature 021.

Hay que enviar **exactamente uno** de los dos: enviar ambos, o ninguno, es
`400 INVALID_PAYLOAD`.

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `enrollmentId` | exactamente uno de los dos | debe corresponder a un alumno del que el usuario es guardián, o a una institución de la que es miembro |
| `deliveryPointId` | exactamente uno de los dos | debe corresponder a un `delivery_points` de una institución de la que el usuario es miembro (cualquier `role`) |
| `status` | no | filtra por uno de los valores del enum |
| `limit` | no | tamaño de página; default `20` (ADR-024 punto 9) |
| `offset` | no | desplazamiento; default `0` (ADR-024 punto 9) |

Paginación con `limit`/`offset`, orden `created_at DESC` (ADR-024 punto 9): un
`enrollments` acumula recogidas durante años.

### Diferencias del modo `deliveryPointId`

- **Solo estados activos** (`en_route`, `arriving`, `arrived`), nunca historial
  completo (ADR-050 punto 6): la cola de una puerta es una vista operativa del
  momento, no un registro histórico. Un `pickup_requests` `delivered` o
  `cancelled` desaparece de la cola.
- `status`, si se envía, **acota dentro** de ese conjunto activo; no lo amplía.
  Pedir `status=delivered` junto con `deliveryPointId` devuelve una página vacía
  (`total: 0`), no los entregados — no es un error de payload, es un filtro que
  no puede intersecar nada.
- Autorización distinta (solo `institution_member`, ver arriba).
- **Forma de respuesta distinta** (ADR-051 punto 3): `PickupRequestQueueSummary`,
  no el `PickupRequestSummary` genérico del modo `enrollmentId`. Ver abajo.

**Response 200 — modo `enrollmentId`** (`PickupRequestSummary`; sin cambios)
```json
{
  "pickupRequests": [
    {
      "id": "uuid",
      "status": "en_route | arriving | arrived | delivered | cancelled",
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
      "status": "en_route | arriving | arrived",
      "studentFullName": "string (join: student vía enrollment)",
      "gradeOrGroup": "string | null (join: enrollment)",
      "vehicleDescription": "string | null",
      "vehiclePlate": "string | null",
      "deliveryCode": "string (4 dígitos)",
      "estimatedArrivalAt": "string (timestamptz) | null",
      "etaSeconds": "number | null",
      "updatedAt": "string (timestamptz)"
    }
  ],
  "limit": "number",
  "offset": "number",
  "total": "number"
}
```

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
| 400 | `INVALID_PAYLOAD` | ninguno de `enrollmentId`/`deliveryPointId`, los dos a la vez, o cualquiera de ellos mal formado |
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `NOT_INSTITUTION_MEMBER` | modo `enrollmentId`: el usuario no es guardián del alumno **ni** miembro de la institución del `enrollments` (falla el OR). Modo `deliveryPointId`: el usuario no es `institution_members` de la institución dueña del `delivery_points` |
| 404 | `RESOURCE_NOT_FOUND` | el `enrollments` o el `delivery_points` indicado no existe |

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

## Referencias

- `specs/features/018-crear-pickup-request.md`,
  `specs/features/021-confirmar-llegada-y-entrega.md`,
  `specs/features/022-cancelar-pickup-request.md`.
- `specs/api-contracts/pickup-realtime-mqtt.md` (tiempo real; publicación de cada
  transición).
- `specs/entities/pickup_request.md`,
  `specs/entities/pickup_request_status_history.md`,
  `specs/entities/enrollment.md`, `specs/entities/student_guardian.md`,
  `specs/entities/institution_member.md`.
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
- `specs/api-contracts/delivery-point-queue-ws.md` (los deltas de tiempo real que
  continúan ese snapshot).
- `docs/arquitectura.md` (§`InstitutionMembershipGuard`: los tres patrones de
  resolución de `institutionId`, incluido el de verificación manual OR que usan
  los dos `GET` de este contrato).

## Preguntas abiertas

Ninguna: la exposición del `deliveryCode` en lectura (dueño + cualquier
`institution_members` de la institución, sin restricción de `role`) se resolvió en
ADR-024 (punto 11). El resto de dudas del contrato se resolvieron en ADR-024
(puntos 1, 4, 7 y 9) y en ADR-031 (códigos de error exactos, clasificación HTTP
del `deliveryCode` incorrecto, y mecanismo de autorización de cada endpoint).
