# Feature 025 — Aprobación, suspensión y reactivación de instituciones (super-admin)

## Propósito

El super-admin gestiona el ciclo de vida de `institutions.status`: aprueba
altas nuevas (`pending → approved`), suspende instituciones activas
(`approved → suspended`) y reactiva instituciones suspendidas (`suspended →
approved`). Es la pantalla "Aprobación de instituciones" del
`docs/design-brief.md` ("cola de altas de escuelas por validar"). Las
transiciones ya estaban fijadas en ADR-018 (punto 1); esta feature es su
implementación.

## Entidades involucradas

- `institutions` (actualizado: `status`)
- `institution_members` (leído, para resolver a quién notificar por correo)
- `users` (leído, vía `is_super_admin` para autorización)
- `audit_log` (creado, una fila por transición)

## Precondiciones

- Quien gestiona debe ser un `users` autenticado con `is_super_admin = true`
  (ADR-040 punto 2). No hay restricción de institución — el super-admin
  actúa sobre cualquiera.
- **Aprobar** solo aplica a una institución en `status = pending`.
- **Suspender** solo aplica a una institución en `status = approved`.
- **Reactivar** solo aplica a una institución en `status = suspended`.
- No existe transición directa de `suspended` a `pending`, ni un estado de
  rechazo explícito (ADR-018 punto 1) — una institución no aprobada
  permanece en `pending` indefinidamente hasta que el super-admin decida.

## Postcondiciones

### Al aprobar
- `institutions.status` pasa a `approved`.
- Se envía correo (`EmailProvider`, ADR-017) a todos los
  `institution_members` con `role = admin` de esa institución, `kind:
  institution_approved`. Un fallo de envío no revierte la transición ya
  persistida (ADR-040 punto 4).
- Se registra `audit_log` con `action = institution.approved`,
  `entity_type = 'institution'`, `entity_id` = el id de la institución,
  `actor_user_id` = el super-admin, `metadata = null`.

### Al suspender
- `institutions.status` pasa a `suspended`.
- Se envía correo, `kind: institution_suspended`, a los mismos
  destinatarios.
- Se registra `audit_log` con `action = institution.suspended`.

### Al reactivar
- `institutions.status` vuelve a `approved`.
- Se envía correo, `kind: institution_reactivated`.
- Se registra `audit_log` con `action = institution.reactivated` — acción
  distinta de `institution.approved`, aunque el `status` resultante sea el
  mismo (ADR-040 punto 6): el historial debe distinguir "primera
  aprobación" de "se levantó una suspensión".

## Casos Given/When/Then

### Caso de éxito — aprobar

```
Given una institution con status = pending
  And quien gestiona es user con is_super_admin = true
When aprueba la institution
Then institution.status pasa a approved
  And se envía correo institution_approved a los institution_members con
      role = admin de esa institution
  And se registra audit_log con action = institution.approved
```

### Caso de éxito — suspender

```
Given una institution con status = approved
  And quien gestiona es user con is_super_admin = true
When suspende la institution
Then institution.status pasa a suspended
  And se envía correo institution_suspended
  And se registra audit_log con action = institution.suspended
```

### Caso de éxito — reactivar

```
Given una institution con status = suspended
  And quien gestiona es user con is_super_admin = true
When reactiva la institution
Then institution.status vuelve a approved
  And se envía correo institution_reactivated
  And se registra audit_log con action = institution.reactivated
      (distinto de institution.approved, ADR-040 punto 6)
```

### Caso: transición inválida

```
Given una institution con status = approved
When se intenta "aprobar" (solo válido desde pending)
Then la operación se rechaza (409 INVALID_STATUS_TRANSITION)
  And no se envía correo ni se registra audit_log

Given una institution con status = pending
When se intenta "suspender" (solo válido desde approved) o "reactivar"
     (solo válido desde suspended)
Then la operación se rechaza en ambos casos (409 INVALID_STATUS_TRANSITION)
```

### Caso: usuario autenticado sin ser super-admin

```
Given un user autenticado con is_super_admin = false
      (incluye admins de institución, staff, y tutores)
When intenta aprobar, suspender o reactivar cualquier institution
Then la operación se rechaza por falta de autorización
     (SuperAdminGuard, ADR-040 punto 2)
```

### Caso de éxito — listar la cola

```
Given varias institutions con distintos status
  And quien consulta es user con is_super_admin = true
When solicita el listado sin filtro de status
Then recibe todas las institutions, paginadas, ordenadas por created_at
     ascendente
When solicita el listado con status = pending
Then recibe solo las institutions pendientes de aprobación
```

## Referencia a contrato de API

Ver `specs/api-contracts/institutions.md` — `PATCH /institutions/:id/approve`,
`PATCH /institutions/:id/suspend`, `PATCH /institutions/:id/reactivate` — y
`specs/api-contracts/admin-institutions.md` — `GET /admin/institutions`.

## Referencia a MQTT

No aplica: la gestión del ciclo de vida de instituciones no publica ni
consume topics MQTT.

## Referencias

- ADR-009 (correo transaccional para eventos de cuenta).
- ADR-017 (`EmailProvider` como port).
- ADR-018 (punto 1: transiciones válidas de `institutions.status`; punto 9:
  convención `entity.verb` de `audit_log`).
- ADR-037 (endpoint de búsqueda por nombre — no se reutiliza aquí).
- ADR-038 (`is_super_admin`, `SuperAdminGuard`, namespace `/admin/`).
- ADR-040 (decisión completa de este slice: endpoints por verbo,
  notificación por correo, auditoría, `reactivate` como transición propia).
- `specs/entities/institution.md`, `specs/entities/institution_member.md`.
- `docs/design-brief.md` (pantalla "Aprobación de instituciones").

## Preguntas abiertas

Ninguna: las transiciones válidas (ADR-018 punto 1), la forma de los
endpoints, la autorización, la notificación por correo y la convención de
auditoría se resolvieron en ADR-040.
