# Feature 015 — Invitar tutor autorizado

## Propósito

Un tutor con acceso a un alumno invita, por correo electrónico, a otra persona
para que también sea tutor autorizado (`student_guardian`) de ese mismo alumno,
con un `relationship` (`mother`, `father`, `grandparent`, `driver`, `other`).
Es cómo un alumno pasa de tener un solo tutor (el que lo registró en
`specs/features/004-alta-alumno.md`, que queda `is_primary = true`) a varios
(madre, padre, abuela, chofer). Estructura paralela a
`specs/features/012-invitar-personal.md`.

El resultado siempre es una fila en `student_guardian` para ese `(student,
guardián)`. El camino depende de si el correo invitado ya corresponde a un
`user`.

## Entidades involucradas

- `student_guardian` (creado)
- `user` (leído; creado con `status = invited` solo en el caso de correo nuevo)
- `student` (leído, para autorización: el invitador debe ser guardián del alumno)

## Precondiciones

- Quien invita debe ser el `student_guardian` con **`is_primary = true` y
  `status = active`** del `student` al que invita (ADR-023, punto 2): solo el
  guardián principal invita tutores adicionales. Un guardián no principal, o uno
  `invited`/`revoked`, no puede invitar. Autorización por relación de datos, ver
  `specs/api-contracts/students.md`.
- El `relationship` a asignar debe ser uno de los valores del enum de
  `student_guardian.relationship`: `mother`, `father`, `grandparent`, `driver`,
  `other` (ver `specs/entities/student_guardian.md`).

## Postcondiciones

Nota: a diferencia de `institution_members` (que no tiene `status`),
`student_guardians` **sí tiene su propia columna `status`**
(`active | invited | revoked`, default `invited` — ver
`specs/entities/student_guardian.md`). El estado "Invitado" de un tutor vive en
esa columna, no se deriva únicamente de `users.status`.

En ambas ramas la fila `student_guardian` nace en `status = invited` y la
persona invitada debe **aceptar** para pasar a `active` — es un consentimiento
explícito a quedar autorizada sobre un alumno ajeno (ADR-023, punto 3). Por eso
en las dos ramas se envía correo de invitación vía `EmailProvider`.

### Caso (a) — el correo ya es un `user` existente y `active`
- No se crea un `user` nuevo.
- Se crea la fila `student_guardian` con `student_id`, `guardian_user_id` (el
  user existente), el `relationship` indicado, `is_primary = false` y
  `status = invited`.
- Se envía el correo de invitación: la persona debe aceptar para que su
  `student_guardian` pase a `active` (ADR-023 punto 3). Su aceptación **no**
  define contraseña ni verifica correo (el `user` ya está `active`); solo
  transiciona el `student_guardian` (ver feature 016).
- Se respeta la restricción única `(student_id, guardian_user_id)`: si ese user
  ya es guardián de ese alumno, la invitación se rechaza.

### Caso (b) — el correo NO existe como `user`
- Se crea un `user` nuevo con `status = invited` y `password_hash = NULL` (sin
  contraseña): `password_hash` es nullable precisamente para este caso (ADR-022,
  punto 2, ya aplicado en `specs/entities/user.md`); la contraseña se define al
  aceptar la invitación (feature 016).
- Se crea la fila `student_guardian` con `status = invited`, `is_primary = false`
  y el `relationship` indicado.
- Se dispara el envío del correo de invitación (vía el port `EmailProvider`, ver
  ADR-017) con el link de aceptación; el flujo se detalla en
  `specs/features/016-aceptar-invitacion-tutor.md`.

## Casos Given/When/Then

### Caso de éxito — correo de un user existente y activo

```
Given un student cuyo student_guardian is_primary = true y activo invita
  And el correo invitado ya corresponde a un user con status = active que NO es
      guardián de ese student
When se envía la invitación con un relationship válido
Then se crea la fila student_guardian con status = invited (no un user nuevo)
  And se envía el correo de invitación vía EmailProvider (aceptación sin
      contraseña; ver feature 016)
```

### Caso de éxito — correo nuevo (no existe user)

```
Given un student cuyo student_guardian is_primary = true y activo invita
  And el correo invitado NO corresponde a ningún user
When se envía la invitación con un relationship válido
Then se crea un user con status = invited y password_hash = NULL
  And se crea la fila student_guardian con status = invited
  And se envía el correo de invitación vía EmailProvider (ver feature 016)
```

### Caso: el correo ya es guardián de este alumno

```
Given un user que ya es student_guardian de ese student (en cualquier status)
When se intenta invitarlo de nuevo al mismo student
Then la operación se rechaza por la restricción única (student_id,
     guardian_user_id) (specs/entities/student_guardian.md)
  And no se crea una segunda fila
```

### Caso: relationship fuera del enum

```
Given un student con un student_guardian activo que invita
When se intenta invitar con un relationship que no es mother, father,
     grandparent, driver ni other
Then la operación se rechaza por relationship inválido (fuera del enum)
```

### Caso: quien invita no es el guardián principal del alumno

```
Given un student
  And quien intenta invitar NO es el student_guardian con is_primary = true y
      status = active de ese student (es un guardián no principal, o su status
      es invited/revoked, o no es guardián en absoluto)
When se intenta invitar a otra persona como guardián de ese student
Then la operación se rechaza por falta de autorización (solo el principal
     invita, ADR-023 punto 2)
```

## Referencia a contrato de API

Ver `specs/api-contracts/student-guardians.md` —
`GET /students/:id/guardians` y `POST /students/:id/guardians/invite`. La
aceptación de invitación del caso (b) se detalla en la feature 016.

## Referencia a MQTT

No aplica: la invitación de tutor viaja por correo (`EmailProvider`, ver
ADR-017), no por MQTT — consistente con ADR-009 (MQTT se reserva para eventos
operativos de recogida en tiempo real; los eventos de cuenta van por correo).

## Referencias

- ADR-009 (correo transaccional para eventos de cuenta, incluida la invitación).
- ADR-017 (`EmailProvider` como port).
- ADR-018 (punto 6: índice único parcial de `is_primary` por `student_id`;
  punto 7: `status = revoked` terminal).
- ADR-022 (punto 2: `password_hash` nullable para el `user` invitado).
- ADR-023 (punto 2: solo el guardián `is_primary` invita; punto 3: la invitación
  siempre requiere aceptación, incluso para un `user` ya activo).
- `specs/entities/student_guardian.md` (con columna `status`; único
  `(student_id, guardian_user_id)`), `specs/entities/user.md`,
  `specs/entities/student.md`.
- `specs/features/004-alta-alumno.md` (el creador queda como guardián
  `is_primary = true`),
  `specs/features/012-invitar-personal.md` (invitación paralela de personal),
  `specs/features/016-aceptar-invitacion-tutor.md`.
- `specs/api-contracts/students.md` (autorización por relación de datos).

## Preguntas abiertas

Ninguna: la autorización para invitar (solo el guardián `is_primary`) y la
necesidad de aceptación también en la rama (a) (`user` ya activo) se resolvieron
en ADR-023 (puntos 2 y 3).
