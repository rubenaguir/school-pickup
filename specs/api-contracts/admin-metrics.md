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
  "averagePickupDurationSeconds": "number | null"
}
```

`averagePickupDurationSeconds` es `null` si no hubo ningún `pickup_request`
con `status = delivered` en el periodo (sin datos para promediar, no un error).

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `SUPER_ADMIN_REQUIRED` | el usuario autenticado no tiene `is_super_admin = true` |

## Referencias

- `specs/features/024-metricas-globales-super-admin.md`.
- ADR-038 (guard nuevo; definiciones exactas de cada métrica).
- `specs/entities/user.md` (`is_super_admin`).
