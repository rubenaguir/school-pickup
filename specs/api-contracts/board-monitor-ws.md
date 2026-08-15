# API Contract — Carril, monitor de institución (WebSocket)

Contrato del **puente WebSocket** que el `api` expone para Carril, el modo
de staff del tablero de institución (`apps/board`, ADR-071 pt.2). No es REST
y no es MQTT: es el canal por el que Carril recibe, en vivo, el feed
agregado de recogidas de **toda su institución**, con datos de
tutor/vehículo que el feed público de `specs/api-contracts/board-ws.md` no
lleva.

Existe por ADR-050 (el navegador nunca se conecta directamente al broker
MQTT) y, específicamente, por ADR-071 pt.2: Carril necesita su **propio**
canal porque su payload es más sensible que el del tablero público —
compartir transporte con `specs/api-contracts/board-ws.md` filtraría datos
de tutor/vehículo a cualquier kiosko físico público (Andén/Sereno), aunque
la interfaz nunca los pintara. Mismo criterio de separación que ya distingue
la cola de la consola de puerta del feed del tablero (ADR-050/051), aplicado
aquí a un segundo caso.

Este canal transporta **solo deltas**. El estado inicial se obtiene por
REST con `GET /pickup-requests?institutionId=...&view=monitor`
(`specs/api-contracts/pickup-requests.md`) — dos mecanismos separados,
nunca uno híbrido (mismo criterio que ADR-050 punto 6).

## Endpoint

```
wss://{host}/ws/board-monitor?accessToken={jwt}&institutionId={uuid}
```

Sin el prefijo `/api` del REST — mismo criterio que
`specs/api-contracts/board-ws.md`.

### Por qué el token va en el query string

Misma razón que los canales hermanos: la API `WebSocket` nativa del
navegador no permite fijar headers en el handshake (ADR-050 punto 3).
`accessToken` viaja como query param, nunca el refresh token.

## Autorización de la conexión

Se valida al momento de conectar, no por mensaje — mismo criterio que los
canales hermanos.

1. `accessToken` e `institutionId` presentes y bien formados.
2. El JWT verifica firma y expiración (mismo `JwtService` del access
   token).
3. El `institutions` solicitado existe.
4. El usuario del token es `institution_members` de esa institución, con
   **cualquier `role`** (ADR-011, ADR-071 pt.2) — Carril **no es un rol
   nuevo**, es una proyección de datos nueva: cualquier `institution_member`
   que ya tiene sesión en `apps/board` puede cambiar a este modo. Mismo
   criterio de autorización que `board-ws.md`, sin restricción adicional.

No hay reevaluación posterior — mismo trade-off que los canales hermanos.

### Códigos de cierre

Mismo rango 4000–4999, espejo de los `code` REST equivalentes.

| Código | `reason` | Caso |
|---|---|---|
| `4400` | `INVALID_PAYLOAD` | falta `accessToken` o `institutionId`, o `institutionId` no es un UUID |
| `4401` | `UNAUTHENTICATED` | el `accessToken` no verifica |
| `4403` | `NOT_INSTITUTION_MEMBER` | el usuario no es `institution_members` de esa institución |
| `4404` | `RESOURCE_NOT_FOUND` | el `institutions` no existe |

## Mensajes servidor → cliente

Un mensaje por cada publicación del broker en el topic `board-monitor` de la
institución de esta conexión — el `api` se suscribe al wildcard completo
(`school-pickup/institution/+/board-monitor`), pero cada cliente de este
canal solo recibe los que corresponden a su `institutionId`. Sin segundo
filtro, igual que `board-ws.md`: Carril recibe **todo** el feed de su
institución, sin importar el `pickup_request` o el `delivery_point` al que
pertenezca cada fila.

El cuerpo es **exactamente** el payload que ya construye
`buildBoardMonitorPayload()` (`packages/shared`) — sin envoltura ni campos
añadidos, misma forma documentada en
`specs/api-contracts/pickup-realtime-mqtt.md`, § "Topic — Carril (monitor de
institución)". **No incluye `deliveryCode`** (ADR-051 no cambia para ningún
modo del tablero) — sí incluye `guardianFullName`, `guardianRelationship`,
`vehicleDescription` y `vehiclePlate`, lo que distingue este canal del de
`board-ws.md`.

## Mensajes cliente → servidor

Ninguno — canal unidireccional, igual que los canales hermanos. Toda acción
operativa (confirmar entrega, etc.) va por REST desde la Consola de puerta,
no desde el tablero.

## Reconexión

Responsabilidad del frontend — al reconectar, vuelve a pedir el snapshot
REST (`view=monitor`) antes de reanudar el consumo de deltas.

`apps/board` abre esta conexión solo mientras Carril está activo, y la
cierra al salir de ese modo (ADR-071 pt.2, punto 6) — a diferencia de
`board-ws.md`, que Andén/Sereno mantienen abierta todo el tiempo que el
kiosko está en esos modos.

## Referencias

- ADR-050 (patrón original del puente WebSocket).
- ADR-068 (canal hermano `board-ws.md`: sesión reutilizada de
  `institution_member`, snapshot + WS del feed completo, filtro por punto
  de entrega en cliente).
- ADR-071 (punto 2: decisión completa de este canal — por qué Carril
  necesita transporte propio, `PickupRequestBoardMonitorPayload`, topic
  `board-monitor`, `BoardMonitorGateway`, snapshot REST `view=monitor`;
  punto 6: apertura/cierre condicionado al modo activo).
- ADR-011 (tablero, en cualquiera de sus modos, sin restricción de `role`
  dentro del tenant).
- ADR-051 (`deliveryCode` fuera de todo payload de tablero, incluido este).
- `specs/api-contracts/pickup-requests.md` (snapshot REST que precede a
  este canal, modo `institutionId&view=monitor`).
- `specs/api-contracts/pickup-realtime-mqtt.md` (topic de origen y forma
  del payload de Carril).
- `specs/api-contracts/board-ws.md` (canal hermano — mismo mecanismo,
  payload y alcance de audiencia distintos).

## Preguntas abiertas

Ninguna: ADR-071 pt.2 resolvió sesión, snapshot, canal y payload en un único
punto de decisión.
