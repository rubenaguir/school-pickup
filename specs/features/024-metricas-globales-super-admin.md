# Feature 024 — Métricas globales de plataforma (super-admin)

## Propósito

El super-admin consulta un panel agregado con la salud operativa de toda la
plataforma: instituciones por estado, colas de aprobación pendientes, tutores
registrados, volumen de recogidas con comparativo mensual, instituciones más
activas y tiempo medio de recogida. Es lectura pura — no hay acciones de
escritura en este feature.

## Entidades involucradas

- `institutions` (leído, agregado)
- `enrollments` (leído, agregado)
- `users` (leído, agregado — vía `is_super_admin` para autorización, y para
  contar tutores registrados)
- `student_guardians` (leído, agregado)
- `pickup_requests` (leído, agregado)

## Precondiciones

- Quien consulta debe ser un `users` autenticado con `is_super_admin = true`
  (ADR-038, punto 1). No hay restricción adicional de institución — es una
  vista de toda la plataforma, no de un tenant.

## Postcondiciones

Ninguna — es una consulta de solo lectura, sin efectos secundarios.

## Definición exacta de cada métrica (ADR-038)

1. **Instituciones por status**: conteo de `institutions` agrupado por
   `status` (`pending`/`approved`/`suspended`).
2. **Solicitudes pendientes** (dos métricas separadas, ADR-038 punto 3):
   - `enrollmentsPending`: conteo de `enrollments.status = pending`.
   - `institutionsPendingApproval`: conteo de `institutions.status = pending`
     (mismo dato que la métrica 1, expuesto también aquí).
3. **Tutores registrados**: conteo de `users` distintos que aparecen como
   `guardian_user_id` en al menos una fila de `student_guardians`, sin
   filtrar por `status` del vínculo (ADR-038 punto 4).
4. **Recogidas totales con comparativo**: conteo de `pickup_requests`
   creados (`started_at`) en el mes calendario actual (recorte al día de
   hoy) vs. el mismo recorte de días del mes calendario anterior (ADR-038
   punto 2).
5. **Top 5 instituciones por uso**: instituciones ordenadas descendente por
   conteo de `pickup_requests` creados en la ventana del punto 4.
6. **Tiempo medio de recogida**: promedio de `completed_at - started_at`
   sobre `pickup_requests` con `status = delivered` en la ventana del punto 4
   (ADR-038 punto 6).

## Casos Given/When/Then

### Caso de éxito

```
Given un user autenticado con is_super_admin = true
When solicita el panel de métricas globales
Then recibe los seis grupos de métricas definidos arriba, calculados sobre
     la ventana del mes calendario actual (recortado al día de hoy) vs. el
     mismo recorte del mes anterior
```

### Caso: usuario autenticado sin ser super-admin

```
Given un user autenticado con is_super_admin = false
      (incluye admins de institución, staff, y tutores)
When intenta consultar el panel de métricas globales
Then la operación se rechaza por falta de autorización
     (SuperAdminGuard, ADR-038 punto 1)
```

### Caso: plataforma sin datos suficientes (mes nuevo, sin recogidas previas)

```
Given no existe ningún pickup_request en el mes calendario anterior
When se solicita el comparativo de recogidas totales
Then el periodo anterior se reporta como 0, y el comparativo se calcula
     normalmente contra ese 0 (sin división por cero ni error — un
     incremento desde 0 es matemáticamente válido, se reporta como tal)
```

## Referencia a contrato de API

Ver `specs/api-contracts/admin-metrics.md` — `GET /admin/metrics`.

## Referencia a MQTT

No aplica: es una consulta agregada sobre Postgres, sin componente de tiempo
real.

## Referencias

- ADR-038 (guard nuevo; definiciones exactas de cada métrica).
- `specs/entities/user.md` (`is_super_admin`).
- `docs/design-brief.md` (sección "Rol: super-admin (operador)").

## Preguntas abiertas

Ninguna: las definiciones de cada métrica (ventana de tiempo, alcance de
"tutores registrados", umbral del top de instituciones, criterio de "tiempo
medio de recogida") se resolvieron en ADR-038.
