# API Contract — Students

Recurso de alumnos. Cubre `specs/features/004-alta-alumno.md`.

## Autenticación

Ambos endpoints requieren access token válido (cualquier `user`, no solo
tutores formalmente — la autorización se resuelve por relación de datos, no
por rol fijo, ya que "tutor" no es un flag en `user`, ver
`specs/entities/user.md`).

## Reglas de autorización

Un usuario solo puede ver o crear alumnos donde él mismo sea
`student_guardian`. No hay concepto de "ver todos los alumnos" para ningún
rol en este contrato (ni siquiera super-admin — fuera de alcance de este
slice; reportes agregados de super-admin se definirán en otra ronda).

## `POST /students`

Ver feature 004. Crea el `student` y, como postcondición del feature, la
fila de `student_guardian` correspondiente en la misma operación.

**Request**
```json
{
  "fullName": "string",
  "birthDate": "string (date) | null",
  "photoUrl": "string | null",
  "relationship": "mother | father | grandparent | driver | other"
}
```

`relationship` es requerido aquí porque alimenta la fila de
`student_guardian` creada automáticamente (ver feature 004); no es un campo
de la tabla `students`.

**Response 201**
```json
{
  "id": "uuid",
  "fullName": "string",
  "birthDate": "string | null",
  "photoUrl": "string | null",
  "createdByUserId": "uuid"
}
```

**Errores**
| Código | Caso |
|---|---|
| 400 | payload inválido (`fullName` faltante, `relationship` fuera del enum) |
| 401 | no autenticado |

## `GET /students`

Lista los alumnos del usuario autenticado, filtrando por
`student_guardian.guardian_user_id = sub` (no por `student.created_by_user_id`
— un tutor puede ver alumnos de los que es guardián aunque no los haya
creado él, si en el futuro otro tutor lo autoriza).

**Response 200**
```json
{
  "students": [
    {
      "id": "uuid",
      "fullName": "string",
      "birthDate": "string | null",
      "photoUrl": "string | null",
      "guardianRelationship": "mother | father | grandparent | driver | other",
      "guardianStatus": "active | invited | revoked",
      "isPrimaryGuardian": "boolean"
    }
  ]
}
```

Los tres últimos campos provienen de la fila de `student_guardian` del
usuario autenticado para ese alumno, no de `student` directamente.

**Errores**
| Código | Caso |
|---|---|
| 401 | no autenticado |

## Referencias

- `specs/features/004-alta-alumno.md`.
- `specs/entities/student.md`, `specs/entities/student_guardian.md`.

## Preguntas abiertas

Ninguna adicional a las ya listadas en `specs/features/004-alta-alumno.md`
(que no dejó ninguna pendiente).
