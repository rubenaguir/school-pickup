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
  cancelar exigen ser el `guardian_user_id` dueño del `pickup_request` (para
  crear: ser `student_guardian` en `status = active` del alumno del
  `enrollment`).
- **Miembro de institución** (perspectiva de la puerta): confirmar la entrega
  exige ser `institution_member` de la `institution_id` del `pickup_request`,
  con **cualquier `role`** (la consola de puerta no restringe por rol, ADR-011).
- **Lectura**: el tutor guardián del alumno o cualquier `institution_member` de
  la institución del `pickup_request` pueden leerlo.

Como el access token no fija `institutionId` ni `role` (ver
`specs/api-contracts/auth.md`), cada endpoint valida la relación (propiedad del
tutor, o membresía a la institución) contra el `pickup_request` en cuestión.

Toda transición de `status` se valida contra la máquina de estados compartida en
`packages/shared` (`pickup-request-status-machine.ts`, ADR-017); un intento de
transición inválida devuelve 409.

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
  campos de vehículo aplica.

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
| Código | Caso |
|---|---|
| 400 | payload inválido (`enrollmentId` faltante, `arrivalMode` fuera del enum, o combinación de campos de vehículo inválida: `vehicleId` junto con `vehicleDescription`/`vehiclePlate`) |
| 401 | no autenticado |
| 403 | el usuario autenticado no es `student_guardian` activo del alumno del `enrollment` |
| 404 | el `enrollment` no existe |
| 422 | el `enrollment` no está en `status = approved` (regla cruzada entre entidades; ADR-018 punto 2, ADR-025 punto 5) |
| 422 | ya existe un `pickup_request` no terminal (`en_route`/`arriving`/`arrived`) para ese `enrollmentId` (ADR-024 punto 1) |

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

`deliveryCode` se incluye para el `guardian_user_id` dueño (lo muestra en su app)
**y** para cualquier `institution_member` de la institución del `pickup_request`
(vía `institution_id`, ADR-018 punto 4), sin restricción de `role` (ADR-011,
ADR-024 punto 11): la consola de puerta lo despliega directamente para que el
operador lo compare con el que muestra el tutor. La verificación de la entrega
sigue siendo server-side vía `PATCH .../deliver` (ADR-024 punto 4).

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |
| 403 | el usuario no es el tutor dueño ni `institution_member` de la institución del `pickup_request` |
| 404 | el `pickup_request` no existe |

## `GET /pickup-requests?enrollmentId=...`

Histórico de recogidas de un `enrollment`. Ver features 018–022.

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `enrollmentId` | sí | debe corresponder a un alumno del que el usuario es guardián, o a una institución de la que es miembro |
| `status` | no | filtra por uno de los valores del enum |
| `limit` | no | tamaño de página; default `20` (ADR-024 punto 9) |
| `offset` | no | desplazamiento; default `0` (ADR-024 punto 9) |

Paginación con `limit`/`offset`, orden `created_at DESC` (ADR-024 punto 9): un
`enrollment` acumula recogidas durante años.

**Response 200**
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

**Errores**
| Código | Caso |
|---|---|
| 400 | `enrollmentId` faltante |
| 401 | no autenticado |
| 403 | el usuario no es guardián del alumno ni miembro de la institución del `enrollment` |

## `PATCH /pickup-requests/:id/arrived`

El tutor confirma "ya llegué". Ver feature 021. Transición a `arrived`.

**Request:** sin body.

**Response 200**
```json
{ "id": "uuid", "status": "arrived" }
```

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |
| 403 | el usuario autenticado no es el `guardian_user_id` dueño |
| 404 | el `pickup_request` no existe |
| 409 | transición inválida según la máquina de estados compartida (ADR-017) |

## `PATCH /pickup-requests/:id/deliver`

El staff confirma la entrega verificando el `delivery_code`. Ver feature 021.
Transición a `delivered`.

**Request**
```json
{ "deliveryCode": "string (4 dígitos)" }
```

**Response 200**
```json
{ "id": "uuid", "status": "delivered", "completedAt": "string (timestamptz)" }
```

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |
| 403 | el usuario no es `institution_member` de la institución del `pickup_request` (cualquier `role` sirve, ADR-011) |
| 404 | el `pickup_request` no existe |
| 409 | transición inválida según la máquina de estados compartida (ADR-017) |
| 422 | el `deliveryCode` ingresado no coincide con el del `pickup_request` |

Ante un `deliveryCode` incorrecto **no hay bloqueo ni límite de reintentos**
(verificación presencial, ADR-024 punto 4): el staff puede reintentar. Cada
intento fallido se registra en `audit_log`
(`action = pickup_request.delivery_code_mismatch`).

## `PATCH /pickup-requests/:id/cancel`

El tutor cancela la recogida. Ver feature 022. Transición a `cancelled`.

**Request:** sin body.

**Response 200**
```json
{ "id": "uuid", "status": "cancelled", "completedAt": "string (timestamptz)" }
```

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |
| 403 | el usuario autenticado no es el `guardian_user_id` dueño |
| 404 | el `pickup_request` no existe |
| 409 | transición inválida (ya está en un estado terminal), según la máquina de estados compartida (ADR-017) |

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
- ADR-018 (punto 2: `enrollment` aprobado; punto 3: unicidad de `delivery_code`;
  punto 4: `institution_id` denormalizado).
- ADR-024 (punto 1: recogida activa duplicada → 422; punto 4: `deliveryCode`
  incorrecto sin bloqueo, con `audit_log`; punto 7: `activation_radius_meters`
  no se valida en servidor; punto 9: paginación `limit`/`offset`; punto 11:
  exposición del `deliveryCode` al dueño y a los miembros de la institución).
- ADR-025 (punto 3: captura libre de vehículo vía `vehicleDescription`/`vehiclePlate`;
  punto 5: `enrollment` no aprobado → 422).

## Preguntas abiertas

Ninguna: la exposición del `deliveryCode` en lectura (dueño + cualquier
`institution_member` de la institución, sin restricción de `role`) se resolvió en
ADR-024 (punto 11). El resto de dudas del contrato se resolvieron en ADR-024
(puntos 1, 4, 7 y 9).
