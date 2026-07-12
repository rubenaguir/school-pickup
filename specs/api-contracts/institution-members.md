# API Contract — Institution Members

Recurso de personal de una institución. Cubre
`specs/features/012-invitar-personal.md` y
`specs/features/013-aceptar-invitacion-personal.md`.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md`. Para los endpoints anidados bajo
`/institutions/:id/...` y `PATCH /institution-members/:id`, el usuario
autenticado debe ser `institution_members` de la institución correspondiente,
verificado por `InstitutionMembershipGuard` (ADR-022, punto 4): en las rutas
anidadas lee el `institutionId` de la ruta; en el `PATCH` resuelve la
institución de la propia membresía con una consulta mínima al repositorio. Un
usuario de otra institución recibe 403.

Rol requerido para escritura (`POST .../invite`, `PATCH .../:id`):
**`role = admin`** (ADR-022, punto 1). La lectura (`GET`) está disponible para
cualquier `institution_members` de la institución.

`POST /invitations/:token/accept` es la excepción: es de **acceso público** (no
requiere access token existente), porque quien acepta una invitación de correo
nuevo todavía no tiene sesión. Se autentica con el token de invitación (JWT de
corta duración) como credencial de un solo propósito, igual que la verificación
de correo (ver `specs/api-contracts/auth.md`).

## `GET /institutions/:id/members`

Lista el personal de la institución. Ver feature 012. El estado "Invitado" se
**deriva de `users.status`** (`institution_members` no tiene columna `status` —
ver `specs/entities/institution_member.md`).

**Request:** sin body.

**Response 200**
```json
{
  "members": [
    {
      "id": "uuid",
      "institutionId": "uuid",
      "userId": "uuid",
      "role": "admin | gate_operator | coordinator | teacher",
      "fullName": "string | null",
      "email": "string",
      "userStatus": "active | invited | suspended",
      "createdAt": "string (timestamptz)"
    }
  ]
}
```

`userStatus` proviene de `users.status` (join con `users`), no de una columna de
`institution_members`. Un miembro con `userStatus = invited` es el que la UI
muestra como "Invitado". `fullName` es `null` cuando el `users` referenciado
fue creado por invitación (feature 012, rama de correo nuevo) y todavía no
acepta — su nombre real recién se conoce al aceptar
(`POST /invitations/:token/accept`, feature 013). Ver ADR-030.

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |

No hay un caso 404 "la institución no existe" separado en esta ruta anidada:
`InstitutionMembershipGuard`, en modo ruta anidada, no distingue institución
inexistente de institución existente sin membresía — ambos casos devuelven
`403 NOT_INSTITUTION_MEMBER`. Ver `docs/arquitectura.md`.

## `POST /institutions/:id/members/invite`

Invita a una persona por correo con un `role`. Ver feature 012. El
comportamiento depende de si el correo ya corresponde a un `users`:
- correo de un `users` existente y `active`: se crea solo el `institution_members`;
- correo nuevo: se crea un `users` con `status = invited` y `password_hash = NULL`
  (nullable, ADR-022 punto 2) y se envía el correo de invitación vía
  `EmailProvider` (ver feature 013);
- correo de un `users` en `status = invited` que ya es miembro de esta
  institución: actúa como **reenvío** (ADR-022 punto 5) — genera un token nuevo,
  reenvía el correo y no crea un `institution_members` duplicado. No es este
  endpoint el único de reenvío: no hay uno separado.

**Request**
```json
{
  "email": "string",
  "role": "admin | gate_operator | coordinator | teacher"
}
```

**Response 201**
```json
{
  "member": {
    "id": "uuid",
    "institutionId": "uuid",
    "userId": "uuid",
    "role": "admin | gate_operator | coordinator | teacher"
  },
  "userStatus": "active | invited",
  "invitationSent": "boolean"
}
```

`userStatus = active` e `invitationSent = false` cuando el correo era de un
`users` ya activo (caso (a)); `userStatus = invited` e `invitationSent = true`
cuando se creó un `users` nuevo (caso (b)) o cuando se reenvió a un `users`
todavía `invited` que ya era miembro (reenvío, ADR-022 punto 5).

**Auditoría.** El alta de personal registra una fila en `audit_log` con
`action = institution_member.added` (alta de personal = acción sensible según
`CLAUDE.md`; convención libre `entity.verb`, ADR-018 punto 9; ADR-025 punto 6).

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`email` mal formado, `role` fuera del enum) |
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 409 | el `users` invitado ya es `institution_members` **activo** de esa institución (un miembro todavía `invited` no da 409: se reenvía la invitación, ADR-022 punto 5) |

No hay un caso 404 "la institución no existe" separado en esta ruta anidada:
`InstitutionMembershipGuard`, en modo ruta anidada, no distingue institución
inexistente de institución existente sin membresía — ambos casos devuelven
`403 NOT_INSTITUTION_MEMBER`. Ver `docs/arquitectura.md`.

## `POST /invitations/:token/accept`

Acepta una invitación del caso de correo nuevo: la persona define su contraseña
por primera vez (se llena `password_hash`, hasta ahora `NULL` — ADR-022 punto 2)
y su `users.status` pasa a `active`. Ver feature 013. Endpoint de acceso público
(autenticado por el token de invitación en la ruta), servido por el mismo
mecanismo de activación por token que la verificación de correo, parametrizado
para fijar contraseña (ADR-022 punto 3).

Este endpoint es **compartido** entre la aceptación de personal (feature 013) y la
de tutor autorizado (feature 016); distingue el tipo de invitación por el payload
del token (ADR-023 punto 4). El chequeo de "invitación ya completada" (error 409)
se resuelve **según el tipo de invitación**, no siempre contra `users.status`:
- **invitación de personal:** ya completada si `users.status = active` (no hay un
  `status` propio del `institution_members`);
- **invitación de tutor:** ya completada si `student_guardians.status = active` — no
  se mira `users.status`, porque el `users` puede estar `active` desde antes (p. ej.
  ya es tutor en otra institución) mientras su vínculo con este alumno sigue
  `invited` (ADR-025 punto 7).

**Request**
```json
{ "password": "string", "fullName": "string" }
```

Para la invitación de personal, `fullName` es siempre obligatorio junto con
`password`: el único origen de un `institution_member_invitation` es la rama
de correo nuevo (feature 012), donde `users.password_hash` y `users.full_name`
nacen `NULL` y se llenan por primera vez en este paso (ADR-022 punto 2,
ADR-030). (La rama de tutor sí puede recibir un `users` ya `active` desde
antes — ver `specs/api-contracts/student-guardians.md` — pero ese caso no
aplica a personal.)

**Response 200**
```json
{ "status": "active" }
```

**Errores**
| Código | Caso |
|---|---|
| 400 | token con firma inválida o malformado, o `password` faltante/ inválida |
| 410 | token con firma válida pero expirado (hace falta una nueva invitación — ver Preguntas abiertas de feature 013) |
| 409 | la invitación ya fue aceptada — resuelto según el tipo de invitación del token: personal → `users.status = active`; tutor → `student_guardians.status = active` (ADR-023 punto 4, ADR-025 punto 7) |

**Auditoría.** Al aceptar una invitación de **personal**, se registra una fila en
`audit_log` con `action = institution_member.accepted` (la aceptación de tutor se
registra como `student_guardian.accepted`, ver
`specs/api-contracts/student-guardians.md`). ADR-018 punto 9; prefijo
`student_guardian.*` consolidado en ADR-026 punto 5.

## `PATCH /institution-members/:id`

Cambia el `role` de un miembro existente. Ver feature 012. **Protección del
último admin (ADR-022 punto 5):** no puede degradarse (ni darse de baja) al
único miembro con `role = admin` de la institución; dejaría al plantel sin nadie
capaz de aprobar enrollments, gestionar personal o editar la configuración.

**Request**
```json
{ "role": "admin | gate_operator | coordinator | teacher" }
```

**Response 200**
```json
{
  "id": "uuid",
  "institutionId": "uuid",
  "userId": "uuid",
  "role": "admin | gate_operator | coordinator | teacher"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | `role` fuera del enum |
| 403 | el usuario autenticado no es `institution_members` de la institución del miembro |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | el `institution_members` no existe |
| 422 | el miembro es el único con `role = admin` de la institución y el cambio lo degradaría (protección del último admin, ADR-022 punto 5) |

**Auditoría.** El cambio de rol registra una fila en `audit_log` con
`action = institution_member.role_changed` (ADR-018 punto 9; ADR-025 punto 6).

## `DELETE /institution-members/:id`

Da de baja a un miembro del personal de la institución. Ver feature 012.
**Elimina únicamente la fila de `institution_members`**; el `users` no se borra (puede
seguir existiendo como tutor o como personal de otra institución). **Protección del
último admin (ADR-022 punto 5, ADR-025 punto 9):** no puede darse de baja al único
miembro con `role = admin` de la institución (dejaría al plantel sin nadie capaz de
aprobar enrollments, gestionar personal o editar la configuración) — mismo criterio
que el `PATCH`.

Autorización: **`role = admin`** de la institución (ADR-022 punto 1); el
`InstitutionMembershipGuard` resuelve la institución desde la propia membresía del
recurso (ADR-022 punto 4), igual que el `PATCH`.

**Request:** sin body.

**Response 204** (sin body)

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de la institución del miembro |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | el `institution_members` no existe |
| 422 | el miembro es el único con `role = admin` de la institución (protección del último admin, ADR-022 punto 5, ADR-025 punto 9) |

**Auditoría.** La baja registra una fila en `audit_log` con
`action = institution_member.removed` (baja de personal = acción sensible según
`CLAUDE.md`; convención libre `entity.verb`, ADR-018 punto 9; ADR-025 puntos 6 y 9).

## Referencias

- `specs/features/012-invitar-personal.md`,
  `specs/features/013-aceptar-invitacion-personal.md`.
- `specs/entities/institution_member.md` (sin columna `status`; único
  `(institution_id, user_id)`), `specs/entities/user.md` (`status` enum;
  `password_hash` nullable), `specs/entities/institution.md`.
- `specs/api-contracts/auth.md` (patrón de token de un solo propósito para
  verificación de correo, análogo al de invitación).
- `docs/arquitectura.md` (aislamiento multi-tenant).
- ADR-009 (invitación por correo transaccional).
- ADR-011 (roles de `institution_members`; acceso operativo no restringido por
  `role`).
- ADR-017 (`EmailProvider` como port).
- ADR-019 (punto 2: `status = invited`; punto 5: restricción a `role = admin`).
- ADR-022 (punto 1: invitar y cambiar roles exige `role = admin`; punto 2:
  `password_hash` nullable; punto 3: activación por token parametrizada; punto 4:
  `InstitutionMembershipGuard`; punto 5: protección del último admin y reenvío
  vía re-invitación).
- ADR-023 (punto 4: endpoint de aceptación compartido, parametrizado por tipo de
  invitación).
- ADR-025 (punto 6: registro en `audit_log` de `institution_member.added` /
  `institution_member.accepted` / `institution_member.role_changed` /
  `institution_member.removed`; punto 7: chequeo de "ya aceptada" según el tipo de
  invitación en `POST /invitations/:token/accept`; punto 9: endpoint
  `DELETE /institution-members/:id` con protección del último admin).
- ADR-030 (`users.full_name` nullable — mismo patrón que `password_hash`,
  ADR-022 punto 2 — mientras un `users` invitado no acepta).
- `specs/entities/audit_log.md`.

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`), la nulabilidad de `password_hash`,
la protección del último admin, el reenvío de invitación y el mecanismo de
aislamiento multi-tenant (`InstitutionMembershipGuard`) se resolvieron en
ADR-022 (puntos 1–5).
