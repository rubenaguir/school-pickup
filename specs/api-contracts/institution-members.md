# API Contract — Institution Members

Recurso de personal de una institución. Cubre
`specs/features/012-invitar-personal.md` y
`specs/features/013-aceptar-invitacion-personal.md`.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md`. Para los endpoints anidados bajo
`/institutions/:id/...` y `PATCH /institution-members/:id`, el usuario
autenticado debe ser `institution_member` de la institución correspondiente,
verificado por `InstitutionMembershipGuard` (ADR-022, punto 4): en las rutas
anidadas lee el `institutionId` de la ruta; en el `PATCH` resuelve la
institución de la propia membresía con una consulta mínima al repositorio. Un
usuario de otra institución recibe 403.

Rol requerido para escritura (`POST .../invite`, `PATCH .../:id`):
**`role = admin`** (ADR-022, punto 1). La lectura (`GET`) está disponible para
cualquier `institution_member` de la institución.

`POST /invitations/:token/accept` es la excepción: es de **acceso público** (no
requiere access token existente), porque quien acepta una invitación de correo
nuevo todavía no tiene sesión. Se autentica con el token de invitación (JWT de
corta duración) como credencial de un solo propósito, igual que la verificación
de correo (ver `specs/api-contracts/auth.md`).

## `GET /institutions/:id/members`

Lista el personal de la institución. Ver feature 012. El estado "Invitado" se
**deriva de `users.status`** (`institution_member` no tiene columna `status` —
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
      "fullName": "string",
      "email": "string",
      "userStatus": "active | invited | suspended",
      "createdAt": "string (timestamptz)"
    }
  ]
}
```

`userStatus` proviene de `users.status` (join con `user`), no de una columna de
`institution_member`. Un miembro con `userStatus = invited` es el que la UI
muestra como "Invitado".

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_member` de esa `:id` |
| 404 | la institución no existe |

## `POST /institutions/:id/members/invite`

Invita a una persona por correo con un `role`. Ver feature 012. El
comportamiento depende de si el correo ya corresponde a un `user`:
- correo de un `user` existente y `active`: se crea solo el `institution_member`;
- correo nuevo: se crea un `user` con `status = invited` y `password_hash = NULL`
  (nullable, ADR-022 punto 2) y se envía el correo de invitación vía
  `EmailProvider` (ver feature 013);
- correo de un `user` en `status = invited` que ya es miembro de esta
  institución: actúa como **reenvío** (ADR-022 punto 5) — genera un token nuevo,
  reenvía el correo y no crea un `institution_member` duplicado. No es este
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
`user` ya activo (caso (a)); `userStatus = invited` e `invitationSent = true`
cuando se creó un `user` nuevo (caso (b)) o cuando se reenvió a un `user`
todavía `invited` que ya era miembro (reenvío, ADR-022 punto 5).

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`email` mal formado, `role` fuera del enum) |
| 403 | el usuario autenticado no es `institution_member` de esa `:id` |
| 403 | el usuario es `institution_member` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | la institución no existe |
| 409 | el `user` invitado ya es `institution_member` **activo** de esa institución (un miembro todavía `invited` no da 409: se reenvía la invitación, ADR-022 punto 5) |

## `POST /invitations/:token/accept`

Acepta una invitación del caso de correo nuevo: la persona define su contraseña
por primera vez (se llena `password_hash`, hasta ahora `NULL` — ADR-022 punto 2)
y su `users.status` pasa a `active`. Ver feature 013. Endpoint de acceso público
(autenticado por el token de invitación en la ruta), servido por el mismo
mecanismo de activación por token que la verificación de correo, parametrizado
para fijar contraseña (ADR-022 punto 3).

**Request**
```json
{ "password": "string" }
```

**Response 200**
```json
{ "status": "active" }
```

**Errores**
| Código | Caso |
|---|---|
| 400 | token con firma inválida o malformado, o `password` faltante/ inválida |
| 410 | token con firma válida pero expirado (hace falta una nueva invitación — ver Preguntas abiertas de feature 013) |
| 409 | la cuenta asociada al token ya está `active` (invitación ya aceptada) |

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
| 403 | el usuario autenticado no es `institution_member` de la institución del miembro |
| 403 | el usuario es `institution_member` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | el `institution_member` no existe |
| 422 | el miembro es el único con `role = admin` de la institución y el cambio lo degradaría (protección del último admin, ADR-022 punto 5) |

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
- ADR-011 (roles de `institution_member`; acceso operativo no restringido por
  `role`).
- ADR-017 (`EmailProvider` como port).
- ADR-019 (punto 2: `status = invited`; punto 5: restricción a `role = admin`).
- ADR-022 (punto 1: invitar y cambiar roles exige `role = admin`; punto 2:
  `password_hash` nullable; punto 3: activación por token parametrizada; punto 4:
  `InstitutionMembershipGuard`; punto 5: protección del último admin y reenvío
  vía re-invitación).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`), la nulabilidad de `password_hash`,
la protección del último admin, el reenvío de invitación y el mecanismo de
aislamiento multi-tenant (`InstitutionMembershipGuard`) se resolvieron en
ADR-022 (puntos 1–5).
