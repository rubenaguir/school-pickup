# Feature 028 — Notificación push de confirmación de entrega

## Propósito

Cuando un `pickup_requests` llega a `delivered`, se notifica por push (Web
Push API) a los **demás** tutores autorizados activos del alumno — no a
quien ejecutó la recogida, que ya lo supo en tiempo real por su propia
pantalla de seguimiento (ADR-064). Resuelve un problema real de
coordinación entre varios tutores de un mismo alumno (madre, padre,
abuela, chofer). Ver ADR-066 para el razonamiento completo de alcance
(por qué solo este tipo de notificación de los cuatro modelados).

## Entidades involucradas

- `push_subscriptions` (nueva: creada, leída, borrada)
- `pickup_requests` (leído — el evento disparador)
- `student_guardians` (leído — resolución de destinatarios)
- `users` (leído — `notify_delivery_confirmed`)

## Precondiciones

- Para **recibir**: el usuario debe tener al menos una `push_subscriptions`
  activa y `notify_delivery_confirmed = true`.
- Para **suscribirse**: el usuario debe estar autenticado; el navegador
  debe soportar Web Push y el usuario debe haber otorgado el permiso de
  notificación.

## Postcondiciones

### Al confirmar entrega (extiende feature 021, no la reemplaza)
- Tras la transición exitosa a `delivered` (fuera de la transacción
  principal, best-effort — ADR-066 punto 4): se resuelven los
  `student_guardians` con `status = active` del `student` del
  `pickup_requests`, excluyendo a su `guardian_user_id` dueño.
- De esos, se filtra a quienes tengan `notify_delivery_confirmed = true`.
- A cada uno, se envía una notificación push a **todas** sus
  `push_subscriptions` registradas — contenido genérico, sin nombrar quién
  recogió (ADR-066 punto 5).
- Un fallo de envío (suscripción expirada, error de red) no revierte la
  entrega ni bloquea el resto — se registra y continúa con las demás
  suscripciones/destinatarios.

### Al suscribirse
- Se crea una fila en `push_subscriptions` con el `endpoint`/`p256dh_key`/
  `auth_key` que entrega el navegador.

### Al desuscribirse
- Se borra la fila correspondiente.

## Casos Given/When/Then

### Caso de éxito — dos tutores activos, uno recoge

```
Given un student con dos student_guardians activos (A y B)
  And B tiene notify_delivery_confirmed = true y una push_subscription
      registrada
When A confirma la entrega de un pickup_request de ese student
Then B recibe una notificación push genérica
  And A no recibe ninguna (ADR-066 punto 3 — ya lo sabía)
```

### Caso: destinatario con la preferencia desactivada

```
Given un student_guardian activo B con notify_delivery_confirmed = false
When se confirma la entrega
Then B no recibe notificación, aunque tenga suscripciones registradas
```

### Caso: destinatario sin ninguna suscripción

```
Given un student_guardian activo B con notify_delivery_confirmed = true
      pero sin ninguna push_subscription
When se confirma la entrega
Then no hay ningún envío para B (no hay a dónde enviarlo)
  And la entrega se completa con normalidad, sin error
```

### Caso: fallo de envío no revierte la entrega

```
Given una push_subscription inválida/expirada de algún destinatario
When se confirma la entrega
Then la transición a delivered ya se persistió antes de intentar el envío
  And el fallo del envío se registra (log), sin afectar la respuesta al
      cliente que confirmó la entrega
```

### Caso: alumno con un solo tutor (el que recoge)

```
Given un student con un único student_guardian activo (el que recoge)
When se confirma la entrega
Then no hay ningún destinatario que notificar — comportamiento normal, sin
     error
```

## Referencia a contrato de API

Ver `specs/api-contracts/push-subscriptions.md` — `POST
/push-subscriptions`, `DELETE /push-subscriptions/:id`. La notificación en
sí no es un endpoint — es un efecto secundario de `PATCH
/pickup-requests/:id/deliver`, ya documentado en
`specs/api-contracts/pickup-requests.md` (referencia cruzada a agregar
ahí).

## Referencia a MQTT

No aplica — Web Push es un mecanismo independiente de MQTT, para llegar al
usuario con la app completamente cerrada.

## Referencias

- ADR-066 (decisión completa: alcance, destinatarios, mecanismo técnico).
- ADR-059 (`notify_delivery_confirmed`, preferencia reutilizada).
- ADR-064 (por qué quien recogió no es destinatario).
- `specs/features/021-confirmar-llegada-y-entrega.md` (evento disparador).
- `specs/entities/student_guardian.md` (resolución de destinatarios).

## Preguntas abiertas

Ninguna: el alcance (solo este tipo de notificación, estos destinatarios)
y el mecanismo técnico se resolvieron en ADR-066. Los otros tres tipos de
notificación quedan explícitamente fuera de este feature, no como
pregunta abierta sino como decisión de alcance.
