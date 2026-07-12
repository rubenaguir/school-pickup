# API Contract — Dismissal Windows

Recurso de horarios de salida recurrentes de una institución. Cubre
`specs/features/010-gestionar-horarios-recurrentes.md`.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md`. El usuario autenticado debe ser
`institution_members` de la institución dueña de la ventana, verificado por
`InstitutionMembershipGuard` (ADR-022, punto 4). En los endpoints anidados bajo
`/institutions/:id/...` el guard lee el `institutionId` de la ruta; en
`PATCH /dismissal-windows/:id` resuelve la institución de la ventana con una
consulta mínima al repositorio y la compara contra las membresías del usuario.
Un usuario de otra institución recibe 403.

Rol requerido para escritura (`POST`, `PATCH`): **`role = admin`** (ADR-022,
punto 1). La lectura (`GET`) está disponible para cualquier `institution_members`
de la institución.

## `GET /institutions/:id/dismissal-windows`

Lista las ventanas de salida recurrentes de la institución. Ver feature 010.

**Request:** sin body.

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `status` | no | filtra por `active`/`paused`; sin filtro, devuelve todas |

**Response 200**
```json
{
  "dismissalWindows": [
    {
      "id": "uuid",
      "institutionId": "uuid",
      "weekday": "number (0-6)",
      "startTime": "string (HH:mm)",
      "endTime": "string (HH:mm)",
      "label": "string",
      "level": "string | null",
      "status": "active | paused"
    }
  ]
}
```

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |

No hay un caso 404 "la institución no existe" separado en esta ruta anidada:
`InstitutionMembershipGuard`, en modo ruta anidada, no distingue institución
inexistente de institución existente sin membresía — ambos casos devuelven
`403 NOT_INSTITUTION_MEMBER`. Ver `docs/arquitectura.md`.

## `POST /institutions/:id/dismissal-windows`

Crea una ventana de salida recurrente. Ver feature 010.

**Request**
```json
{
  "weekday": "number (0-6)",
  "startTime": "string (HH:mm)",
  "endTime": "string (HH:mm)",
  "label": "string",
  "level": "string | null"
}
```

`status` no se envía: se crea con `active` por defecto.

**Response 201**
```json
{
  "id": "uuid",
  "institutionId": "uuid",
  "weekday": "number (0-6)",
  "startTime": "string (HH:mm)",
  "endTime": "string (HH:mm)",
  "label": "string",
  "level": "string | null",
  "status": "active"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`weekday` fuera de 0–6, `label` faltante, horas mal formadas) |
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |

No hay un caso 404 "la institución no existe" separado en esta ruta anidada:
`InstitutionMembershipGuard`, en modo ruta anidada, no distingue institución
inexistente de institución existente sin membresía — ambos casos devuelven
`403 NOT_INSTITUTION_MEMBER`. Ver `docs/arquitectura.md`.

## `PATCH /dismissal-windows/:id`

Edita una ventana, incluyendo pausar/activar vía `status`. Ver feature 010.

**Request** (todos los campos opcionales; edición parcial)
```json
{
  "weekday": "number (0-6)",
  "startTime": "string (HH:mm)",
  "endTime": "string (HH:mm)",
  "label": "string",
  "level": "string | null",
  "status": "active | paused"
}
```

**Response 200**
```json
{
  "id": "uuid",
  "institutionId": "uuid",
  "weekday": "number (0-6)",
  "startTime": "string (HH:mm)",
  "endTime": "string (HH:mm)",
  "label": "string",
  "level": "string | null",
  "status": "active | paused"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`weekday` fuera de 0–6, horas mal formadas) |
| 403 | el usuario autenticado no es `institution_members` de la institución de la ventana |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | la ventana no existe |

## Referencias

- `specs/features/010-gestionar-horarios-recurrentes.md`.
- `specs/entities/dismissal_window.md`, `specs/entities/institution_member.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).
- ADR-015 (`label`, `level`, `status`; horarios recurrentes vs. excepciones).
- ADR-019 (punto 5: restricción a `role = admin`).
- ADR-022 (punto 1: escritura exige `role = admin`; punto 4:
  `InstitutionMembershipGuard`).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`) y el mecanismo de aislamiento
(`InstitutionMembershipGuard`) se resolvieron en ADR-022 (puntos 1 y 4).
