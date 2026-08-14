# API Contract — Seguimiento de `pickup_request` (WebSocket)

Contrato del **puente WebSocket** que el `api` expone para la pantalla de
seguimiento de `apps/parent` (features 018–022). No es REST y no es MQTT:
es el canal por el que el navegador del tutor recibe, en vivo, el
estado/ETA de **su propio** `pickup_request`.

Existe por ADR-050/ADR-064: **el navegador nunca se conecta directamente
al broker MQTT**. El `api` se suscribe al broker por comodín y reenvía a
cada cliente autorizado únicamente los mensajes de su propio
`pickup_request`. Desde la perspectiva de Mosquitto no hay ninguna
conexión nueva — mismo principio que el canal de cola de punto de entrega,
autorización distinta.

Este canal transporta **solo deltas**. El estado inicial se obtiene por
REST con `GET /pickup-requests/:id`
(`specs/api-contracts/pickup-requests.md`) — dos mecanismos separados,
nunca uno híbrido (mismo criterio que ADR-050 punto 6).

## Endpoint

```
wss://{host}/ws/pickup-request-tracking?accessToken={jwt}&pickupRequestId={uuid}
```

Sin el prefijo `/api` del REST — mismo criterio que
`specs/api-contracts/delivery-point-queue-ws.md`.

### Por qué el token va en el query string

Misma razón que el canal de cola: la API `WebSocket` nativa del navegador
no permite fijar headers en el handshake (ADR-050 punto 3). `accessToken`
viaja como query param, nunca el refresh token.

## Autorización de la conexión

Se valida al momento de conectar, no por mensaje — mismo criterio que el
canal de cola.

1. `accessToken` y `pickupRequestId` presentes y bien formados.
2. El JWT verifica firma y expiración (mismo `JwtService` del access
   token).
3. El `pickup_requests` solicitado existe.
4. **El `guardian_user_id` del `pickup_requests` debe ser el usuario del
   token** (ADR-064 punto 1) — a diferencia del canal de cola (membresía
   de institución), aquí la regla es propiedad del tutor, mismo criterio
   que `assertOwner` en `PickupsService`. **Sin lado de institución** — un
   `institution_member` no se conecta a este canal (tiene el suyo propio,
   la cola de punto de entrega).

No hay reevaluación posterior — mismo trade-off que el canal de cola.

### Códigos de cierre

Mismo rango 4000–4999, espejo de los `code` REST equivalentes.

| Código | `reason` | Caso |
|---|---|---|
| `4400` | `INVALID_PAYLOAD` | falta `accessToken` o `pickupRequestId`, o `pickupRequestId` no es un UUID |
| `4401` | `UNAUTHENTICATED` | el `accessToken` no verifica |
| `4403` | `NOT_STUDENT_GUARDIAN` | el usuario no es el `guardian_user_id` dueño del `pickup_requests` |
| `4404` | `RESOURCE_NOT_FOUND` | el `pickup_requests` no existe |

## Mensajes servidor → cliente

Un mensaje por cada publicación del broker en el topic de tablero de la
institución dueña, **filtrado** a los mensajes cuyo `pickupRequestId`
coincide con el de esta conexión — el `api` se suscribe al wildcard
completo del tablero (mismo topic que ya consume `apps/board`), pero cada
cliente de este canal solo recibe los que le corresponden.

El cuerpo es **exactamente** el payload que ya construye
`buildBoardPayload()` (`packages/shared`) — sin envoltura ni campos
añadidos, misma forma documentada en
`specs/api-contracts/pickup-realtime-mqtt.md`, § "Topic — feed agregado
del tablero". **No incluye `deliveryCode`** (ADR-051, deliberado) — el
tutor ya lo obtuvo del snapshot REST inicial; no cambia durante la vida
del `pickup_requests`, así que no hace falta repetirlo en cada delta.

## Mensajes cliente → servidor

Ninguno — canal unidireccional, igual que el de cola. El envío de
ubicación va por REST (`POST /pickup-requests/:id/location`, ADR-062), no
por este canal.

## Reconexión

Responsabilidad del frontend — al reconectar, vuelve a pedir el snapshot
REST antes de reanudar el consumo de deltas.

## Referencias

- ADR-050 (patrón original del puente WebSocket).
- ADR-064 (decisión completa de este canal: autorización por propiedad,
  reutilización del topic de tablero, throttling de ubicación en el
  cliente).
- ADR-051 (`deliveryCode` fuera del payload de tablero).
- ADR-062 (`POST /pickup-requests/:id/location`, canal de ubicación
  saliente, separado de este).
- `specs/api-contracts/pickup-requests.md` (snapshot REST que precede a
  este canal).
- `specs/api-contracts/pickup-realtime-mqtt.md` (topic de origen y forma
  del payload de tablero).
- `specs/api-contracts/delivery-point-queue-ws.md` y
  `specs/api-contracts/board-ws.md` (canales hermanos, misma arquitectura,
  autorización y alcance del filtrado distintos).
