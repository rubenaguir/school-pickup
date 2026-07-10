# Feature 005 — Asociar alumno a institución

## Propósito

Un tutor solicita asociar uno de sus alumnos a una institución. Esto crea un
`enrollments` en estado `pending`, que la institución deberá aprobar o
rechazar (feature 006) antes de que el alumno pueda tener recogidas
(`pickup_requests`, fuera de este slice) en esa institución.

## Entidades involucradas

- `enrollments` (creado)
- `institutions` (leído, para resolver por nombre o `join_code`)
- `students` (leído)

## Precondiciones

- El tutor debe estar autenticado y ser `student_guardians` (`status =
  active`) del `students` que intenta asociar — un tutor no puede asociar un
  alumno que no es suyo.
- No debe existir ya un `enrollments` **no terminal** (`pending` o `approved`)
  para ese `(student_id, institution_id)` — índice único parcial documentado en
  `docs/modelo-datos.md` y `specs/entities/enrollment.md`. Una fila `rejected`
  previa (terminal) NO bloquea una solicitud nueva: se crea una fila nueva. Ver
  ADR-026 punto 1.
- **La institución debe tener `status = approved`** (ADR-019, punto 4):
  tanto la búsqueda por nombre como la resolución por `join_code` solo
  consideran instituciones `approved`. Una institución en `pending` o
  `suspended` no aparece en resultados de búsqueda ni acepta su `join_code`
  para iniciar una solicitud — no es solo que la aprobación del enrollment
  quede bloqueada (ADR-018), la solicitud ni siquiera puede iniciarse.

## Postcondiciones

- Se crea una fila en `enrollments` con `status = pending`,
  `requested_by_user_id` = el tutor autenticado, `requested_at = now()`.
- `grade_or_group` se captura en el mismo formulario si la institución lo
  requiere (usado después para resolver `delivery_points`, fuera de este
  slice).
- `enrollment_code` se genera en este paso (único globalmente, ver ADR-016)
  — su algoritmo de generación no está definido en ningún ADR ni spec de
  entidad; se documenta como detalle de implementación a resolver al
  codificar el `service`, no como pregunta abierta de negocio (no afecta el
  contrato ni el modelo).

## Casos Given/When/Then

### Caso de éxito — por búsqueda de nombre

```
Given un tutor autenticado, guardián activo de un student
  And una institution con status = approved
  And no existe ya un enrollment para ese (student, institution)
When el tutor busca la institución por nombre y solicita asociar al alumno
Then se crea enrollment con status = pending
```

### Caso de éxito — por join_code

```
Given un tutor autenticado, guardián activo de un student
  And conoce el join_code de una institution
  And no existe ya un enrollment para ese (student, institution)
When el tutor captura el join_code y solicita asociar al alumno
Then se crea enrollment con status = pending
```

### Caso: enrollment duplicado no terminal

```
Given ya existe un enrollment no terminal (pending o approved) para el mismo
      (student_id, institution_id)
When el tutor intenta solicitar la asociación de nuevo
Then la operación falla por violar el índice único parcial (student_id,
     institution_id) WHERE status IN ('pending', 'approved')
  And se devuelve un error indicando que ya existe una solicitud o relación
      activa con esa institución
```

### Caso: nueva solicitud tras un rechazo previo

```
Given la única fila enrollment existente para ese (student_id, institution_id)
      está en status = rejected (terminal)
When el tutor solicita de nuevo la asociación a esa institución
Then se crea un enrollment nuevo con status = pending (una fila nueva; no se
     reactiva la fila rejected)
```

`rejected` es terminal y no se reactiva in-place (ADR-018): el índice único
parcial excluye `rejected` precisamente para permitir esta solicitud nueva sin
chocar con la fila previa. La regla queda documentada en la sección "Invariantes
de negocio" de `specs/entities/enrollment.md`. Ver ADR-026 punto 1.

### Caso: institución no aprobada (búsqueda o join_code)

```
Given una institution con status = pending o status = suspended
When el tutor busca esa institución por nombre, o intenta capturar su
     join_code
Then la institución no aparece en los resultados de búsqueda
  And el join_code no resuelve ninguna institución válida para asociar
  And no se crea ningún enrollment
```

Ver ADR-019, punto 4.

## Referencia a contrato de API

Ver `specs/api-contracts/enrollments.md` — `POST /enrollments`.

## Referencia a MQTT

No aplica.

## Referencias

- `specs/entities/enrollment.md`, `specs/entities/institution.md`,
  `specs/entities/student.md`.
- ADR-012 (`grade_or_group` alimenta la asignación de `delivery_points`, fuera
  de este slice).
- ADR-016 (`enrollment_code` único, vive en `enrollments`).
- ADR-018 (aprobación bloqueada si `institutions.status != approved`).
- ADR-019 (visibilidad de instituciones no aprobadas en búsqueda/`join_code`).
- ADR-026 (punto 1: índice único parcial que excluye `rejected`; una solicitud nueva tras un rechazo crea una fila nueva).

## Preguntas abiertas

Ninguna: la pregunta sobre visibilidad de instituciones `pending`/
`suspended` se resolvió en ADR-019.
