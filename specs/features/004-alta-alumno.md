# Feature 004 — Alta de alumno

## Propósito

Un tutor autenticado registra un alumno. El alumno todavía no está asociado
a ninguna institución en este paso (eso ocurre en feature 005): esta feature
solo crea el registro del alumno y establece al tutor que lo dio de alta
como su primer tutor autorizado.

## Entidades involucradas

- `student` (creado)
- `student_guardian` (creado)

## Precondiciones

- El tutor debe estar autenticado (ver feature 003).

## Postcondiciones

- Se crea una fila en `student` con `created_by_user_id` = el tutor
  autenticado.
- **Se crea automáticamente una fila en `student_guardian`** vinculando ese
  `student` con el tutor autenticado:
  - `relationship`: el valor capturado en el mismo formulario de alta (uno
    de `mother`, `father`, `grandparent`, `driver`, `other` — ver
    `specs/entities/student_guardian.md`).
  - `is_primary = true`. Es la primera y única fila de `student_guardian`
    para este `student` en este momento, así que satisface trivialmente el
    índice único parcial documentado en `specs/entities/student_guardian.md`
    (ADR-018).
  - `status = active` (no `invited`): a diferencia de cuando un tutor
    autoriza a un tercero (feature 015), aquí el propio tutor está
    creando el vínculo sobre sí mismo, no invitando a otra persona.

  El estado inicial `active` para el guardián creador está documentado como
  **excepción explícita** al default `invited` de la columna en
  `specs/entities/student_guardian.md` (Invariantes de negocio, "Estado inicial
  según cómo nace el vínculo"; ADR-025 punto 8). Es la única forma de que el tutor
  después pueda ver/gestionar ese alumno (ver la regla de autorización de
  `specs/api-contracts/students.md`: "un tutor solo puede ver alumnos donde él
  mismo sea `student_guardian`"): sin esta fila `active`, el alumno recién creado
  sería invisible para su propio creador.

## Casos Given/When/Then

### Caso de éxito

```
Given un tutor autenticado
When envía el formulario de alta de alumno (full_name, birth_date opcional,
     photo_url opcional, relationship)
Then se crea student con created_by_user_id = el tutor
  And se crea student_guardian vinculando ese student con el tutor,
      is_primary = true, status = active, relationship = el valor capturado
```

No hay casos de error de negocio adicionales documentados para este feature
(no hay restricción de unicidad sobre `student.full_name` ni límite de
alumnos por tutor en ninguna spec de entidad).

## Referencia a contrato de API

Ver `specs/api-contracts/students.md` — `POST /students`.

## Referencia a MQTT

No aplica.

## Referencias

- `specs/entities/student.md`, `specs/entities/student_guardian.md`.
- ADR-018 (índice único parcial de `is_primary` en `student_guardian`).
- ADR-025 (punto 8: el guardián creador nace `status = active`, excepción al
  default `invited`).

## Preguntas abiertas

Ninguna para este feature: la auto-creación de `student_guardian` con
`status = active` quedó formalizada como excepción explícita en
`specs/entities/student_guardian.md` (ADR-025 punto 8), ya no como una inferencia
del feature.
