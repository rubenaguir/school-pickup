# Feature 001 — Registro de institución

## Propósito

Una institución (escuela o actividad extracurricular) se da de alta en la
plataforma. Es el punto de entrada para el primer administrador de esa
institución: no existe un flujo separado de "crear cuenta" seguido de
"crear institución" — ambos ocurren en el mismo paso.

## Entidades involucradas

- `institution` (creada)
- `institution_member` (creada, `role = admin`)
- `user` (creado si quien registra no tiene ya una cuenta; ver precondiciones)

## Precondiciones

- Quien registra no necesita tener una cuenta previa: este feature puede
  crear el `user` administrador junto con la `institution` en la misma
  operación.
- `email` del administrador no debe existir ya en `users.email`.

## Postcondiciones

- Se crea una fila en `institution` con `status = pending` (ver ADR-018: una
  institución permanece en `pending` hasta que un super-admin decide
  aprobarla; no hay estado de rechazo explícito).
- **`join_code` se autogenera** (ADR-019, punto 1): iniciales del nombre de
  la institución + año actual (ej. "CSB-2024"), con verificación de
  unicidad y sufijo aleatorio en caso de colisión. El formulario de alta no
  captura este campo; el admin puede regenerarlo después desde la
  configuración de la institución (fuera de este slice).
- Se crea (o reutiliza, si ya existía la cuenta) una fila en `user`.
- **El `user` administrador queda en `status = invited`** (ADR-019, punto
  2), no `active`: al completar el registro se le envía un correo de
  verificación vía el port `EmailProvider` (ver ADR-017) con un token
  firmado de corta duración (24h). No puede iniciar sesión hasta verificar
  su correo — ver `specs/features/007-verificacion-correo.md`.
- Se crea una fila en `institution_member` vinculando ese `user` con la
  nueva `institution` y `role = admin` (ver ADR-011: el `role` es
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

### Caso: email de administrador ya registrado

```
Given ya existe un user con ese email
When se envía el formulario de registro de institución
Then la operación falla sin crear ningún registro
  And se devuelve un error indicando que el correo ya está en uso
```

## Referencia a contrato de API

Ver `specs/api-contracts/auth.md` — `POST /auth/register/institution`.

## Referencia a MQTT

No aplica: este feature no publica ni consume ningún topic MQTT.

## Referencias

- ADR-004 (modelo "institution").
- ADR-011 (rol `admin` como rol organizacional del primer miembro).
- ADR-017 (`EmailProvider` como port).
- ADR-018 (transiciones de `institution.status`; permanece `pending` hasta
  decisión de super-admin).
- ADR-019 (autogeneración de `join_code`; `user.status = invited` en
  auto-registro).
- `specs/entities/institution.md`, `specs/entities/institution_member.md`,
  `specs/entities/user.md`.
- `specs/features/007-verificacion-correo.md`.

## Preguntas abiertas

Ninguna: las dos preguntas que tenía este feature (generación de
`join_code`, `status` inicial del administrador) se resolvieron en ADR-019.
