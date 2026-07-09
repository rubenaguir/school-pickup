# Feature 012 — Invitar personal a la institución

## Propósito

Un miembro de la institución invita a una persona, por correo electrónico, a
unirse al personal de su institución con un rol (`admin`, `gate_operator`,
`coordinator`, `teacher`). Es cómo crece el directorio de personal de una
institución después del alta (feature 001, que solo crea al primer `admin`).

El resultado siempre es una fila en `institution_member`. El camino hacia esa
fila depende de si el correo invitado ya corresponde a un `user` existente o no.

## Entidades involucradas

- `institution_member` (creado)
- `user` (leído; creado con `status = invited` solo en el caso de correo nuevo)
- `institution` (leído, para autorización multi-tenant)

## Precondiciones

- Quien invita debe ser `institution_member` de la `institution_id` a la que
  invita (aislamiento multi-tenant, ver `docs/arquitectura.md`).
- Invitar personal está **restringido a `role = admin`** de esa institución
  (ADR-022, punto 1): es una acción de configuración/identidad. `coordinator`,
  `teacher` y `gate_operator` no pueden invitar personal.
- El rol a asignar debe ser uno de los cuatro valores del enum de
  `institution_member.role`: `admin`, `gate_operator`, `coordinator`, `teacher`
  (ver `specs/entities/institution_member.md`).

## Postcondiciones

Nota importante sobre el estado "Invitado": `institution_member` **no tiene
columna `status`** (sus únicas columnas son `id`, `institution_id`, `user_id`,
`role`, `created_at` — ver `specs/entities/institution_member.md`). El estado
"Invitado" que se muestra en las pantallas de personal se **deriva de
`users.status = invited`**, no de un campo propio de la membresía. Esta feature
no agrega ninguna columna a `institution_member`.

### Caso (a) — el correo ya es un `user` existente y `active`
- No se crea un `user` nuevo ni se le pide verificar nada.
- Se crea únicamente la fila en `institution_member` vinculando ese `user` con
  la institución y el `role` indicado.
- Esa persona ya puede acceder a la institución con sus credenciales existentes
  de inmediato (ej. alguien que ya era tutor en la plataforma). Como su
  `users.status` sigue siendo `active`, en la lista de personal aparece como
  miembro activo, no como "Invitado".
- Se respeta la restricción única `(institution_id, user_id)`: si ese `user` ya
  es miembro de esa institución, la invitación se rechaza (no puede haber dos
  membresías del mismo usuario en la misma institución).

### Caso (b) — el correo NO existe como `user`
- Se crea un `user` nuevo con `status = invited` y `password_hash = NULL` (sin
  contraseña): a diferencia del auto-registro (features 001/002), donde el
  usuario define su contraseña de entrada, aquí la contraseña se define después,
  al aceptar la invitación (feature 013). `password_hash` es nullable
  precisamente para este caso (ADR-022, punto 2); se llena al activarse.
- Se crea la fila en `institution_member` con el `role` indicado, vinculada al
  `user` recién creado. Mientras `users.status = invited`, esa persona aparece
  como "Invitado" en la lista de personal y no puede iniciar sesión.
- Se dispara el envío del correo de invitación (vía el port `EmailProvider`, ver
  ADR-017) con el link de aceptación; el flujo de aceptación se detalla en
  `specs/features/013-aceptar-invitacion-personal.md`.

### Re-invitación (reenvío) — ADR-022, punto 5
- No existe un endpoint de reenvío separado para invitaciones de personal.
  Volver a invitar el mismo correo cuando su `user` sigue en `status = invited`
  (y cuyo `institution_member` ya se creó en la primera invitación) se comporta
  como **reenvío**: se genera un token nuevo y se reenvía el correo, **sin**
  crear un segundo `institution_member` (respeta el único
  `(institution_id, user_id)`). Difiere del auto-registro, que sí necesita un
  endpoint de reenvío propio porque el registro ya dejó una contraseña puesta.

## Casos Given/When/Then

### Caso de éxito — correo de un user existente y activo

```
Given una institution con status = approved
  And quien invita es institution_member con role = admin de esa institution
  And el correo invitado ya corresponde a un user con status = active que NO es
      miembro de esa institution
When se envía la invitación con un role válido
Then se crea solo una fila en institution_member (no un user nuevo)
  And esa persona puede acceder de inmediato con sus credenciales existentes
  And no se envía correo de definición de contraseña
```

### Caso de éxito — correo nuevo (no existe user)

```
Given una institution con status = approved
  And quien invita es institution_member con role = admin de esa institution
  And el correo invitado NO corresponde a ningún user
When se envía la invitación con un role válido
Then se crea un user con status = invited y sin contraseña
  And se crea la fila institution_member correspondiente
  And se envía el correo de invitación vía EmailProvider (ver feature 013)
  And en la lista de personal esa persona aparece como "Invitado"
      (derivado de users.status = invited)
```

### Caso: re-invitar a un miembro todavía invitado (reenvío)

```
Given un user con status = invited que ya es institution_member de la
      institution A (creado en una invitación previa que aún no acepta)
When se le vuelve a invitar a la institution A
Then la operación se comporta como reenvío (ADR-022 punto 5): genera un token
     nuevo y reenvía el correo de invitación
  And NO se crea una segunda membresía (respeta el único (institution_id,
      user_id))
```

### Caso: el correo ya es miembro activo de esta institución

```
Given un user con status = active que ya es institution_member de la
      institution A
When se intenta invitarlo de nuevo a la institution A
Then la operación se rechaza por conflicto (ya es miembro activo; restricción
     única (institution_id, user_id), specs/entities/institution_member.md)
  And no se crea una segunda membresía
```

### Caso: rol fuera del enum

```
Given una institution con status = approved
When se intenta invitar con un role que no es admin, gate_operator,
     coordinator ni teacher
Then la operación se rechaza por rol inválido (fuera del enum)
```

### Caso: quien invita no pertenece a la institución (multi-tenant)

```
Given una institution A
  And quien intenta invitar es institution_member únicamente de la institution B
When se intenta invitar personal a la institution A
Then la operación se rechaza por falta de autorización (aislamiento
     multi-tenant)
```

## Referencia a contrato de API

Ver `specs/api-contracts/institution-members.md` —
`GET /institutions/:id/members` y `POST /institutions/:id/members/invite`. El
cambio de rol de un miembro existente es `PATCH /institution-members/:id`; la
aceptación de invitación del caso (b) es `POST /invitations/:token/accept`
(feature 013).

## Referencia a MQTT

No aplica: la invitación de personal viaja por correo (`EmailProvider`, ver
ADR-017), no por MQTT — consistente con ADR-009 (MQTT se reserva para eventos
operativos de recogida en tiempo real; los eventos de cuenta van por correo).

## Referencias

- ADR-009 (correo transaccional para eventos de cuenta, incluida la invitación).
- ADR-011 (roles organizacionales de `institution_member`; `admin`,
  `gate_operator`, `coordinator`, `teacher`).
- ADR-017 (`EmailProvider` como port).
- ADR-019 (punto 2: `status = invited` para cuentas no verificadas; punto 5:
  restricción a `role = admin` de acciones sensibles).
- ADR-022 (punto 1: invitar exige `role = admin`; punto 2: `password_hash`
  nullable para el `user` invitado; punto 5: reenvío vía este mismo endpoint).
- `specs/entities/institution_member.md` (sin columna `status`; único
  `(institution_id, user_id)`), `specs/entities/user.md` (`status` enum;
  `password_hash` nullable), `specs/entities/institution.md`.
- `specs/features/013-aceptar-invitacion-personal.md` (flujo de aceptación del
  caso de correo nuevo).
- `docs/arquitectura.md` (aislamiento multi-tenant).

## Preguntas abiertas

Ninguna: el rol requerido (`role = admin`), la nulabilidad de `password_hash`
para el `user` invitado, y el comportamiento de reenvío se resolvieron en
ADR-022 (puntos 1, 2 y 5).
