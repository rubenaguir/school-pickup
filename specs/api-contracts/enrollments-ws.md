# API Contract — Bandeja de `enrollment` (WebSocket)

Contrato del **puente WebSocket** que el `api` expone para las dos bandejas
de aprobación de `enrollment` (ADR-087): la de la institución
(`PendingEnrollments.tsx`, `apps/portal`) y la del tutor
(`useMyEnrollments`, `apps/parent`). No es REST y no es MQTT: es el canal
por el que ambos navegadores reciben, en vivo, los cambios de estado de
las solicitudes de asociación alumno–institución.

Existe por ADR-050/ADR-087: **el navegador nunca se conecta directamente
al broker MQTT**. El `api` se suscribe al broker por comodín (dos veces —
una por cada topic de origen) y reenvía a cada cliente autorizado
únicamente los mensajes de su propio scope. Desde la perspectiva de
Mosquitto no hay ninguna conexión nueva.

Este canal transporta **solo deltas**. El estado inicial se obtiene por
REST — `GET /enrollments?status=pending&institutionId=...` para la
institución, `GET /enrollments/mine` para el tutor
(`specs/api-contracts/enrollments.md`) — dos mecanismos separados, nunca
uno híbrido (mismo criterio que ADR-050 punto 6).

## Endpoint

Un único `path`, con **dos modos de conexión** según los query params:

```
wss://{host}/ws/enrollments?accessToken={jwt}&institutionId={uuid}   (modo institución)
wss://{host}/ws/enrollments?accessToken={jwt}                        (modo tutor — canal propio)
```

La presencia de `institutionId` decide el modo. No hay un tercer query
param de "modo" explícito: un tutor nunca tiene motivo para pasar
`institutionId` (su canal es siempre el propio, por `userId` del token),
y una institución siempre lo pasa (necesita decir cuál).

Sin el prefijo `/api` del REST — mismo criterio que
`specs/api-contracts/delivery-point-queue-ws.md`.

### Por qué el token va en el query string

Misma razón que los demás canales: la API `WebSocket` nativa del
navegador no permite fijar headers en el handshake (ADR-050 punto 3).
`accessToken` viaja como query param, nunca el refresh token.

## Autorización de la conexión

Se valida al momento de conectar, no por mensaje — mismo criterio que los
demás canales.

**Modo institución** (`institutionId` presente):

1. `accessToken` presente y bien formado; `institutionId` es un UUID.
2. El JWT verifica firma y expiración.
3. El usuario del token es `institution_members` de esa institución, con
   **cualquier `role`** (ADR-011) — misma regla que `BoardGateway`/
   `DeliveryPointQueueGateway`.

**Modo tutor** (`institutionId` ausente):

1. `accessToken` presente y bien formado.
2. El JWT verifica firma y expiración.
3. **Sin comprobación adicional**: el canal es siempre "mis propias
   solicitudes", identificado por el `sub` del propio token — no hay un
   recurso de terceros que autorizar, a diferencia de
   `pickup-request-tracking-ws.md` (que sí valida propiedad de un
   `pickup_requests` concreto). Cualquier usuario autenticado puede abrir
   su propio canal, exista o no una solicitud pendiente todavía.

No hay reevaluación posterior — mismo trade-off que los demás canales.

### Códigos de cierre

Mismo rango 4000–4999, espejo de los `code` REST equivalentes.

| Código | `reason` | Caso |
|---|---|---|
| `4400` | `INVALID_PAYLOAD` | falta `accessToken`, o `institutionId` está presente pero no es un UUID |
| `4401` | `UNAUTHENTICATED` | el `accessToken` no verifica |
| `4403` | `NOT_INSTITUTION_MEMBER` | (solo modo institución) el usuario no es `institution_members` de esa institución |
| `4404` | `RESOURCE_NOT_FOUND` | (solo modo institución) la institución no existe |

## Mensajes servidor → cliente

Un mensaje por cada publicación del broker en el topic correspondiente al
scope de la conexión:

- **Modo institución**: recibe únicamente los mensajes de
  `school-pickup/institution/{institutionId}/enrollments` para su propio
  `institutionId`. El cuerpo es exactamente `EnrollmentInstitutionPayload`
  (`packages/shared`, `buildEnrollmentInstitutionPayload()`) — mismo campo
  a campo que `InstitutionEnrollmentListItem`
  (`GET /enrollments?institutionId=`), sin envoltura ni campos añadidos.
- **Modo tutor**: recibe únicamente los mensajes de
  `school-pickup/guardian/{userId}/enrollments` para su propio `userId` —
  **un canal por tutor que cubre todas sus solicitudes a la vez**, no uno
  por `enrollment` individual. El cuerpo es exactamente
  `EnrollmentGuardianPayload` (`buildEnrollmentGuardianPayload()`), mismo
  campo a campo que `MyEnrollmentResponse` (`GET /enrollments/mine`).

`EnrollmentsService` publica en `create` (solo al topic de institución —
el tutor que acaba de enviar la solicitud ya lo sabe) y en
`approve`/`reject` (a ambos topics — el tutor necesita enterarse del
cambio de estado).

## Mensajes cliente → servidor

Ninguno. Canal unidireccional — mismo criterio que los demás. Aprobar/
rechazar una solicitud va por REST
(`PATCH /enrollments/:id/approve|reject`).

## Reconexión

Responsabilidad del frontend — al reconectar, cada lado vuelve a pedir su
propio snapshot REST antes de reanudar el consumo de deltas.

## Referencias

- ADR-050 (patrón original del puente WebSocket).
- ADR-087 (decisión completa de este canal: doble scope, publish en
  create/approve/reject, alcance de las pantallas cubiertas).
- ADR-011 (sin restricción de `role` dentro del tenant, modo institución).
- `specs/api-contracts/enrollments.md` (snapshot REST que precede a este
  canal, en ambos modos).
- `specs/api-contracts/board-ws.md` (canal hermano con el mismo patrón de
  dos suscripciones-comodín multiplexadas sobre un único puente).
- `specs/api-contracts/pickup-request-tracking-ws.md` (canal hermano cuyo
  modo tutor sí valida propiedad de un recurso concreto — a diferencia de
  este, cuyo modo tutor no tiene recurso que autorizar).
