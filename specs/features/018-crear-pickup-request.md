# Feature 018 — Crear pickup request

## Propósito

El tutor toca "voy en camino" y se crea un `pickup_requests` en `status =
en_route`: es el evento central del dominio, el inicio del trayecto de recogida.
Al crearlo se resuelve su punto de entrega, se genera el código de entrega y se
publica el estado inicial en tiempo real para el tablero y la consola de puerta.

## Entidades involucradas

- `pickup_requests` (creado)
- `pickup_request_status_history` (creada la primera fila, `status = en_route`)
- `enrollments` (leído: precondición de `approved`; fuente de `institution_id` y
  `grade_or_group`)
- `student_guardians` (leído, para autorización)
- `delivery_points` (leído, para resolver `delivery_point_id`)
- `vehicles` (leído, si se selecciona uno del catálogo, para el snapshot)

## Precondiciones

- Quien crea es un `users` autenticado y debe ser `student_guardians` en
  `status = active` del alumno del `enrollments` indicado (solo un guardián activo
  puede operar sobre el alumno — invariante de
  `specs/entities/student_guardian.md`). Un guardián `invited`/`revoked` no puede.
- El `enrollments` debe estar en `status = approved` (ADR-018, punto 2): no se
  puede iniciar una recogida sobre una asociación pendiente o rechazada.
- El `guardian_user_id` del `pickup_requests` es el usuario autenticado.
- **No debe existir ya un `pickup_requests` activo (no terminal:
  `en_route`/`arriving`/`arrived`) para el mismo `enrollment_id`** (ADR-024,
  punto 1): no se permiten dos recogidas en curso para la misma asociación.
- No se valida la distancia del tutor al plantel al crear: `activation_radius_meters`
  es solo un afordance de cliente (habilita el botón "ya voy" en `parent`), no una
  frontera de seguridad forzada en el servidor (ADR-024, punto 7).

## Postcondiciones

- Se crea una fila en `pickup_requests` con:
  - `enrollment_id` = el `enrollments` indicado; `guardian_user_id` = usuario
    autenticado; `status = en_route`; `started_at = now()`.
  - `institution_id` **denormalizado** desde `enrollments.institution_id`,
    inmutable después (ADR-018, punto 4).
  - `delivery_point_id` **resuelto automáticamente** haciendo match entre
    `enrollments.grade_or_group` y `delivery_points.assigned_groups` de la
    institución (ADR-012). Queda `null` si la institución no tiene puntos
    configurados o no hay match; el tutor no lo elige ni lo cambia.
  - `delivery_code`: código de 4 dígitos generado en el servidor, **único solo
    entre los `pickup_requests` en `status` `en_route`/`arriving`/`arrived` de la
    misma institución** (índice único parcial, ADR-018 punto 3). No es único
    global ni permanente: puede repetirse en el tiempo y entre instituciones.
  - Vehículo: se especifica por una de tres vías mutuamente excluyentes (ADR-014,
    ADR-025):
    - **Catálogo:** si se selecciona un `vehicle_id` del catálogo del tutor, se
      copian `vehicle_description` y `vehicle_plate` como **snapshot** al momento del
      viaje (ADR-014); editar/borrar el `vehicles` después no altera estos campos.
    - **Captura libre:** si el tutor indica `vehicle_description`/`vehicle_plate` sin
      `vehicle_id` (un vehículo prestado o un viaje puntual, no guardado en el
      catálogo), se toman tal cual como snapshot, sin crear una fila en `vehicles`
      (ADR-014).
    - **Caminando:** si el tutor llega caminando, `arrival_mode = walking` y no se
      fija vehículo.
    Todos los caminos son válidos (los campos de vehículo y `arrival_mode` son
    nullable).
- Se crea la primera fila en `pickup_request_status_history` con
  `status = en_route` y `changed_by_user_id` = el tutor (transición iniciada por
  una persona, no automática).
- La transición inicial a `en_route` es la creación misma; cualquier transición
  posterior se valida contra la máquina de estados compartida en
  `packages/shared` (`pickup-request-status-machine.ts`, ADR-017) — esta feature
  no reimplementa esa lógica.
- **Publicación MQTT** (vía el port `MqttClient`, no un cliente concreto): al
  crearse, se publica el estado inicial al feed agregado del tablero
  `school-pickup/institution/{institutionId}/board` y, si `delivery_point_id` no
  es nulo, también a la cola de esa puerta
  `school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`
  (ADR-012, `docs/arquitectura.md`). El detalle del payload está en
  `specs/api-contracts/pickup-realtime-mqtt.md`.

## Casos Given/When/Then

### Caso de éxito — en vehículo con punto de entrega resuelto

```
Given un enrollment con status = approved
  And el usuario autenticado es student_guardian activo del alumno de ese
      enrollment
  And el grade_or_group del enrollment hace match con assigned_groups de un
      delivery_point de la institución
When crea el pickup_request seleccionando un vehicle de su catálogo
Then se crea el pickup_request con status = en_route
  And institution_id se copia de enrollment.institution_id
  And delivery_point_id queda resuelto por el match
  And delivery_code queda generado (4 dígitos, único entre activos de la
      institución)
  And vehicle_description y vehicle_plate quedan como snapshot del vehicle
  And se crea la fila en pickup_request_status_history (en_route,
      changed_by_user_id = tutor)
  And se publica el estado inicial al topic agregado y al de la cola del
      delivery_point
```

### Caso de éxito — caminando, institución sin punto de entrega

```
Given un enrollment con status = approved cuya institución no tiene
      delivery_points configurados
  And el usuario autenticado es student_guardian activo del alumno
When crea el pickup_request con arrival_mode = walking
Then se crea el pickup_request con status = en_route y delivery_point_id = null
  And no se fija vehicle_id, vehicle_description ni vehicle_plate
  And se publica el estado inicial solo al topic agregado (no hay cola de puerta)
```

### Caso de éxito — vehículo de captura libre (sin `vehicle_id`)

```
Given un enrollment con status = approved
  And el usuario autenticado es student_guardian activo del alumno
When crea el pickup_request con vehicle_description y vehicle_plate pero SIN
     vehicle_id (un vehículo no guardado en su catálogo)
Then se crea el pickup_request con status = en_route
  And vehicle_description y vehicle_plate quedan como snapshot tal cual se
      capturaron
  And no se crea ninguna fila en vehicles ni se referencia un vehicle_id
```

### Caso: enrollment no aprobado

```
Given un enrollment con status = pending o rejected
When se intenta crear un pickup_request para ese enrollment
Then la operación se rechaza (ADR-018 punto 2: no se opera sobre un enrollment
     no aprobado)
```

### Caso: quien crea no es guardián activo del alumno

```
Given un enrollment con status = approved
  And el usuario autenticado NO es student_guardian activo del alumno de ese
      enrollment (no lo es, o su status es invited/revoked)
When se intenta crear el pickup_request
Then la operación se rechaza por falta de autorización
```

### Caso: ya existe una recogida activa para el enrollment

```
Given un enrollment con status = approved
  And ya existe un pickup_request en status en_route, arriving o arrived para
      ese enrollment_id
When el tutor intenta crear otro pickup_request para el mismo enrollment
Then la operación se rechaza (ADR-024 punto 1: no dos recogidas activas para la
     misma asociación)
```

## Referencia a contrato de API

Ver `specs/api-contracts/pickup-requests.md` — `POST /pickup-requests`. El
contrato de tiempo real de la publicación inicial está en
`specs/api-contracts/pickup-realtime-mqtt.md`.

## Referencia a MQTT

Al crearse, se publica el estado inicial (vía `MqttClient`):
- siempre a `school-pickup/institution/{institutionId}/board`;
- si `delivery_point_id` no es nulo, también a
  `school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`.

Ver `specs/api-contracts/pickup-realtime-mqtt.md` para el payload.

## Referencias

- ADR-011 (roles de institución; contexto de quién opera después la consola de
  puerta).
- ADR-012 (resolución automática de `delivery_point_id`; nullable sin match).
- ADR-013 (ciclo de vida; `delivery_code`; `arrival_mode`; los dos radios).
- ADR-014 (snapshot de vehículo).
- ADR-017 (máquina de estados compartida en `packages/shared`; `MqttClient`
  como port).
- ADR-018 (punto 2: `enrollments` debe estar `approved`; punto 3: alcance de
  unicidad de `delivery_code`; punto 4: `institution_id` denormalizado).
- ADR-024 (punto 1: bloqueo de recogida activa duplicada; punto 7:
  `activation_radius_meters` solo afordance de cliente).
- ADR-025 (punto 3: captura libre de vehículo sin `vehicle_id`).
- `specs/entities/pickup_request.md`,
  `specs/entities/pickup_request_status_history.md`,
  `specs/entities/enrollment.md`, `specs/entities/student_guardian.md`,
  `specs/entities/delivery_point.md`, `specs/entities/vehicle.md`.
- `docs/arquitectura.md` (flujo de tiempo real; topics).

## Preguntas abiertas

Ninguna: el bloqueo de recogida activa duplicada (422, ADR-024 punto 1) y que
`activation_radius_meters` sea solo afordance de cliente sin validación en el
servidor (ADR-024 punto 7) quedaron resueltos.
