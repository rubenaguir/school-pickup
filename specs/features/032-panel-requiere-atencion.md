# Feature 032 — Panel "Requiere atención" del Dashboard

## Propósito

Reemplaza el contenido fijo de ejemplo (`PLACEHOLDER_ALERTS`) que el panel
"Requiere atención" del Dashboard de institución (`apps/portal`) tiene desde
ADR-072 §6, con 3 condiciones reales calculadas contra los datos vivos de la
institución. A petición del humano tras terminar la auditoría exhaustiva de
Fase 10 — el panel llevaba desde entonces marcado explícitamente como "NOT
real data" en el propio código.

## Entidades involucradas

- `pickup_requests`, `pickup_request_status_history` (lectura únicamente,
  sin escritura nueva).
- `institutions.attention_wait_minutes` (columna nueva, ADR-105).
- `dismissal_windows`, `dismissal_exceptions` (lectura, vía
  `resolveDismissalWindowEnd`/`resolveDeadline`, reutilizadas de
  `institution-reports/punctuality.ts`).

## Precondiciones

- El usuario es `institution_members` de la institución (cualquier `role`
  — mismo criterio que el resto del Dashboard, ADR-071 punto 1).

## Postcondiciones

- Ninguna — es un endpoint de solo lectura, no muta ningún dato.

## Casos Given/When/Then

### Caso 1: viaje esperando demasiado en la puerta

```
Given un pickup_request en status = arrived
  And su transición a arrived ocurrió hace más de institutions.attention_wait_minutes minutos
When se consulta GET /institutions/:id/attention-items
Then aparece un ítem type = waiting_too_long con waitingMinutes poblado
```

### Caso 2: viaje recién llegado, todavía dentro del umbral

```
Given un pickup_request en status = arrived
  And su transición a arrived ocurrió hace menos de institutions.attention_wait_minutes minutos
When se consulta GET /institutions/:id/attention-items
Then ese pickup_request NO aparece como waiting_too_long
```

### Caso 3: recogida cancelada sin seguimiento, dentro de la ventana de salida

```
Given un pickup_request en status = cancelled, completado hoy
  And no existe ningún otro pickup_request del mismo enrollment_id creado después
  And todavía no pasó el cierre de la ventana de salida de hoy para el nivel de ese alumno
When se consulta GET /institutions/:id/attention-items
Then aparece un ítem type = cancelled_no_followup
```

### Caso 4: recogida cancelada, pero con una segunda recogida después (contraturno)

```
Given un pickup_request en status = cancelled
  And existe otro pickup_request del mismo enrollment_id creado después (sin importar su status)
When se consulta GET /institutions/:id/attention-items
Then el pickup_request cancelado NO aparece como cancelled_no_followup
```

### Caso 5: recogida cancelada, pero ya cerró la ventana de salida del día

```
Given un pickup_request en status = cancelled, sin seguimiento posterior
  And ya pasó resolveDeadline(hoy, resolveDismissalWindowEnd(...), arrival_tolerance_minutes) para el nivel de ese alumno
When se consulta GET /institutions/:id/attention-items
Then ese pickup_request NO aparece como cancelled_no_followup
```

### Caso 6: primera vez que este tutor recoge a este alumno

```
Given un pickup_request activo (en_route/approaching/arriving/arrived)
  And no existe ningún otro pickup_request con el mismo enrollment_id y el mismo guardian_user_id en status = delivered
When se consulta GET /institutions/:id/attention-items
Then aparece un ítem type = first_time_guardian
```

### Caso 7: tutor que ya ha recogido antes a este alumno

```
Given un pickup_request activo
  And existe al menos un pickup_request anterior con el mismo enrollment_id y el mismo guardian_user_id en status = delivered
When se consulta GET /institutions/:id/attention-items
Then ese pickup_request NO aparece como first_time_guardian
```

### Caso 8: recogida por chofer autorizado, no es la primera vez

```
Given un pickup_request activo cuyo guardian_user_id tiene relationship = driver para ese alumno
  And ese mismo chofer ya recogió antes a ese alumno (delivered previo)
When se consulta GET /institutions/:id/attention-items
Then ese pickup_request NO aparece en el panel por esa razón — la relationship "driver" por sí sola no dispara ninguna condición
```

## Referencia a contrato de API

Ver `specs/api-contracts/pickup-requests.md` —
`GET /institutions/:id/attention-items`.

## Referencias

- ADR-072 §6 (origen del panel con contenido fijo de ejemplo).
- ADR-060 punto 4 / `apps/api/src/institution-reports/punctuality.ts`
  (`resolveDismissalWindowEnd`/`resolveDeadline`, reutilizadas tal cual).
- ADR-084 (nivel del alumno vía `enrollment.group?.name`, no una columna
  `grade_or_group`).
- ADR-105 (decisión completa: por qué endpoint propio en vez de extender
  el feed `monitor`, por qué se descartó "toda recogida por chofer" a
  favor de "primera vez con este tutor").
- `specs/entities/pickup_request.md`,
  `specs/entities/pickup_request_status_history.md`,
  `specs/entities/institution.md`, `specs/entities/dismissal_window.md`,
  `specs/entities/dismissal_exception.md`.

## Preguntas abiertas

Ninguna.
