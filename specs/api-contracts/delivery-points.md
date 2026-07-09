# API Contract — Delivery Points

Recurso de puntos de entrega de una institución. Cubre
`specs/features/009-gestionar-puntos-entrega.md`.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md`. El usuario autenticado debe ser
`institution_member` de la institución dueña del `delivery_point`, verificado
por `InstitutionMembershipGuard` (ADR-022, punto 4). En los endpoints anidados
bajo `/institutions/:id/...` el guard lee el `institutionId` de la ruta; en
`PATCH /delivery-points/:id` resuelve la institución del recurso con una consulta
mínima al repositorio y la compara contra las membresías del usuario. Un usuario
de otra institución recibe 403.

Rol requerido para escritura (`POST`, `PATCH`): **`role = admin`** (ADR-022,
punto 1). La lectura (`GET`) está disponible para cualquier `institution_member`
de la institución.

## `GET /institutions/:id/delivery-points`

Lista los puntos de entrega de la institución. Ver feature 009. Un listado
vacío es un estado válido (institución sin puntos configurados; ADR-012).

**Request:** sin body.

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `status` | no | filtra por `active`/`inactive`; sin filtro, devuelve todos |

**Response 200**
```json
{
  "deliveryPoints": [
    {
      "id": "uuid",
      "institutionId": "uuid",
      "name": "string",
      "description": "string | null",
      "operatorUserId": "uuid | null",
      "assignedGroups": ["string"],
      "status": "active | inactive"
    }
  ]
}
```

`assignedGroups` puede ser `null` (o vacío) para instituciones que no asignan
grupos (ADR-012).

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_member` de esa `:id` |
| 404 | la institución no existe |

## `POST /institutions/:id/delivery-points`

Crea un punto de entrega. Ver feature 009.

**Request**
```json
{
  "name": "string",
  "description": "string | null",
  "operatorUserId": "uuid | null",
  "assignedGroups": ["string"]
}
```

`status` no se envía: se crea con `active` por defecto. `assignedGroups` es
opcional (texto libre, ADR-012).

**Response 201**
```json
{
  "id": "uuid",
  "institutionId": "uuid",
  "name": "string",
  "description": "string | null",
  "operatorUserId": "uuid | null",
  "assignedGroups": ["string"],
  "status": "active"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`name` faltante, tipos incorrectos) |
| 403 | el usuario autenticado no es `institution_member` de esa `:id` |
| 403 | el usuario es `institution_member` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | la institución no existe |
| 422 | `operatorUserId` no corresponde a un `institution_member` de esa institución (validación cruzada en capa de servicio, ADR-018 punto 11; código 422 por ADR-022 punto 5) |

## `PATCH /delivery-points/:id`

Edita un punto de entrega, incluyendo su desactivación/reactivación vía
`status`. Ver feature 009. No hay borrado físico: desactivar es
`status = inactive`.

**Request** (todos los campos opcionales; edición parcial)
```json
{
  "name": "string",
  "description": "string | null",
  "operatorUserId": "uuid | null",
  "assignedGroups": ["string"],
  "status": "active | inactive"
}
```

**Response 200**
```json
{
  "id": "uuid",
  "institutionId": "uuid",
  "name": "string",
  "description": "string | null",
  "operatorUserId": "uuid | null",
  "assignedGroups": ["string"],
  "status": "active | inactive"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido |
| 403 | el usuario autenticado no es `institution_member` de la institución del `delivery_point` |
| 403 | el usuario es `institution_member` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | el `delivery_point` no existe |
| 422 | `operatorUserId` no corresponde a un `institution_member` de esa institución (validación cruzada en capa de servicio, ADR-018 punto 11; código 422 por ADR-022 punto 5) |

## Referencias

- `specs/features/009-gestionar-puntos-entrega.md`.
- `specs/entities/delivery_point.md`, `specs/entities/institution_member.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).
- ADR-012 (asignación automática/estructural por grupo; `assigned_groups` texto
  libre; `delivery_point_id` nullable).
- ADR-017 (validación cruzada en capa de servicio).
- ADR-018 (punto 11: `operator_user_id` debe ser miembro de la misma
  institución).
- ADR-019 (punto 5: restricción a `role = admin`).
- ADR-022 (punto 1: escritura exige `role = admin`; punto 4:
  `InstitutionMembershipGuard`; punto 5: código 422 para validaciones cruzadas).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`), el mecanismo de aislamiento
(`InstitutionMembershipGuard`) y el código HTTP de la validación cruzada de
`operatorUserId` (422) se resolvieron en ADR-022 (puntos 1, 4 y 5).
