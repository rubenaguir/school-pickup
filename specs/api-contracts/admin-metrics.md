# API Contract — Admin Metrics

Panel de métricas globales de plataforma para el super-admin. Cubre
`specs/features/024-metricas-globales-super-admin.md`.

## Autenticación y autorización

Requiere JWT válido y `users.is_super_admin = true` (`SuperAdminGuard`,
ADR-038 punto 1) — no usa `InstitutionMembershipGuard`: esta vista no
pertenece a ninguna institución.

## `GET /admin/metrics`

**Request:** sin body ni query params (ventana de tiempo fija, ADR-038 punto 2 —
no configurable por el cliente en esta fase).

**Response 200**
```json
{
  "institutionsByStatus": {
    "pending": "number",
    "approved": "number",
    "suspended": "number"
  },
  "pendingRequests": {
    "enrollmentsPending": "number",
    "institutionsPendingApproval": "number"
  },
  "registeredGuardiansCount": "number",
  "pickupRequestsTotal": {
    "currentPeriod": "number",
    "previousPeriod": "number"
  },
  "topInstitutionsByUsage": [
    { "institutionId": "uuid", "name": "string", "pickupRequestsCount": "number" }
  ],
  "averagePickupDurationSeconds": "number | null",
  "deliveriesByDay": [
    { "date": "string", "count": "number" }
  ]
}
```

`averagePickupDurationSeconds` es `null` si no hubo ningún `pickup_request`
con `status = delivered` en el periodo (sin datos para promediar, no un error).

`deliveriesByDay` cubre los últimos 14 días corridos (`now - 14d` hasta `now`),
plataforma completa sin filtro de institución — una ventana fija,
independiente de la ventana de comparación mensual que usa
`pickupRequestsTotal` (ADR-074 punto 2). Mismo patrón que
`GET /institutions/:id/reports`'s `deliveriesByDay`
(`specs/api-contracts/institution-reports.md`): solo trae los días con al
menos una entrega, sin ceros de relleno.

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `SUPER_ADMIN_REQUIRED` | el usuario autenticado no tiene `is_super_admin = true` |

## Referencias

- `specs/features/024-metricas-globales-super-admin.md`.
- ADR-038 (guard nuevo; definiciones exactas de cada métrica).
- `specs/entities/user.md` (`is_super_admin`).
- ADR-074 (`deliveriesByDay`, shell de navegación del rol Operador/OPS).
- `specs/api-contracts/institution-reports.md` (mismo patrón de `deliveriesByDay`, con filtro de institución).
