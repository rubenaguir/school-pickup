# Feature 022 — Cancelar pickup request

## Propósito

El tutor cancela un trayecto de recogida en curso. Cubre el caso en que el tutor
ya no va a recoger (imprevisto, error al iniciar, cambio de planes): el
`pickup_request` pasa a `cancelled` y se retira del tablero y de la cola de
puerta en tiempo real.

## Entidades involucradas

- `pickup_request` (actualizado: `status` a `cancelled`; `completed_at`)
- `pickup_request_status_history` (creada una fila, `status = cancelled`)

## Precondiciones

- Solo el `guardian_user_id` **dueño** del `pickup_request` puede cancelarlo.
- El `pickup_request` está en un estado **no terminal** (`en_route`, `arriving` o
  `arrived`): `cancelled` es alcanzable desde cualquiera de esos tres, pero no
  desde `delivered` ni desde otro `cancelled`. La validez de la transición se
  resuelve contra la máquina de estados compartida en `packages/shared`
  (`pickup-request-status-machine.ts`, ADR-017); la feature invoca
  `canTransition(...)`, no la reimplementa.

## Postcondiciones

- `pickup_request.status` pasa a `cancelled` y se fija `completed_at = now()`
  (igual que `delivered`, es un estado terminal que cierra la ventana de
  recogida; a partir de aquí corre la retención de `location_updates`, feature
  023).
- Se crea una fila en `pickup_request_status_history` con `status = cancelled` y
  `changed_by_user_id` = el tutor.
- Se publica el estado actualizado (vía `MqttClient`) al feed agregado
  `school-pickup/institution/{institutionId}/board` y, si hay
  `delivery_point_id`, a la cola
  `school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`,
  para que el tablero y la consola de puerta retiren el trayecto.

## Casos Given/When/Then

### Caso de éxito

```
Given un pickup_request en status en_route, arriving o arrived
  And el usuario autenticado es su guardian_user_id
  And la máquina de estados compartida permite la transición a cancelled
When el tutor cancela
Then status pasa a cancelled y completed_at queda fijado
  And se crea la fila de historial (changed_by_user_id = tutor)
  And se publica el estado a los topics para retirarlo del tablero/cola
```

### Caso: intento de cancelar un trayecto ya terminal

```
Given un pickup_request en status = delivered o cancelled
When se intenta cancelar
Then la operación falla (la máquina de estados no permite transición desde un
     estado terminal)
```

### Caso: alguien que no es el tutor dueño intenta cancelar

```
Given un pickup_request
  And el usuario autenticado NO es su guardian_user_id
When intenta cancelar
Then la operación se rechaza por falta de autorización
```

## Referencia a contrato de API

Ver `specs/api-contracts/pickup-requests.md` —
`PATCH /pickup-requests/:id/cancel`.

## Referencia a MQTT

Publica el estado `cancelled` (vía `MqttClient`) al feed agregado y, si hay
`delivery_point_id`, a la cola del punto de entrega. Ver
`specs/api-contracts/pickup-realtime-mqtt.md`.

## Referencias

- ADR-013 (ciclo de vida; `cancelled` alcanzable desde los estados no
  terminales).
- ADR-017 (máquina de estados compartida; `MqttClient` como port).
- ADR-024 (punto 8: `cancelled` válido desde `en_route`/`arriving`/`arrived`).
- `specs/entities/pickup_request.md`,
  `specs/entities/pickup_request_status_history.md`.
- `docs/arquitectura.md` (flujo de tiempo real).

## Preguntas abiertas

Ninguna.
