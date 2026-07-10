# Feature 017 — Gestionar tutores autorizados

## Propósito

Un tutor con acceso a un alumno consulta la lista de tutores autorizados
(`student_guardians`) de ese alumno, revoca el acceso de alguno y reasigna la
primariedad (`is_primary`) entre guardianes. Es el control sobre quién sigue
autorizado a operar sobre un alumno, complementario a la invitación (feature
015).

## Entidades involucradas

- `student_guardian` (leído; actualizado al revocar)
- `student` (leído, para autorización: quien gestiona debe ser guardián del
  alumno)

## Precondiciones

- **Listar:** quien consulta debe ser `student_guardian` del `student`
  correspondiente (autorización por relación de datos, ver
  `specs/api-contracts/students.md`).
- **Revocar y reasignar primariedad:** reservado al `student_guardian` con
  `is_primary = true` y `status = active` del alumno (ADR-023, punto 5): solo el
  guardián principal administra a los demás. Es la misma autoridad que para
  invitar (ADR-023 punto 2).
- Revocar solo aplica a un `student_guardian` que no esté ya en `status =
  revoked`: `revoked` es **terminal** (ADR-018, punto 7), no se reactiva
  in-place. Para restablecer el vínculo se envía una nueva invitación (feature
  015), que crea una **fila nueva** — no reactiva la fila `revoked` (el índice
  único parcial la excluye, ADR-026 punto 1). No existe una acción de
  "reactivar".
- **Protección del principal / último guardián activo (ADR-023, punto 5):** no se
  puede revocar a un `student_guardian` con `is_primary = true` sin **reasignar
  antes** la primariedad a otro guardián `active`. Esto incluye la
  auto-revocación del propio principal: para retirarse, primero reasigna
  `is_primary` a otro guardián activo. Evita que el alumno quede sin ningún
  guardián activo.

## Postcondiciones

### Al listar
- Se devuelven los `student_guardians` del alumno, con su `relationship`,
  `is_primary` y `status` (`active | invited | revoked`).

### Al revocar
- El `student_guardian` indicado pasa a `status = revoked`. A partir de ahí esa
  persona deja de estar autorizada a operar sobre el alumno (solo `status =
  active` autoriza — ver `specs/entities/student_guardian.md`). La transición es
  terminal: no puede volver a `active` desde `revoked` (ADR-018 punto 7).

### Al reasignar la primariedad
- Fijar `is_primary = true` sobre otro `student_guardian` `active` desmarca al
  principal anterior, de modo que nunca coexistan dos principales (índice único
  parcial, ADR-018 punto 6). Es el paso previo obligatorio para poder revocar al
  principal actual (ADR-023 punto 5).

## Casos Given/When/Then

### Caso de éxito — listar

```
Given un student con varios student_guardians
  And quien consulta es guardián de ese student
When solicita la lista de tutores autorizados
Then se devuelven los student_guardians con relationship, is_primary y status
```

### Caso de éxito — revocar un guardián no principal

```
Given un student_guardian objetivo con status = active o invited y
      is_primary = false
  And quien revoca es el student_guardian is_primary = true y activo del alumno
When revoca ese student_guardian objetivo
Then su status pasa a revoked
  And deja de estar autorizado a operar sobre el alumno
```

### Caso: revocar uno ya revocado

```
Given un student_guardian con status = revoked
When se intenta revocarlo de nuevo
Then la operación falla (revoked es terminal, no hay transición desde revoked —
     ADR-018 punto 7)
```

### Caso: intento de revocar al principal sin reasignar antes

```
Given el student_guardian con is_primary = true del alumno
When se intenta revocarlo (por otro o por sí mismo) sin haber reasignado antes
     la primariedad a otro guardián activo
Then la operación se rechaza (ADR-023 punto 5: no se revoca al principal sin
     reasignar la primariedad primero)
```

### Caso de éxito — reasignar primariedad y luego revocar al ex-principal

```
Given un alumno con guardián A (is_primary = true) y guardián B (active)
When A reasigna is_primary = true a B
Then B queda is_primary = true y A queda is_primary = false
  And a partir de ahí B (ahora principal) puede revocar a A si procede
```

### Caso: revocar/administrar sin ser el principal

```
Given un student
  And quien intenta revocar o reasignar primariedad NO es el student_guardian
      is_primary = true y activo de ese student (es un guardián no principal, o
      no es guardián)
When intenta la operación
Then se rechaza por falta de autorización (ADR-023 punto 5)
```

### Caso: listar sin ser guardián del alumno

```
Given un student
  And quien intenta listar NO es student_guardian de ese student
When solicita la lista de tutores
Then se rechaza por falta de autorización
```

## Referencia a contrato de API

Ver `specs/api-contracts/student-guardians.md` —
`GET /students/:id/guardians` y `PATCH /student-guardians/:id` (que cubre tanto
revocar, `status = revoked`, como reasignar la primariedad, `isPrimary = true`).

## Referencia a MQTT

No aplica: la gestión de tutores autorizados no publica ni consume topics MQTT.

## Referencias

- ADR-018 (punto 6: índice único parcial de `is_primary` por `student_id`;
  punto 7: `status = revoked` terminal, requiere nueva invitación para
  restablecer).
- ADR-023 (punto 5: solo el guardián `is_primary` revoca y reasigna
  primariedad; no se revoca al principal sin reasignar antes; auto-revocación
  del principal solo tras reasignar).
- ADR-026 (punto 1: el índice único parcial excluye `revoked`, por lo que la
  nueva invitación de feature 015 crea una fila nueva; punto 3: protección del
  guardián principal responde 422).
- `specs/entities/student_guardian.md`, `specs/entities/student.md`.
- `specs/features/015-invitar-tutor-autorizado.md` (nueva invitación para
  restablecer un vínculo revocado).
- `specs/api-contracts/students.md` (autorización por relación de datos).

## Preguntas abiertas

Ninguna: la autorización para revocar (solo el guardián `is_primary`), la
protección del principal/último guardián activo (reasignar antes de revocar) y la
auto-revocación (permitida solo tras reasignar la primariedad) se resolvieron en
ADR-023 (punto 5).
