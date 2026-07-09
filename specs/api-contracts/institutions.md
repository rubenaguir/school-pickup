# API Contract — Institutions

Recurso de configuración de una institución ya creada y aprobada. Cubre
`specs/features/008-editar-perfil-institucion.md`. El alta inicial de la
institución vive en `specs/api-contracts/auth.md`
(`POST /auth/register/institution`), no aquí.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md` ("cada institución solo ve y gestiona lo suyo").
Todos los endpoints de este documento exigen que el usuario autenticado sea
`institution_member` de la `:id` indicada. Se implementa con
`InstitutionMembershipGuard` (ADR-022, punto 4): tras el guard de JWT, verifica
que exista un `institution_member` `(userId, institutionId)`; para estas rutas
lee el `institutionId` del parámetro de ruta (el access token no fija
`institutionId` ni `role` — ver `specs/api-contracts/auth.md`). Un usuario de
otra institución recibe 403.

Rol requerido para las operaciones de escritura (`PATCH`,
`regenerate-join-code`): **`role = admin`** (ADR-022, punto 1; la regeneración
del `join_code` también por ADR-019 punto 1). La lectura (`GET`) está disponible
para cualquier `institution_member` de la institución.

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
  "joinCode": "string",
  "status": "pending | approved | suspended"
}
```

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_member` de esa `:id` |
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
  "advanceNoticeMinutes": "number"
}
```

`geofenceRadiusMeters` (arribo) y `activationRadiusMeters` (activación del botón
"ya voy") son dos campos independientes y se actualizan por separado (ADR-013).

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
  "status": "pending | approved | suspended"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (tipos incorrectos, radios no enteros, etc.) |
| 403 | el usuario autenticado no es `institution_member` de esa `:id` |
| 403 | el usuario es `institution_member` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | la institución no existe |
| 409 | se envió `category` no nula en una institución con `type = school` (invariante de `specs/entities/institution.md`) |
| 409 | `institution.status != approved` (la edición de perfil requiere institución aprobada, ver feature 008) |

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
| 403 | el usuario autenticado no es `institution_member` de esa `:id` |
| 403 | el usuario es `institution_member` correcto, pero su `role` no es `admin` (ADR-019 punto 1 atribuye la regeneración al admin) |
| 404 | la institución no existe |

## Referencias

- `specs/features/008-editar-perfil-institucion.md`.
- `specs/entities/institution.md`, `specs/entities/institution_member.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).
- ADR-013 (dos radios independientes).
- ADR-015 (campos operativos de `institutions`).
- ADR-018 (transiciones de `status` son de super-admin, no editables aquí).
- ADR-019 (punto 1: regeneración de `join_code` por el admin; punto 5:
  restricción a `role = admin`).
- ADR-022 (punto 1: la configuración exige `role = admin`; punto 4:
  `InstitutionMembershipGuard`).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`) y el mecanismo de aislamiento
multi-tenant (`InstitutionMembershipGuard`) se resolvieron en ADR-022 (puntos 1
y 4).
