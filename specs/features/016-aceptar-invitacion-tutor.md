# Feature 016 — Aceptar invitación de tutor

## Propósito

Completa la invitación de la feature 015: una persona invitada a ser tutor
autorizado de un alumno recibe un correo con un link para aceptar. **La
aceptación es obligatoria en ambas ramas** (ADR-023, punto 3) y su efecto
depende del estado del `user`:
- **rama (b), `user` nuevo:** define su contraseña por primera vez, su cuenta
  pasa a `active` y su `student_guardian` pasa de `invited` a `active`;
- **rama (a), `user` ya `active`:** no define contraseña ni verifica correo;
  solo su `student_guardian` pasa de `invited` a `active` (consentimiento
  explícito a quedar autorizada sobre ese alumno).

## Entidades involucradas

- `user` (leído y actualizado: se fija la contraseña y `status` pasa a `active`)
- `student_guardian` (leído y actualizado: `status` pasa de `invited` a `active`)

## Precondiciones

- Existe la fila `student_guardian` con `status = invited` para ese
  `guardian_user_id` y `student_id`, creada por la feature 015.
- El `user` existe: en `status = invited` sin contraseña (rama (b)) o ya en
  `status = active` (rama (a)).
- El invitado presenta un token de invitación válido: JWT firmado de corta
  duración, sin persistencia en base de datos, que identifica la invitación
  (`guardian_user_id` y `student_id`). Es el mismo mecanismo de activación por
  token que la verificación de correo (feature 007) y la aceptación de personal
  (feature 013), unificado y parametrizado (ADR-022 punto 3; ADR-023 punto 3)
  según (a) si el paso define contraseña y (b) el efecto secundario sobre el
  vínculo que se acepta.

## Postcondiciones

- Al aceptar exitosamente, en **ambas ramas** el `student_guardian`
  correspondiente pasa de `status = invited` a `status = active`: la persona
  queda autorizada a operar sobre ese alumno (solo `status = active` autoriza —
  ver `specs/entities/student_guardian.md`).
- Además, **solo en la rama (b)** (`user` estaba `invited` sin contraseña): se
  establece por primera vez la contraseña del `user` (se guarda su hash en
  `password_hash`, hasta ahora `NULL` — ADR-022 punto 2) y `user.status` pasa de
  `invited` a `active`, satisfaciendo la invariante "un `user` `active` tiene
  `password_hash` no nulo".
- En la **rama (a)** (`user` ya `active`): no se toca el `user` (no define
  contraseña ni cambia su `status`); solo se transiciona el `student_guardian`.
- La validez del token se resuelve verificando firma y expiración, sin tabla que
  lo almacene ni lo revoque.

### Diferencia con la feature 013 (aceptar invitación de personal)

Ambas usan el mismo mecanismo de token, pero difieren en el efecto secundario
específico del vínculo que se acepta:
- **Feature 013:** solo activa el `user`; el `institution_member` no tiene
  `status` propio, así que no hay una segunda transición, y su rama de "correo
  ya existente y activo" no requiere aceptación (el miembro queda activo de
  inmediato).
- **Feature 016:** transiciona el `student_guardian` de `invited` a `active`
  (esta entidad sí tiene su propio `status`) — **siempre**, incluso cuando el
  `user` ya estaba `active` y no hay que tocar su cuenta (ADR-023 punto 3).

## Casos Given/When/Then

### Caso de éxito — rama (b): user nuevo

```
Given un user con status = invited y sin contraseña (creado por feature 015,
      rama de correo nuevo)
  And su student_guardian correspondiente con status = invited
  And un token de invitación válido (firma correcta, no expirado)
When la persona abre el link, define su contraseña y confirma
Then se guarda el hash de la contraseña del user
  And user.status pasa a active
  And student_guardian.status pasa a active
  And la persona queda autorizada como guardián de ese alumno
```

### Caso de éxito — rama (a): user ya activo

```
Given un user con status = active (invitado siendo ya usuario de la plataforma)
  And su student_guardian correspondiente con status = invited
  And un token de invitación válido (firma correcta, no expirado)
When la persona abre el link y confirma que acepta ser guardián
Then student_guardian.status pasa a active
  And el user no se modifica (no define contraseña ni cambia su status)
  And la persona queda autorizada como guardián de ese alumno
```

### Caso: token expirado

```
Given un token de invitación con firma válida pero expirado
When se intenta aceptar la invitación
Then la operación falla con un mensaje claro indicando que el enlace expiró
  And se indica que hace falta una nueva invitación (la re-invitación la genera
      un guardián del alumno desde la feature 015)
```

### Caso: token con firma inválida o malformado

```
Given un token que no fue emitido por el sistema (firma inválida) o está
      malformado
When se intenta aceptar la invitación
Then la operación falla con un error genérico de token inválido
```

### Caso: la cuenta ya está activa

```
Given un user cuyo status ya es active (la invitación ya fue aceptada antes)
When se intenta aceptar de nuevo con este flujo
Then la operación es idempotente/segura: no reactiva ni redefine credenciales
     y no degrada el vínculo ya active
```

## Referencia a contrato de API

La aceptación reutiliza el endpoint compartido
`POST /invitations/:token/accept` (definido en
`specs/api-contracts/institution-members.md`), que distingue el tipo de
invitación por el payload del token (ADR-023, punto 4). Ver también
`specs/api-contracts/student-guardians.md`, sección de aceptación de invitación.

## Referencia a MQTT

No aplica: el correo de invitación viaja por `EmailProvider` (ver ADR-017), no
por MQTT.

## Referencias

- ADR-017 (`EmailProvider` como port).
- ADR-018 (punto 7: `status = revoked` terminal — contexto del ciclo de vida de
  `student_guardian`).
- ADR-019 (punto 2: `status = invited` para cuentas no verificadas; token JWT de
  corta duración sin persistencia).
- ADR-022 (punto 2: `password_hash` nullable e invariante `active` ⇒ no nulo;
  punto 3: mecanismo único de activación por token parametrizado).
- ADR-023 (punto 3: aceptación obligatoria en ambas ramas, sin contraseña para
  el `user` ya activo; punto 4: reutiliza el endpoint compartido de aceptación).
- `specs/entities/user.md`, `specs/entities/student_guardian.md`.
- `specs/features/015-invitar-tutor-autorizado.md` (genera este flujo),
  `specs/features/013-aceptar-invitacion-personal.md` (flujo análogo para
  personal),
  `specs/features/007-verificacion-correo.md`,
  `specs/features/003-login.md`.
- `specs/api-contracts/institution-members.md`
  (`POST /invitations/:token/accept`, endpoint compartido).

## Preguntas abiertas

Ninguna: el endpoint de aceptación (reutilizar `POST /invitations/:token/accept`)
y la aceptación obligatoria también para el `user` ya activo (sin contraseña) se
resolvieron en ADR-023 (puntos 3 y 4).
