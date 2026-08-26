# API Contract — Enrollments

Recurso de asociaciones alumno–institución. Cubre
`specs/features/005-asociar-institucion.md` y
`specs/features/006-aprobacion-enrollment.md`.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md`. Dos perspectivas distintas sobre el mismo
recurso:
- **Tutor**: solo puede crear/ver `enrollments` donde él sea
  `requested_by_user_id` (o, para ver, donde sea guardián activo del
  `students` asociado). Para **cancelar** (`DELETE /enrollments/:id`) o
  **dar de baja** (`PATCH /enrollments/:id/withdraw`) su propia
  solicitud, la condición es más estricta: debe ser el propio
  `requested_by_user_id`, ser guardián activo no basta (ADR-088).
- **Miembro de institución**: solo puede **ver** `enrollments` cuya
  `institution_id` coincida con alguna de sus filas de `institution_members`
  (`GET`, cualquier `role`). Para **aprobar/rechazar** aplica además una
  restricción de rol (ADR-019, punto 5): solo `role = admin` puede ejecutar
  `PATCH /enrollments/:id/approve` o `/reject`; `coordinator`, `teacher` y
  `gate_operator` pueden ver la bandeja pero no resolverla. La misma
  restricción de rol aplica al lado institución de
  `PATCH /enrollments/:id/withdraw` (ADR-088) — a diferencia de
  approve/reject/group, este endpoint no pasa por
  `InstitutionMembershipGuard` (el otro actor posible, el tutor, no es
  `institution_members`), así que la verificación de rol vive en el
  servicio, no en un guard. Como el access
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
  "groupId": "uuid | null"
}
```

Debe enviarse exactamente uno de `institutionId` o `joinCode` (ver los dos
casos de éxito de feature 005: búsqueda por nombre resuelve `institutionId`
en el cliente antes de enviar; `joinCode` se resuelve en el servidor).

`groupId`, si viene definido, debe corresponder a un `institution_groups` de
la institución resuelta (por `institutionId` o `joinCode`) → 422
`GROUP_NOT_IN_INSTITUTION` si no. Campo renombrado desde `gradeOrGroup`
(texto libre) por ADR-084 — la respuesta de lectura sigue exponiendo
`gradeOrGroup: string | null`, resuelto por join al nombre del grupo.

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
| 422 | `groupId` no corresponde a un `institution_groups` de la institución resuelta; `code: GROUP_NOT_IN_INSTITUTION` |

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
| `status` | no | filtra por `pending`/`approved`/`rejected`/`withdrawn`; sin filtro, devuelve todos |

**Response 200**
```json
{
  "enrollments": [
    {
      "id": "uuid",
      "studentId": "uuid",
      "studentFullName": "string",
      "institutionId": "uuid",
      "institutionName": "string",
      "institutionType": "school | extracurricular",
      "institutionCategory": "string | null",
      "status": "pending | approved | rejected | withdrawn",
      "gradeOrGroup": "string | null",
      "enrollmentCode": "string",
      "requestedAt": "string (timestamptz)",
      "reviewedAt": "string (timestamptz) | null",
      "withdrawnAt": "string (timestamptz) | null"
    }
  ]
}
```

`withdrawnAt` agregado por ADR-088 — sin `withdrawnByUserId`: mismo
criterio que la ausencia de `reviewedByUserId` aquí (la identidad del
staffer que resolvió o dio de baja no es asunto de esta pantalla).

`institutionName`, `institutionType`, `institutionCategory` vienen de un
`JOIN` contra `institutions` (ADR-057) — sin restricción de `institutions.status`,
a diferencia de `GET /institutions?search=...` (ADR-037), que solo devuelve
`approved`: aquí el tutor ya tiene una relación real con la institución vía el
`enrollments` existente, sin importar su estado actual.

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
| `status` | no | filtra por `pending`/`approved`/`rejected`/`withdrawn`; sin filtro, devuelve todos |

**Response 200**
```json
{
  "enrollments": [
    {
      "id": "uuid",
      "studentId": "uuid",
      "studentFullName": "string",
      "status": "pending | approved | rejected | withdrawn",
      "gradeOrGroup": "string | null",
      "enrollmentCode": "string",
      "requestedByUserId": "uuid",
      "requestedAt": "string (timestamptz)",
      "reviewedByUserId": "uuid | null",
      "reviewedAt": "string (timestamptz) | null",
      "withdrawnByUserId": "uuid | null",
      "withdrawnAt": "string (timestamptz) | null"
    }
  ]
}
```

`withdrawnByUserId`/`withdrawnAt` agregados por ADR-088, mismo criterio
que `reviewedByUserId`/`reviewedAt`.

**Errores**
| Código | Caso |
|---|---|
| 400 | `institutionId` faltante |
| 403 | el usuario autenticado no es `institution_members` de ese `institutionId` |

## `PATCH /enrollments/:id/approve`

Ver feature 006.

**Request** (opcional; body vacío es válido)
```json
{
  "groupId": "uuid | null"
}
```

`groupId`, si viene definido, se asigna a `enrollments.group_id` dentro de la
misma transacción que ya escribe `status`/`reviewedByUserId`/`reviewedAt` —
permite asignar o corregir el grupo del alumno en el mismo paso en que se
aprueba, en vez de depender solo del punto de entrega atrapa-todo (ADR-083).
Si se omite, `group_id` no se toca. Debe corresponder a un
`institution_groups` de la institución del enrollment → 422
`GROUP_NOT_IN_INSTITUTION` si no. Campo renombrado desde `gradeOrGroup` por
ADR-084.

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
| 422 | `groupId` no corresponde a un `institution_groups` de la institución del enrollment; `code: GROUP_NOT_IN_INSTITUTION` |

**Auditoría.** La aprobación registra una fila en `audit_log` con
`action = enrollment.approved` (aprobación = acción sensible según `CLAUDE.md`;
convención libre `entity.verb`, ADR-018 punto 9; ADR-025 punto 6).

## `PATCH /enrollments/:id/group`

Corrige `gradeOrGroup` de una matrícula ya `approved`, fuera del momento de
aprobación (pantalla "Alumnos", ver `specs/features/029-editar-grupo-alumno.md`).
Endpoint separado de `approve()`: `approve()` exige `status = pending` y
reenvía el correo de aprobación en cada llamada — reusarlo para corregir una
matrícula ya aprobada dispararía un correo falso. Ver ADR-083. Endpoint y DTO
renombrados desde `PATCH /enrollments/:id/grade` /
`UpdateEnrollmentGradeDto` por ADR-084 (coherente con que el campo ya no es
texto libre, es una referencia al catálogo).

**Autorización:** misma que `approve`/`reject` — `institution_members` de la
institución del enrollment, con `role = admin` (ADR-019, punto 5).

**Request**
```json
{
  "groupId": "uuid | null"
}
```

`groupId` debe corresponder a un `institution_groups` de la institución del
enrollment → 422 `GROUP_NOT_IN_INSTITUTION` si no.

**Response 200** — mismo shape que una fila de
`GET /enrollments?status=...&institutionId=...` (`InstitutionEnrollmentListItem`,
ver más abajo). `gradeOrGroup` sin cambio de nombre en la respuesta.
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "studentFullName": "string",
  "status": "approved",
  "gradeOrGroup": "string | null",
  "enrollmentCode": "string",
  "requestedByUserId": "uuid",
  "requestedAt": "string (timestamptz)",
  "reviewedByUserId": "uuid | null",
  "reviewedAt": "string (timestamptz) | null",
  "withdrawnByUserId": "uuid | null",
  "withdrawnAt": "string (timestamptz) | null"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido |
| 403 | el usuario autenticado no es `institution_members` de la institución del enrollment |
| 403 | el usuario autenticado es `institution_members` de la institución correcta, pero su `role` no es `admin` (ADR-019, punto 5) |
| 404 | `enrollments` no existe |
| 409 | `enrollments.status != approved`; `code: ENROLLMENT_NOT_APPROVED` |
| 422 | `groupId` no corresponde a un `institution_groups` de la institución del enrollment; `code: GROUP_NOT_IN_INSTITUTION` |

Sin auditoría: es corrección de dato operativo, no una decisión de control de
acceso como aprobar/rechazar/invitar (ADR-083).

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

## `DELETE /enrollments/:id`

Cancela una solicitud propia todavía `pending` (perspectiva del tutor).
Ver ADR-088. A diferencia de `reject`, esto es un `DELETE` real — la
fila desaparece, sin valor de enum ni columna de auditoría: nunca pudo
generar un `pickup_requests` (esa FK solo referencia enrollments
`approved`), así que no hay nada que preservar como historial.

**Autorización:** el usuario autenticado debe ser el propio
`requested_by_user_id` del enrollment — ser guardián activo del alumno
no basta (a diferencia de `GET /enrollments/mine`).

**Request:** sin body.

**Response:** `204 No Content`.

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es el `requested_by_user_id` del enrollment; `code: ENROLLMENT_NOT_OWNED` |
| 404 | `enrollments` no existe |
| 409 | `enrollments.status != pending`; `code: ENROLLMENT_NOT_PENDING` |

**Tiempo real.** Publica un evento `EnrollmentRemovedPayload`
(`{ event: 'removed', id }`) a los dos topics de enrollments (ADR-087):
institución y tutor. Ver `specs/api-contracts/enrollments-ws.md`.

Sin auditoría: es una acción de auto-servicio sobre el propio recurso,
no una decisión de control de acceso como aprobar/rechazar/dar de baja.

## `PATCH /enrollments/:id/withdraw`

Da de baja una asociación ya `approved` (perspectiva de tutor **o**
institución — el mismo endpoint sirve a ambos actores, ver ADR-088). A
diferencia de cancelar, la fila se conserva como historial: `status`
pasa a `withdrawn` y queda terminal, igual que `rejected`.

**Autorización:** permitido si el usuario autenticado es el propio
`requested_by_user_id` del enrollment (tutor dueño), **o** si es
`institution_members` con `role = admin` de la institución del
enrollment (mismo nivel de privilegio que `approve`/`reject`/`group`).
No pasa por `InstitutionMembershipGuard` — el tutor no es
`institution_members`, así que ambas ramas se verifican en el servicio.

**Request:** sin body.

**Response 200**
```json
{
  "id": "uuid",
  "status": "withdrawn",
  "withdrawnByUserId": "uuid",
  "withdrawnAt": "string (timestamptz)"
}
```

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es el `requested_by_user_id` del enrollment ni un `institution_members` con `role = admin` de su institución; `code: ENROLLMENT_WITHDRAW_FORBIDDEN` |
| 404 | `enrollments` no existe |
| 409 | `enrollments.status != approved`; `code: ENROLLMENT_NOT_APPROVED` |

**Tiempo real.** Publica a ambos topics de enrollments (ADR-087), mismo
`EnrollmentInstitutionPayload`/`EnrollmentGuardianPayload` que
`approve`/`reject`, ahora con `status: "withdrawn"`.

**Auditoría.** Registra una fila en `audit_log` con
`action = enrollment.withdrawn` — `actor_user_id` es quien ejecutó la
acción, tutor o miembro de institución según el caso.

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
- ADR-057 (`GET /enrollments/mine` enriquecido con `institutionName`,
  `institutionType`, `institutionCategory`; `GET /enrollments?institutionId=...`
  sin cambios).
- ADR-083 (`gradeOrGroup` opcional en `approve`; endpoint nuevo, luego
  renombrado por ADR-084, para matrículas ya `approved`).
- ADR-084 (`gradeOrGroup`→`groupId`/`grade`→`group` en los tres DTOs de
  escritura; 422 `GROUP_NOT_IN_INSTITUTION`; respuestas de lectura sin
  cambio de nombre; `specs/api-contracts/institution-groups.md`, el CRUD del
  catálogo).
- `specs/features/029-editar-grupo-alumno.md` (pantalla "Alumnos" del
  portal, consumidora de `PATCH /enrollments/:id/group`).
- ADR-087 (`specs/api-contracts/enrollments-ws.md`): canal WebSocket que
  extiende este snapshot REST con deltas en vivo — `create` publica al
  topic de institución, `approve`/`reject` a ambos (institución + tutor).
- ADR-088 (`DELETE /enrollments/:id` para cancelar un `pending`;
  `PATCH /enrollments/:id/withdraw`, endpoint único para tutor e
  institución, para dar de baja un `approved`).

## Preguntas abiertas

Ninguna: las dos preguntas que tenía este contrato (visibilidad de
instituciones no aprobadas, restricción de rol para aprobar/rechazar) se
resolvieron en ADR-019.
