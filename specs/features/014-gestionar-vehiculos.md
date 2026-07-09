# Feature 014 — Gestionar catálogo de vehículos

## Propósito

Un tutor administra su lista reutilizable de vehículos guardados en el perfil:
los agrega, edita, elimina y marca cuál es el principal. Es un catálogo del
tutor, **independiente de cualquier viaje**: el vehículo con el que llega puede
variar por recogida, y el uso de un vehículo en un `pickup_request` guarda un
snapshot denormalizado, no una referencia viva (ADR-014). La selección de un
vehículo al iniciar un `pickup_request` es de un slice futuro, fuera de aquí.

## Entidades involucradas

- `vehicle` (creado, actualizado, eliminado)
- `user` (leído, para autorización: el tutor autenticado es el dueño)

## Precondiciones

- Quien gestiona es un `user` autenticado y solo puede operar sobre **sus
  propios** vehículos: `vehicle.guardian_user_id` debe ser el usuario
  autenticado. No hay restricción por rol — "tutor" no es un flag en `user`
  (ver `specs/entities/user.md`); la autorización es por propiedad del dato.

## Postcondiciones

### Al agregar
- Se crea una fila en `vehicle` con `guardian_user_id` = usuario autenticado,
  `description` (obligatorio, ej. "Mazda CX-5 gris") y `plate` (obligatorio).
- `is_primary` se puede fijar al crear; si no se indica, queda `false` por
  defecto. Si se fija `true`, aplica la regla del principal (ver abajo).

### Al editar
- Se actualizan `description`, `plate` y/o `is_primary` del vehículo.
  `updated_at` pasa a `now()`. Editar no afecta el histórico de
  `pickup_requests` ya creados, que conservan su snapshot (ADR-014).

### Al marcar como principal
- Solo un `vehicle` por `guardian_user_id` puede tener `is_primary = true`,
  forzado por el índice único parcial de Postgres
  `ON vehicles (guardian_user_id) WHERE is_primary = true` (ADR-018, punto 5).
  Marcar uno como principal implica desmarcar el que lo fuera antes: la
  operación debe dejar exactamente un principal, no dos, para no violar el
  índice.

### Al eliminar
- Se elimina la fila del `vehicle` del catálogo. No afecta el histórico: los
  `pickup_requests` que lo usaron conservan su snapshot y su FK queda
  `ON DELETE SET NULL` (ver `specs/entities/vehicle.md`).
- **Borrado del vehículo principal (ADR-023, punto 1):** si el vehículo que se
  borra tiene `is_primary = true` y el tutor tiene otros vehículos, se promueve
  otro a principal, **seleccionado por el tutor** (la operación de borrado indica
  cuál de los restantes queda como nuevo `is_primary`). Si el vehículo principal
  era el único del catálogo, el borrado procede y el catálogo queda vacío, sin
  principal.

## Casos Given/When/Then

### Caso de éxito — agregar

```
Given un user autenticado
When agrega un vehicle con description y plate
Then se crea la fila con guardian_user_id = usuario autenticado
  And is_primary queda en false si no se indicó
```

### Caso: marcar un vehículo como principal desmarca el anterior

```
Given un user con un vehicle A marcado is_primary = true
  And otro vehicle B del mismo user con is_primary = false
When marca B como is_primary = true
Then B queda con is_primary = true
  And A queda con is_primary = false
  And nunca hay dos vehicles con is_primary = true para el mismo
      guardian_user_id (índice único parcial, ADR-018 punto 5)
```

### Caso: intento de gestionar un vehículo de otro tutor

```
Given un vehicle cuyo guardian_user_id es otro user
When el usuario autenticado intenta editarlo o eliminarlo
Then la operación se rechaza por falta de autorización (solo el dueño gestiona
     sus vehículos)
```

### Caso: borrar el vehículo principal habiendo otros

```
Given un user con un vehicle A (is_primary = true) y al menos otro vehicle B
When borra A designando a B como nuevo principal
Then A se elimina
  And B queda con is_primary = true (promoción seleccionada por el tutor,
      ADR-023 punto 1)
```

### Caso: borrar el vehículo principal siendo el único

```
Given un user cuyo único vehicle A tiene is_primary = true
When borra A
Then A se elimina y el catálogo queda vacío, sin principal (ADR-023 punto 1)
```

### Caso: editar/eliminar no altera el histórico

```
Given un vehicle usado en pickup_requests pasados
When el dueño lo edita o lo elimina del catálogo
Then los pickup_requests históricos conservan su snapshot
     (vehicle_description / vehicle_plate) sin cambios (ADR-014)
```

## Referencia a contrato de API

Ver `specs/api-contracts/vehicles.md` — `GET /vehicles`, `POST /vehicles`,
`PATCH /vehicles/:id`, `DELETE /vehicles/:id`.

## Referencia a MQTT

No aplica: la gestión del catálogo de vehículos no publica ni consume topics
MQTT.

## Referencias

- ADR-014 (catálogo de vehículos del tutor; snapshot denormalizado en
  `pickup_request`; el catálogo es libremente editable sin efectos secundarios).
- ADR-018 (punto 5: índice único parcial que fuerza un solo `is_primary = true`
  por `guardian_user_id`).
- ADR-023 (punto 1: promoción seleccionada por el tutor al borrar el vehículo
  principal).
- `specs/entities/vehicle.md`, `specs/entities/user.md`.

## Preguntas abiertas

Ninguna: el comportamiento de `is_primary` al borrar el vehículo principal
(promover otro, seleccionado por el tutor) se resolvió en ADR-023 (punto 1).
