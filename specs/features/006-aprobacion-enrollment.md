# Feature 006 — Aprobación/rechazo de enrollment

## Propósito

Un miembro de la institución revisa un `enrollments` pendiente y decide
aprobarlo o rechazarlo. Es el control de la institución sobre quién queda
formalmente asociado a ella — la pantalla más importante del portal de
institución según `docs/design-brief.md` ("Bandeja de aprobación de
alumnos").

## Entidades involucradas

- `enrollments` (actualizado)
- `institution_members` (leído, para autorización)
- `institutions` (leído, para validar `status`)

## Precondiciones

- Quien aprueba/rechaza debe ser `institution_members` de la misma
  `institution_id` que el `enrollments` (aislamiento multi-tenant, ver
  `docs/arquitectura.md`) **y tener `role = admin`** (ADR-019, punto 5).
  `coordinator`, `teacher` y `gate_operator` no pueden aprobar ni rechazar.
  Esto es deliberadamente distinto de la consola de puerta (ADR-011, sin
  restricción de `role`, por ser cobertura operativa): aprobar un
  `enrollments` es una decisión de control de acceso/identidad — decide quién
  queda autorizado a operar sobre un alumno específico — de mayor
  sensibilidad que cubrir un turno en la puerta, por lo que se restringe al
  rol `admin`.
- El `enrollments` debe estar en `status = pending` (no se puede aprobar ni
  rechazar uno ya `approved` o `rejected` — `rejected` es terminal según
  ADR-018).
- Para aprobar (no para rechazar): `institutions.status` debe ser `approved`
  en el momento de la revisión (ADR-018). Si la institución fue `suspended`
  entre que se creó la solicitud y se revisó, la aprobación debe rechazarse
  aunque el `enrollments` en sí esté correctamente `pending`.

## Postcondiciones

### Al aprobar
- `enrollments.status = approved`
- `enrollments.reviewed_by_user_id` = el miembro que aprobó
- `enrollments.reviewed_at = now()`

### Al rechazar
- `enrollments.status = rejected` (terminal, ver ADR-018)
- `enrollments.reviewed_by_user_id` = el miembro que rechazó
- `enrollments.reviewed_at = now()`
- El tutor deberá enviar una nueva solicitud (feature 005) si quiere volver a
  intentarlo; este feature no reabre el `enrollments` rechazado (ver la
  pregunta abierta ya documentada en `specs/entities/enrollment.md` sobre
  cómo convive esto con la restricción única `(student_id, institution_id)`).

## Casos Given/When/Then

### Caso de éxito — aprobar

```
Given un enrollment con status = pending de una institution con
      status = approved
  And quien revisa es institution_member con role = admin de esa misma
      institution
When se ejecuta la acción de aprobar
Then enrollment.status pasa a approved
  And se registran reviewed_by_user_id y reviewed_at
```

### Caso de éxito — rechazar

```
Given un enrollment con status = pending
  And quien revisa es institution_member con role = admin de esa misma
      institution
When se ejecuta la acción de rechazar
Then enrollment.status pasa a rejected
  And se registran reviewed_by_user_id y reviewed_at
```

### Caso: miembro sin rol admin intenta aprobar/rechazar

```
Given un enrollment con status = pending
  And quien intenta revisar es institution_member de la misma institution,
      pero con role = coordinator, teacher o gate_operator
When se intenta aprobar o rechazar
Then la operación se rechaza por falta de autorización (rol insuficiente),
     aunque la membresía a la institución sea correcta
```

### Caso: institución suspendida entre solicitud y revisión

```
Given un enrollment con status = pending
  And la institution de ese enrollment tiene status = suspended
      (cambió después de que se creó la solicitud)
When un institution_member intenta aprobar
Then la operación falla
  And se devuelve un error indicando que la institución no está activa
```

Nótese que el **rechazo** de un `enrollments` no requiere que la institución
esté `approved` — ADR-018 solo condiciona la transición a `approved`, no la
transición a `rejected`.

### Caso: intento de revisar un enrollment de otra institución

```
Given un enrollment perteneciente a la institution A
  And quien intenta revisar es institution_member únicamente de la
      institution B
When se intenta aprobar o rechazar
Then la operación se rechaza por falta de autorización
```

### Caso: intento de revisar un enrollment ya resuelto

```
Given un enrollment con status = approved o rejected
When se intenta aprobar o rechazar de nuevo
Then la operación falla (no hay transición válida desde un estado terminal
     o ya aprobado hacia otra decisión)
```

## Referencia a contrato de API

Ver `specs/api-contracts/enrollments.md` — `PATCH /enrollments/:id/approve`,
`PATCH /enrollments/:id/reject`, y `GET /enrollments?status=pending` para la
bandeja de solicitudes pendientes.

## Referencia a MQTT

No aplica: la notificación al tutor de que su solicitud fue aprobada/
rechazada es, según ADR-009, un evento de cuenta que viaja por correo
(`EmailProvider`, ver ADR-017), no por MQTT (MQTT se reserva para eventos
operativos de recogida en tiempo real). Este feature debe invocar el port
`EmailProvider` al resolver la revisión, no una implementación concreta de
correo.

## Referencias

- ADR-009 (correo transaccional para eventos de cuenta, incluida la
  aprobación/rechazo de solicitudes).
- ADR-011 (rol organizacional de `institution_members`; la consola de puerta
  no restringe por `role`, a diferencia de este feature — ver ADR-019).
- ADR-017 (`EmailProvider` como port).
- ADR-018 (condición de `institutions.status = approved` para aprobar;
  `rejected` terminal).
- ADR-019 (punto 5: aprobar/rechazar `enrollments` restringido a
  `role = admin`).
- `specs/entities/enrollment.md`, `specs/entities/institution_member.md`,
  `specs/entities/institution.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).

## Preguntas abiertas

Ninguna: la restricción de autorización (`role = admin`) se resolvió en
ADR-019.
