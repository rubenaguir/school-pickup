# API Contract — Cola de punto de entrega (WebSocket)

Contrato del **puente WebSocket** que el `api` expone para la Consola de puerta
(feature 021). No es REST y no es MQTT: es el canal por el que el navegador
recibe, en vivo, los cambios de la cola de un `delivery_points`.

Existe por ADR-050: **el navegador nunca se conecta directamente al broker
MQTT**. El `api` se suscribe al broker por comodín y reenvía a cada cliente
autorizado únicamente los mensajes de su punto de entrega. Desde la perspectiva
de Mosquitto no hay ninguna conexión nueva.

Este canal transporta **solo deltas**. El estado inicial se obtiene por REST con
`GET /pickup-requests?deliveryPointId=...`
(`specs/api-contracts/pickup-requests.md`) — dos mecanismos separados, nunca uno
híbrido (ADR-050 punto 6).

## Endpoint

```
wss://{host}/ws/delivery-point-queue?accessToken={jwt}&deliveryPointId={uuid}
```

El `path` **no** lleva el prefijo `/api` del REST: `setGlobalPrefix('api')` de
NestJS aplica a rutas HTTP, no al servidor WebSocket, que se monta sobre el mismo
puerto con su propio `path`.

### Por qué el token va en el query string

La API `WebSocket` nativa del navegador no permite fijar headers en el handshake,
así que no hay `Authorization: Bearer` posible (ADR-050 punto 3). El
`accessToken` viaja como query param. Consecuencias asumidas: la URL puede
aparecer en logs de servidor/proxy, de ahí que se use el **access token** (TTL
corto, `JWT_ACCESS_TTL`) y nunca el refresh token.

## Autorización de la conexión

Se valida **al momento de conectar**, no por mensaje: si algo falla, la conexión
se cierra de inmediato, nunca queda abierta en un estado ambiguo.

1. `accessToken` y `deliveryPointId` presentes y bien formados.
2. El JWT verifica firma y expiración con el mismo mecanismo que el REST (el
   `JwtService` del access token; ver `specs/api-contracts/auth.md`).
3. El `delivery_points` solicitado existe.
4. El usuario del token es `institution_members` de la institución dueña de ese
   `delivery_points`, con **cualquier `role`** (ADR-011). Es la misma regla que
   `InstitutionMembershipGuard` aplica en REST, adaptada al contexto de conexión.

No hay reevaluación posterior: la autorización caduca cuando el cliente se
desconecta. Un access token que expira **no** cierra la conexión abierta — mismo
trade-off que ya tiene cualquier claim del token en REST.

### Códigos de cierre

Códigos del rango privado de la aplicación (4000–4999, RFC 6455), espejo de los
`code` REST equivalentes:

| Código | `reason` | Caso |
|---|---|---|
| `4400` | `INVALID_PAYLOAD` | falta `accessToken` o `deliveryPointId`, o `deliveryPointId` no es un UUID |
| `4401` | `UNAUTHENTICATED` | el `accessToken` no verifica (firma inválida, expirado, malformado) |
| `4403` | `NOT_INSTITUTION_MEMBER` | el usuario no es `institution_members` de la institución dueña del punto |
| `4404` | `RESOURCE_NOT_FOUND` | el `delivery_points` no existe |

El `reason` del cierre lleva el mismo `code` en inglés que usaría el error REST,
por la misma razón (ADR-028): el frontend traduce por `code`, no por texto.

## Mensajes servidor → cliente

Un mensaje por cada publicación del broker en el topic de cola de ese punto. El
cuerpo es **exactamente** el payload que ya construye `buildQueuePayload()`
(`packages/shared`), sin envoltura ni campos añadidos (ADR-050 punto 5) — su
forma está documentada en `specs/api-contracts/pickup-realtime-mqtt.md`, § "Topic
— cola de un punto de entrega", y no se repite aquí para que no haya dos fuentes
de verdad.

Cada cliente recibe únicamente los mensajes cuyo topic corresponde al
`institutionId` + `deliveryPointId` con que fue autorizado. Nunca los de otro
punto de entrega, ni los de otra institución.

Ese payload incluye `deliveryCode` (ADR-051): es la razón por la que la
autorización de la conexión importa tanto — el canal transporta el código de
verificación de la entrega, y solo debe llegar a un `institution_member`
autenticado de la institución dueña del punto. El snapshot REST que precede a
este canal devuelve exactamente los mismos campos, para que el cliente fusione
ambos sin transformarlos.

## Mensajes cliente → servidor

Ninguno. El canal es unidireccional en la práctica: toda acción de la consola
(confirmar entrega, etc.) va por REST. Un mensaje entrante del cliente se ignora.

## Reconexión

Responsabilidad del frontend (ADR-050 punto 7), no del servidor: al reconectar,
el cliente vuelve a pedir el snapshot REST antes de reanudar el consumo de
deltas, ya que los mensajes emitidos mientras estuvo desconectado no se
almacenan ni se reenvían.

## Referencias

- ADR-050 (decisión completa: puente WebSocket, cero cambios al broker,
  autorización, un canal por punto de entrega).
- ADR-011 (consola de puerta sin restricción de `role` dentro del tenant).
- ADR-028 (forma de los errores: `code` en inglés, estable).
- ADR-036 (mismo criterio de "no agregar dependencia sin necesidad clara" que
  descarta `socket.io` a favor del adaptador `ws`).
- `specs/api-contracts/pickup-requests.md` (snapshot REST que precede a este
  canal).
- `specs/api-contracts/pickup-realtime-mqtt.md` (topic de origen y forma del
  payload).
- `specs/features/021-confirmar-llegada-y-entrega.md` (contexto operativo).

## Preguntas abiertas

Ninguna en este slice. El feed del tablero (`apps/board`) sigue pendiente
de su propia fase. El tracking del padre ya se resolvió — ver
`specs/api-contracts/pickup-request-tracking-ws.md` (ADR-064): mismo
puente, topic de tablero reutilizado, autorización por propiedad del
tutor en vez de membresía de institución.
