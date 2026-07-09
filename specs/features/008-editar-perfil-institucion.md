# Feature 008 — Editar perfil de institución

## Propósito

Un miembro de la institución edita los datos operativos de una institución ya
creada y aprobada: identidad (nombre, dirección), geocerca en el mapa
(`location`) y sus dos radios, y los parámetros de configuración
(`cct_code`, `levels`, `category`, tolerancias). El registro inicial de la
institución ya ocurrió en `specs/features/001-registro-institucion.md` (con
`join_code` autogenerado y datos operativos vacíos o por defecto); esta feature
es la que permite completarlos y mantenerlos después.

## Entidades involucradas

- `institution` (actualizada)
- `institution_member` (leído, para autorización)

## Precondiciones

- Quien edita debe ser `institution_member` de la misma `institution_id` que se
  edita (aislamiento multi-tenant, ver `docs/arquitectura.md`).
- Editar el perfil está **restringido a `role = admin`** de esa misma
  institución (ADR-022, punto 1): es una acción de configuración/identidad, de
  la misma sensibilidad que aprobar un `enrollment` (ADR-019, punto 5) y
  deliberadamente más restringida que la cobertura operativa de la consola de
  puerta (ADR-011, sin restricción de rol). `coordinator`, `teacher` y
  `gate_operator` no pueden editar el perfil.
- La institución debe estar en `status = approved`. `status` no se edita en esta
  feature: sus transiciones (`pending → approved`, `approved ⇄ suspended`) son
  acción exclusiva del super-admin (ADR-018), fuera de este slice.
- `type` no se edita: es una clasificación fija por institución, no un ciclo de
  vida (ver `specs/entities/institution.md`).

## Postcondiciones

- Se actualizan, para la `institution` indicada, cualquiera de los campos
  editables: `name`, `address`, `location` (geography(Point,4326)),
  `geofence_radius_meters` (radio de arribo) y `activation_radius_meters` (radio
  de activación del botón "ya voy") — **dos campos independientes que no deben
  colapsarse** (ADR-013, punto 5) —, `cct_code`, `levels`,
  `arrival_tolerance_minutes` y `advance_notice_minutes` (ADR-015).
- `category` solo puede tener valor cuando `type = extracurricular`; debe
  quedar `NULL` cuando `type = school` (invariante de
  `specs/entities/institution.md`). Un intento de fijar `category` en una
  institución `type = school` se rechaza.
- `updated_at` pasa a `now()`.
- `join_code` no se edita aquí: se regenera con su propia acción
  (ver feature en `specs/api-contracts/institutions.md`,
  `POST /institutions/:id/regenerate-join-code`, ADR-019 punto 1).

## Casos Given/When/Then

### Caso de éxito

```
Given una institution con status = approved
  And quien edita es institution_member con role = admin de esa misma
      institution
When se envía la edición del perfil con datos válidos
Then se actualizan los campos indicados de institution
  And se actualiza updated_at
```

### Caso: fijar category en una institución type = school

```
Given una institution con type = school
When se intenta editar el perfil enviando un valor no nulo en category
Then la operación se rechaza por invariante de dominio (category solo aplica a
     type = extracurricular)
  And no se actualiza ningún campo
```

### Caso: colapsar los dos radios

```
Given una institution con status = approved
When se intenta editar enviando un solo radio con la intención de que aplique
     a arribo y a activación a la vez
Then la operación conserva geofence_radius_meters y activation_radius_meters
     como dos campos independientes (ADR-013): cada uno se actualiza por
     separado, ninguno sustituye al otro
```

### Caso: editor de otra institución (multi-tenant)

```
Given una institution A
  And quien intenta editar es institution_member únicamente de la institution B
When se intenta editar el perfil de la institution A
Then la operación se rechaza por falta de autorización (aislamiento
     multi-tenant)
```

### Caso: miembro sin rol admin

```
Given una institution con status = approved
  And quien intenta editar es institution_member de la misma institution, pero
      con role = coordinator, teacher o gate_operator
When se intenta editar el perfil
Then la operación se rechaza por rol insuficiente (ADR-022 punto 1: la edición
     de configuración exige role = admin)
```

## Referencia a contrato de API

Ver `specs/api-contracts/institutions.md` — `GET /institutions/:id` y
`PATCH /institutions/:id`.

## Referencia a MQTT

No aplica: la configuración de institución no publica ni consume ningún topic
MQTT.

## Referencias

- ADR-013 (distinción entre `geofence_radius_meters` de arribo y
  `activation_radius_meters` de activación; dos campos independientes).
- ADR-015 (campos operativos de `institutions`: `cct_code`, `levels`,
  `category`, `arrival_tolerance_minutes`, `advance_notice_minutes`).
- ADR-018 (transiciones de `institution.status` son acción de super-admin, no
  se editan aquí).
- ADR-019 (punto 5: restringir a `role = admin` las acciones de control de
  acceso/identidad).
- ADR-022 (punto 1: la configuración de institución exige `role = admin`).
- `specs/entities/institution.md`, `specs/entities/institution_member.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`) se resolvió en ADR-022 (punto 1).
