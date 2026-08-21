# API Contract — Institution Groups

Catálogo curado de grupos/niveles por institución. Reemplaza el texto libre
que antes vivía en `enrollments.grade_or_group` y
`delivery_points.assigned_groups`. Ver ADR-084.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md`. Mismo criterio que `delivery-points` (ADR-022,
punto 1): el usuario autenticado debe ser `institution_members` de la
institución dueña del `institution_groups`, verificado por
`InstitutionMembershipGuard`. Rol requerido para escritura (`POST`, `PATCH`,
`DELETE`): **`role = admin`**. La lectura (`GET`) está disponible para
cualquier `institution_members` de la institución.

## `GET /institutions/:id/groups`

Lista los grupos del catálogo con sus conteos de uso. Alimenta tanto la
pantalla "Grupos" del portal como la advertencia de borrado de `DELETE
/groups/:id`.

**Request:** sin body.

**Response 200**
```json
{
  "groups": [
    {
      "id": "uuid",
      "institutionId": "uuid",
      "name": "string",
      "enrollmentsCount": 0,
      "deliveryPointsCount": 0
    }
  ]
}
```

`enrollmentsCount`: número de `enrollments` con `group_id` apuntando a este
grupo. `deliveryPointsCount`: número de filas en `delivery_point_groups` para
este grupo (equivalente a "cuántos puntos de entrega lo tienen asignado").

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |

## `POST /institutions/:id/groups`

Crea un grupo nuevo en el catálogo.

**Request**
```json
{
  "name": "string"
}
```

`name` se recorta (`trim`) antes de guardar y de validar contra el índice
único case-insensitive.

**Response 201**
```json
{
  "id": "uuid",
  "institutionId": "uuid",
  "name": "string",
  "enrollmentsCount": 0,
  "deliveryPointsCount": 0
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`name` faltante o vacío tras `trim`) |
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` |
| 422 | ya existe un grupo con el mismo `name` (comparación case-insensitive) en esta institución; `code: DUPLICATE_GROUP_NAME` |

## `PATCH /groups/:id`

Renombra un grupo existente. Misma validación de unicidad que `POST`.

**Request**
```json
{
  "name": "string"
}
```

**Response 200** — mismo shape que un elemento de `GET /institutions/:id/groups`.
```json
{
  "id": "uuid",
  "institutionId": "uuid",
  "name": "string",
  "enrollmentsCount": 0,
  "deliveryPointsCount": 0
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido |
| 403 | el usuario autenticado no es `institution_members` de la institución del grupo |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` |
| 404 | el `institution_groups` no existe |
| 422 | ya existe otro grupo con el mismo `name` (comparación case-insensitive) en esta institución; `code: DUPLICATE_GROUP_NAME` |

## `DELETE /groups/:id`

Borra un grupo del catálogo. Flujo de confirmación en dos pasos (decisión
confirmada con el humano, ADR-084 punto 6):

1. **Sin `?confirm=true`**: si el grupo está en uso
   (`enrollmentsCount > 0` o `deliveryPointsCount > 0`), responde 409 con los
   conteos — el frontend arma la advertencia a partir de esos números, no los
   inventa.
2. **Con `?confirm=true`** (o si el grupo no está en uso, sin necesidad de
   confirmar): procede con el borrado. El `ON DELETE SET NULL` de
   `enrollments.group_id` y el `ON DELETE CASCADE` de `delivery_point_groups`
   hacen el resto — el service **no** escribe él mismo los `NULL` ni borra
   filas de `delivery_point_groups` a mano.

**Request:** sin body.

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `confirm` | no | `true` para proceder pese a que el grupo esté en uso |

**Response 204** — sin body, borrado exitoso.

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de la institución del grupo |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` |
| 404 | el `institution_groups` no existe |
| 409 | el grupo está en uso y `confirm` no es `true`; `code: GROUP_IN_USE`, body `{ enrollmentsCount, deliveryPointsCount }` |

## Referencias

- `specs/entities/institution_group.md`, `specs/entities/delivery_point_group.md`.
- ADR-084 (creación del catálogo; flujo de borrado con confirmación; conteos de uso).
- ADR-022 (punto 1: rol `admin` para escritura; punto 4: `InstitutionMembershipGuard`; punto 5: 422 para validaciones cruzadas).
- `specs/api-contracts/enrollments.md`, `specs/api-contracts/delivery-points.md` (consumidores de `groupId`/`groupIds`, con 422 `GROUP_NOT_IN_INSTITUTION` si el grupo no pertenece a la institución del recurso).
