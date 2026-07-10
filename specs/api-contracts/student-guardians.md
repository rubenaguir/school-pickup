# API Contract — Student Guardians

Recurso de tutores autorizados por alumno. Cubre
`specs/features/015-invitar-tutor-autorizado.md`,
`specs/features/016-aceptar-invitacion-tutor.md` y
`specs/features/017-gestionar-tutores-autorizados.md`. El alta del primer
guardián (el creador del alumno) vive en `specs/features/004-alta-alumno.md` /
`specs/api-contracts/students.md`, no aquí.

## Autenticación

`GET /students/:id/guardians`, `POST /students/:id/guardians/invite` y
`PATCH /student-guardians/:id` requieren access token válido. No hay restricción
por rol ("tutor" no es un flag en `users`, ver `specs/entities/user.md`).

## Reglas de autorización

La autorización es por relación de datos (patrón de
`specs/api-contracts/students.md`):
- **Listar** (`GET`): cualquier `student_guardians` del alumno (cualquier
  `status`... salvo lo que se resuelva en features futuras; en este slice basta
  ser guardián del alumno).
- **Invitar, revocar y reasignar primariedad** (`POST .../invite` y
  `PATCH /student-guardians/:id`): reservado al `student_guardians` con
  `is_primary = true` y `status = active` del alumno (ADR-023, puntos 2 y 5).
  Solo el guardián principal administra a los demás; un guardián no principal, o
  uno `invited`/`revoked`, recibe 403.

## `GET /students/:id/guardians`

Lista los tutores autorizados del alumno. Ver feature 017.

**Request:** sin body.

**Response 200**
```json
{
  "guardians": [
    {
      "id": "uuid",
      "guardianUserId": "uuid",
      "fullName": "string",
      "email": "string",
      "relationship": "mother | father | grandparent | driver | other",
      "isPrimary": "boolean",
      "status": "active | invited | revoked"
    }
  ]
}
```

`fullName` y `email` provienen del `users` vinculado (join); el resto, de la fila
`student_guardians`.

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |
| 403 | el usuario autenticado no es `student_guardians` de ese `:id` |
| 404 | el `students` no existe |

## `POST /students/:id/guardians/invite`

Invita a una persona por correo a ser tutor autorizado del alumno, con un
`relationship`. Ver feature 015. Solo el guardián `is_primary` invita (ADR-023
punto 2). El comportamiento depende de si el correo ya corresponde a un `users`;
en **ambos casos** la fila `student_guardians` nace en `status = invited`, se
envía correo de invitación y la persona debe aceptar para pasar a `active`
(ADR-023 punto 3):
- correo de un `users` existente y `active`: se crea solo la fila
  `student_guardians`; la aceptación no define contraseña (ver feature 016);
- correo nuevo: se crea un `users` con `status = invited` y `password_hash = NULL`
  (nullable, ADR-022 punto 2); la aceptación define su contraseña (feature 016).

**Request**
```json
{
  "email": "string",
  "relationship": "mother | father | grandparent | driver | other"
}
```

**Response 201**
```json
{
  "guardian": {
    "id": "uuid",
    "studentId": "uuid",
    "guardianUserId": "uuid",
    "relationship": "mother | father | grandparent | driver | other",
    "isPrimary": false,
    "status": "invited"
  },
  "userStatus": "active | invited",
  "invitationSent": "boolean"
}
```

`userStatus` distingue si se creó un `users` nuevo (`invited`) o si el correo era
de un `users` ya existente (`active`). `invitationSent = true` en ambas ramas: la
invitación siempre se envía y siempre requiere aceptación (ADR-023 punto 3). La
fila `student_guardians` nace siempre en `status = invited`.

**Auditoría.** La invitación registra una fila en `audit_log` con
`action = student_guardian.added` (alta de tutor = acción sensible según
`CLAUDE.md`; convención libre `entity.verb`, ADR-018 punto 9; prefijo
`student_guardian.*` consolidado en ADR-026 punto 5).

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`email` mal formado, `relationship` fuera del enum) |
| 401 | no autenticado |
| 403 | el usuario autenticado no es el `student_guardians` `is_primary` y activo de ese `:id` (ADR-023 punto 2) |
| 404 | el `students` no existe |
| 409 | el `users` invitado ya es `student_guardians` **no terminal** (`invited` o `active`) de ese alumno (índice único parcial `(student_id, guardian_user_id) WHERE status IN ('invited', 'active')`; duplicidad genuina → 409). Un vínculo previo `revoked` no bloquea: la invitación crea una fila nueva (ADR-026 punto 1) |

## `PATCH /student-guardians/:id`

Cubre dos operaciones del guardián `is_primary` sobre otro guardián del mismo
alumno (ADR-023, punto 5), enviadas por separado:
1. **Revocar** (`status = revoked`): terminal (ADR-018 punto 7); no hay
   transición de vuelta ni "reactivar" — restablecer el vínculo se hace con una
   nueva invitación (`POST /students/:id/guardians/invite`).
2. **Reasignar la primariedad** (`isPrimary = true`): fija al guardián objetivo
   como principal y desmarca al anterior (índice único parcial, ADR-018 punto 6).
   Es el paso previo obligatorio para revocar al principal actual.

Ver feature 017. Un solo campo por request (`status` o `isPrimary`). No se editan
`relationship` ni se transiciona a `active`/`invited` por este endpoint.

**Request** (revocar)
```json
{ "status": "revoked" }
```

**Request** (reasignar primariedad)
```json
{ "isPrimary": true }
```

**Response 200**
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "guardianUserId": "uuid",
  "isPrimary": "boolean",
  "status": "active | invited | revoked"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | body inválido (ni `status = revoked` ni `isPrimary = true`; o `isPrimary = false`, que no se soporta — la primariedad se mueve fijándola en otro) |
| 401 | no autenticado |
| 403 | el usuario autenticado no es el `student_guardians` `is_primary` y activo de ese alumno (ADR-023 punto 5) |
| 404 | el `student_guardians` no existe |
| 422 | se intenta revocar a un `student_guardians` con `is_primary = true` sin reasignar antes la primariedad (obliga a reasignar la primariedad a otra fila `student_guardians`; misma clase de riesgo que la protección del último admin, que es 422; ADR-023 punto 5, corregido de 409 a 422 en ADR-026 punto 3) |
| 422 | se intenta reasignar la primariedad a un `student_guardians` que no está `active` (regla que cruza hacia el estado de otra fila `student_guardians`; corregido de 409 a 422 en ADR-026 punto 3) |
| 409 | el `student_guardians` ya está en `status = revoked` (conflicto del recurso con su propio estado: transición terminal, ADR-018 punto 7; 409 correcto bajo ADR-022 punto 5 ampliado por ADR-026 punto 2) |

**Auditoría.** Cada operación registra una fila en `audit_log`: la revocación con
`action = student_guardian.revoked` y la reasignación de primariedad con
`action = student_guardian.primary_reassigned` (baja/administración de tutor =
acción sensible según `CLAUDE.md`; ADR-018 punto 9; prefijo `student_guardian.*`
consolidado en ADR-026 punto 5).

## Aceptación de invitación

La aceptación (feature 016) **reutiliza el endpoint compartido**
`POST /invitations/:token/accept` (definido en
`specs/api-contracts/institution-members.md`), que distingue el tipo de
invitación por el payload del token (ADR-023, punto 4). Efecto según la rama:
- `users` nuevo (estaba `invited` sin contraseña): define contraseña,
  `users.status → active` y `student_guardians.status → active`;
- `users` ya `active`: solo `student_guardians.status → active` (sin tocar el
  `users`).
Ver `specs/features/016-aceptar-invitacion-tutor.md`.

**Auditoría.** La aceptación registra una fila en `audit_log` con
`action = student_guardian.accepted` (ADR-018 punto 9; prefijo
`student_guardian.*` consolidado en ADR-026 punto 5).

## Referencias

- `specs/features/015-invitar-tutor-autorizado.md`,
  `specs/features/016-aceptar-invitacion-tutor.md`,
  `specs/features/017-gestionar-tutores-autorizados.md`.
- `specs/entities/student_guardian.md`, `specs/entities/student.md`,
  `specs/entities/user.md`, `specs/entities/audit_log.md`.
- `specs/api-contracts/students.md` (autorización por relación de datos),
  `specs/api-contracts/institution-members.md` (endpoint de aceptación
  compartido candidato).
- ADR-009 (invitación por correo transaccional).
- ADR-017 (`EmailProvider` como port).
- ADR-018 (punto 6: `is_primary` único parcial; punto 7: `revoked` terminal).
- ADR-022 (punto 2: `password_hash` nullable; punto 3: activación por token
  parametrizada).
- ADR-023 (puntos 2–5: solo el guardián `is_primary` invita/revoca/reasigna;
  aceptación obligatoria en ambas ramas; reuso del endpoint de aceptación;
  protección del principal).
- ADR-025 (punto 6: registro en `audit_log` de estas acciones — nombradas
  entonces `guardian.*`).
- ADR-026 (punto 1: índice único parcial que excluye `revoked`; punto 3:
  protección del principal y reasignación a no `active` → 422; punto 5: prefijo
  canónico `student_guardian.*` en `audit_log.action`).

## Preguntas abiertas

Ninguna: quién puede invitar/revocar (solo el guardián `is_primary`), la
aceptación obligatoria también para el `users` ya activo, el reuso del endpoint
`POST /invitations/:token/accept` y la protección del principal (reasignar antes
de revocar) se resolvieron en ADR-023 (puntos 2–5).
