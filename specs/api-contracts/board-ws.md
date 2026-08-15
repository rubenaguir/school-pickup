# API Contract — Tablero de institución (WebSocket)

Contrato del **puente WebSocket** que el `api` expone para el tablero de
institución (`apps/board`, ADR-068). No es REST y no es MQTT: es el canal
por el que el kiosko recibe, en vivo, el feed agregado de recogidas de
**toda su institución**.

Existe por ADR-050: **el navegador nunca se conecta directamente al broker
MQTT**. El `api` se suscribe al broker por comodín y reenvía a cada cliente
autorizado únicamente los mensajes de su institución. Desde la perspectiva
de Mosquitto no hay ninguna conexión nueva — mismo principio que los dos
canales hermanos (cola de punto de entrega, seguimiento del tutor).

Este canal transporta **solo deltas**. El estado inicial se obtiene por
REST con `GET /pickup-requests?institutionId=...` (`view=board`, el
default si se omite; `specs/api-contracts/pickup-requests.md`) — dos
mecanismos separados, nunca uno híbrido (mismo criterio que ADR-050 punto 6).

Carril, el modo de staff del tablero (ADR-071 pt.2), **no** usa este canal:
tiene su propio puente, `specs/api-contracts/board-monitor-ws.md`, porque su
payload lleva datos de tutor/vehículo que este canal público nunca debe
transportar.

## Endpoint

```
wss://{host}/ws/board?accessToken={jwt}&institutionId={uuid}
```

Sin el prefijo `/api` del REST — mismo criterio que
`specs/api-contracts/delivery-point-queue-ws.md`.

### Por qué el token va en el query string

Misma razón que los dos canales hermanos: la API `WebSocket` nativa del
navegador no permite fijar headers en el handshake (ADR-050 punto 3).
`accessToken` viaja como query param, nunca el refresh token.

## Autorización de la conexión

Se valida al momento de conectar, no por mensaje — mismo criterio que los
dos canales hermanos.

1. `accessToken` e `institutionId` presentes y bien formados.
2. El JWT verifica firma y expiración (mismo `JwtService` del access
   token).
3. El `institutions` solicitado existe.
4. El usuario del token es `institution_members` de esa institución, con
   **cualquier `role`** (ADR-011, ADR-068 punto 1) — a diferencia del canal
   de seguimiento (propiedad de un `pickup_request` por un tutor), aquí la
   regla es membresía de institución, mismo criterio que el canal de cola
   de punto de entrega.

No hay reevaluación posterior — mismo trade-off que los dos canales
hermanos.

### Códigos de cierre

Mismo rango 4000–4999, espejo de los `code` REST equivalentes.

| Código | `reason` | Caso |
|---|---|---|
| `4400` | `INVALID_PAYLOAD` | falta `accessToken` o `institutionId`, o `institutionId` no es un UUID |
| `4401` | `UNAUTHENTICATED` | el `accessToken` no verifica |
| `4403` | `NOT_INSTITUTION_MEMBER` | el usuario no es `institution_members` de esa institución |
| `4404` | `RESOURCE_NOT_FOUND` | el `institutions` no existe |

## Mensajes servidor → cliente

Un mensaje por cada publicación del broker en cualquiera de los dos topics
que esta conexión multiplexa (ADR-073 pt.3): el feed de filas
(`school-pickup/institution/+/board`, mismo topic que ya consumen los dos
canales hermanos) y el de "vocear"
(`school-pickup/institution/+/board-announce`, ver abajo). El `api` se
suscribe a ambos wildcards; cada cliente de este canal solo recibe los
mensajes que corresponden a su `institutionId`. A diferencia del canal de
seguimiento (que además filtra por `pickupRequestId` dentro de la
institución del tutor), aquí no hay un segundo filtro: el tablero recibe
**todo** el feed de su institución, sin importar el `pickup_request` o el
`delivery_point` al que pertenezca cada fila — el agrupado/filtrado por
punto de entrega es responsabilidad del cliente (ADR-068 punto 5).

Cada mensaje trae un discriminador `kind` (`'row' | 'announce'`) que indica
cuál de las dos formas de abajo tiene — primera vez que este canal necesita
distinguir más de una forma de mensaje (ADR-073 pt.3). El cliente decide
qué hacer con cada uno según ese campo; el `api` reenvía siempre verbatim,
sin transformar ninguno de los dos.

### `kind: 'row'` — fila del feed agregado

El cuerpo es **exactamente** el payload que ya construye
`buildBoardPayload()` (`packages/shared`) — sin envoltura ni campos
añadidos, misma forma documentada en
`specs/api-contracts/pickup-realtime-mqtt.md`, § "Topic — feed agregado
del tablero". **No incluye `deliveryCode`** (ADR-051, deliberado): el
tablero es una pantalla pública en la recepción de la institución.

### `kind: 'announce'` — "vocear" (ADR-073)

Evento efímero: un operador de la Consola de puerta pide que el tablero
anuncie a un alumno por voz (`POST /pickup-requests/:id/announce`,
`specs/api-contracts/pickup-requests.md`). Sin snapshot ni histórico — un
tablero que se reconecta después de un voceo simplemente no lo escucha. El
cuerpo es exactamente el payload que construye `buildBoardAnnouncePayload()`
(`packages/shared`), documentado en
`specs/api-contracts/pickup-realtime-mqtt.md`, § "Topic — vocear
(ADR-073)":

```json
{
  "kind": "announce",
  "pickupRequestId": "uuid",
  "studentFullName": "string (join: student vía enrollment)",
  "announcedAt": "string (timestamptz)"
}
```

**Sin datos de tutor/vehículo** — mismo criterio de privacidad que el resto
de este canal público (ADR-051/068).

## Mensajes cliente → servidor

Ninguno — canal unidireccional, igual que los dos canales hermanos. Toda
acción operativa (confirmar entrega, vocear, etc.) va por REST desde la
Consola de puerta, no desde el tablero.

## Reconexión

Responsabilidad del frontend — al reconectar, vuelve a pedir el snapshot
REST antes de reanudar el consumo de deltas.

## Referencias

- ADR-050 (patrón original del puente WebSocket).
- ADR-068 (decisión completa de este canal: sesión reutilizada de
  `institution_member`, snapshot + WS del feed completo, filtro por punto
  de entrega en cliente).
- ADR-011 (tablero sin restricción de `role` dentro del tenant).
- ADR-051 (`deliveryCode` fuera del payload de tablero).
- `specs/api-contracts/pickup-requests.md` (snapshot REST que precede a
  este canal, modo `institutionId`).
- `specs/api-contracts/pickup-realtime-mqtt.md` (topic de origen y forma
  del payload de tablero).
- `specs/api-contracts/delivery-point-queue-ws.md` y
  `specs/api-contracts/pickup-request-tracking-ws.md` (canales hermanos,
  misma arquitectura, autorización y alcance del filtrado distintos).
- `specs/api-contracts/board-monitor-ws.md` (Carril, el canal hermano del
  modo de staff — mismo mecanismo, payload con datos de tutor/vehículo,
  ADR-071 pt.2).
- ADR-071 (punto 2: por qué Carril no reutiliza este canal).
- ADR-073 (punto 3: "vocear" multiplexado sobre este mismo canal vía el
  discriminador `kind`, en vez de una sexta conexión WS).

## Preguntas abiertas

Ninguna: ADR-068 resolvió sesión, snapshot, canal y filtrado en un único
ADR de plomería.
