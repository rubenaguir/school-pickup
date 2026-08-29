# Feature 001 — Registro de institución

## Propósito

Una institución (escuela o actividad extracurricular) se da de alta en la
plataforma. Es el punto de entrada para el primer administrador de esa
institución: no existe un flujo separado de "crear cuenta" seguido de
"crear institución" — ambos ocurren en el mismo paso.

## Entidades involucradas

- `institutions` (creada)
- `institution_members` (creada, `role = admin`)
- `users` (creado si quien registra no tiene ya una cuenta; ver precondiciones)

## Precondiciones

- Quien registra no necesita tener una cuenta previa: este feature puede
  crear el `users` administrador junto con la `institutions` en la misma
  operación.
- `email` del administrador no debe existir ya en `users.email`.

## Postcondiciones

- Se crea una fila en `institutions` con `status = pending` (ver ADR-018: una
  institución permanece en `pending` hasta que un super-admin decide
  aprobarla; no hay estado de rechazo explícito).
- **`join_code` se autogenera** (ADR-019, punto 1): iniciales del nombre de
  la institución + año actual (ej. "CSB-2024"), con verificación de
  unicidad y sufijo aleatorio en caso de colisión. El formulario de alta no
  captura este campo; el admin puede regenerarlo después desde la
  configuración de la institución (fuera de este slice).
- Se crea una fila en `users`, salvo que `admin.email` ya exista **y**
  `admin.password` coincida con la contraseña de esa cuenta — en ese caso se
  reutiliza el `users` existente en vez de crear uno nuevo (ADR-028, punto
  2: la contraseña correcta prueba posesión de la cuenta; sin esa
  verificación, "reutilizar" sería una vulnerabilidad de apropiación de
  cuenta). Si `admin.email` ya existe pero la contraseña no coincide, ver
  el caso de error más abajo.
- **Alta nueva:** el `users` administrador queda en `status = invited`
  (ADR-019, punto 2), no `active`: al completar el registro se le envía un
  correo de verificación vía el port `EmailProvider` (ver ADR-017) con un
  token firmado de corta duración (24h). No puede iniciar sesión hasta
  verificar su correo — ver `specs/features/007-verificacion-correo.md`.
  **Reutilización de cuenta (ADR-028, punto 2):** el `users` reutilizado
  conserva su `status` actual tal cual estaba (`invited` o `active`) — no se
  reinicia el flujo de verificación ni se envía un correo nuevo.
- Se crea una fila en `institution_members` vinculando ese `users` con la
  nueva `institutions` y `role = admin` (ver ADR-011: el `role` es
  organizacional; `admin` es el rol correcto para quien da de alta el
  plantel).
- Ningún otro dato operativo de la institución (geocerca, radios, horarios,
  puntos de entrega) se resuelve en este feature — quedan con valores por
  defecto o vacíos hasta que se especifique la feature de "configuración de
  institución" (fuera de este slice).

## Casos Given/When/Then

### Caso de éxito

```
Given no existe ningún user con el email del administrador
When se envía el formulario de registro con los datos de la institución
  y los datos del administrador (sin join_code: se autogenera)
Then se crea institution con status = pending y join_code autogenerado
  And se crea user con status = invited
  And se envía un correo de verificación al administrador vía EmailProvider
  And se crea institution_member con role = admin vinculando ambos
  And la respuesta indica que la institución quedó pendiente de aprobación
      y que el administrador debe verificar su correo antes de iniciar sesión
```

### Caso: colisión interna de join_code autogenerado

```
Given el join_code generado a partir de las iniciales del nombre y el año
      ya existe en institutions.join_code
When se procesa el registro
Then el sistema agrega un sufijo aleatorio y reintenta hasta encontrar un
     join_code libre
  And el registro se completa con normalidad (no es un error visible al
      usuario, es un detalle interno de generación de código — ver ADR-019,
      punto 1)
```

### Caso: email de administrador ya registrado, contraseña coincide (reutilización)

```
Given ya existe un user con ese email
  And la contraseña enviada coincide con la contraseña de esa cuenta
When se envía el formulario de registro de institución
Then se reutiliza el user existente (sin crear uno nuevo)
  And se crea institution con status = pending y join_code autogenerado
  And se crea institution_member con role = admin vinculando ambos
  And no se envía un nuevo correo de verificación (el user conserva su
      status actual, invited o active)
  And la respuesta es 201 con el mismo shape que el caso de alta nueva
```
Ver ADR-028, punto 2.

### Caso: email de administrador ya registrado, contraseña no coincide

```
Given ya existe un user con ese email
  And la contraseña enviada NO coincide con la contraseña de esa cuenta
When se envía el formulario de registro de institución
Then la operación falla sin crear ningún registro
  And se devuelve 409 EMAIL_ALREADY_REGISTERED indicando que el correo ya
      está en uso
```

## Referencia a contrato de API

Ver `specs/api-contracts/auth.md` — `POST /auth/register/institution`.

## Referencia a MQTT

No aplica: este feature no publica ni consume ningún topic MQTT.

## Referencias

- ADR-004 (modelo "institution").
- ADR-011 (rol `admin` como rol organizacional del primer miembro).
- ADR-017 (`EmailProvider` como port).
- ADR-018 (transiciones de `institutions.status`; permanece `pending` hasta
  decisión de super-admin).
- ADR-019 (autogeneración de `join_code`; `users.status = invited` en
  auto-registro).
- ADR-028 (reutilización de cuenta existente condicionada a contraseña
  coincidente; forma de los errores con `code`).
- `specs/entities/institution.md`, `specs/entities/institution_member.md`,
  `specs/entities/user.md`.
- `specs/features/007-verificacion-correo.md`.
- `specs/features/031-aviso-privacidad-consentimiento.md` (ADR-099,
  `admin.acceptedPrivacyNotice` obligatorio en este endpoint desde esa
  fecha — no aplica a cuentas creadas antes).

## Preguntas abiertas

Ninguna: las dos preguntas que tenía este feature (generación de
`join_code`, `status` inicial del administrador) se resolvieron en ADR-019.
