# API Contract — Institution Reports

Reporte operativo de una institución para su administrador. Cubre
`specs/features/027-reportes-institucion.md`.

## Autorización

`InstitutionMembershipGuard` + `role = admin` (ADR-060 punto 6) — mismo
patrón que `PATCH /institutions/:id`, `POST /institutions/:id/delivery-points`,
etc. No confundir con los reportes globales de super-admin
(`GET /admin/metrics`), que son un endpoint y alcance distintos.

## `GET /institutions/:id/reports`

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `period` | sí | uno de: `today`, `last7Days`, `last30Days`, `thisMonth`, `lastMonth` (ADR-060 punto 1) |

**Response 200**
```json
{
  "period": "today | last7Days | last30Days | thisMonth | lastMonth",
  "averagePickupDurationSeconds": "number | null",
  "activeStudentsCount": "number",
  "punctualityRate": "number | null",
  "deliveriesByDay": [
    { "date": "string (YYYY-MM-DD)", "count": "number" }
  ]
}
```

`activeStudentsCount` no depende de `period` — es el padrón actual
(ADR-060 punto 3). Las otras tres métricas sí están acotadas al periodo
elegido.

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | `period` ausente o fuera del enum |
| 403 | — | el usuario no es `institution_members` de esa `:id` |
| 403 | `ADMIN_ROLE_REQUIRED` | es `institution_members` correcto, pero su `role` no es `admin` |
| 404 | — | la institución no existe |

## Referencias

- `specs/features/027-reportes-institucion.md`.
- ADR-060 (decisión completa, algoritmo de puntualidad).
- ADR-022 (punto 1: `role = admin` para configuración/reportes de
  institución; punto 4: `InstitutionMembershipGuard`).
