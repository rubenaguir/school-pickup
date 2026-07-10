# Feature 011 — Gestionar días especiales (excepciones de horario)

## Propósito

Un miembro de la institución administra los días puntuales que sobreescriben el
horario recurrente de salida (`dismissal_exceptions`): fechas con hora de salida
distinta (ej. "Fin de cursos", "Ensayo cívico"), opcionalmente acotadas a un
nivel. Una excepción no modifica las `dismissal_windows` de fondo (ver feature
010): las sobreescribe puntualmente para la fecha indicada (ADR-015). Cubre
crear, editar y borrar excepciones.

## Entidades involucradas

- `dismissal_exceptions` (creado, actualizado, borrado)
- `institution_members` (leído, para autorización)
- `institutions` (leído, para autorización multi-tenant)

## Precondiciones

- Quien gestiona debe ser `institution_members` de la misma `institution_id`
  a la que pertenece (o pertenecerá) la excepción (aislamiento multi-tenant, ver
  `docs/arquitectura.md`).
- Gestionar días especiales está **restringido a `role = admin`** de esa
  institución (ADR-022, punto 1). `coordinator`, `teacher` y `gate_operator` no
  pueden crear/editar/borrar excepciones.

## Postcondiciones

### Al crear
- Se crea una fila en `dismissal_exceptions` con `institution_id`, `date`, `name`,
  `time` (hora de salida especial) y `level` (opcional; `NULL` significa "todos
  los niveles").
- Aplica la restricción única `(institution_id, date, level)`: no puede haber
  dos excepciones para la misma institución, fecha y nivel (ADR-018, punto 10).
- **Validación de capa de aplicación (ADR-018, punto 10):** el constraint único
  NO captura la colisión de una excepción con `level = NULL` ("todos los
  niveles") coexistiendo con una excepción de nivel específico en la misma fecha
  (en Postgres, `NULL` nunca es igual a otro `NULL` a efectos de unicidad). Esa
  coexistencia es ambigua —"todos los niveles" incluiría al nivel específico— y
  se rechaza en la capa de servicio al crear/editar, no por el esquema.

### Al editar
- Se actualizan los campos indicados (`date`, `name`, `level`, `time`),
  reaplicando tanto la restricción única como la validación de aplicación de
  `level = NULL` descrita arriba.

### Al borrar
- Se elimina físicamente la fila de `dismissal_exceptions`. A diferencia de
  `delivery_points` (feature 009) y `dismissal_windows` (feature 010), que se
  desactivan/pausan sin borrado, una excepción puntual sí admite borrado: es un
  evento de calendario que puede cancelarse por completo, y la entidad no define
  un `status` para "apagarla". El horario recurrente de fondo
  (`dismissal_windows`) vuelve a regir esa fecha una vez borrada la excepción.

## Casos Given/When/Then

### Caso de éxito — crear

```
Given una institution con status = approved
  And quien gestiona es institution_member con role = admin de esa institution
When se crea una dismissal_exception con date, name y time (level opcional)
Then se crea la fila
  And sobreescribe el horario recurrente para esa fecha y nivel
```

### Caso: excepción duplicada para (institution, date, level)

```
Given una dismissal_exception existente para (institution A, 2026-07-20,
      level = "Primaria")
When se intenta crear otra excepción para (institution A, 2026-07-20,
      level = "Primaria")
Then la operación se rechaza por la restricción única (institution_id, date,
     level) (ADR-018 punto 10)
```

### Caso: colisión level = NULL vs. nivel específico en la misma fecha

```
Given una dismissal_exception existente para (institution A, 2026-07-20,
      level = "Primaria")
When se intenta crear otra excepción para (institution A, 2026-07-20,
      level = NULL) ("todos los niveles")
Then la operación se rechaza por la validación de capa de aplicación (ADR-018
     punto 10): "todos los niveles" no puede coexistir con una excepción de
     nivel específico en la misma fecha, aunque el unique constraint no lo
     atrape (comportamiento de NULL en Postgres)

Given una dismissal_exception existente para (institution A, 2026-07-20,
      level = NULL)
When se intenta crear otra excepción para (institution A, 2026-07-20,
      level = "Primaria")
Then la operación se rechaza por la misma validación de capa de aplicación
     (la excepción "todos los niveles" ya cubre ese día por completo)
```

### Caso: borrar una excepción

```
Given una dismissal_exception existente
When se borra
Then la fila se elimina físicamente
  And el horario recurrente (dismissal_window) vuelve a regir esa fecha
```

### Caso: gestión desde otra institución (multi-tenant)

```
Given una dismissal_exception de la institution A
  And quien intenta gestionarla es institution_member únicamente de la
      institution B
When se intenta crear/editar/borrar excepciones de la institution A
Then la operación se rechaza por falta de autorización (aislamiento
     multi-tenant)
```

## Referencia a contrato de API

Ver `specs/api-contracts/dismissal-exceptions.md` —
`GET /institutions/:id/dismissal-exceptions`,
`POST /institutions/:id/dismissal-exceptions`,
`PATCH /dismissal-exceptions/:id` y `DELETE /dismissal-exceptions/:id`.

## Referencia a MQTT

No aplica: la configuración de días especiales no publica ni consume topics
MQTT.

## Referencias

- ADR-015 (excepciones puntuales como entidad separada de los horarios
  recurrentes; no mezclar "regla" con "excepción").
- ADR-018 (punto 10: restricción única `(institution_id, date, level)` y la
  validación de capa de aplicación para el caso `level = NULL`).
- ADR-019 (punto 5: restricción a `role = admin` de acciones sensibles).
- ADR-022 (punto 1: la configuración exige `role = admin`).
- `specs/entities/dismissal_exception.md`,
  `specs/entities/dismissal_window.md`,
  `specs/entities/institution_member.md`, `specs/entities/institution.md`.
- `specs/features/010-gestionar-horarios-recurrentes.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`) se resolvió en ADR-022 (punto 1).
