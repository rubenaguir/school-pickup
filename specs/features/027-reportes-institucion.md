# Feature 027 — Reportes de institución

## Propósito

Un administrador de institución consulta métricas operativas de su propia
institución: tiempo promedio de recogida, alumnos activos, puntualidad, y
entregas por día. Es lectura pura, sin acciones de escritura. Ver
ADR-060 para las definiciones exactas de cada métrica, incluida la
resolución de "puntualidad" contra horarios de salida.

## Entidades involucradas

- `pickup_requests` (leído, agregado)
- `enrollments` (leído, agregado — para alumnos activos y `grade_or_group`)
- `dismissal_windows`, `dismissal_exceptions` (leído — resolución de la
  ventana esperada para puntualidad)
- `institutions` (leído — `arrival_tolerance_minutes`)
- `institution_members` (leído, para autorización)

## Precondiciones

- Quien consulta debe ser `institution_members` de la institución
  (aislamiento multi-tenant) **con `role = admin`** (ADR-060 punto 6,
  mismo criterio que perfil/puntos de entrega/horarios/personal).
- El periodo del reporte debe ser uno de los rangos predefinidos (ADR-060
  punto 1): `today`, `last7Days`, `last30Days` (default), `thisMonth`,
  `lastMonth`.

## Postcondiciones

Ninguna — consulta de solo lectura.

## Definición exacta de cada métrica (ADR-060)

1. **Tiempo promedio de recogida** (`averagePickupDurationSeconds`):
   promedio de `completed_at - started_at` sobre `pickup_requests` con
   `status = delivered` de esta institución, dentro del periodo elegido.
   `null` si no hay ninguna entrega en el periodo.
2. **Alumnos activos** (`activeStudentsCount`): conteo de alumnos con
   `enrollment.status = approved` en esta institución **hoy** — no depende
   del periodo del reporte (ADR-060 punto 3).
3. **Puntualidad** (`punctualityRate`): porcentaje de `pickup_requests`
   `delivered` en el periodo cuyo `completed_at` cayó dentro de
   `arrival_tolerance_minutes` después del fin de la ventana de salida
   resuelta (ver algoritmo completo en ADR-060 punto 4). Entregas sin
   ventana resoluble se excluyen del cálculo, no cuentan como impuntuales.
   `null` si no hay ninguna entrega con ventana resoluble en el periodo.
4. **Entregas por día** (`deliveriesByDay`): conteo de `pickup_requests`
   `delivered` agrupado por fecha calendario de `completed_at`, dentro del
   periodo elegido.

## Casos Given/When/Then

### Caso de éxito

```
Given un institution_member con role = admin
When solicita el reporte con un periodo predefinido válido
Then recibe las cuatro métricas definidas arriba, acotadas a su propia
     institución
```

### Caso: usuario sin rol admin

```
Given un institution_member de la institución, con role distinto de admin
When intenta consultar el reporte
Then la operación se rechaza por falta de autorización
     (ADR-060 punto 6)
```

### Caso: miembro de otra institución

```
Given un usuario que es institution_member únicamente de la institución B
When intenta consultar el reporte de la institución A
Then la operación se rechaza (aislamiento multi-tenant)
```

### Caso: entrega sin ventana de salida resoluble

```
Given un pickup_request delivered en una fecha/nivel para el que no existe
      ni dismissal_window recurrente ni dismissal_exception aplicable
When se calcula punctualityRate del periodo que incluye esa fecha
Then esa entrega se excluye del cálculo (ni cuenta ni descuenta)
```

### Caso: periodo sin ninguna entrega

```
Given un periodo elegido sin ningún pickup_request delivered
When se solicita el reporte
Then averagePickupDurationSeconds y punctualityRate son null (sin datos
     suficientes, no 0)
  And deliveriesByDay es una lista vacía
  And activeStudentsCount se calcula igual (no depende del periodo)
```

## Referencia a contrato de API

Ver `specs/api-contracts/institution-reports.md` — `GET
/institutions/:id/reports`.

## Referencia a MQTT

No aplica.

## Referencias

- ADR-060 (decisión completa de este slice).
- ADR-038 (precedente de definición de tiempo promedio de recogida).
- `specs/entities/institution.md`, `specs/entities/dismissal_window.md`,
  `specs/entities/dismissal_exception.md`.
- `docs/design-brief.md` (pantalla "Reportes").

## Preguntas abiertas

Ninguna: el periodo predefinido, la definición de alumnos activos, y el
algoritmo de puntualidad se resolvieron en ADR-060.
