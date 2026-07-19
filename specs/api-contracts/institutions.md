# API Contract — Institutions

Recurso de configuración de una institución ya creada y aprobada. Cubre
`specs/features/008-editar-perfil-institucion.md`. El alta inicial de la
institución vive en `specs/api-contracts/auth.md`
(`POST /auth/register/institution`), no aquí.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md` ("cada institución solo ve y gestiona lo suyo").
Todos los endpoints de este documento exigen que el usuario autenticado sea
`institution_members` de la `:id` indicada. Se implementa con
`InstitutionMembershipGuard` (ADR-022, punto 4): tras el guard de JWT, verifica
que exista un `institution_members` `(userId, institutionId)`; para estas rutas
lee el `institutionId` del parámetro de ruta (el access token no fija
`institutionId` ni `role` — ver `specs/api-contracts/auth.md`). Un usuario de
otra institución recibe 403.

Rol requerido para las operaciones de escritura (`PATCH`,
`regenerate-join-code`): **`role = admin`** (ADR-022, punto 1; la regeneración
del `join_code` también por ADR-019 punto 1). La lectura (`GET`) está disponible
para cualquier `institution_members` de la institución.

## `GET /institutions/:id`

Devuelve la configuración de la institución. Ver feature 008.

**Request:** sin body.

**Response 200**
```json
{
  "id": "uuid",
  "name": "string",
  "type": "school | extracurricular",
  "category": "string | null",
  "address": "string",
  "location": { "lat": "number", "lng": "number" },
  "geofenceRadiusMeters": "number",
  "activationRadiusMeters": "number",
  "timezone": "string",
  "cctCode": "string | null",
  "levels": ["string"],
  "arrivalToleranceMinutes": "number",
  "advanceNoticeMinutes": "number",
  "arrivingLeadMinutes": "number",
  "joinCode": "string",
  "status": "pending | approved | suspended"
}
```

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |
| 404 | la institución no existe |

## `PATCH /institutions/:id`

Edita el perfil de la institución. Ver feature 008. Todos los campos del body
son opcionales (edición parcial); no se pueden editar `type`, `join_code` ni
`status` por este endpoint.

**Request**
```json
{
  "name": "string",
  "category": "string | null",
  "address": "string",
  "location": { "lat": "number", "lng": "number" },
  "geofenceRadiusMeters": "number",
  "activationRadiusMeters": "number",
  "timezone": "string",
  "cctCode": "string | null",
  "levels": ["string"],
  "arrivalToleranceMinutes": "number",
  "advanceNoticeMinutes": "number",
  "arrivingLeadMinutes": "number"
}
```

`geofenceRadiusMeters` (arribo) y `activationRadiusMeters` (activación del botón
"ya voy") son dos campos independientes y se actualizan por separado (ADR-013).
`arrivingLeadMinutes` (int, default 5) es el umbral de ETA para pasar a
`arriving` (ADR-024 punto 3).

**Response 200**
```json
{
  "id": "uuid",
  "name": "string",
  "category": "string | null",
  "address": "string",
  "location": { "lat": "number", "lng": "number" },
  "geofenceRadiusMeters": "number",
  "activationRadiusMeters": "number",
  "timezone": "string",
  "cctCode": "string | null",
  "levels": ["string"],
  "arrivalToleranceMinutes": "number",
  "advanceNoticeMinutes": "number",
  "arrivingLeadMinutes": "number",
  "status": "pending | approved | suspended"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (tipos incorrectos, radios no enteros, etc.) |
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-022 punto 1); `code: ADMIN_ROLE_REQUIRED` |
| 404 | la institución no existe |
| 409 | se envió `category` no nula en una institución con `type = school` (invariante intra-entidad de `specs/entities/institution.md`; conflicto del recurso con su propio estado → 409, ADR-022 punto 5 ampliado por ADR-026 punto 2); `code: CATEGORY_NOT_ALLOWED_FOR_TYPE` |
| 409 | `institutions.status != approved` (la edición de perfil requiere institución aprobada, ver feature 008; conflicto del recurso con su propio estado → 409, ADR-022 punto 5 ampliado por ADR-026 punto 2); `code: INSTITUTION_NOT_APPROVED` |

## `POST /institutions/:id/regenerate-join-code`

Regenera el `join_code` de la institución. Ver ADR-019 (punto 1): el admin puede
regenerarlo desde la configuración; el algoritmo (iniciales + año, con sufijo
aleatorio ante colisión) es el mismo que en el alta.

**Request:** sin body.

**Response 200**
```json
{ "id": "uuid", "joinCode": "string" }
```

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-019 punto 1 atribuye la regeneración al admin); `code: ADMIN_ROLE_REQUIRED` |
| 404 | la institución no existe |

## `GET /institutions?search=...`

Busca instituciones `approved` por coincidencia parcial de nombre. Ver
feature 005 (camino de asociación por búsqueda de nombre). A diferencia de
los demás endpoints de este contrato, **no** exige `InstitutionMembershipGuard`:
el usuario que busca todavía no tiene ninguna relación con la institución
que encuentre — es el paso previo a `POST /enrollments`. Solo exige JWT
válido (ADR-037).

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `search` | sí | coincidencia parcial, case-insensitive, sobre `name` (`ILIKE '%search%'`) |
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
      "category": "string | null"
    }
  ],
  "limit": "number",
  "offset": "number",
  "total": "number"
}
```

Solo instituciones con `status = approved` (ADR-019 punto 4) — una `pending` o
`suspended` no debe aparecer en ningún resultado.

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | `search` faltante o vacío |
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |

## Referencias

- `specs/features/008-editar-perfil-institucion.md`.
- `specs/features/005-asociar-institucion.md` (camino de búsqueda por
  nombre).
- `specs/entities/institution.md`, `specs/entities/institution_member.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).
- ADR-013 (dos radios independientes).
- ADR-015 (campos operativos de `institutions`).
- ADR-018 (transiciones de `status` son de super-admin, no editables aquí).
- ADR-019 (punto 1: regeneración de `join_code` por el admin; punto 4:
  visibilidad de instituciones no aprobadas; punto 5: restricción a
  `role = admin`).
- ADR-022 (punto 1: la configuración exige `role = admin`; punto 4:
  `InstitutionMembershipGuard`).
- ADR-024 (punto 3: `arrivingLeadMinutes` como campo de configuración
  editable; punto 9: paginación `limit`/`offset`).
- ADR-026 (punto 2: ampliación de la convención 409/422 — el conflicto de un
  recurso con su propio estado, como `status != approved` o `category`/`type`,
  usa 409, no 422; ambos casos de este endpoint quedan correctamente en 409).
- ADR-037 (endpoint de búsqueda sin `InstitutionMembershipGuard`; solo JWT).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`) y el mecanismo de aislamiento
multi-tenant (`InstitutionMembershipGuard`) se resolvieron en ADR-022 (puntos 1
y 4).
