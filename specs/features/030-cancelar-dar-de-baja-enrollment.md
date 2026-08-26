# Feature 030 — Cancelar y dar de baja una asociación alumno–institución

## Propósito

Deshace una asociación alumno–institución (`enrollments`) desde
cualquiera de las dos apps. Cubre dos casos distintos, según el estado
del `enrollments`:

- **Cancelar** una solicitud todavía `pending` — el tutor se arrepiente
  o se equivocó antes de que la institución la resuelva.
- **Dar de baja** una asociación ya `approved` — el alumno deja la
  institución (cambio de escuela, fin de la actividad extracurricular),
  decidido por el tutor o por la institución.

Surgió al probar ADR-087 manualmente: no existía forma de deshacer una
asociación desde ninguna de las dos apps, solo `DELETE` directo en la
base de datos.

## Entidades involucradas

- `enrollments` (cancelar: fila borrada; dar de baja: `status` a
  `withdrawn`, `withdrawn_at`, `withdrawn_by_user_id`)
- `audit_log` (solo para dar de baja — cancelar no audita, ver más abajo)

## Precondiciones

- **Cancelar**: el `enrollments` está en `pending`, y el usuario
  autenticado es su propio `requested_by_user_id`.
- **Dar de baja**: el `enrollments` está en `approved`, y el usuario
  autenticado es su propio `requested_by_user_id` (tutor), **o** es
  `institution_members` con `role = admin` de la institución del
  enrollment.

## Postcondiciones

- **Cancelar**: la fila se borra de la base de datos. Nunca puede
  chocar con la FK `pickup_requests.enrollment_id → enrollments.id`
  (`ON DELETE RESTRICT`): esa FK solo referencia enrollments `approved`
  (`pickups.service.ts` exige `enrollment.status === 'approved'` para
  crear cualquier `pickup_requests`), y un `pending` nunca llegó a ese
  estado. Se publica un evento `removed` (ver
  `specs/api-contracts/enrollments-ws.md`) a los topics de institución y
  tutor, para que ambas listas en vivo quiten la fila.
- **Dar de baja**: `status` pasa a `withdrawn` (terminal, igual que
  `rejected`), `withdrawn_at = now()`, `withdrawn_by_user_id` = quien
  ejecutó la acción. Se crea una fila en `audit_log` con
  `action = enrollment.withdrawn`. Se publica el estado actualizado a
  ambos topics de enrollments, mismo shape que `approve`/`reject`.
- En ambos casos, el índice único parcial
  `(student_id, institution_id) WHERE status IN ('pending', 'approved')`
  ya permite una solicitud nueva del mismo alumno a la misma institución
  sin ningún mecanismo adicional — el mismo criterio que ya resuelve el
  reintento tras un `rejected`.

## Casos Given/When/Then

### Caso de éxito: cancelar

```
Given un enrollments en status = pending
  And el usuario autenticado es su requested_by_user_id
When el tutor cancela
Then la fila se borra
  And se publica el evento removed a ambos topics
```

### Caso de éxito: dar de baja (tutor)

```
Given un enrollments en status = approved
  And el usuario autenticado es su requested_by_user_id
When el tutor da de baja la asociación
Then status pasa a withdrawn, withdrawn_at y withdrawn_by_user_id quedan fijados
  And se registra audit_log (action = enrollment.withdrawn)
  And se publica el estado actualizado a ambos topics
```

### Caso de éxito: dar de baja (institución)

```
Given un enrollments en status = approved
  And el usuario autenticado es institution_members con role = admin de esa institución
When la institución da de baja la asociación
Then status pasa a withdrawn, withdrawn_at y withdrawn_by_user_id quedan fijados
  And se registra audit_log (action = enrollment.withdrawn)
  And se publica el estado actualizado a ambos topics
```

### Caso: cancelar algo que no está pending

```
Given un enrollments en status = approved, rejected o withdrawn
When se intenta cancelar
Then la operación falla (409, ENROLLMENT_NOT_PENDING)
```

### Caso: dar de baja algo que no está approved

```
Given un enrollments en status = pending, rejected o withdrawn
When se intenta dar de baja
Then la operación falla (409, ENROLLMENT_NOT_APPROVED)
```

### Caso: alguien sin autorización intenta cualquiera de las dos acciones

```
Given un enrollments
  And el usuario autenticado no es su requested_by_user_id
  And (para dar de baja) tampoco es institution_members con role = admin de su institución
When intenta cancelar o dar de baja
Then la operación se rechaza por falta de autorización (403)
```

## Referencia a contrato de API

Ver `specs/api-contracts/enrollments.md` — `DELETE /enrollments/:id`,
`PATCH /enrollments/:id/withdraw`.

## Referencia a tiempo real

Ver `specs/api-contracts/enrollments-ws.md` — ambas acciones publican a
los dos topics de enrollments ya existentes (ADR-087); `cancel` usa un
mensaje `removed` dedicado en vez del shape completo, ya que la fila
deja de existir.

## Referencias

- ADR-088 (decisión completa: por qué cancelar es `DELETE` real y dar de
  baja es un nuevo valor de enum; corrección de diseño durante la
  implementación — endpoint único de `withdraw` para tutor e
  institución, en vez de uno por controlador).
- ADR-087 (canal WebSocket reutilizado).
- `specs/entities/enrollment.md`.

## Preguntas abiertas

Ninguna.
