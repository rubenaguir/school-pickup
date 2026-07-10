# Feature 009 — Gestionar puntos de entrega

## Propósito

Un miembro de la institución administra los puntos de entrega físicos de su
plantel (ej. "Puerta principal", "Puerta vehicular"): los crea, los edita, los
desactiva, y define qué grupos/niveles llegan por cada uno (`assigned_groups`).
Esta configuración es la base de la asignación automática de recogidas a un
punto de entrega (ADR-012): un tutor nunca elige el punto de entrega de su
recogida.

## Entidades involucradas

- `delivery_points` (creado, actualizado, desactivado)
- `institution_members` (leído, para autorización y para validar
  `operator_user_id`)
- `institutions` (leído, para autorización multi-tenant)

## Precondiciones

- Quien gestiona debe ser `institution_members` de la misma `institution_id`
  a la que pertenece (o pertenecerá) el `delivery_points` (aislamiento
  multi-tenant, ver `docs/arquitectura.md`).
- Gestionar puntos de entrega está **restringido a `role = admin`** de esa
  institución (ADR-022, punto 1). `coordinator`, `teacher` y `gate_operator` no
  pueden crear/editar/desactivar puntos.
- Si se asigna `operator_user_id`, ese `users` debe ser `institution_members` de
  la **misma** `institution_id` que el `delivery_points` (ADR-018, punto 11).
  Es una regla que cruza dos tablas y se valida en la capa de servicio (NestJS),
  no con FK ni trigger (ADR-017).

## Postcondiciones

### Al crear
- Se crea una fila en `delivery_points` con `institution_id` de la institución,
  `name`, `description` (opcional), `assigned_groups` (opcional, texto libre),
  `operator_user_id` (opcional, validado) y `status = active` por defecto.

### Al editar
- Se actualizan los campos indicados (`name`, `description`, `assigned_groups`,
  `operator_user_id`) del `delivery_points`. `updated_at` pasa a `now()`.

### Al desactivar
- `delivery_points.status` pasa a `inactive`. **No hay borrado físico** de puntos
  de entrega: un `pickup_requests` no debe perderse si el punto deja de operar
  (por eso la FK `pickup_requests.delivery_point_id` es `ON DELETE SET NULL`, ver
  `specs/entities/delivery_point.md`). La reactivación es el mismo mecanismo con
  `status = active`.

### Nota sobre asignación
- `assigned_groups` es texto libre (varchar[]); no está atado a un catálogo
  curado (ADR-012). La asignación de un `pickup_requests` a un `delivery_points`
  es automática y estructural — se resuelve matcheando `enrollments.grade_or_group`
  contra `assigned_groups` al crear el viaje — y no es elegible por el tutor
  (ADR-012). Esa resolución vive en el slice de recogidas, fuera de esta feature.

## Casos Given/When/Then

### Caso de éxito — crear

```
Given una institution con status = approved
  And quien gestiona es institution_member con role = admin de esa institution
When se crea un delivery_point con name y, opcionalmente, assigned_groups
Then se crea la fila con status = active
  And queda asociado a la institution vía institution_id
```

### Caso: operator_user_id que no es miembro de la institución

```
Given una institution A con status = approved
  And un user que NO es institution_member de la institution A
When se intenta crear o editar un delivery_point de A asignando ese user como
     operator_user_id
Then la operación se rechaza (validación de capa de servicio, ADR-018 punto 11):
     operator_user_id debe pertenecer a un institution_member de la misma
     institution
  And no se crea ni modifica el delivery_point
```

### Caso: institución sin ningún punto de entrega (comportamiento por defecto)

```
Given una institution con status = approved y cero delivery_points
When se consultan sus puntos de entrega
Then el listado es vacío, lo cual es un estado válido
  And las recogidas de esa institution se crean con delivery_point_id = null
     (ADR-012: nullable para instituciones con un solo punto o sin match)
```

### Caso: desactivar un punto de entrega (sin borrado físico)

```
Given un delivery_point con status = active
When se desactiva
Then delivery_point.status pasa a inactive
  And la fila se conserva (no hay borrado físico); los pickup_requests
     históricos que apuntaban a él no se pierden
```

### Caso: gestión desde otra institución (multi-tenant)

```
Given un delivery_point de la institution A
  And quien intenta gestionarlo es institution_member únicamente de la
      institution B
When se intenta crear/editar/desactivar puntos de la institution A
Then la operación se rechaza por falta de autorización (aislamiento
     multi-tenant)
```

## Referencia a contrato de API

Ver `specs/api-contracts/delivery-points.md` —
`GET /institutions/:id/delivery-points`,
`POST /institutions/:id/delivery-points` y `PATCH /delivery-points/:id`.

## Referencia a MQTT

No aplica: la gestión de puntos de entrega es configuración y no publica ni
consume topics MQTT. (Los topics de tiempo real por punto de entrega
—`school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`,
ver `docs/arquitectura.md`— los produce/consume el slice de recogidas, no esta
feature.)

## Referencias

- ADR-012 (puntos de entrega y asignación automática/estructural por grupo;
  `delivery_point_id` nullable en `pickup_requests`; el tutor no elige el punto).
- ADR-017 (validaciones cruzadas en capa de servicio, no en base de datos).
- ADR-018 (punto 11: `operator_user_id` debe ser `institution_members` de la
  misma institución, validado en la capa de servicio).
- ADR-019 (punto 5: restricción a `role = admin` de acciones sensibles).
- ADR-022 (punto 1: la configuración exige `role = admin`; punto 5: código 422
  para validaciones cruzadas como la de `operator_user_id`).
- `specs/entities/delivery_point.md`, `specs/entities/institution_member.md`,
  `specs/entities/institution.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant; segmentación de topics por
  punto de entrega).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`) y el código de error de la validación
cruzada de `operator_user_id` (422) se resolvieron en ADR-022 (puntos 1 y 5).
