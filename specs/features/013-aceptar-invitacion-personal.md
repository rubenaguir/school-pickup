# Feature 013 — Aceptar invitación de personal

## Propósito

Completa el caso "correo nuevo" de la feature 012: una persona que fue invitada
a una institución, y para la cual se creó un `user` con `status = invited` y sin
contraseña, recibe un correo con un link para aceptar la invitación. Al
aceptarlo, define su contraseña por primera vez y su cuenta pasa a `active`,
quedando en condiciones de iniciar sesión.

## Entidades involucradas

- `user` (leído y actualizado: se fija la contraseña y `status` pasa a `active`)

## Precondiciones

- El `user` existe con `status = invited`, creado por la feature 012 en su caso
  de correo nuevo (nunca definió contraseña).
- El invitado presenta un token de invitación válido: JWT firmado de corta
  duración, sin persistencia en base de datos, que identifica al `user`
  invitado. Es el mismo mecanismo de activación por token que la verificación de
  correo (feature 007), unificado y parametrizado según si el paso define
  contraseña (ADR-022, punto 3; ver ADR-019 punto 2).

## Postcondiciones

- Al aceptar exitosamente: se establece por primera vez la contraseña del `user`
  (se guarda su hash en `password_hash`, que hasta ahora era `NULL` — ADR-022
  punto 2) y `user.status` pasa de `invited` a `active`. La persona puede
  iniciar sesión (feature 003) y operar en la institución según el `role` con el
  que fue invitada (la fila de `institution_member` ya se creó en la feature
  012). Con esto se satisface la invariante "un `user` `active` tiene
  `password_hash` no nulo" (ADR-022, punto 2).
- La validez del token se resuelve verificando firma y expiración, sin tabla que
  lo almacene ni lo revoque.

### Diferencia con la feature 007 (verificación de correo)

Ambas features activan una cuenta (`invited → active`) con un token JWT de corta
duración, pero cubren situaciones distintas:

- **Feature 007 (verificación de correo):** es para quien se **auto-registró**
  (institución o tutor, features 001/002) y **ya definió su contraseña** al
  registrarse. Solo falta confirmar que controla el correo. El token no lleva a
  definir contraseña; solo activa la cuenta.
- **Feature 013 (aceptar invitación):** es para quien **nunca definió
  contraseña** porque otra persona lo invitó (feature 012, caso de correo
  nuevo). Aquí el paso central es **definir la contraseña por primera vez**, y de
  paso la cuenta queda `active`.

Ambos flujos se implementan sobre **un único mecanismo de activación por token
parametrizado** por si el paso define contraseña (ADR-022, punto 3): la
verificación de correo no fija contraseña; la aceptación de invitación sí.

## Casos Given/When/Then

### Caso de éxito

```
Given un user con status = invited y sin contraseña (creado por feature 012,
      caso de correo nuevo)
  And un token de invitación válido (firma correcta, no expirado) emitido para
      ese user.id
When la persona abre el link, define su contraseña y confirma
Then se guarda el hash de la contraseña del user
  And user.status pasa a active
  And la persona queda en condiciones de iniciar sesión (feature 003)
```

### Caso: token expirado

```
Given un token de invitación con firma válida pero expirado
When se intenta aceptar la invitación
Then la operación falla con un mensaje claro indicando que el enlace expiró
  And se indica que hace falta una nueva invitación: un admin vuelve a invitar
      el mismo correo desde la feature 012, lo que actúa como reenvío (genera un
      token nuevo sin duplicar el institution_member; ADR-022 punto 5)
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
Given un user cuyo status ya es active (por ejemplo, la invitación ya fue
      aceptada antes, o el correo correspondía a un user existente y activo —
      caso (a) de la feature 012, que no genera este flujo)
When se intenta aceptar una invitación / definir contraseña con este flujo
Then la operación no reactiva ni redefine credenciales: responde de forma
     idempotente/segura sin degradar la cuenta ya activa
```

## Referencia a contrato de API

Ver `specs/api-contracts/institution-members.md` —
`POST /invitations/:token/accept`.

## Referencia a MQTT

No aplica: el correo de invitación viaja por `EmailProvider` (ver ADR-017), no
por MQTT.

## Referencias

- ADR-017 (`EmailProvider` como port; el correo de invitación se envía a través
  de él).
- ADR-019 (punto 2: `status = invited` para cuentas no verificadas; token JWT de
  corta duración sin persistencia).
- ADR-022 (punto 2: `password_hash` nullable e invariante `active` ⇒ no nulo;
  punto 3: mecanismo único de activación por token parametrizado; punto 5:
  reenvío vía re-invitación).
- `specs/entities/user.md` (`status` enum; `password_hash` nullable).
- `specs/features/012-invitar-personal.md` (genera este flujo en su caso de
  correo nuevo),
  `specs/features/007-verificacion-correo.md` (flujo análogo pero para
  auto-registro con contraseña ya definida),
  `specs/features/003-login.md`.

## Preguntas abiertas

Ninguna: la nulabilidad de `password_hash`, la unificación con la feature 007
(mecanismo de activación por token parametrizado) y la re-invitación tras
expiración se resolvieron en ADR-022 (puntos 2, 3 y 5).
