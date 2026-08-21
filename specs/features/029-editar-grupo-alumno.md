# Feature 029 — Editar grupo del alumno

## Propósito

Cierra el hueco operativo confirmado en ADR-083: `enrollments.grade_or_group`
no tenía ninguna vía de asignación o corrección después de creada la
matrícula, lo que dejaba `pickup_requests.delivery_point_id` en `NULL` para
cualquier alumno con grupo faltante, mal escrito, o huérfano tras una
reconfiguración de puntos de entrega. Ver ADR-012 y ADR-083.

Tres flujos de usuario:

1. La institución asigna o corrige `gradeOrGroup` **al aprobar** una
   matrícula pendiente (bandeja de aprobación, feature 006).
2. La institución busca una matrícula ya `approved` y corrige su
   `gradeOrGroup` en la pantalla nueva "Alumnos".
3. Una institución sin grupos reales (ej. una escuela de taekwondo con un
   solo punto de entrega) no necesita hacer nada de lo anterior: el punto de
   entrega atrapa-todo (ADR-083, `resolveDeliveryPointId()`) resuelve el caso
   solo, sin que nadie tenga que escribir un grupo inventado.

## Entidades involucradas

- `enrollments` (actualizado)
- `institution_members` (leído, para autorización)

## Precondiciones

### Flujo 1 — asignar/corregir al aprobar

Mismas precondiciones que feature 006 (`PATCH /enrollments/:id/approve`):
`role = admin` de la institución del enrollment, `enrollments.status =
pending`, `institutions.status = approved`. `gradeOrGroup` en el body es
opcional — un body vacío deja `grade_or_group` sin tocar, igual que antes de
ADR-083.

### Flujo 2 — corregir una matrícula ya aprobada

- Quien edita debe ser `institution_members` de la misma `institution_id` que
  el `enrollments` **y tener `role = admin`** (mismo criterio que feature
  006 — corregir el grupo de un alumno es, igual que aprobar, una decisión
  operativa restringida a `admin`, no abierta a `coordinator`/`teacher`/
  `gate_operator`).
- El `enrollments` debe estar en `status = approved`. A diferencia de
  `approve()`, este endpoint no acepta `pending` ni `rejected` — no existe
  como atajo para aprobar.

### Flujo 3 — institución sin grupos

Sin precondición: no hay ninguna acción que el usuario deba tomar. Aplica
cuando la institución tiene configurado un único punto de entrega activo sin
`assignedGroups` (el atrapa-todo, ADR-083) y ningún alumno necesita un
`gradeOrGroup` real para que sus recogidas se asignen correctamente.

## Postcondiciones

### Flujo 1 — al aprobar con `gradeOrGroup`

- `enrollments.status = approved`
- `enrollments.reviewed_by_user_id` / `reviewed_at` (sin cambio respecto a
  feature 006)
- `enrollments.grade_or_group` = el valor enviado, si el body lo incluyó

### Flujo 2 — al corregir vía `PATCH /enrollments/:id/grade`

- `enrollments.grade_or_group` = el valor enviado
- Sin cambio en `status`, `reviewed_by_user_id` ni `reviewed_at`
- Sin fila nueva en `audit_log` (ADR-083 — corrección de dato operativo, no
  una decisión de control de acceso)
- Sin correo: a diferencia de `approve()`, este endpoint no notifica al
  tutor

### Flujo 3 — institución sin grupos

- Ningún cambio de estado: `pickup_requests.delivery_point_id` se resuelve
  al punto atrapa-todo en cada solicitud nueva, sin intervención de la
  institución (ADR-083, `resolveDeliveryPointId()`).

## Casos Given/When/Then

### Caso de éxito — asignar grupo al aprobar

```
Given un enrollment con status = pending, grade_or_group = null
  And quien revisa es institution_member con role = admin de esa institución
When se aprueba enviando { gradeOrGroup: "3° B" }
Then enrollment.status pasa a approved
  And enrollment.grade_or_group queda en "3° B"
```

### Caso de éxito — aprobar sin tocar el grupo

```
Given un enrollment con status = pending
  And quien revisa es institution_member con role = admin
When se aprueba sin enviar body (o sin la clave gradeOrGroup)
Then enrollment.status pasa a approved
  And enrollment.grade_or_group no cambia
```

### Caso de éxito — corregir el grupo de una matrícula aprobada

```
Given un enrollment con status = approved, grade_or_group = "1A"
  And quien edita es institution_member con role = admin de esa institución
When se llama PATCH /enrollments/:id/grade con { gradeOrGroup: "2A" }
Then enrollment.grade_or_group queda en "2A"
  And enrollment.status sigue en approved
  And no se registra fila nueva en audit_log
  And no se envía correo
```

### Caso: corregir el grupo de una matrícula no aprobada

```
Given un enrollment con status = pending o rejected
When se llama PATCH /enrollments/:id/grade
Then la operación falla con ENROLLMENT_NOT_APPROVED (409)
```

### Caso: miembro sin rol admin intenta corregir el grupo

```
Given un enrollment con status = approved
  And quien intenta editar es institution_member de la misma institución,
      pero con role = coordinator, teacher o gate_operator
When se llama PATCH /enrollments/:id/grade
Then la operación se rechaza por falta de autorización (rol insuficiente)
```

### Caso: intento de editar el grupo de un enrollment de otra institución

```
Given un enrollment perteneciente a la institution A
  And quien intenta editar es institution_member únicamente de la
      institution B
When se llama PATCH /enrollments/:id/grade
Then la operación se rechaza por falta de autorización
```

### Caso: institución sin grupos reales

```
Given una institución con un único punto de entrega activo, sin
      assignedGroups configurado (el atrapa-todo)
  And un alumno con grade_or_group = null
When el tutor crea una recogida para ese alumno
Then pickup_requests.delivery_point_id se resuelve al punto atrapa-todo
  And nadie en la institución tuvo que asignar ni corregir un grupo
```

## Referencia a contrato de API

Ver `specs/api-contracts/enrollments.md` —
`PATCH /enrollments/:id/approve` (body `gradeOrGroup` opcional, nuevo) y
`PATCH /enrollments/:id/grade` (endpoint nuevo).

## Referencia a MQTT

No aplica: ni aprobar con grupo ni corregir el grupo de una matrícula ya
aprobada son eventos operativos de recogida en tiempo real — no hay
publicación MQTT en ninguno de los dos casos (a diferencia de `approve()`,
que sí dispara un correo vía `EmailProvider`, sin cambio respecto a feature
006).

## Referencias

- ADR-012 (asignación automática de punto de entrega vía `grade_or_group`;
  origen del criterio de texto libre; consecuencia ya declarada de que
  instituciones con un solo punto de entrega no necesitan asignar grupos).
- ADR-083 (punto de entrega atrapa-todo; `gradeOrGroup` opcional en
  `approve`; endpoint nuevo `PATCH /enrollments/:id/grade`; sin auditoría en
  la corrección post-aprobación).
- `specs/features/006-aprobacion-enrollment.md` (precondición de
  `role = admin` reutilizada por el endpoint de edición; el mismo criterio
  de "deshabilitado, no oculto" para quien no es admin).
- `specs/entities/enrollment.md`, `specs/entities/delivery_point.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).

## Preguntas abiertas

Ninguna: alcance, autorización y comportamiento de los tres flujos se
resolvieron en ADR-083.
