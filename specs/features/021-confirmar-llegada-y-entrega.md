# Feature 021 — Confirmar llegada y entrega

## Propósito

Cubre las dos transiciones finales del trayecto, juntas porque comparten el
contexto de verificación de identidad en el punto de entrega:
- **`arrived`**: el tutor confirma "ya llegué" desde su app.
- **`delivered`**: el staff, en la consola de puerta, verifica el `delivery_code`
  que el tutor muestra y confirma la entrega del alumno.

## Entidades involucradas

- `pickup_requests` (actualizado: `status` a `arrived` y luego `delivered`;
  `completed_at` al entregar)
- `pickup_request_status_history` (una fila por cada transición)
- `institution_members` (leído, para autorizar la entrega)
- `student_guardians` (leído, para autorizar la confirmación de llegada)
- `audit_log` (creada una fila por cada intento de `delivery_code` incorrecto)

## Precondiciones

### Para `arrived` (tutor)
- Solo el `guardian_user_id` **dueño** del `pickup_requests` puede disparar esta
  transición (es quien va en camino). En "Camino A" el tutor confirma
  manualmente "ya llegué"; no hay geofence en background
  (`docs/modelo-datos.md`).
- La transición hacia `arrived` es válida según la máquina de estados compartida
  en `packages/shared` (ADR-017); la feature invoca `canTransition(...)`, no la
  reimplementa. La máquina admite `arrived` tanto desde `arriving` como
  **directamente desde `en_route`** (el tutor confirma antes de que el `worker`
  marque `arriving`) — ADR-024 punto 8.

### Para `delivered` (staff)
- Quien confirma la entrega debe ser `institution_members` de la
  `institution_id` del `pickup_requests` (aislamiento multi-tenant). **Cualquier
  `role` sirve**: la consola de puerta no está restringida por rol (ADR-011),
  a diferencia de aprobar un `enrollments` (restringido a `admin` por ADR-019).
- El staff verifica el `delivery_code` de 4 dígitos: la consola de puerta lo
  despliega directamente (es visible para cualquier `institution_members` de la
  institución vía `GET`, ADR-024 punto 11), y el operador confirma que coincide
  con el que el tutor muestra en su app. La confirmación de entrega valida el
  código server-side contra `pickup_requests.delivery_code` (ADR-024 punto 4).
- La transición a `delivered` es válida según la máquina de estados compartida
  (ADR-017).

## Postcondiciones

### Al confirmar llegada (`arrived`)
- `pickup_requests.status` pasa a `arrived`.
- Se crea una fila en `pickup_request_status_history` con `status = arrived` y
  `changed_by_user_id` = el tutor.
- Se publica el estado a los topics (agregado y, si hay `delivery_point_id`,
  cola). Es el momento en que el tutor ve su `delivery_code` en la app
  (`docs/arquitectura.md` §Identidad en la entrega).

### Al confirmar entrega (`delivered`)
- Solo si el `delivery_code` ingresado coincide: `pickup_requests.status` pasa a
  `delivered` y se fija `completed_at = now()` (a partir de aquí corre la
  ventana de retención de `location_updates`, feature 023).
- Se crea una fila en `pickup_request_status_history` con `status = delivered` y
  `changed_by_user_id` = el `institution_members` que confirmó.
- Se publica el estado a los topics; la app del padre recibe la confirmación al
  instante (sin push, por MQTT con la app abierta).

### Ante un `delivery_code` incorrecto (ADR-024, punto 4)
- **No hay bloqueo ni límite de reintentos**: es una verificación presencial
  (tutor y staff cara a cara), no fuerza bruta remota; bloquear generaría
  fricción real con niños esperando por un error de tecleo.
- Cada intento fallido se registra en `audit_log` con
  `action = pickup_request.delivery_code_mismatch` (convención libre
  `entity.verb`, ADR-018 punto 9) para trazabilidad. El `pickup_requests`
  permanece en `arrived`; no se fija `completed_at` ni se crea fila de historial
  de estado.

## Casos Given/When/Then

### Caso de éxito — el tutor confirma llegada (desde arriving o desde en_route)

```
Given un pickup_request en status = en_route o arriving cuyo guardian_user_id
      es el usuario autenticado
When el tutor confirma "ya llegué"
Then status pasa a arrived (la máquina admite arrived desde en_route y desde
     arriving — ADR-024 punto 8)
  And se crea la fila de historial (changed_by_user_id = tutor)
  And se publica el estado a los topics
```

### Caso: alguien que no es el tutor dueño intenta confirmar llegada

```
Given un pickup_request
  And el usuario autenticado NO es su guardian_user_id
When intenta confirmar la llegada
Then la operación se rechaza por falta de autorización
```

### Caso de éxito — el staff verifica el código y entrega

```
Given un pickup_request en status = arrived con delivery_code = C
  And quien confirma es institution_member de la institución del pickup_request
      (cualquier role, ADR-011)
When ingresa el delivery_code C en la consola de puerta
Then status pasa a delivered
  And completed_at queda fijado
  And se crea la fila de historial (changed_by_user_id = el miembro)
  And se publica el estado a los topics
```

### Caso: delivery_code incorrecto

```
Given un pickup_request en status = arrived con delivery_code = C
  And quien confirma es institution_member de esa institución
When ingresa un delivery_code distinto de C
Then la entrega no se confirma: status permanece en arrived
  And no se crea fila de historial de estado ni se fija completed_at
  And se registra el intento fallido en audit_log
      (action = pickup_request.delivery_code_mismatch, ADR-024 punto 4)
  And el staff puede reintentar sin límite (verificación presencial, sin bloqueo)
```

### Caso: miembro de otra institución intenta entregar

```
Given un pickup_request de la institución A
  And quien intenta confirmar la entrega es institution_member solo de la
      institución B
When intenta confirmar la entrega
Then la operación se rechaza por falta de autorización (aislamiento
     multi-tenant)
```

## Referencia a contrato de API

Ver `specs/api-contracts/pickup-requests.md` —
`PATCH /pickup-requests/:id/arrived` y `PATCH /pickup-requests/:id/deliver`
(este último con el `delivery_code` en el body).

## Referencia a MQTT

Ambas transiciones publican el estado actualizado (vía `MqttClient`) al feed
agregado y, si hay `delivery_point_id`, a la cola del punto de entrega. Ver
`specs/api-contracts/pickup-realtime-mqtt.md`.

## Referencias

- ADR-011 (la consola de puerta no restringe por `role`: cualquier
  `institution_members` puede confirmar la entrega).
- ADR-013 (ciclo de vida; `delivery_code` como verificación de identidad en la
  entrega).
- ADR-017 (máquina de estados compartida; `MqttClient` como port).
- ADR-019 (contraste: aprobar `enrollments` sí se restringe a `admin`; la entrega
  no).
- ADR-024 (punto 4: `delivery_code` incorrecto sin bloqueo, con registro en
  `audit_log`; punto 8: `arrived` admitido desde `en_route` y desde `arriving`;
  punto 11: el `delivery_code` es visible en la consola del operador).
- `specs/entities/pickup_request.md`,
  `specs/entities/pickup_request_status_history.md`,
  `specs/entities/institution_member.md`,
  `specs/entities/student_guardian.md`, `specs/entities/audit_log.md`.
- `docs/arquitectura.md` (identidad en la entrega; flujo de tiempo real).

## Preguntas abiertas

- **Botón "Reportar incidencia": fuera de alcance (decisión, ADR-024 punto 5).**
  Las pantallas diseñadas muestran un botón "Reportar incidencia" en la consola
  de puerta, pero **no existe entidad ni campo** en el modelo que lo respalde. Se
  confirma fuera de alcance de este slice: cuando se aborde será su propio ADR +
  entidad nueva, no una improvisación aquí. (No es una pregunta pendiente: es una
  exclusión explícita.)
