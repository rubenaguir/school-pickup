# API Contract — Dismissal Exceptions

Recurso de días especiales (excepciones de horario) de una institución. Cubre
`specs/features/011-gestionar-dias-especiales.md`.

## Reglas de autorización (aislamiento multi-tenant)

Ver `docs/arquitectura.md`. El usuario autenticado debe ser
`institution_members` de la institución dueña de la excepción, verificado por
`InstitutionMembershipGuard` (ADR-022, punto 4). En los endpoints anidados bajo
`/institutions/:id/...` el guard lee el `institutionId` de la ruta; en `PATCH` y
`DELETE /dismissal-exceptions/:id` resuelve la institución de la excepción con
una consulta mínima al repositorio y la compara contra las membresías del
usuario. Un usuario de otra institución recibe 403.

Rol requerido para escritura (`POST`, `PATCH`, `DELETE`): **`role = admin`**
(ADR-022, punto 1). La lectura (`GET`) está disponible para cualquier
`institution_members` de la institución.

## `GET /institutions/:id/dismissal-exceptions`

Lista las excepciones de horario de la institución. Ver feature 011.

**Request:** sin body.

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `from` | no | fecha ISO (`YYYY-MM-DD`); filtra excepciones con `date >= from` |
| `to` | no | fecha ISO (`YYYY-MM-DD`); filtra excepciones con `date <= to` |

**Response 200**
```json
{
  "dismissalExceptions": [
    {
      "id": "uuid",
      "institutionId": "uuid",
      "date": "string (YYYY-MM-DD)",
      "name": "string",
      "level": "string | null",
      "time": "string (HH:mm)"
    }
  ]
}
```

`level = null` representa "todos los niveles".

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |

No hay un caso 404 "la institución no existe" separado en esta ruta anidada:
`InstitutionMembershipGuard`, en modo ruta anidada, no distingue institución
inexistente de institución existente sin membresía — ambos casos devuelven
`403 NOT_INSTITUTION_MEMBER`. Ver `docs/arquitectura.md`.

## `POST /institutions/:id/dismissal-exceptions`

Crea una excepción de horario. Ver feature 011.

**Request**
```json
{
  "date": "string (YYYY-MM-DD)",
  "name": "string",
  "level": "string | null",
  "time": "string (HH:mm)"
}
```

**Response 201**
```json
{
  "id": "uuid",
  "institutionId": "uuid",
  "date": "string (YYYY-MM-DD)",
  "name": "string",
  "level": "string | null",
  "time": "string (HH:mm)"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`date`/`time` mal formados, `name` faltante) |
| 403 | el usuario autenticado no es `institution_members` de esa `:id` |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 409 | ya existe una excepción para ese `(institutionId, date, level)` (restricción única, ADR-018 punto 10) |
| 422 | colisión `level = null` vs. nivel específico en la misma fecha (validación de capa de aplicación que consulta otras filas de `dismissal_exceptions`, ADR-018 punto 10 — no la atrapa el unique constraint; 422 por ADR-022 punto 5 ampliado por ADR-026 punto 3, mismo patrón que la reasignación de primariedad en `student_guardians` y `vehicles.newPrimaryVehicleId`, no 409) |

No hay un caso 404 "la institución no existe" separado en esta ruta anidada:
`InstitutionMembershipGuard`, en modo ruta anidada, no distingue institución
inexistente de institución existente sin membresía — ambos casos devuelven
`403 NOT_INSTITUTION_MEMBER`. Ver `docs/arquitectura.md`.

## `PATCH /dismissal-exceptions/:id`

Edita una excepción. Ver feature 011.

**Request** (todos los campos opcionales; edición parcial)
```json
{
  "date": "string (YYYY-MM-DD)",
  "name": "string",
  "level": "string | null",
  "time": "string (HH:mm)"
}
```

**Response 200**
```json
{
  "id": "uuid",
  "institutionId": "uuid",
  "date": "string (YYYY-MM-DD)",
  "name": "string",
  "level": "string | null",
  "time": "string (HH:mm)"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido |
| 403 | el usuario autenticado no es `institution_members` de la institución de la excepción |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | la excepción no existe |
| 409 | la edición choca con la restricción única `(institutionId, date, level)` (ADR-018 punto 10) |
| 422 | la edición produce la colisión `level = null` vs. nivel específico en la misma fecha (validación de capa de aplicación que consulta otras filas de `dismissal_exceptions`, ADR-018 punto 10; 422 por ADR-022 punto 5 ampliado por ADR-026 punto 3) |

## `DELETE /dismissal-exceptions/:id`

Borra físicamente una excepción (a diferencia de puntos de entrega y ventanas,
que se desactivan/pausan). Ver feature 011. Tras borrarla, el horario recurrente
de fondo vuelve a regir esa fecha.

**Request:** sin body.

**Response 204** (sin body)

**Errores**
| Código | Caso |
|---|---|
| 403 | el usuario autenticado no es `institution_members` de la institución de la excepción |
| 403 | el usuario es `institution_members` correcto, pero su `role` no es `admin` (ADR-022 punto 1) |
| 404 | la excepción no existe |

## Referencias

- `specs/features/011-gestionar-dias-especiales.md`.
- `specs/entities/dismissal_exception.md`,
  `specs/entities/institution_member.md`.
- `docs/arquitectura.md` (aislamiento multi-tenant).
- ADR-015 (excepciones puntuales como entidad separada).
- ADR-018 (punto 10: restricción única `(institution_id, date, level)` y la
  validación de capa de aplicación para `level = NULL`).
- ADR-019 (punto 5: restricción a `role = admin`).
- ADR-022 (punto 1: escritura exige `role = admin`; punto 4:
  `InstitutionMembershipGuard`; punto 5, ampliado por ADR-026 punto 3: 422
  para la colisión `level = null` vs. nivel específico, por ser una regla
  que consulta otra fila de la misma tabla, no el propio estado del
  recurso).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`) y el mecanismo de aislamiento
(`InstitutionMembershipGuard`) se resolvieron en ADR-022 (puntos 1 y 4).
