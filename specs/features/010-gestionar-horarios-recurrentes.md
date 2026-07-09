# Feature 010 — Gestionar horarios de salida recurrentes

## Propósito

Un miembro de la institución administra las ventanas de salida recurrentes de
su plantel (`dismissal_windows`): horarios semanales nombrados (ej. "Salida
vespertina") que sirven para calcular los recordatorios de anticipación
(`advance_notice_minutes`) y para validar la ventana en la que un
`pickup_request` tiene sentido. Cubre crear, editar y pausar/activar ventanas.

## Entidades involucradas

- `dismissal_window` (creado, actualizado, pausado/activado)
- `institution_member` (leído, para autorización)
- `institution` (leído, para autorización multi-tenant)

## Precondiciones

- Quien gestiona debe ser `institution_member` de la misma `institution_id`
  a la que pertenece (o pertenecerá) la ventana (aislamiento multi-tenant, ver
  `docs/arquitectura.md`).
- Gestionar horarios recurrentes está **restringido a `role = admin`** de esa
  institución (ADR-022, punto 1). `coordinator`, `teacher` y `gate_operator` no
  pueden crear/editar/pausar ventanas.

## Postcondiciones

### Al crear
- Se crea una fila en `dismissal_window` con `institution_id`, `weekday` (0–6),
  `start_time`, `end_time`, `label` (obligatorio), `level` (opcional) y
  `status = active` por defecto (ADR-015). Una institución puede tener múltiples
  ventanas nombradas, diferenciadas por `label` y `level`.

### Al editar
- Se actualizan los campos indicados de la ventana (`weekday`, `start_time`,
  `end_time`, `label`, `level`). La entidad `dismissal_window` no tiene columnas
  de timestamp (`created_at`/`updated_at`) — ver
  `specs/entities/dismissal_window.md` —, así que no se registra fecha de
  modificación.

### Al pausar/activar
- `dismissal_window.status` alterna entre `active` y `paused`. `paused` desactiva
  temporalmente la ventana sin borrarla, conservando el historial de
  configuración (ADR-015). No hay borrado documentado en la entidad; pausar es
  el mecanismo para "apagar" una ventana.

## Casos Given/When/Then

### Caso de éxito — crear

```
Given una institution con status = approved
  And quien gestiona es institution_member con role = admin de esa institution
When se crea una dismissal_window con weekday en 0–6, start_time, end_time y
     label
Then se crea la fila con status = active
  And queda asociada a la institution vía institution_id
```

### Caso: weekday fuera de rango

```
Given una institution con status = approved
When se intenta crear o editar una dismissal_window con weekday fuera del rango
     0–6
Then la operación se rechaza por invariante de dominio (weekday debe estar en
     0–6, ver specs/entities/dismissal_window.md)
  And no se crea ni modifica la ventana
```

### Caso: pausar sin borrar

```
Given una dismissal_window con status = active
When se pausa
Then dismissal_window.status pasa a paused
  And la fila se conserva (no se borra); puede volver a status = active después
```

### Caso: gestión desde otra institución (multi-tenant)

```
Given una dismissal_window de la institution A
  And quien intenta gestionarla es institution_member únicamente de la
      institution B
When se intenta crear/editar/pausar ventanas de la institution A
Then la operación se rechaza por falta de autorización (aislamiento
     multi-tenant)
```

## Referencia a contrato de API

Ver `specs/api-contracts/dismissal-windows.md` —
`GET /institutions/:id/dismissal-windows`,
`POST /institutions/:id/dismissal-windows` y `PATCH /dismissal-windows/:id`.

## Referencia a MQTT

No aplica: la configuración de horarios no publica ni consume topics MQTT.

## Referencias

- ADR-015 (configuración de institución y horarios; `label`, `level`, `status`
  de `dismissal_windows`; horarios recurrentes vs. excepciones en tablas
  separadas — ver feature 011).
- ADR-019 (punto 5: restricción a `role = admin` de acciones sensibles).
- ADR-022 (punto 1: la configuración exige `role = admin`).
- `specs/entities/dismissal_window.md`, `specs/entities/institution_member.md`,
  `specs/entities/institution.md`.
- `specs/features/011-gestionar-dias-especiales.md` (excepciones puntuales que
  sobreescriben estas ventanas).
- `docs/arquitectura.md` (aislamiento multi-tenant).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`) se resolvió en ADR-022 (punto 1).
