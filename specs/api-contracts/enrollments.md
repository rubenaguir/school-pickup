# API Contract — Enrollments

Recurso de asociaciones alumno–institución. Cubre
`specs/features/005-asociar-institucion.md` y
`specs/features/006-aprobacion-enrollment.md`.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md`. Dos perspectivas distintas sobre el mismo
recurso:
- **Tutor**: solo puede crear/ver `enrollments` donde él sea
  `requested_by_user_id` (o, para ver, donde sea guardián activo del
  `students` asociado).
- **Miembro de institución**: solo puede **ver** `enrollments` cuya
  `institution_id` coincida con alguna de sus filas de `institution_members`
  (`GET`, cualquier `role`). Para **aprobar/rechazar** aplica además una
  restricción de rol (ADR-019, punto 5): solo `role = admin` puede ejecutar
  `PATCH /enrollments/:id/approve` o `/reject`; `coordinator`, `teacher` y
  `gate_operator` pueden ver la bandeja pero no resolverla. Como el access
  token no fija `institutionId` (ver `specs/features/003-login.md`), cada
  endpoint institucional recibe el `institutionId` explícitamente (o lo
  deriva del `enrollments` en los `PATCH`) y lo valida contra las membresías
  del usuario autenticado.

## `POST /enrollments`

Ver feature 005. Crea la solicitud de asociación (perspectiva del tutor).

**Request**
```json
{
  "studentId": "uuid",
  "institutionId": "uuid | omitido si se usa joinCode",
  "joinCode": "string | omitido si se usa institutionId",
  "gradeOrGroup": "string | null"
}
```

Debe enviarse exactamente uno de `institutionId` o `joinCode` (ver los dos
casos de éxito de feature 005: búsqueda por nombre resuelve `institutionId`
en el cliente antes de enviar; `joinCode` se resuelve en el servidor).

**Response 201**
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "institutionId": "uuid",
  "status": "pending",
  "enrollmentCode": "string",
  "requestedAt": "string (timestamptz)"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | ni `institutionId` ni `joinCode` presentes, o ambos presentes |
| 403 | el usuario autenticado no es guardián activo del `studentId` |
| 404 | `joinCode` no corresponde a ninguna institución **con `status = approved`** (ADR-019, punto 4 — una institución `pending`/`suspended` no resuelve, igual que si no existiera) |
| 404 | `institutionId` no corresponde a ninguna institución `approved` |
| 409 | ya existe un `enrollments` para ese `(studentId, institutionId)` |

## `GET /enrollments/mine`

Lista de solicitudes propias (perspectiva del tutor). Ver feature 005. A
diferencia de `GET /enrollments` (perspectiva de institución, más abajo), no
recibe `institutionId`: el alcance es siempre el usuario autenticado. Incluye
toda solicitud donde el usuario sea guardián activo (`student_guardians.status
= active`) del `students` asociado — no solo las que él mismo solicitó
(`requested_by_user_id`), consistente con la regla de "Reglas de
autorización" arriba.

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `status` | no | filtra por `pending`/`approved`/`rejected`; sin filtro, devuelve todos |

**Response 200**
```json
{
  "enrollments": [
    {
      "id": "uuid",
      "studentId": "uuid",
      "studentFullName": "string",
      "institutionId": "uuid",
      "status": "pending | approved | rejected",
      "gradeOrGroup": "string | null",
      "enrollmentCode": "string",
      "requestedAt": "string (timestamptz)",
      "reviewedAt": "string (timestamptz) | null"
    }
  ]
}
```

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |

## `GET /enrollments?status=pending&institutionId=...`

Bandeja de solicitudes para revisión (perspectiva de institución). Ver
feature 006.

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `institutionId` | sí | debe corresponder a una `institution_members` del usuario autenticado |
| `status` | no | filtra por `pending`/`approved`/`rejected`; sin filtro, devuelve todos |

**Response 200**
```json
{
  "enrollments": [
    {
      "id": "uuid",
      "studentId": "uuid",
      "studentFullName": "string",
      "status": "pending | approved | rejected",
      "gradeOrGroup": "string | null",
      "enrollmentCode": "string",
      "requestedByUserId": "uuid",
      "requestedAt": "string (timestamptz)",
      "reviewedByUserId": "uuid | null",
      "reviewedAt": "string (timestamptz) | null"
    }
  ]
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | `institutionId` faltante |
| 403 | el usuario autenticado no es `institution_members` de ese `institutionId` |

## `PATCH /enrollments/:id/approve`

Ver feature 006.

**Request:** sin body.

**Response 200**
```json
{
  "id": "uuid",
  "status": "approved",
  "reviewedByUserId": "uuid",
  "reviewedAt": "string (timestamptz)"
}
```

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de la institución del enrollment |
| 403 | el usuario autenticado es `institution_members` de la institución correcta, pero su `role` no es `admin` (ADR-019, punto 5) |
| 404 | `enrollments` no existe |
| 409 | `enrollments.status != pending` |
| 422 | `institutions.status != approved` (regla cruzada entre entidades; ADR-018, ADR-025 punto 5) |

**Auditoría.** La aprobación registra una fila en `audit_log` con
`action = enrollment.approved` (aprobación = acción sensible según `CLAUDE.md`;
convención libre `entity.verb`, ADR-018 punto 9; ADR-025 punto 6).

## `PATCH /enrollments/:id/reject`

**Request:** sin body (no hay campo de motivo de rechazo en la entidad —
ver `specs/entities/enrollment.md`, que no define ninguna columna para
capturarlo).

**Response 200**
```json
{
  "id": "uuid",
  "status": "rejected",
  "reviewedByUserId": "uuid",
  "reviewedAt": "string (timestamptz)"
}
```

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de la institución del enrollment |
| 403 | el usuario autenticado es `institution_members` de la institución correcta, pero su `role` no es `admin` (ADR-019, punto 5) |
| 404 | `enrollments` no existe |
| 409 | `enrollments.status != pending` |

Nota: a diferencia de `approve`, `reject` no valida `institutions.status`
(ver feature 006 — ADR-018 solo condiciona la transición a `approved`).

**Auditoría.** El rechazo registra una fila en `audit_log` con
`action = enrollment.rejected` (ADR-018 punto 9; ADR-025 punto 6).

## Referencias

- `specs/features/005-asociar-institucion.md`,
  `specs/features/006-aprobacion-enrollment.md`.
- `specs/entities/enrollment.md`, `specs/entities/institution.md`,
  `specs/entities/institution_member.md`, `specs/entities/audit_log.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).
- ADR-018 (condición de aprobación; `rejected` terminal).
- ADR-019 (visibilidad de instituciones no aprobadas; restricción de
  `role = admin` para aprobar/rechazar).
- `GET /enrollments/mine` documentado a posteriori, al implementar la mitad
  tutor de feature 005: la sección "Reglas de autorización" ya prometía
  lectura al tutor pero no existía un endpoint que la respaldara — el único
  `GET /enrollments` documentado en este archivo es, y siempre fue, el de
  feature 006 (bandeja de staff).
- ADR-025 (punto 5: `institutions.status != approved` → 422; punto 6: registro en
  `audit_log` de `enrollment.approved` / `enrollment.rejected`).

## Preguntas abiertas

Ninguna: las dos preguntas que tenía este contrato (visibilidad de
instituciones no aprobadas, restricción de rol para aprobar/rechazar) se
resolvieron en ADR-019.
