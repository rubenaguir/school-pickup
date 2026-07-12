# API Contract — Vehicles

Recurso del catálogo reutilizable de vehículos del tutor. Cubre
`specs/features/014-gestionar-vehiculos.md`.

## Autenticación

Todos los endpoints requieren access token válido. No hay restricción por rol
("tutor" no es un flag en `users`, ver `specs/entities/user.md`).

## Reglas de autorización

La autorización es por propiedad del dato: un usuario solo puede ver o gestionar
vehículos donde `vehicles.guardian_user_id = sub` (el `users.id` del token). No
existe un concepto de "ver todos los vehículos" para ningún rol.

## `GET /vehicles`

Lista los vehículos del tutor autenticado. Ver feature 014.

**Request:** sin body.

**Response 200**
```json
{
  "vehicles": [
    {
      "id": "uuid",
      "description": "string",
      "plate": "string",
      "isPrimary": "boolean"
    }
  ]
}
```

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |

## `POST /vehicles`

Agrega un vehículo al catálogo del tutor autenticado. Ver feature 014.

**Request**
```json
{
  "description": "string",
  "plate": "string",
  "isPrimary": "boolean"
}
```

`isPrimary` es opcional; si se omite, se crea con `false`. Si se envía `true`,
desmarca el principal anterior del tutor (índice único parcial, ADR-018 punto 5).

**Response 201**
```json
{
  "id": "uuid",
  "description": "string",
  "plate": "string",
  "isPrimary": "boolean"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`description` o `plate` faltantes) |
| 401 | no autenticado |

## `PATCH /vehicles/:id`

Edita un vehículo del tutor autenticado, incluyendo marcarlo como principal. Ver
feature 014. Todos los campos son opcionales (edición parcial).

**Request**
```json
{
  "description": "string",
  "plate": "string",
  "isPrimary": "boolean"
}
```

Fijar `isPrimary = true` desmarca el principal anterior del mismo tutor, de modo
que nunca coexistan dos principales (ADR-018 punto 5).

**Response 200**
```json
{
  "id": "uuid",
  "description": "string",
  "plate": "string",
  "isPrimary": "boolean"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido |
| 401 | no autenticado |
| 403 | el `vehicles` pertenece a otro `guardian_user_id` |
| 404 | el `vehicles` no existe |

## `DELETE /vehicles/:id`

Elimina un vehículo del catálogo del tutor autenticado. Ver feature 014. No
afecta el histórico de `pickup_requests` (conservan su snapshot; FK
`ON DELETE SET NULL`, ADR-014).

**Request** (body opcional; requerido al borrar el principal habiendo otros)
```json
{ "newPrimaryVehicleId": "uuid" }
```

`newPrimaryVehicleId` designa cuál de los vehículos restantes del tutor queda
como `is_primary = true` cuando se borra el vehículo principal (ADR-023 punto 1).
Reglas:
- Si el vehículo a borrar no es el principal: no se requiere `newPrimaryVehicleId`
  (se ignora si se envía).
- Si es el principal y el tutor tiene otros vehículos: `newPrimaryVehicleId` es
  obligatorio y debe referir a otro vehículo del mismo tutor.
- Si es el principal y es el único vehículo: no se envía; el catálogo queda vacío.

**Response 204** (sin body)

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |
| 403 | el `vehicles` pertenece a otro `guardian_user_id` |
| 404 | el `vehicles` no existe |
| 422 `NEW_PRIMARY_VEHICLE_REQUIRED` | se borra el vehículo principal habiendo otros y no se designó `newPrimaryVehicleId` (obliga a reasignar la primariedad a otra fila `vehicles`; regla que cruza hacia otra entidad; ADR-023 punto 1, corregido de 409 a 422 en ADR-026 punto 3) |
| 422 `NEW_PRIMARY_VEHICLE_INVALID` | `newPrimaryVehicleId` no refiere a otro vehículo del tutor: no pertenece al mismo `guardian_user_id`, o es el mismo vehículo que se está borrando (regla cruzada entre entidades; ADR-025 punto 5) |

## Referencias

- `specs/features/014-gestionar-vehiculos.md`.
- `specs/entities/vehicle.md`, `specs/entities/user.md`.
- ADR-014 (catálogo independiente del histórico; snapshot en `pickup_requests`).
- ADR-018 (punto 5: índice único parcial de `is_primary` por `guardian_user_id`).
- ADR-023 (punto 1: promoción seleccionada por el tutor al borrar el principal).
- ADR-025 (punto 5: `newPrimaryVehicleId` inválido → 422, regla cruzada entre
  entidades).
- ADR-026 (punto 3: borrar el principal sin `newPrimaryVehicleId` habiendo otros
  → 422, corregido de 409).

## Preguntas abiertas

Ninguna: el comportamiento de `DELETE /vehicles/:id` sobre el vehículo principal
(designar el reemplazo vía `newPrimaryVehicleId`) se resolvió en ADR-023
(punto 1).
