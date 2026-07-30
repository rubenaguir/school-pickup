# API Contract — Admin Institutions

Cola de instituciones para el super-admin: aprobar altas nuevas, y ver/
gestionar el resto por status. Cubre
`specs/features/025-aprobacion-suspension-institucion.md`. Las transiciones
de estado (`approve`/`suspend`/`reactivate`) viven en
`specs/api-contracts/institutions.md` — este archivo cubre solo el listado.

## Autenticación y autorización

Requiere JWT válido y `users.is_super_admin = true` (`SuperAdminGuard`,
ADR-038) — no usa `InstitutionMembershipGuard`. Mismo namespace `/admin/`
que `GET /admin/metrics` (ADR-040 punto 3).

No confundir con `GET /institutions?search=...` (ADR-037): ese endpoint es
para tutores buscando instituciones ya `approved` a las que asociarse; este
es para el super-admin, ve instituciones de **cualquier** `status`.

## `GET /admin/institutions`

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `status` | no | `pending \| approved \| suspended`; sin filtro, devuelve todas |
| `limit` | no | tamaño de página; default `20` (ADR-024 punto 9) |
| `offset` | no | desplazamiento; default `0` (ADR-024 punto 9) |

**Response 200**
```json
{
  "institutions": [
    {
      "id": "uuid",
      "name": "string",
      "type": "school | extracurricular",
      "category": "string | null",
      "status": "pending | approved | suspended",
      "joinCode": "string"
    }
  ],
  "limit": "number",
  "offset": "number",
  "total": "number"
}
```

Ordenado por `created_at ASC` (las solicitudes más antiguas primero — cola
FIFO, coherente con "cola de altas por validar" del `design-brief.md`).

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |
| 403 | `SUPER_ADMIN_REQUIRED` | el usuario autenticado no tiene `is_super_admin = true` |

## Referencias

- `specs/features/025-aprobacion-suspension-institucion.md`.
- `specs/api-contracts/institutions.md` (`approve`/`suspend`/`reactivate`).
- ADR-037 (endpoint de búsqueda por nombre — propósito y autorización
  distintos).
- ADR-038 (`SuperAdminGuard`, namespace `/admin/`).
- ADR-040 (decisión completa de este slice).
