# Registro de decisiones (ADR)

> Cada decisión: contexto, decisión y consecuencias. Útil para defender el
> proyecto y para que Claude Code entienda el "por qué", no solo el "qué".

## ADR-001 — Backend en Node.js + TypeScript (NestJS)

**Contexto.** Se evaluó PHP (framework propio) vs Node. El proyecto es el trabajo
final de un máster.

**Decisión.** Backend en Node.js + TypeScript con NestJS.

**Consecuencias.**
- Stack unificado en un solo lenguaje (TS) a través de los tres frontends y el
  backend: narrativa de arquitectura coherente y fácil de defender.
- El proceso en segundo plano (ingesta de ubicación + ETA) es natural en el
  modelo orientado a eventos de Node.
- NestJS aporta estructura (módulos, DI), validación, testing y OpenAPI, todo
  bien valorado en un contexto académico.
- Alternativas válidas si se quisiera menos ceremonia: Express o Fastify.

## ADR-002 — App del padre como PWA ("Camino A")

**Contexto.** El requisito crítico es el tracking de ubicación. Una PWA pura no
puede rastrear en segundo plano de forma fiable (limitación del navegador, sobre
todo iOS). Publicar en tiendas no es una fortaleza del autor.

**Decisión.** MVP con PWA en primer plano (Camino A): `watchPosition` +
Wake Lock + Page Visibility, con el teléfono en el soporte del coche.

**Consecuencias.**
- Cero dependencia de tiendas de apps en el MVP.
- ETA algo más burdo: si el usuario bloquea la pantalla o cambia de app, el
  tracking se pausa (se comunica en la UI, no se finge dato fresco).
- Migración futura a **Capacitor** (Camino B) sin reescritura: se encapsula la
  captura de ubicación tras un `LocationProvider` para sustituir solo esa pieza.
- Camino C (React Native) descartado por implicar código separado del portal.

## ADR-003 — Tiempo real con MQTT

**Contexto.** Hay un broker MQTT disponible. La alternativa eran WebSockets.

**Decisión.** Usar MQTT como transporte de tiempo real. Navegadores vía
MQTT.js sobre WSS; backend vía la librería `mqtt` de Node.

**Consecuencias.**
- MQTT encaja de forma natural con telemetría y pub/sub.
- Un solo modelo mental (MQTT) en navegador y servidor.
- Requiere ACL por institución en el broker para aislar tenants (seguridad).

## ADR-004 — Modelo "institution" (multi-institución por alumno)

**Contexto.** Un alumno asiste a primaria y también a extracurriculares (danza,
fútbol, taekwondo). El concepto "escuela" se queda corto.

**Decisión.** La entidad de dominio es `institution` (con `type`), no "school".
Un alumno puede asociarse a varias instituciones.

**Consecuencias.**
- El evento de recogida es la terna tutor–alumno–institución: al ir "en camino"
  hay que indicar a qué institución.
- Cada institución tiene su ubicación, geocerca y horarios propios.
- El tablero es opcional/configurable por institución (un dojo pequeño quizá use
  solo una tablet).

## ADR-005 — Carpool / multi-alumno fuera de alcance

**Contexto.** Un tutor podría recoger a varios alumnos a la vez.

**Decisión.** Fuera del MVP. Una solicitud de recogida referencia exactamente un
alumno.

**Consecuencias.**
- Modelo más simple. El caso de hermanos en la misma institución es similar y se
  podrá absorber después sin rediseño.

## ADR-006 — PostgreSQL + PostGIS, ORM TypeORM

**Contexto.** Se necesitan geocercas y consultas de distancia. Preferencia previa
por PostgreSQL.

**Decisión.** PostgreSQL + PostGIS. ORM: TypeORM.

**Consecuencias.**
- PostGIS resuelve geocercas y distancias de forma nativa.
- TypeORM maneja tipos geográficos de PostGIS de forma más directa que Prisma e
  integra bien con NestJS. (Con Prisma, la parte geográfica iría en SQL crudo.)

## ADR-007 — Idioma: código en inglés, documentación en español

**Contexto.** Mantener un estándar internacional en el código.

**Decisión.** Todo el código (variables, funciones, tablas, campos, endpoints,
comentarios, commits) en **inglés**. La documentación, en **español**.

**Consecuencias.**
- Código portable y alineado a convenciones internacionales.
- Documentación accesible para el contexto local y la defensa del máster.

## ADR-008 — Monorepo

**Contexto.** Tres frontends + backend, desarrollados en solitario.

**Decisión.** Monorepo con `apps/*` y `packages/shared`.

**Consecuencias.**
- Tipos TypeScript compartidos entre backend y frontends.
- Más fácil de gestionar y de presentar en la defensa que múltiples repos.

## ADR-009 — Correo transaccional: Resend (plan gratuito)

**Contexto.** Se necesita envío de correo transaccional para eventos de cuenta
(no para las notificaciones operativas en tiempo real, que ya viajan por MQTT).

**Decisión.** Usar Resend (plan gratuito) como proveedor de correo transaccional,
con remitente `no-reply@mail.casillego.com.mx`.

**Consecuencias.**
- Subdominio dedicado `mail.` para aislar la reputación de envío del dominio
  raíz `casillego.com.mx`.
- El correo corporativo (`contacto@`, `soporte@`) vive aparte, en buzones de
  Akky; no forma parte del código ni de este stack.
- Alcance limitado a eventos de cuenta: aprobación/rechazo de solicitudes de
  padres, recuperación de contraseña, invitaciones/altas. Las notificaciones
  operativas (`en_route`, `arriving`, `arrived`, `delivered`, `cancelled`) NO
  van por correo — siguen yendo por MQTT/push, como ya está diseñado (ver
  ADR-003).
- Criterio de migración futura: pasar a Amazon SES cuando se supere ~3,000
  correos/mes, o cuando el límite de 100 correos/día de Resend se convierta en
  una restricción operativa recurrente (p. ej. onboardings masivos de
  instituciones).

## ADR-010 — Despliegue por subdominios (producción)

**Contexto.** Hay tres frontends, un backend y un futuro sitio comercial que
deben convivir bajo el dominio `casillego.com.mx`.

**Decisión.** Cada superficie se despliega en su propio subdominio:
- `casillego.com.mx` → landing/sitio comercial
- `portal.casillego.com.mx` → `apps/portal` (admin del colegio)
- `app.casillego.com.mx` → `apps/parent` (PWA de padres)
- `tablero.casillego.com.mx` → `apps/board` (pantalla tipo aeropuerto)
- `api.casillego.com.mx` → `apps/api` (backend NestJS)

`casillego.mx` y `casillego.com` serán redirects 301 al `.com.mx`.

**Consecuencias.**
- Separación clara de superficies por audiencia (público, institución, padres,
  tablero, API), facilitando políticas de caché, CORS y certificados por
  subdominio.
- El DNS se administra en Akky; el reverse proxy (Caddy) y los certificados se
  configuran directamente en el VPS al momento del despliegue — queda fuera
  del alcance del código de este repo.

## ADR-011 — Personal de institución y acceso operativo

**Contexto.** Una institución tiene varios roles operativos (administrador,
coordinador, docente, operador de puerta) y necesita reflejarlos como datos
reales del modelo, tanto para reportes y directorio como para futura
granularidad de permisos. Al mismo tiempo, la consola de puerta es una
pantalla de trabajo diaria que cualquier miembro puede necesitar cubrir
temporalmente (por ejemplo, un coordinador cubriendo a un operador ausente),
sin que esto exija reconfigurar accesos.

**Decisión.** `institution_members.role` es un enum con cuatro valores:
`admin`, `gate_operator`, `coordinator`, `teacher`. El acceso a la consola de
puerta NO se restringe por `role`: cualquier `institution_member` de la
institución puede entrar. El campo `role` es informativo/organizacional
(reportes, directorio de personal, auditoría) y sienta la base para reglas de
permisos más finas en el futuro, pero hoy no controla el acceso a esa
pantalla específica.

**Consecuencias.**
- Reporting y directorio operan sobre roles reales.
- Cubrir un puesto temporalmente no requiere cambiar el `role` del usuario ni
  reconfigurar accesos.
- Una futura granularidad de permisos (ej. restringir aprobación de alumnos
  solo a `admin` y `coordinator`) se puede introducir sin cambios de esquema.

## ADR-012 — Puntos de entrega y asignación por grupo

**Contexto.** Una institución puede tener varios puntos de entrega físicos
(puerta principal, puerta vehicular, acceso preescolar, etc.), cada uno
atendido por un operador y con su propia consola de trabajo. Hay que decidir
(a) cómo se asigna cada recogida a un punto de entrega y (b) cómo evitar
confusión para los padres.

**Decisión.** Se modela la entidad `delivery_points` con el campo
`assigned_groups` (varchar[]) que lista los grupos o niveles que llegan por
ese punto (ej. `["Preescolar"]` o `["3°B", "4°A"]`). La asignación de un
`pickup_request` a un punto de entrega es **automática y estructural**: al
crear el viaje, se resuelve haciendo match entre
`enrollments.grade_or_group` y `delivery_points.assigned_groups`. El
resultado se guarda en `pickup_requests.delivery_point_id`.

Un tutor NO puede cambiar el punto de entrega de su recogida individual:
cambios individuales generarían confusión sistémica (el tutor no se entera,
el alumno espera en la puerta equivocada). La única forma de cambiar por
dónde sale un alumno es cambiar la asignación del grupo entero a nivel de
institución.

Para reflejar esto en el tiempo real, los topics MQTT se segmentan también
por punto de entrega: además del feed agregado del tablero de institución,
hay un topic por delivery_point para que cada consola de puerta consuma solo
su cola. Ver `docs/arquitectura.md`.

**Consecuencias.**
- La consola de puerta filtra solo su cola sin lógica de cliente compleja.
- Los cambios operativos se hacen a nivel institucional (reasignando grupos),
  no por padre.
- Instituciones con un solo punto de entrega no necesitan asignar grupos:
  `delivery_point_id` en `pickup_requests` es nullable.
- `assigned_groups` es texto libre (varchar[]) para no bloquear altas de
  grupos nuevos antes de tener un catálogo curado por institución.

## ADR-013 — Ciclo de vida de la recogida

**Contexto.** El `pickup_request` es el evento central del dominio. Se
necesita definir sus estados, cómo se registra su historia, cómo se verifica
la identidad en la entrega, y las reglas geográficas que gobiernan la
activación del botón "ya voy" y la detección del arribo.

**Decisión.**
1. **Estados:** `en_route`, `arriving`, `arrived`, `delivered`, `cancelled`.
2. **Historial en tabla separada.** Se crea
   `pickup_request_status_history` (una fila por transición) en lugar de
   agregar timestamps individuales (`arriving_at`, `arrived_at`, …) a
   `pickup_requests`. Métricas derivadas (ej. "tiempo en puerta") se calculan
   restando `changed_at` entre filas consecutivas del historial.
3. **`arrival_mode` opcional por viaje.** El tutor puede llegar en vehículo o
   caminando, y esto varía por trayecto — no es un dato fijo del tutor.
   `arrival_mode` es un enum (`vehicle` | `walking`) opcional en
   `pickup_requests`.
4. **`delivery_code` (4 dígitos) es parte del MVP.** El tutor lo ve en su
   app al alcanzar el estado "En puerta"; el staff lo verifica en la consola
   de puerta antes de confirmar la entrega (transición a `delivered`). Es el
   mecanismo de verificación en el punto de entrega.
5. **Radios separados en `institutions`.** `geofence_radius_meters` es el
   radio de **arribo** (detección de llegada al plantel).
   `activation_radius_meters` es el radio de **activación** (distancia a
   partir de la cual se habilita el botón "ya voy" en la app del padre).
   Son conceptos distintos y coexisten como dos campos.

**Consecuencias.**
- El modelo es extensible a nuevas transiciones o estados sin cambios ad-hoc
  en `pickup_requests`.
- Verificación de identidad en la entrega desde el MVP, sin depender de
  hardware ni de reconocimiento manual.
- Separación clara entre la lógica de "cuándo puedo tocar el botón" y
  "cuándo se detecta la llegada", cada una configurable por institución.

## ADR-014 — Catálogo de vehículos del tutor

**Contexto.** El tutor guarda una lista reutilizable de sus vehículos en el
perfil, pero el vehículo con el que llega puede variar por viaje. El
histórico de recogidas debe reflejar con qué vehículo llegó cada vez, sin
cambiar retroactivamente si el tutor edita o borra un vehículo del perfil
después.

**Decisión.** Se modela la entidad `vehicles` (con `guardian_user_id`,
`description`, `plate`, `is_primary`) como catálogo reutilizable del tutor.
En `pickup_requests`:
- `vehicle_id` (FK nullable a `vehicles`) referencia el vehículo guardado
  seleccionado, si se seleccionó uno.
- `vehicle_description` y `vehicle_plate` guardan un **snapshot
  denormalizado** del vehículo al momento del viaje (copiado del catálogo si
  se seleccionó uno guardado, o captura libre si no).

Todo esto es nullable para permitir `arrival_mode = walking` o cualquier
otro caso donde no aplique.

**Consecuencias.**
- El histórico de `pickup_requests` queda congelado por diseño: editar o
  borrar un vehículo del catálogo no altera lo que ya pasó.
- El catálogo del tutor es libremente editable sin efectos secundarios.
- Se soporta captura libre (un vehículo prestado, un viaje puntual) sin
  obligar al tutor a guardarlo en su perfil.

## ADR-015 — Configuración de institución y horarios

**Contexto.** Cada institución necesita datos operativos ricos (identificador
oficial, niveles ofrecidos, tolerancias, código de vínculo para tutores) y
soporte tanto para horarios recurrentes como para excepciones puntuales de
calendario (fin de cursos, ensayo cívico).

**Decisión.**
- **Campos operativos en `institutions`:**
  - `cct_code` (varchar, nullable): clave de centro de trabajo (SEP).
  - `levels` (varchar[]): niveles que ofrece la institución (ej. preescolar,
    primaria, secundaria).
  - `arrival_tolerance_minutes` (int): tolerancia antes de marcar el plazo
    de recogida como vencido.
  - `advance_notice_minutes` (int): minutos de anticipación para el
    recordatorio de salida.
  - `join_code` (varchar, único): código que el tutor captura para vincular
    la institución (ej. "CSB-2024").
  - `category` (varchar, nullable): subcategoría/disciplina cuando `type =
    extracurricular` (ej. "Ballet", "Natación", "Robótica"). Siempre nulo
    para `type = school`. Se deja como texto libre para no bloquear altas
    de disciplinas nuevas antes de tener un catálogo curado.
- **`dismissal_windows`** incluye `label` (ej. "Salida vespertina"), `level`
  (nullable, nivel al que aplica) y `status` (`active` | `paused`). Esto
  permite múltiples ventanas nombradas por institución.
- **`dismissal_exceptions`** es una entidad separada para días puntuales que
  sobreescriben el horario normal (fecha, nombre, nivel opcional, hora
  especial).

**Consecuencias.**
- La configuración operativa de una institución queda completa desde el MVP,
  sin campos añadidos ad-hoc en el camino.
- Los horarios recurrentes y las excepciones se modelan por separado, sin
  mezclar "regla" con "excepción" en la misma tabla.

## ADR-016 — Perfil del tutor y datos de matrícula

**Contexto.** El tutor tiene preferencias de notificación gestionables desde
el perfil y usa autenticación biométrica del dispositivo. La matrícula/folio
de un alumno depende de la institución (un mismo alumno tiene folios
distintos en su primaria y en su clase de taekwondo), no del alumno en
general.

**Decisión.**
- **Preferencias de notificación como columnas inline en `users`**, no como
  tabla separada ni `jsonb`. Cuatro booleans:
  - `notify_enrollment_approved` (default `true`)
  - `notify_dismissal_reminder` (default `true`)
  - `notify_delivery_confirmed` (default `true`)
  - `notify_product_news` (default `false`)
  Se mantiene el patrón de configuración inline que ya se usa en
  `institutions` (columnas concretas por preferencia). Son pocas y no
  guardan relación estructural entre sí más allá de pertenecer al mismo
  usuario, por lo que no justifican una tabla o blob.
- **Biometría solo del lado cliente.** El "inicio con huella" del perfil es
  autenticación biométrica del dispositivo (WebAuthn/plataforma). No
  persiste en `users`.
- **`enrollment_code` vive en `enrollments`, no en `students`.** La
  matrícula/folio visible en UI (ej. "A-10428") es propia de la relación
  alumno–institución. Ponerlo en `students` implicaría un solo folio por
  alumno, incompatible con el modelo multi-institución de ADR-004.

**Consecuencias.**
- El perfil del tutor cubre notificaciones desde el MVP sin infraestructura
  adicional.
- La biometría no contamina el esquema del backend.
- Los folios/matrículas escalan naturalmente al modelo multi-institución.

## ADR-017 — Arquitectura de capas simple (no Clean Architecture completa)

**Contexto.** El backend (`api` y `worker`) necesita una arquitectura de capas
clara antes de empezar a implementar los módulos de dominio. Se evaluó Clean
Architecture completa (casos de uso, entidades de dominio desacopladas del
ORM, interfaces de repositorio) y se descartó por el costo de ceremonia
(boilerplate de interfaces, mappers entre capas) frente al beneficio real en
un proyecto de un solo desarrollador que ya fijó su ORM y base de datos
(ADR-006) y que usa NestJS, cuyo sistema de módulos e inyección de
dependencias ya cubre gran parte del valor de esa separación.

**Decisión.**
1. **Arquitectura en capas simple por módulo de NestJS:** Controller →
   Service → Entidad de TypeORM. Sin capa de casos de uso separada, sin
   entidades de dominio distintas de las entidades de TypeORM, sin interfaz
   de repositorio genérica. Un módulo de NestJS por contexto de dominio:
   `auth`, `institutions`, `students`, `enrollments`, `pickups`,
   `delivery-points`, `vehicles`, entre otros que surjan al detallar
   `specs/features/`.
2. **Inversión de dependencias solo en integraciones volátiles**, mediante
   interfaces (ports) con implementación concreta inyectada por NestJS:
   - `MapsProvider`: cálculo de ETA con tráfico en vivo. Implementación
     concreta pendiente de elegir (Google Maps o Mapbox, ver
     `arquitectura.md`). Vive en el `worker`.
   - `EmailProvider`: envío de correo transaccional. Implementación concreta
     `ResendEmailProvider` ahora, con migración futura a `SesEmailProvider`
     ya prevista en ADR-009.
   - `MqttClient`: wrapper del cliente MQTT usado por `api` y `worker`, para
     poder testear sin un broker real.
   - `LocationProvider` (ya definido en ADR-002 para `apps/parent`) sigue el
     mismo patrón; se documenta aquí como parte de la misma familia de
     decisión, no como caso aislado.
3. **Lógica de estado de `pickup_request` como módulo puro compartido.** Las
   transiciones válidas del ciclo de vida (`en_route → arriving → arrived →
   delivered/cancelled`, ver `docs/modelo-datos.md`) se implementan como
   función pura en `packages/shared` (sin dependencia de TypeORM ni de
   NestJS), consumida tanto por `api` como por `worker` para validar
   transiciones antes de persistir un cambio de estado. Es la única pieza de
   lógica de dominio que se aísla explícitamente, por ser la regla de
   negocio central del proyecto y estar duplicada entre dos procesos.

**Consecuencias.**
- Menos boilerplate en los módulos CRUD simples (la mayoría del dominio).
- Los puntos genuinamente propensos a cambiar (proveedor de mapas, de
  correo, cliente MQTT) quedan mockeables para pruebas y sustituibles sin
  tocar el resto del código.
- La regla de negocio más importante del dominio (transiciones de
  `pickup_request`) vive en un solo lugar, compartida por los dos procesos
  que la necesitan, evitando que `api` y `worker` diverjan en su validación.
- Decisión documentada y defendible: se optó conscientemente por no aplicar
  Clean Architecture completa, en vez de aplicarla por defecto y asumir su
  fricción sin cuestionarla.

## ADR-018 — Resolución de reglas de negocio pendientes de `specs/entities/`

**Contexto.** Al construir `specs/entities/` (ver ADR-anterior de SDD) se
identificaron 12 reglas de negocio e implementación no resueltas en
`docs/modelo-datos.md` ni en ADRs previos. Se resuelven aquí antes de avanzar
a `specs/features/`.

**Decisión.**
1. **`institutions.status`.** Transiciones válidas: `pending → approved`
   (aprobación de super-admin) y `approved ⇄ suspended` (bidireccional,
   acción de super-admin). No existe camino de `suspended` de vuelta a
   `pending`. No hay estado de rechazo explícito: una institución no
   aprobada permanece en `pending` indefinidamente hasta que el super-admin
   decida.
2. **`enrollments.status`.** No puede pasar a `approved` si
   `institutions.status != approved`. `rejected` es terminal — no puede
   reactivarse; el tutor debe enviar una nueva solicitud (nuevo registro).
3. **`pickup_requests.delivery_code`.** Único solo entre registros en estado
   `en_route`/`arriving`/`arrived` de la **misma institución**, no global ni
   permanente. Se puede repetir en el tiempo y entre instituciones.
4. **`pickup_requests.institution_id`.** Se agrega como columna
   denormalizada (FK a `institutions`), copiada de `enrollments.institution_id`
   al crear el `pickup_request` (inmutable después). Motivo: evitar el join
   `pickup_request → enrollment → institution` en cada consulta del tablero
   y al publicar en el topic MQTT correcto.
5. **`vehicles.is_primary`.** Forzado en base de datos con índice único
   parcial de Postgres (`UNIQUE INDEX ... ON vehicles (guardian_user_id)
   WHERE is_primary = true`), no solo convención de UI.
6. **`student_guardians.is_primary`.** Mismo patrón, índice único parcial
   sobre `(student_id) WHERE is_primary = true`.
7. **`student_guardians.status`.** `revoked` es terminal, igual que
   `enrollments.rejected`. Requiere nueva invitación para reactivar el
   vínculo.
8. **`location_updates`.** Política de retención de 90 días desde
   `pickup_requests.completed_at` (ya sea `delivered` o `cancelled`), para
   fines de reportes y auditoría. Requiere: (a) mención explícita en el
   aviso de privacidad (LFPDPPP, ver `docs/arquitectura.md` sección
   "Privacidad y marco legal"), y (b) un job programado de limpieza que
   purgue registros más antiguos que 90 días — la implementación del job
   queda fuera de esta ronda de specs, se resuelve al definir
   `specs/features/` para el `worker`.
9. **`audit_log.action`.** Convención de nombres libre `entity.verb` (ej.
   `enrollment.approved`, `institution.suspended`, `student_guardian.added`), no
   un enum cerrado. Nuevos tipos de evento no requieren migración de esquema.
   (El prefijo canónico del tutor autorizado es `student_guardian.*`, no
   `guardian.*` — consolidado en ADR-026 punto 5.)
10. **`dismissal_exceptions`.** Restricción única `(institution_id, date,
    level)`. El caso de un `level = null` ("todos los niveles") coexistiendo
    con una excepción de nivel específico en la misma fecha no lo captura un
    unique constraint simple (comportamiento de `NULL` en Postgres) — se
    valida en la capa de aplicación al crear/editar una excepción.
11. **`delivery_points.operator_user_id`.** Debe pertenecer a un
    `institution_member` de la misma institución que el `delivery_point`.
    Esta regla cruza tablas y se valida en la capa de servicio (NestJS), no
    con trigger de base de datos — consistente con ADR-017 (lógica de
    negocio en la capa de aplicación, base de datos simple).
12. **`users.status`.** Transiciones válidas: `invited → active` (al
    completar registro/primer login), `active ⇄ suspended` (acción de
    administrador o super-admin), e `invited → suspended` (revocar una
    invitación antes de que se acepte).

**Consecuencias.**
- Nueva columna `institution_id` en `pickup_requests` (denormalizada, ver
  punto 4) — impacta `docs/modelo-datos.md` y su diagrama.
- Dos nuevos índices únicos parciales de Postgres (`vehicles`,
  `student_guardians`) y uno nuevo compuesto (`dismissal_exceptions`).
- Política de retención de 90 días para `location_updates` con job de
  limpieza pendiente de especificar como feature.
- Ninguna de estas decisiones introduce triggers de base de datos; las
  validaciones cruzadas (punto 10 y 11) se resuelven en la capa de servicio,
  consistente con ADR-017.

## ADR-019 — Resolución de preguntas abiertas del vertical slice auth/enrollment

**Contexto.** Al construir `specs/features/001` a `006` y
`specs/api-contracts/auth.md`, `students.md` y `enrollments.md` (primer
vertical slice de SDD) se identificaron 5 preguntas abiertas de negocio/
implementación. Se resuelven aquí.

**Decisión.**
1. **`institutions.join_code`.** Se autogenera al crear la institución (no
   lo captura el admin en el formulario de alta). Algoritmo: iniciales del
   nombre de la institución + año actual (ej. "CSB-2024"), con verificación
   de unicidad y sufijo aleatorio en caso de colisión. El admin de la
   institución puede regenerarlo después desde la configuración, pero no lo
   escribe a mano en el alta inicial.
2. **`users.status` en auto-registro.** Cuando un usuario se auto-registra
   (alta de institución o alta de tutor, NO cuando alguien más lo invita —
   ver distinción con `institution_members` invitados por un admin o
   `student_guardians` invitados por otro tutor), su cuenta queda en
   `status = invited` hasta verificar su correo electrónico. La
   verificación se resuelve con un token firmado (JWT) de corta duración
   (24h), sin persistencia en base de datos — no requiere tabla nueva
   porque no necesita revocación, solo expiración. Al verificar, `status`
   pasa a `active`. Un usuario en `invited` no puede iniciar sesión hasta
   completar la verificación (ver `specs/features/003-login.md` y la nueva
   `specs/features/007-verificacion-correo.md`).
3. **Refresh token stateless.** Se acepta conscientemente como limitación
   del MVP. JWT firmado (access + refresh) sin tabla de revocación — no se
   puede invalidar un token robado antes de que expire. Queda como ítem de
   backlog: agregar una entidad de revocación (ej. `revoked_tokens` o lista
   de sesiones activas) en una ronda futura si se requiere endurecer la
   seguridad antes de producción.

   **Enmienda (Fase 4, implementación del módulo `auth`).** Aunque no existe
   tabla de revocación, `POST /auth/refresh` sí valida `users.status` (y que
   el `users` referido por el `sub` del token siga existiendo) en cada uso, y
   rechaza la renovación: `403 ACCOUNT_SUSPENDED` si el usuario está
   `suspended` (mismo `code` que usa `POST /auth/login` para el mismo caso),
   o `401 INVALID_REFRESH_TOKEN` si ya no existe. Esto matiza, sin
   contradecir, la limitación descrita arriba: una suspensión **sí** bloquea
   la renovación de sesión, con un retraso máximo igual al TTL del access
   token vigente (15 minutos, `JWT_ACCESS_TTL`) — no hasta que expire el
   refresh token (30 días). La limitación aceptada que permanece
   sin cambios es más estrecha de lo que sugiere el punto 3: un refresh token
   **robado de una cuenta que sigue `active`** no puede invalidarse antes de
   su expiración; el caso de una cuenta ya suspendida no está expuesto.
4. **Visibilidad de instituciones no aprobadas.** Solo instituciones con
   `status = approved` son buscables por nombre o aceptan su `join_code`
   para iniciar una solicitud de `enrollment`. Instituciones en `pending` o
   `suspended` no aparecen en la búsqueda ni aceptan solicitudes nuevas. Es
   una extensión de la regla ya existente en ADR-018 (no se puede *aprobar*
   un enrollment si la institución no está aprobada): aquí se evita que la
   solicitud pueda *iniciarse* siquiera.
5. **Autorización para aprobar/rechazar `enrollment`.** Restringido a
   `institution_members.role = 'admin'` de la institución dueña del
   `enrollment`. A diferencia de la consola de puerta (ADR-011, sin
   restricción de rol — es cobertura operativa), aprobar un `enrollment` es
   una decisión de control de acceso/identidad (quién queda autorizado a
   operar sobre un alumno específico), de mayor sensibilidad, y se
   restringe deliberadamente al rol `admin`. `coordinator`, `teacher` y
   `gate_operator` no pueden aprobar ni rechazar.

**Consecuencias.**
- Nueva feature: verificación de correo (ver
  `specs/features/007-verificacion-correo.md`).
- `specs/api-contracts/auth.md` gana un endpoint de verificación (y uno de
  reenvío).
- `specs/api-contracts/enrollments.md` documenta la regla de autorización
  del punto 5.
- No se agregan entidades nuevas al modelo de datos: ni el token de
  verificación ni el de refresh requieren tabla propia bajo las decisiones
  tomadas aquí.

## ADR-020 — Frontends en React 19 + Vite 8

**Contexto.** El scaffolding inicial de los tres frontends (`portal`, `parent`,
`board`) declaraba React 18.3 y Vite 5.4. Antes de escribir componentes se
revisó si convenía fijar versiones más recientes. Los tres frontends estaban
vacíos (Fase 7+ del plan, sin componentes), por lo que el costo de migración
en este momento es cero y solo crecería al empezar a escribir UI.

**Decisión.** Subir los tres frontends a **React 19.2** y **Vite 8.1** (con
`@vitejs/plugin-react` 6 y `@types/react` 19). React 19 es estable desde
diciembre 2024, maduro y sin blockers de ecosistema. Vite 8 (motor Rolldown)
es la línea actual.

**Consecuencias.**
- Se aprovechan mejoras de React 19 directamente relevantes al producto:
  Suspense/async y `use()` para la PWA del padre, form actions para los
  formularios del portal.
- Se evita una migración 18→19 futura con las tres PWAs ya construidas.
- Los peers opcionales de `@vitejs/plugin-react` 6 (React Compiler,
  `@rolldown/plugin-babel`) no se instalan; se pueden habilitar más adelante
  sin cambiar de versión.
- `@types/node` se alinea a la línea 24 (mismo major que el runtime, Node 24),
  no se adelanta a 26.

## ADR-021 — Compuerta de calidad (lint + formato + build + test) y TypeScript 5.9

**Contexto.** Con el dominio ya especificado en `specs/` (fuente de verdad),
el riesgo al implementar no es falta de documentación sino que el código se
desvíe de la spec en silencio (campos/endpoints/códigos de error inventados,
invariantes no forzadas). Las specs son la defensa conceptual; faltaba una
defensa **mecánica** que impida que el código compile desviándose. El
repositorio no tenía ESLint, Prettier ni runner de tests.

Al elegir versiones surgió un conflicto duro: `typescript-eslint` declara
`peer typescript >=4.8.4 <6.1.0`, por lo que **TypeScript 7** (compilador
nativo en Go) deja el linting sin información de tipos —degradado a solo
sintaxis— y se pierde `no-floating-promises`, justo el valor de la compuerta
en un backend NestJS con mucho async.

**Decisión.**
- Compuerta única `npm run check` = `lint` (ESLint 10 + typescript-eslint 8,
  type-aware sobre los fuentes reales) → `format:check` (Prettier 3) →
  `build` (typecheck real de los 5 workspaces) → `test` (Vitest 4).
- **TypeScript 5.9.3**: la línea más madura que conserva el linting type-aware
  completo, sin warnings de deprecación. Se pospone TS 7 hasta que el
  ecosistema de linting lo soporte; migrar desde 5.9 costará lo mismo.
- Prettier gobierna **código, no prosa**: `docs/`, `specs/` y todo `*.md`
  quedan fuera (`.prettierignore`). La documentación SDD, hecha a mano, es
  fuente de verdad y no se deja a merced de un formateador.
- El linting type-aware se limita a `apps/*/src` y `packages/*/src` (fuentes
  dentro de un `tsconfig include`); los archivos de configuración usan reglas
  sin tipos para no romper por "archivo fuera del proyecto".

**Consecuencias.**
- Un import o símbolo inventado no compila; una promesa sin `await` en NestJS
  es error de lint. La deriva mecánica se atrapa antes de correr nada.
- La regla de proceso complementaria (spec como fuente de verdad, no
  implementar lo que no esté especificado) vive en `CLAUDE.md` §"Reglas de
  implementación".
- Pendiente al llegar a Fase 3/4: subir NestJS 10→11. TypeORM 1.0 (que exige
  Node ≥24.11) queda desbloqueado al correr Node 24.18; el `engines` del
  monorepo se fija en `>=24.11` para reflejar ese piso.
- Cada "Invariante de negocio" de una spec deberá respaldarse con un test o
  un constraint de BD (Nivel 2, al escribir cada módulo): así la compuerta
  cubre también corrección de negocio, no solo tipos.

## ADR-022 — Resolución de preguntas abiertas del vertical slice de configuración de institución

**Contexto.** Al construir el segundo vertical slice de SDD
(`specs/features/008`–`013` y `specs/api-contracts/institutions.md`,
`delivery-points.md`, `dismissal-windows.md`, `dismissal-exceptions.md`,
`institution-members.md` — configuración operativa de una institución ya
aprobada) se identificaron 5 preguntas abiertas de negocio/implementación.
Se resuelven aquí.

**Decisión.**
1. **Autorización de las acciones de configuración.** Toda acción de
   configuración/identidad de una institución —editar el perfil (feature 008),
   regenerar `join_code`, gestionar puntos de entrega (009), horarios
   recurrentes (010), días especiales (011), invitar personal (012) y cambiar
   el `role` de un miembro— requiere que el usuario autenticado sea
   `institution_member` de esa institución **y** tenga `role = admin`. Es la
   misma restricción, y por la misma razón, que aprobar/rechazar un
   `enrollment` (ADR-019, punto 5): son decisiones de control de acceso e
   identidad, de mayor sensibilidad que la cobertura operativa de la consola de
   puerta (ADR-011, sin restricción de rol). La lectura (`GET`) de estos
   recursos está disponible para cualquier `institution_member` de la
   institución. Nota: una institución nunca nace sin admin — su primer `admin`
   se crea junto con ella en el alta (feature 001); los admins adicionales se
   crean por invitación (feature 012) de un admin ya existente. No se
   especifica en este slice un flujo de super-admin creando admins directamente;
   si se requiere, será una feature aparte.
2. **`users.password_hash` pasa a nullable.** El flujo de invitación de personal
   (feature 012, caso de correo nuevo) crea un `user` con `status = invited`
   antes de que esa persona defina una contraseña; esta la establece al aceptar
   la invitación (feature 013). Para representarlo sin hashes placeholder ni
   tablas auxiliares, `password_hash` se vuelve **nullable**: es `NULL` mientras
   el usuario está `invited` sin haber definido contraseña, y se llena al
   activarse. Invariante asociada: un `user` con `status = active` debe tener
   `password_hash` no nulo (se valida en la capa de servicio al activar, no con
   CHECK en BD, consistente con ADR-017). El auto-registro (features 001/002)
   sigue definiendo la contraseña de entrada, así que en ese camino
   `password_hash` nunca es nulo.
3. **Activación de cuenta por token, parametrizada.** La verificación de correo
   (feature 007) y la aceptación de invitación (feature 013) comparten mecanismo
   —JWT firmado de corta duración, sin persistencia, que lleva `user.status` de
   `invited` a `active`— y difieren solo en si el paso incluye definir la
   contraseña por primera vez. Se unifican en un único mecanismo de activación
   por token parametrizado por ese detalle (verificación: no fija contraseña;
   invitación: fija contraseña). Evita dos implementaciones divergentes del
   mismo flujo.
4. **Aislamiento multi-tenant vía `InstitutionMembershipGuard` (NestJS).** El
   aislamiento multi-tenant a nivel API se implementa con un guard de NestJS que
   corre después del guard de JWT y exige que exista un `institution_member`
   `(userId, institutionId)` antes de dejar pasar el request. Para rutas
   anidadas (`/institutions/:institutionId/...`) el guard lee el `institutionId`
   del parámetro de ruta; para rutas por recurso (ej. `PATCH /delivery-points/:id`)
   resuelve la institución del recurso con una consulta mínima al repositorio
   antes de comparar contra las membresías. Complemento obligatorio: los
   services filtran siempre por el `institutionId` del contexto autenticado,
   nunca por uno recibido en el body. **No se usa Row-Level Security de
   Postgres**: es ceremonia innecesaria dado ADR-017 (capas simples, lógica de
   negocio en la aplicación, base de datos simple).
5. **Convenciones puntuales.**
   - **Código HTTP para validaciones cruzadas entre entidades:** convención de
     proyecto — una petición bien formada que viola una regla de negocio que
     cruza entidades devuelve **422 Unprocessable Entity** (no 400, reservado
     para peticiones mal formadas: falta de campo, tipo incorrecto). Aplica a
     `operator_user_id` que no es miembro de la institución (ADR-018, punto 11),
     y en general a toda validación cruzada del API.

     **Ampliación (validación final de Fase 1, ADR-026).** La convención se
     amplía para cubrir explícitamente el caso de un recurso que entra en
     conflicto con **su propio estado actual** (transiciones de máquina de
     estados, invariantes intra-entidad). La distinción completa queda así:
     - **400**: petición mal formada (campo faltante, tipo incorrecto).
     - **409**: el recurso entra en conflicto con **su propio estado** — por
       ejemplo `institution.status != approved` bloqueando un `PATCH` sobre esa
       misma institución, o `category` no nula con `type = school` en la misma
       entidad, o una transición de estado inválida sobre el propio recurso.
     - **422**: la petición viola una regla de negocio que **cruza hacia otra
       entidad** — por ejemplo un `operator_user_id` que no es miembro de la
       institución, dejar una institución sin ningún admin, revocar al guardián
       principal sin reasignar antes, o reasignar la primariedad a un guardián
       no activo.

     **Segunda ampliación (revisión previa de Fase 6, ADR-031 punto 2).** Se
     reconoce una **tercera categoría**, que no encajaba en ninguna de las dos
     anteriores:
     - **401**: **fallo de verificación de una credencial o secreto
       compartido** sobre una acción específica. No es autenticación de sesión
       (el usuario está autenticado y autorizado), pero responde al mismo
       principio que `INVALID_CREDENTIALS` en el login: el valor secreto que se
       presenta no coincide con el almacenado. El caso que la motiva es
       `INVALID_DELIVERY_CODE` (`PATCH /pickup-requests/:id/deliver`, ADR-031
       punto 1): comparar el `deliveryCode` tecleado contra
       `pickup_requests.delivery_code` de esa misma fila es autoconsulta —lo
       que por la lectura estricta lo llevaría a 409—, pero un código
       equivocado no es un conflicto de estado del recurso: el recurso está
       perfectamente en `arrived` y sigue estándolo. Es un secreto que no
       coincide.

     Nota: esta ampliación aclara —sin requerir cambio de código— que
     `specs/api-contracts/institutions.md` (bloqueo de `PATCH` si
     `institution.status != approved`) y la validación de `category`/`type` en
     esa misma spec ya estaban correctamente codificados en **409** bajo esta
     lectura ampliada.
   - **Protección del último admin:** el cambio de `role`
     (`PATCH /institution-members/:id`) y cualquier baja de personal deben
     rechazarse con **422** si el miembro afectado es el único con `role = admin`
     de esa institución. Sin esta regla una institución puede quedar sin nadie
     capaz de aprobar enrollments, gestionar personal o editar la configuración
     — un estado irrecuperable sin intervención manual en la base de datos.
   - **Re-invitación:** no hay endpoint de reenvío separado para invitaciones de
     personal. Volver a llamar `POST /institutions/:id/members/invite` con un
     correo cuyo `user` sigue en `status = invited` (y cuyo `institution_member`
     ya existe desde la primera invitación) se comporta como reenvío: genera un
     token nuevo, reenvía el correo y **no** crea un `institution_member`
     duplicado (respeta el único `(institution_id, user_id)`). Si el `user` ya
     está `active` (aceptó, o el correo era de un usuario existente), la
     invitación repetida se rechaza con conflicto. Difiere del auto-registro
     (que sí necesita `POST /auth/resend-verification`) porque allí el registro
     ya dejó una contraseña puesta y no puede reejecutarse.

**Consecuencias.**
- `users.password_hash` cambia de `NOT NULL` a nullable (actualiza
  `specs/entities/user.md` y `docs/modelo-datos.md`); nueva invariante
  "`status = active` ⇒ `password_hash` no nulo" validada en capa de servicio.
- Las 11 specs del slice dejan de marcar como "pregunta abierta" el rol de
  configuración (resuelto: `admin`), el mecanismo multi-tenant (resuelto:
  `InstitutionMembershipGuard`) y las convenciones del punto 5.
- Nuevo componente transversal a implementar: `InstitutionMembershipGuard`.
- Regla de negocio nueva a forzar por test (ADR-021): protección del último
  admin; e invariante de `password_hash` no nulo cuando `active`.
- No se agregan entidades nuevas al modelo de datos. La feature 007 y la 013
  comparten un mismo servicio de activación por token.

## ADR-023 — Resolución de preguntas abiertas del vertical slice de vehículos y tutores autorizados

**Contexto.** Al construir el tercer vertical slice de SDD
(`specs/features/014`–`017` y `specs/api-contracts/vehicles.md`,
`student-guardians.md` — catálogo de vehículos del tutor y gestión de tutores
autorizados adicionales por alumno) se identificaron 5 preguntas abiertas de
negocio. Se resuelven aquí. Ninguna requiere cambios de esquema: `is_primary` y
`status` ya existen en `vehicles` y `student_guardians`.

**Decisión.**
1. **Borrado del vehículo principal.** Al eliminar un `vehicle` con
   `is_primary = true`, si el tutor tiene otros vehículos en el catálogo se
   promueve otro a principal, **seleccionado por el tutor** (no una promoción
   automática arbitraria): la operación de borrado indica cuál de los vehículos
   restantes queda como nuevo principal. Si el vehículo principal era el único
   del catálogo, el borrado procede y el catálogo simplemente queda vacío, sin
   principal.
2. **Autorización para invitar tutores: solo el principal.** Solo el
   `student_guardian` con `is_primary = true` (y `status = active`) de un alumno
   puede invitar tutores autorizados adicionales. Los guardianes no principales
   (aunque estén `active`) no invitan. Es la misma clase de decisión de
   control de identidad que motivó restringir acciones al `admin` en ADR-019
   (punto 5) y ADR-022 (punto 1): aquí el "dueño" del alumno es el guardián
   principal.
3. **La invitación de tutor siempre requiere aceptación.** La fila
   `student_guardian` nace en `status = invited` en ambas ramas de la invitación
   (correo de `user` nuevo y correo de `user` ya existente y `active`), y en
   todos los casos la persona invitada debe **aceptar** para que su
   `student_guardian` pase a `active` — es un consentimiento explícito a quedar
   autorizada sobre un alumno ajeno. Para un `user` que ya está `active`, la
   aceptación no define contraseña ni verifica correo: solo transiciona el
   `student_guardian` de `invited` a `active`. El mecanismo único de activación
   por token (ADR-022, punto 3) se parametriza también por si el `user` ya está
   activo (en cuyo caso omite el paso de contraseña).
4. **La aceptación reutiliza el endpoint compartido.** La aceptación de
   invitación de tutor usa el mismo endpoint que la de personal,
   `POST /invitations/:token/accept` (ver
   `specs/api-contracts/institution-members.md`), distinguiendo el tipo de
   invitación por el payload del token y aplicando el efecto secundario que
   corresponda: para tutor, `student_guardian.status → active` (y, solo si el
   `user` estaba `invited` sin contraseña, además `user.status → active` con
   definición de contraseña). Consistente con ADR-022 (punto 3).
5. **Revocación de tutores.**
   - **Autorización:** solo el `student_guardian` con `is_primary = true` (y
     `status = active`) puede revocar a otros guardianes del alumno (misma
     autoridad que para invitar, punto 2).
   - **Protección del principal / último guardián activo:** no se puede revocar a
     un `student_guardian` con `is_primary = true` sin **reasignar antes** la
     primariedad a otro guardián `active`. Esto incluye la auto-revocación del
     propio principal: para retirarse, primero debe reasignar `is_primary` a otro
     guardián activo. Evita que un alumno quede sin ningún guardián activo (mismo
     patrón de riesgo que la protección del último admin, ADR-022 punto 5).
   - **Reasignación de la primariedad:** se hace vía
     `PATCH /student-guardians/:id` fijando `isPrimary = true` sobre el nuevo
     principal, lo que desmarca al anterior (índice único parcial de Postgres,
     ADR-018 punto 6). Esta reasignación está reservada al `is_primary` actual.

**Consecuencias.**
- No se agregan ni modifican entidades: las decisiones se apoyan en columnas ya
  existentes (`vehicles.is_primary`, `student_guardians.is_primary`,
  `student_guardians.status`).
- `DELETE /vehicles/:id` acepta la designación del nuevo principal cuando se
  borra el vehículo principal y existen otros.
- `PATCH /student-guardians/:id` cubre dos operaciones: revocar
  (`status = revoked`) y reasignar la primariedad (`isPrimary = true`).
- Las 6 specs del slice dejan de marcar preguntas abiertas: quedan resueltas la
  promoción al borrar el principal, la autorización de invitación/revocación
  (solo `is_primary`), la aceptación obligatoria (incl. para `user` ya activo),
  el reuso del endpoint de aceptación y la protección del principal.
- El servicio de activación por token (ADR-022 punto 3) gana un caso más:
  aceptación sin definición de contraseña (para el `user` ya `active`).
- Reglas de negocio nuevas a forzar por test (ADR-021): solo el principal invita
  y revoca; no se revoca al principal sin reasignar primero; promoción del
  principal al borrar un vehículo principal.

## ADR-024 — Resolución de preguntas abiertas del vertical slice de flujo de `pickup_request`

**Contexto.** Al construir el cuarto y último vertical slice de la Fase 1
(`specs/features/018`–`023` y `specs/api-contracts/pickup-requests.md`,
`pickup-realtime-mqtt.md` — ciclo de vida completo de la recogida) se
identificaron 10 preguntas abiertas, entre ellas varios valores numéricos que las
specs deliberadamente no inventaron. Se resuelven aquí.

**Decisión.**
1. **Recogida activa duplicada: bloquear con 422.** No se permite crear un
   `pickup_request` nuevo si ya existe uno en estado no terminal
   (`en_route`/`arriving`/`arrived`) para el mismo `enrollment_id`. El código es
   **422**, consistente con la convención de validación cruzada entre entidades
   (ADR-023 punto 5 / ADR-022 punto 5).
2. **Throttling del recálculo de ETA: 20 segundos o 150 metros, lo que ocurra
   primero.** El `worker` recalcula el ETA (vía `MapsProvider`) cuando han pasado
   ≥ 20 s desde el último recálculo **o** el tutor se ha desplazado ≥ 150 m,
   lo que ocurra primero. La ingesta de `location_updates` sigue sin throttling.
3. **Umbral de transición a `arriving`: configurable por institución.** Se agrega
   la columna `institutions.arriving_lead_minutes` (`int`, NOT NULL, default
   `5`): minutos de ETA restante a partir de los cuales el `worker` transiciona
   el `pickup_request` a `arriving`, dando tiempo al plantel para vocear y
   preparar al alumno. Es **distinta** de `geofence_radius_meters` (detección de
   arribo real por proximidad); ambas condiciones —umbral de tiempo O entrada a
   la geocerca— disparan la transición, lo que ocurra primero. Es configurable
   por el mismo criterio que `arrival_tolerance_minutes` y
   `activation_radius_meters` (ADR-015): el tiempo de preparación varía por
   tamaño e infraestructura del plantel.
4. **`delivery_code` incorrecto: sin bloqueo, con registro en `audit_log`.** Es
   verificación presencial (tutor y staff cara a cara), no fuerza bruta remota;
   bloquear generaría fricción con niños esperando por un error de tecleo. No hay
   límite de reintentos. Cada intento fallido se registra en `audit_log` con
   `action = pickup_request.delivery_code_mismatch` (convención libre `entity.verb`,
   ADR-018 punto 9) para trazabilidad. [Nota: renombrado a
   delivery_code_mismatched por ADR-031 punto 7, forma participio consistente
   con el resto de audit_log.action]
5. **"Reportar incidencia": fuera de alcance.** El botón visible en las pantallas
   diseñadas no tiene entidad ni campo en el modelo. Se confirma fuera de alcance
   de este slice; cuando se aborde será su propio ADR + entidad nueva, no una
   improvisación dentro de este slice.
6. **Job de purga de `location_updates`: diario.** Con una ventana de retención de
   90 días (ADR-018 punto 8), ejecutar el job una vez al día (de madrugada,
   horario de bajo tráfico) es suficiente.
7. **`activation_radius_meters`: solo afordance de cliente, sin validación en
   servidor.** Es un gatillo de UX (habilita el botón "ya voy" en `parent`), no
   una frontera de seguridad: nada sensible se expone si un tutor lo "salta".
   Forzarlo en el servidor exigiría capturar ubicación al crear el
   `pickup_request` (antes de que exista el flujo MQTT), complejidad no
   justificada para algo de bajo riesgo. `POST /pickup-requests` no valida
   distancia.
8. **Transiciones válidas de la máquina de estados** (`packages/shared`,
   `pickup-request-status-machine.ts`, ADR-017):
   - `en_route → arriving` (automática, `worker`)
   - `en_route → arrived` (manual, el tutor confirma antes de que el `worker`
     detecte `arriving`)
   - `arriving → arrived` (manual, tutor)
   - `arrived → delivered` (staff, verifica `delivery_code`)
   - `en_route`/`arriving`/`arrived` → `cancelled` (manual, tutor, en cualquier
     estado no terminal)
   - `delivered` y `cancelled` son terminales (sin transiciones salientes).
   Se permite el salto directo `en_route → arrived`: es más realista que forzar
   el paso por `arriving`, ya que un tutor puede llegar rápido y confirmar
   manualmente antes de que el `worker` calcule la transición automática.
9. **Paginación del histórico: sí, desde ahora.** `GET /pickup-requests?enrollmentId=`
   pagina con `limit`/`offset` (default `limit = 20`), orden `created_at DESC`.
   Es barato agregarlo ahora y caro retrofitarlo: un `enrollment` acumula
   recogidas durante años.
10. **Payloads MQTT: estimación, no congelados.** La forma de los payloads de los
    topics queda como estimación derivable del modelo, **sujeta a revisión en
    Fase 7–9**, cuando se construyan los consumidores reales (`board`, consola de
    puerta) y se sepa con certeza qué campos necesita cada pantalla. No se
    congela ahora.
11. **Exposición del `delivery_code` en lectura.** El `delivery_code` es visible
    en `GET /pickup-requests/:id` para el `guardian_user_id` dueño del
    `pickup_request` (lo muestra en su app) **y** para cualquier
    `institution_member` de la institución asociada (vía
    `pickup_requests.institution_id`, ADR-018 punto 4), sin restricción de
    `role` (consistente con ADR-011: acceso abierto a la consola de puerta). El
    precedente de la pantalla "Puerta — Consola de salida" (`docs/design-brief.md`)
    confirma que el código se despliega directamente en la consola del operador,
    no se valida a ciegas. La verificación en la entrega
    (`PATCH /pickup-requests/:id/deliver`) sigue siendo server-side: el operador
    confirma que el código que muestra el tutor coincide con el de la consola, y
    un desajuste se maneja según el punto 4.

**Consecuencias.**
- **Cambio de esquema:** nueva columna `institutions.arriving_lead_minutes`
  (`int`, NOT NULL, default `5`) — actualiza `specs/entities/institution.md` y
  `docs/modelo-datos.md`. Se suma a los campos editables del perfil de
  institución (`specs/features/008-editar-perfil-institucion.md` y
  `specs/api-contracts/institutions.md`).
- **Nuevo `action` de `audit_log`:** `pickup_request.delivery_code_mismatch` (sin
  cambio de esquema; `audit_log.action` es convención libre, ADR-018 punto 9).
  [Nota: renombrado a delivery_code_mismatched por ADR-031 punto 7, forma
  participio consistente con el resto de audit_log.action]
- Las 8 specs del slice dejan de marcar preguntas abiertas (salvo la #5 y la #10,
  que quedan como decisiones explícitas: fuera de alcance / diferido a Fase 7–9,
  no como pendientes).
- Valores concretos a fijar en configuración/código: throttling 20 s / 150 m
  (worker), `arriving_lead_minutes` default 5 (institución), purga diaria (job).
- La máquina de estados de `packages/shared` (Fase 2) codifica el conjunto de
  transiciones del punto 8.
- Reglas de negocio nuevas a forzar por test (ADR-021): bloqueo de recogida
  activa duplicada (422); registro de `delivery_code` fallido en `audit_log`.
- Cierra la Fase 1 de `docs/plan-implementacion.md` (los cuatro vertical slices
  especificados).

## ADR-025 — Correcciones de consistencia cruzada tras validación de especificaciones (Fase 1)

**Contexto.** Al completar la Fase 1 de SDD (los cuatro vertical slices) se ejecutó
una validación cruzada exhaustiva entre las 15 specs de entidades, las 12 de
api-contracts, las 23 de features y los documentos de `docs/`
(`arquitectura.md`, `modelo-datos.md`, `decisiones.md`, `CLAUDE.md`,
`plan-implementacion.md`), usando agentes en paralelo. Se encontraron 6
discrepancias reales entre lo decidido en ADRs previos y su aplicación en las
specs, más dos bugs de especificación (features 016 y 004) y varios gaps de
documentación (referencias de ADR que ya regían una entidad pero no la citaban).
Se resuelven aquí. Ninguna es una decisión de fondo nueva: son sincronizaciones
que alinean las specs con decisiones ya tomadas (ADR-014, 018, 022, 023, 024) o
correcciones puntuales de contrato.

**Decisión.**
1. **Diagrama y enums incompletos: falta la transición `en_route → arrived`.**
   ADR-024 punto 8 ya permite el salto directo (`en_route → arrived`, el tutor
   confirma antes de que el `worker` detecte `arriving`), y
   `specs/features/021-confirmar-llegada-y-entrega.md` ya lo usa. Es un gap de
   sincronización, no una decisión nueva: se completa el diagrama ASCII de
   `docs/modelo-datos.md` y la sección Enums de `specs/entities/pickup_request.md`
   para reflejar el conjunto completo de transiciones ya decidido.
2. **Falta el constraint de "recogida activa única por enrollment".** ADR-024
   punto 1 decidió bloquear con 422 la creación de un `pickup_request` si ya existe
   uno no terminal para el mismo `enrollment_id`, pero
   `specs/entities/pickup_request.md` no lo documentaba como invariante forzada. Se
   agrega índice único parcial de Postgres, mismo patrón que `vehicles.is_primary`
   (ADR-018): `UNIQUE INDEX ... ON pickup_requests (enrollment_id) WHERE status IN
   ('en_route', 'arriving', 'arrived')`.
3. **Captura libre de vehículo sin forma de enviarse en la API.** ADR-014 preveía
   que el tutor pudiera capturar un vehículo no guardado en su catálogo ("captura
   libre"), pero `specs/api-contracts/pickup-requests.md` (`POST /pickup-requests`)
   solo aceptaba `vehicleId`. Se agregan `vehicleDescription` y `vehiclePlate`
   (string, opcionales) al body, mutuamente exclusivos con `vehicleId`: si se manda
   `vehicleId`, el snapshot se copia del catálogo (`vehicles`); si se mandan
   `vehicleDescription`/`vehiclePlate` sin `vehicleId`, es captura libre; si
   `arrivalMode = walking`, ninguno de los tres aplica.
4. **Cuatro columnas `NOT NULL` de `institutions` sin default ni punto de captura.**
   `geofence_radius_meters`, `activation_radius_meters`, `arrival_tolerance_minutes`
   y `advance_notice_minutes` eran `NOT NULL` sin default, y ningún feature las
   capturaba obligatoriamente (`001-registro-institucion.md` decía "valores por
   defecto o vacíos" sin que existiera un default real). Se agregan defaults a nivel
   de columna, tres de ellos tomados directamente de las pantallas ya diseñadas y
   auditadas (Colegio Simón Bolívar, panel "Tolerancia y avisos"):
   - `activation_radius_meters`: default `3000` (3 km, valor visible en el diseño)
   - `arrival_tolerance_minutes`: default `10` (valor visible en el diseño)
   - `advance_notice_minutes`: default `15` (valor visible en el diseño)
   - `geofence_radius_meters`: default `100` (sin precedente en el diseño; valor
     razonable, menor que el radio de activación, cubre el frente/estacionamiento del
     plantel)
   Con estos defaults, el registro de una institución (feature 001) no necesita
   capturarlos explícitamente — quedan editables después en
   `008-editar-perfil-institucion.md`, como ya estaba previsto.
5. **Inconsistencia sistemática 409 vs. 422.** Se corrigen 3 violaciones puntuales de
   la convención ya establecida en ADR-022 punto 5 (422 = regla de negocio cruzada
   entre entidades bien formada; 400 = mal formada; 409 solo para conflictos de
   duplicidad genuina):
   - `specs/api-contracts/vehicles.md`: `DELETE /vehicles/:id` con
     `newPrimaryVehicleId` inválido — cambia de 400 a 422.
   - `specs/api-contracts/enrollments.md`: `PATCH /enrollments/:id/approve` cuando
     `institution.status != approved` — cambia de 409 a 422.
   - `specs/api-contracts/pickup-requests.md`: caso "enrollment no aprobado" — cambia
     de 409 a 422 (consistente con el caso análogo de recogida activa duplicada, que
     ya usa 422 en el mismo endpoint).
6. **Alcance de `audit_log` incompleto.** `CLAUDE.md` exige registrar "aprobaciones,
   alta/baja de tutores" en `audit_log`, y `specs/entities/audit_log.md` ya usa
   `guardian.added` y `enrollment.approved` como ejemplos, pero ninguno de los
   api-contracts correspondientes lo documentaba. Se agrega explícitamente:
   - `specs/api-contracts/enrollments.md`: `approve`/`reject` registran
     `enrollment.approved` / `enrollment.rejected`.
   - `specs/api-contracts/student-guardians.md`: invitar/aceptar/revocar/reasignar
     principal registran `guardian.added` / `guardian.accepted` / `guardian.revoked` /
     `guardian.primary_reassigned`.
   - `specs/api-contracts/institution-members.md`: invitar/aceptar/cambiar rol/dar de
     baja registran `institution_member.added` / `institution_member.accepted` /
     `institution_member.role_changed` / `institution_member.removed`.
   `specs/api-contracts/students.md` queda **fuera de alcance**: la creación de un
   alumno no es "alta/baja de tutor" según la redacción de `CLAUDE.md`, y no se agrega
   registro de auditoría ahí.
7. **Bug en feature 016 (aceptar invitación de tutor).** El endpoint compartido
   `POST /invitations/:token/accept` (ADR-023 punto 4, diseñado para parametrizarse
   por tipo de invitación) validaba incorrectamente "ya aceptada" revisando
   `user.status = active` — válido para invitaciones de personal, pero incorrecto para
   invitaciones de tutor, donde lo pendiente es `student_guardian.status`, no
   `user.status` (el `user` puede ya estar `active` como tutor en otra institución). Se
   corrige: el chequeo de "ya completada" se resuelve según el tipo de invitación
   codificado en el payload del token — para personal, contra `user.status`; para
   tutor, contra `student_guardian.status`.
8. **Excepción no documentada en feature 004 (alta de alumno).** El guardián que
   registra a un `student` (feature 004) queda como `student_guardian` con
   `is_primary = true` y `status = active` directamente, sin pasar por `invited` — es
   correcto (quien registra al alumno no necesita auto-invitarse), pero no estaba
   documentado como excepción en la spec de la entidad, cuyo default es `invited`. Se
   agrega nota explícita en `specs/entities/student_guardian.md`: el guardián creador
   (feature 004) nace `active`; los guardianes agregados después por invitación
   (ADR-023) nacen `invited`.
9. **Endpoint faltante de baja de personal.** Al aplicar el punto 6 (alcance de
   `audit_log`) se detectó que `institution_member.removed` quedaba como nombre de
   acción reservado **sin endpoint correspondiente**:
   `specs/api-contracts/institution-members.md` solo tenía `PATCH` (cambio de rol),
   nunca una baja explícita. Se agrega `DELETE /institution-members/:id`:
   - **Autorización:** mismo guard que el resto de las acciones de configuración de
     esta spec — `institution_member.role = admin` de la institución (ADR-022 punto 1);
     el `InstitutionMembershipGuard` resuelve la institución desde la propia membresía
     (ADR-022 punto 4), como ya hace el `PATCH`.
   - **Protección del último admin:** mismo criterio que ya aplica al `PATCH` (ADR-022
     punto 5) — responde **422** si el miembro a eliminar es el único con `role = admin`
     de esa institución.
   - **No elimina el `user`:** solo la fila de `institution_members`. El `user` puede
     seguir existiendo (p. ej. como tutor, o como personal de otra institución).
   - Registra `institution_member.removed` en `audit_log`, cerrando el nombre que había
     quedado reservado en el punto 6.

**Consecuencias.**
- **Cambio de esquema:** 4 columnas de `institutions` ganan default (sin cambio de
  tipo ni nullability); nuevo índice único parcial en `pickup_requests` (recogida
  activa única por `enrollment_id`).
- `POST /pickup-requests` gana 2 campos opcionales de request
  (`vehicleDescription`/`vehiclePlate`, captura libre).
- 3 códigos HTTP corregidos de 409/400 a 422.
- 3 api-contracts ganan documentación de `audit_log` que antes faltaba (sin nuevas
  columnas; `audit_log.action` es convención libre `entity.verb`, ADR-018 punto 9).
- Nuevo endpoint `DELETE /institution-members/:id` (baja de personal), con protección
  del último admin (422) y registro `institution_member.removed`: el nombre de acción
  reservado en el punto 6 deja de estar sin endpoint.
- 1 bug de spec corregido (feature 016) sin cambio de esquema.
- 1 excepción de negocio documentada explícitamente (feature 004 /
  `student_guardian.md`).
- Varias specs de entidades ganan referencias a ADRs que ya las regían pero no
  citaban (ADR-022 en `institution_member`; ADR-023 en `student_guardian` y `vehicle`;
  ADR-024 en `pickup_request` y `pickup_request_status_history`).
- `CLAUDE.md` corrige la lista de identificadores de dominio (`guardian` no es una
  entidad propia; el concepto vive como `student_guardians.guardian_user_id`).
- Reglas de negocio nuevas a forzar por test/constraint (ADR-021): recogida activa
  única por `enrollment_id` (índice parcial).

---

## ADR-026 — Correcciones de la validación final de Fase 1 (SDD)

**Contexto.** Tras aplicar ADR-025, se corrió una tercera y última ronda de
validación cruzada exhaustiva (5 agentes en paralelo, 12 verificaciones) sobre la
Fase 1 completa, como checkpoint final antes de que empiece a existir código
(Fase 2). Se encontraron 4 discrepancias reales y 12 hallazgos menores. Este ADR
resuelve las decisiones de fondo; su aplicación puntual en cada spec queda
registrada en las "Consecuencias".

**Decisión.**

1. **Reactivación tras estado terminal: índices únicos parciales, no un mecanismo
   de reactivación.** Se detectó que `enrollments` (constraint única
   `(student_id, institution_id)`) y `student_guardians` (constraint única
   `(student_id, guardian_user_id)`) bloqueaban a nivel de esquema la creación de
   la "fila nueva" que ADR-018 puntos 2 y 7 exigen tras un estado terminal
   (`rejected`, `revoked`) — una contradicción entre el constraint y la regla de
   negocio ya decidida. Se resuelve relajando ambas constraints a **índices únicos
   parciales** que excluyen los estados terminales, mismo patrón que
   `vehicles.is_primary` (ADR-018) y la recogida activa única de `pickup_requests`
   (ADR-024 punto 2):
   ```sql
   -- enrollments
   UNIQUE (student_id, institution_id) WHERE status IN ('pending', 'approved')

   -- student_guardians
   UNIQUE (student_id, guardian_user_id) WHERE status IN ('invited', 'active')
   ```
   Esto preserva la semántica "terminal = requiere una solicitud/invitación nueva"
   (no se reactiva la fila existente in-place) sin bloquear físicamente la fila
   siguiente. No se introduce ningún endpoint ni flujo de "reactivación".

2. **Ampliación de la convención 409/422** (ver la enmienda a ADR-022 punto 5).
   Se aplica retroactivamente, **sin cambio de código**, a
   `specs/api-contracts/institutions.md` (bloqueo de `PATCH` por `status`) y a la
   validación `category`/`type`: ambos casos son un conflicto del recurso con su
   propio estado y quedan correctamente en **409**.

3. **Tres códigos de error corregidos a 422** (bugs confirmados; cruzan hacia otra
   entidad bajo la convención ampliada):
   - `specs/api-contracts/vehicles.md`: `DELETE /vehicles/:id` sin
     `newPrimaryVehicleId` cuando existen otros vehículos — 409 → 422.
   - `specs/api-contracts/student-guardians.md`: reasignar la primariedad a un
     guardián no `active` — 409 → 422.
   - `specs/api-contracts/student-guardians.md`: protección del guardián principal
     (revocar al principal sin reasignar antes; análoga a la del último admin) —
     409 → 422.

4. **Protección append-only de `audit_log` a nivel de base de datos.** Por ser la
   garantía forense/legal del proyecto (trazabilidad de acciones sensibles ante
   requerimientos de privacidad; ver `docs/arquitectura.md` sección LFPDPPP),
   `audit_log` recibe protección a nivel de base de datos: se revocan los
   privilegios `UPDATE` y `DELETE` sobre esa tabla para el rol de conexión de la
   aplicación (`api`/`worker` solo pueden `INSERT`/`SELECT`). Es una **excepción
   deliberada** al criterio general de ADR-017/ADR-018 (evitar mecanismos de base
   de datos y preferir la capa de servicio): se justifica porque la inmutabilidad
   de un log forense debe sobrevivir incluso a un bug de la aplicación, no solo a
   la disciplina del código. `location_updates` y `pickup_request_status_history`
   (también conceptualmente append-only) **NO** reciben esta protección — para
   esos dos basta una nota de capa de servicio (ningún endpoint expone
   `UPDATE`/`DELETE` sobre ellos), consistente con el resto del proyecto.

   **Enmienda (Fase 3, implementación de migraciones).** El mecanismo descrito
   arriba —revocar `UPDATE`/`DELETE` sobre `audit_log` para el rol de conexión
   de la aplicación— no ofrece protección real: en PostgreSQL el dueño de una
   tabla ignora los privilegios ACL sobre ella, y el rol de conexión
   configurado en `.env` (`api`/`worker`) es el mismo rol que ejecuta las
   migraciones y por tanto el dueño de `audit_log`. Un `REVOKE` sobre el
   propio dueño no tiene efecto real — sería protección de papel. Se corrige
   el mecanismo a un **trigger de base de datos**
   (`BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW`) que rechaza la
   operación (`RAISE EXCEPTION`) sin importar qué rol la ejecute, incluido el
   dueño de la tabla. El trigger bloquea todo `DELETE` sin condición; en
   `UPDATE` permite únicamente la forma exacta que produce el cascade
   `ON DELETE SET NULL` ya decidido para `audit_log.actor_user_id` (ver
   `specs/entities/user.md`): `actor_user_id` pasa de no nulo a nulo sin que
   ninguna otra columna cambie. Cualquier otro `UPDATE` sigue rechazado. Se
   mantiene la misma excepción deliberada ya aceptada arriba (mecanismo de
   base de datos en vez de capa de servicio, justificado por la naturaleza
   forense de `audit_log`); no se introduce separación de roles de base de
   datos (un rol de migraciones distinto del rol de conexión de la
   aplicación), que habría sido un cambio de alcance mayor.

5. **Consolidación de nombres de `audit_log.action`: `student_guardian.*`, no
   `guardian.*`.** Las 4 acciones `guardian.added` / `guardian.accepted` /
   `guardian.revoked` / `guardian.primary_reassigned` (documentadas en ADR-018
   punto 9 y usadas como ejemplo en `audit_log.md`) usan un prefijo que no
   corresponde a ninguna entidad real: `guardian` no es una tabla (ya aclarado en
   `CLAUDE.md` tras ADR-025). Se renombran a `student_guardian.added` /
   `student_guardian.accepted` / `student_guardian.revoked` /
   `student_guardian.primary_reassigned`, consistente con la convención
   `entity.verb` de ADR-018 punto 9. Sin impacto de esquema (`audit_log.action` es
   texto libre).

6. **Gap de features del super-admin: diferido, no se especifica en esta ronda.**
   No existen features para que el super-admin apruebe (`institution.approved`) o
   suspenda (`institution.suspended`) una institución, pese a ser acciones
   auditables ya previstas en ADR-018 punto 1. Es un gap de cobertura, no una
   contradicción: se registra como pendiente explícito en
   `docs/plan-implementacion.md` para especificarse como un slice futuro
   (probablemente junto con el resto de la consola de super-admin). No se resuelve
   en esta ronda.

**Consecuencias.**
- Dos constraints únicas cambian de totales a parciales (`enrollments`,
  `student_guardians`) — impacta `specs/entities/enrollment.md`,
  `specs/entities/student_guardian.md` y `docs/modelo-datos.md`.
- `specs/features/005-asociar-institucion.md` y
  `specs/features/015-invitar-tutor-autorizado.md` corrigen su lógica de rechazo
  para considerar el estado de la fila existente, no solo su existencia.
- `audit_log` gana una restricción de privilegios a nivel de base de datos —
  primer y único caso del proyecto de mecanismo de BD por encima de la capa de
  servicio, justificado explícitamente por su naturaleza forense.
- 4 nombres de `audit_log.action` renombrados (`guardian.*` → `student_guardian.*`)
  en las specs y ADRs que los mencionan.
- 3 códigos HTTP corregidos de 409 a 422 (`vehicles.md`, `student-guardians.md`).
- `location_updates` y `pickup_request_status_history` ganan nota explícita de
  capa de servicio para su invariante append-only; `location_update.md` corrige la
  referencia estancada al job de purga (ya existe como feature 023).
- `institution_member.md` sube la protección del último admin a su sección de
  Invariantes de negocio; `enrollment.md` y `pickup_request.md` ganan notas de
  capa de servicio que faltaban.
- `specs/README.md` formaliza el template de 7 secciones de `specs/entities/`.
- Gap de super-admin queda registrado como trabajo futuro, no resuelto.
- Reglas de negocio a forzar por test/constraint (ADR-021): unicidad parcial de
  `enrollments` y `student_guardians` (excluyendo estados terminales); revocación
  de `UPDATE`/`DELETE` sobre `audit_log` para el rol de la aplicación.

## ADR-027 — Corrección de nomenclatura de tablas: plural sin excepción

**Contexto.** Al implementar las entidades de TypeORM (Fase 3, primer código
que toca el esquema real), se detectó que 12 de las 14 `specs/entities/*.md`
usaban el nombre de tabla en singular — en su encabezado H1 y en los
fragmentos internos que referencian esa tabla (notación `FK → tabla.columna`,
relaciones `vía tabla.columna`, descripciones de índices) — divergiendo
silenciosamente de `docs/modelo-datos.md`, que documenta las 14 entidades en
plural desde su origen (encabezados `### \`users\``, `### \`institutions\``,
etc.), y de las referencias literales ya usadas en ADR-018, ADR-024, ADR-025 y
ADR-026 (`vehicles.is_primary`, `pickup_requests (enrollment_id)`,
`enrollments` y `student_guardians` como constraints). La divergencia no se
había detectado antes porque ninguna implementación real había tocado el
esquema hasta esta fase; las 12 specs afectadas eran internamente
consistentes entre sí (mismo error repetido en cada una), lo que ocultó el
desvío frente a su propia fuente.

Las únicas dos entidades ya correctas eran `pickup_request_status_history` y
`audit_log`: `docs/modelo-datos.md` tampoco las pluraliza (no es un desvío,
es la convención correcta para esas dos).

La revisión se extendió a `specs/api-contracts/*.md` (12 archivos) y
`specs/features/*.md` (23 archivos), donde la misma tabla en singular
aparecía de forma extensiva en prosa (reglas de autorización, tablas de
errores, descripciones de payload) — 447 ocurrencias en total. Las rutas REST
(`GET /institution-members/:id`, etc.) ya usaban su propia convención
kebab-case plural y no se vieron afectadas. Se detectó además una convención
distinta que coincide superficialmente en sintaxis: los valores de
`audit_log.action` siguen el patrón `entity.verb` (ADR-018 punto 9, ADR-026
punto 5) usando el nombre de entidad en **singular** deliberadamente (ej.
`enrollment.approved`, `student_guardian.added`, `institution_member.removed`)
— esto no es una referencia de tabla y se preserva sin cambio.

**Decisión.** La convención de nomenclatura de tablas es **plural sin
excepción** (salvo `pickup_request_status_history` y `audit_log`, que nunca
se pluralizan, tal como los documenta `docs/modelo-datos.md` desde su
origen), consistente con ADR-018, ADR-024, ADR-025, ADR-026 y
`docs/modelo-datos.md`. Se corrige el desvío en:
1. Las 14 entidades de TypeORM ya implementadas (12 con el nombre de tabla
   corregido; las 2 restantes ya eran correctas).
2. Las 12 `specs/entities/*.md` afectadas (encabezado H1 y toda referencia
   interna literal a esa tabla).
3. `specs/api-contracts/*.md` y `specs/features/*.md` donde aparecía la
   misma tabla en singular en prosa — con la excepción explícita de los
   valores de `audit_log.action` en convención `entity.verb`, que
   permanecen en singular por diseño.

**Consecuencias.**
- `specs/entities/*.md` vuelve a ser fiel a `docs/modelo-datos.md`,
  restaurando su rol de fuente de verdad sin contradicción interna
  (`CLAUDE.md` §"Reglas de implementación").
- Ninguna migración se había escrito todavía (Fase 3 recién arrancando), así
  que la corrección no tiene costo de migración de datos reales — es un
  cambio de texto en specs y en clases de TypeORM aún no desplegadas.
- `pickup_request_status_history` y `audit_log` no requirieron cambio: nunca
  estuvieron en plural en `docs/modelo-datos.md`.
- Los valores de `audit_log.action` (`entity.verb`, ej.
  `student_guardian.added`) permanecen explícitamente en singular — no se
  confunden con la nomenclatura de tablas pese a la coincidencia sintáctica
  superficial (`tabla.columna` vs. `entidad.verbo`).

## ADR-028 — Idioma de errores de la API y reutilización de cuenta en registro de institución

**Contexto.** Al preparar la implementación del núcleo de autenticación
(registro, login, verificación de correo — `specs/features/001-003`, `007`)
surgieron 2 ambigüedades no resueltas por ningún ADR previo: en qué idioma
va el contenido de los mensajes de error de la API, y cómo conciliar que
`specs/features/001-registro-institucion.md` dice que el `users` se "crea o
reutiliza, si ya existía la cuenta" mientras que
`specs/api-contracts/auth.md` documenta 409 sin excepción para email ya
registrado. Se resuelven ambas aquí antes de implementar Fase 4.

**Decisión.**
1. **Errores de la API: `message` en inglés + campo `code` machine-readable
   en inglés; la traducción a español vive en cada frontend.** Mismo patrón
   ya establecido en `docs/design-brief.md` para los estados de
   `pickup_request` (texto de UI en español, identificador interno en
   inglés): la API no decide en qué idioma habla a 3 frontends distintos:
   cada frontend traduce por `code` en su propia capa de i18n. `message`
   queda como texto de desarrollo/logs (consistente con "código en inglés"
   de `CLAUDE.md`), nunca se muestra directo al usuario final.

   **Enmienda (Fase 6, `pickups`):** `INVALID_PAYLOAD` es el único `code`
   del proyecto que es **muchos-a-uno**: cubre cualquier regla de
   `class-validator` de cualquier DTO, a diferencia del resto de los `code`
   (1-a-1 con su causa de negocio). Por eso, y solo para `INVALID_PAYLOAD`,
   el body de error incluye además un campo `details` — un arreglo de
   `{ property, constraints }`, uno por cada `ValidationError` que reporta
   `class-validator` — para poder distinguir cuál campo/regla falló sin
   leer el código fuente del validador. `constraints` sigue el mismo
   criterio que `message` arriba: texto de desarrollo/logs, no listo para
   mostrar al usuario final sin traducción del frontend. El resto de los
   `code` del proyecto permanece como `{ code, message }` sin este campo,
   por ser ya suficientemente específicos por sí mismos. Shape documentado
   una sola vez en `specs/api-contracts/README.md`.
2. **Registro de institución: reutilizar cuenta existente solo si la
   contraseña coincide.** Si el email del administrador ya existe como
   `users` y la contraseña enviada coincide con esa cuenta, se reutiliza:
   se crea la `institutions` + `institution_members` (`role = admin`) sobre
   el `users` existente, sin nueva verificación de correo (la contraseña
   correcta ya prueba posesión de la cuenta). Si el email existe y la
   contraseña NO coincide, 409 (mismo comportamiento que hoy). Justificación
   de negocio: el proyecto ya asume que una persona puede tener varios roles
   con la misma cuenta (tutor + admin de institución, ver ADR-004 y el
   modelo de `users` único); sin la verificación de contraseña, "reutilizar"
   sería una vulnerabilidad de apropiación de cuenta.

**Consecuencias.**
- `specs/api-contracts/auth.md` gana el campo `code` en las respuestas de
  error de los 6 endpoints de este contrato, y su endpoint de registro de
  institución documenta el flujo de reutilización condicionada a contraseña.
- `specs/features/001-registro-institucion.md` se ajusta para especificar la
  verificación de contraseña como condición de la reutilización (antes solo
  decía "reutilizado si ya existía", sin ese detalle).
- Ningún cambio de esquema de base de datos.

## ADR-029 — Columna compañera de solo lectura `institutionId` en 6 entidades, para `InstitutionMembershipGuard`

**Contexto.** Al implementar `InstitutionMembershipGuard` (ADR-022 punto 4) en
su modo `@InstitutionResource` se detectó que las entidades candidatas a
usarlo (`InstitutionMember`, `DeliveryPoint`, `DismissalWindow`,
`DismissalException`, `Enrollment`) solo exponían la institución vía la
relación TypeORM `institution: Institution` (`@ManyToOne` + `@JoinColumn`).
El guard, para no forzar un join a `institutions` en cada request que solo
necesita el `institutionId` como escalar, necesita poder leerlo sin cargar
la relación completa.

Nota de precisión: esto **no es el mismo problema** que resolvió
`pickup_requests.institution_id` (ADR-018 punto 4). Ahí se agregó una
relación directa nueva a `institutions` para evitar el join
**multi-hop** `pickup_request → enrollment → institution`. Las 5 entidades
de aquí ya tienen una relación **directa, de un solo salto** a
`institutions` — no hay múltiples hops que evitar. El problema es distinto
y más acotado: leer el valor escalar de un FK ya directo sin instanciar el
objeto relacionado completo.

**Decisión.** Se agrega, en las 5 entidades, una propiedad TypeORM
compañera de solo lectura que mapea a la **misma columna física** ya usada
por la relación `institution` existente — no una columna nueva:

```typescript
@Column({ name: 'institution_id', type: 'uuid', nullable: true, insert: false, update: false })
institutionId!: string;

@ManyToOne(() => Institution, ...)
@JoinColumn({ name: 'institution_id' })
institution!: Institution;
```

`insert: false, update: false` asegura que solo la relación controla
escrituras; la propiedad plana es puramente de lectura. `nullable: true` es
deliberado: refleja la nulabilidad real que ya tiene la columna física hoy
(el `@ManyToOne` de las 5 entidades no fija `nullable: false`, así que la
columna FK subyacente ya admite `NULL` a nivel de esquema, aunque las
specs y la capa de servicio garanticen que en la práctica siempre está
poblada). Endurecer esa opción a `nullable: false` habría producido una
migración real (intento de agregar una constraint `NOT NULL`) — se
verificó explícitamente que no es el caso (ver Consecuencias).

`InstitutionMembershipGuard` (`institution-membership.guard.ts`) no cambia:
ya soportaba este caso genéricamente vía `institutionColumn` (default
`'institutionId'`) con resolución dot-path. Esta ronda solo hace que el
caso común (columna plana, sin necesidad de dot-path) funcione out-of-the-box
para estas 5 entidades.

**Consecuencias.**
- Sin cambio de esquema real: se verificó corriendo
  `migration:generate` antes y después del cambio de entidades — el
  diff generado es **idéntico** en ambos casos (mismo conjunto de `DROP
  INDEX` sobre los índices únicos parciales/GIN que ya existían como drift
  preexistente y documentado entre las entidades TypeORM y las migraciones
  SQL manuales de ADR-024/ADR-025 — ninguna línea nueva relacionada con
  `institution_id`). Ese drift preexistente es un asunto aparte, no
  introducido ni agravado por este ADR, y queda fuera de alcance aquí.
- `specs/entities/institution_member.md`, `delivery_point.md`,
  `dismissal_window.md`, `dismissal_exception.md` y `enrollment.md` ganan
  una nota en "Invariantes de negocio" documentando la propiedad compañera.
- Ningún cambio en `InstitutionMembershipGuard` ni en su contrato
  (`InstitutionResourceOptions`).

[Nota: extendido a una 6ª entidad, `PickupRequest`, al implementar
`PATCH /pickup-requests/:id/deliver` (feature 021) — `pickup_requests`
también tiene una relación directa de un solo salto a `institutions`
(`institution_id`, denormalizada por ADR-018 punto 4 para evitar el join
multi-hop vía `enrollments`, no para este propósito), y quedó fuera de la
lista original de 5 solo porque el guard todavía no tenía ningún endpoint
`@InstitutionResource` sobre `pickup_requests` en ese momento. Mismo patrón,
misma columna física, mismo `insert:false, update:false` — salvo que aquí
`nullable` se omite porque `institution_id` ya es `NOT NULL` en el esquema
de `pickup_requests`. Verificado sin cambio de esquema, igual que las 5
originales. `specs/entities/pickup_request.md` gana la nota
correspondiente.]

## ADR-030 — `users.full_name` pasa a nullable

**Contexto.** Mismo problema que resolvió `password_hash` (ADR-022 punto 2),
detectado en Fase 5 al implementar la invitación de tutores autorizados
(`specs/features/015-invitar-tutor-autorizado.md`): cuando
`POST /students/:id/guardians/invite` recibe un correo que no corresponde a
ningún `users` existente, se crea un `users` nuevo con `status = invited`
antes de que esa persona haya podido decir cuál es su nombre — el
`fullName` recién se conoce cuando acepta la invitación
(`POST /invitations/:token/accept`, feature 016), momento en el que también
define su contraseña por primera vez. Como `full_name` era `NOT NULL` sin
default, la implementación inicial insertaba `''` (string vacío) como
valor transitorio — un placeholder falso, visible en cualquier lectura
directa de la fila mientras la invitación sigue pendiente, exactamente el
problema que ADR-022 punto 2 ya había resuelto para `password_hash` con la
misma mecánica de invitación.

El mismo problema aplica en principio a `institution_members` (feature 012,
rama de correo nuevo) aunque ese módulo no está implementado todavía: la
invitación de personal tampoco captura un nombre en el alta, solo en la
aceptación.

**Decisión.** `users.full_name` pasa de `NOT NULL` a **nullable**, mismo
patrón y misma justificación que `password_hash`:
- Es `NULL` mientras el `users` fue creado por invitación
  (`student_guardians` o, en el futuro, `institution_members`) y esa
  persona todavía no acepta.
- Se llena por primera vez al aceptar la invitación
  (`POST /invitations/:token/accept`), en el mismo paso donde se define la
  contraseña para un `users` que nace sin ella.
- Invariante asociada, igual que la de `password_hash`: un `users` con
  `status = active` debe tener `full_name` no nulo. No se implementa como
  `CHECK` constraint; se valida en la capa de servicio al activar la cuenta
  (auto-registro, que siempre captura el nombre de entrada, o aceptación de
  invitación, que lo define por primera vez), consistente con ADR-017.
- El auto-registro (features 001/002) sigue capturando `full_name` en el
  formulario de alta, así que en ese camino nunca es nulo.

Se prefiere `NULL` explícito sobre cualquier placeholder (string vacío,
email, etc.): `NULL` es la representación honesta de "este dato no existe
todavía", consistente con el criterio ya sentado por ADR-022 punto 2 — no
se introduce un criterio distinto para un problema idéntico.

**Consecuencias.**
- `users.full_name`: `varchar(255) NOT NULL` → `varchar(255) NULL`.
  Migración `UserFullNameNullable1783826146163` (`ALTER TABLE "users" ALTER
  COLUMN "full_name" DROP NOT NULL`); se verificó corriendo
  `migration:generate` después de aplicarla — el diff resultante es vacío
  ("No changes in database schema were found"), confirmando que no queda
  ningún cambio de esquema adicional no intencionado.
- Actualiza `specs/entities/user.md` (fila `full_name` e invariante nueva) y
  `docs/modelo-datos.md`.
- `apps/api/src/student-guardians/student-guardians.service.ts`: el `users`
  nuevo creado en `invite()` deja de insertar `fullName: ''`; ahora no
  provee el campo (`NULL` por default de columna). El flujo de
  `POST /invitations/:token/accept` no cambia: ya definía `fullName` cuando
  `passwordHash` nace `null`, solo que ahora escribe sobre un valor `NULL`
  real en vez de sobrescribir un placeholder falso.
- `specs/api-contracts/student-guardians.md` e `institution-members.md`:
  el campo `fullName` en las respuestas de `GET .../guardians` /
  `GET .../members` puede ser `null` mientras el `users` referenciado no ha
  aceptado su invitación (`status = invited`) — se documenta explícitamente
  en ambos contratos en vez de dejarlo como string garantizado.
- Regla de negocio nueva a forzar por test (ADR-021): `invite()` con correo
  nuevo persiste `full_name = null` (no `''`); toda lectura de un guardián o
  miembro invitado-no-aceptado debe manejar `fullName: null` explícitamente
  en el cliente.

## ADR-031 — Resolución de los huecos de la revisión previa de Fase 6

**Contexto.** Antes de escribir una sola línea del slice de `pickup_requests`
(features 018–023 + `worker`) se corrió una revisión previa exhaustiva de sus
specs contra el código ya construido en las Fases 2–5, con el mismo criterio de
"spec antes que código" (ADR-021) que se aplicó en las fases anteriores. La
revisión confirmó que las piezas centrales están sanas —la máquina de estados de
`packages/shared` coincide transición por transición con ADR-024 punto 8; los
builders de topics producen exactamente los strings documentados; los índices
únicos parciales excluyen los estados terminales— pero encontró **cuatro huecos
bloqueantes** y varios menores que, de no resolverse aquí, se habrían "acuñado
sobre la marcha" durante la implementación:

1. `specs/api-contracts/pickup-requests.md` documenta ~20 filas de error y
   **ninguna** tiene el string `code` exacto, solo el status HTTP — exactamente
   el patrón que en la Fase 5 dejó 36 códigos vivos en el código y ausentes de
   toda spec.
2. El `worker` es un esqueleto (`app.module.ts` con `imports: []` y un service
   placeholder) sin ninguna spec que defina su estructura de módulos, el ciclo
   de vida de su conexión MQTT ni el wiring de sus ports — el mismo tipo de
   hueco que `InstitutionMembershipGuard` tuvo antes de construirse.
3. No existe implementación concreta de `MqttClient` en ningún proceso, ni la
   dependencia `mqtt` en ningún `package.json`, pese a que la feature 018 exige
   que el **`api`** publique al crear la recogida.
4. El throttling de ETA de ADR-024 punto 2 ("20 s **o** 150 m") no tiene dónde
   guardar su mitad temporal: los 150 m se computan contra `last_location`, pero
   no existe ninguna columna que registre **cuándo** fue el último recálculo.

**Decisión.**

1. **Códigos de error de `pickup_requests`.** Se acuñan cuatro códigos nuevos:
   - `ENROLLMENT_NOT_APPROVED` (**422**) — el `enrollments` no está en
     `status = approved`; cruza hacia otra entidad.
   - `ACTIVE_PICKUP_REQUEST_EXISTS` (**422**) — ya hay un `pickup_requests` no
     terminal para ese `enrollment_id`; se decide consultando **otra fila** de la
     misma tabla, no el estado del recurso propio (que ni existe todavía).
   - `INVALID_STATUS_TRANSITION` (**409**) — la transición pedida no es válida
     según la máquina de estados compartida; autoconsulta del estado propio del
     recurso.
   - `INVALID_DELIVERY_CODE` (**401**) — el `deliveryCode` tecleado no coincide;
     categoría nueva, ver punto 2.

   Y se **reutilizan sin cambio** los ya acuñados en la Fase 5:
   `NOT_STUDENT_GUARDIAN`, `GUARDIAN_NOT_ACTIVE`, `NOT_INSTITUTION_MEMBER`,
   `NOT_VEHICLE_OWNER`, `RESOURCE_NOT_FOUND` e `INVALID_PAYLOAD`. Reutilizar es
   deliberado: un frontend que ya traduce `NOT_INSTITUTION_MEMBER` no debe
   aprender un sinónimo por cada módulo nuevo (ADR-028).

2. **`INVALID_DELIVERY_CODE` inaugura una tercera categoría HTTP: `401` para
   verificación de credencial/secreto compartido.** La convención de ADR-022
   punto 5 (ya ampliada por ADR-026) reconocía dos categorías —409 para el
   conflicto con el estado propio, 422 para la regla que cruza hacia otra
   entidad o fila— y el `deliveryCode` incorrecto no encaja limpiamente en
   ninguna: comparar el código tecleado contra `pickup_requests.delivery_code` de
   la misma fila es formalmente autoconsulta (→ 409), pero el recurso **no está
   en conflicto con su estado**: sigue en `arrived`, perfectamente válido, y lo
   que falló fue un secreto que no coincide. Es el mismo principio que
   `INVALID_CREDENTIALS` en el login, aplicado a una acción concreta en vez de a
   la sesión. Se documenta como tercera categoría en ADR-022 punto 5.

   Consistente con ADR-024 punto 4, **no hay bloqueo ni límite de reintentos**:
   la verificación es presencial (tutor y staff cara a cara), no fuerza bruta
   remota. Cada intento fallido se registra en `audit_log` (puntos 7 y 8).

3. **La estructura del `worker` se documenta en `docs/arquitectura.md`, no como
   spec aparte.** Mismo tratamiento que recibió la "forma concreta" de
   `InstitutionMembershipGuard`: es infraestructura de un proceso, no una feature
   de negocio, y `specs/features/` describe comportamiento observable, no
   cableado de módulos. La sección expandida cubre la estructura de módulos
   NestJS standalone, el ciclo de vida de la conexión MQTT (conexión inicial,
   reconexión, manejo de desconexión, shutdown graceful) y cómo se inyectan
   `MqttClient` y `MapsProvider`.

4. **El `worker` se suscribe por comodín, no dinámicamente.** Una sola
   suscripción al patrón MQTT `school-pickup/institution/+/pickup/+/location`
   (con wildcards `+` de un solo nivel), hecha al arrancar, en vez de
   suscribirse/desuscribirse a un topic concreto por cada `pickup_requests` que
   nace y termina. La alternativa dinámica obliga al `worker` a enterarse de cada
   alta (que ocurre en el `api`, otro proceso) y a reconstruir su set de
   suscripciones tras cada reconexión o reinicio: complejidad y modos de falla
   nuevos sin beneficio real, dado que el ACL del broker ya acota qué puede
   publicar cada cliente.

   Consecuencia directa: el `worker` recibe el `institutionId` y el
   `pickupRequestId` **solo en el string del topic** (el payload no los lleva), así
   que hace falta un **parser inverso** en `packages/shared`, compañero de los
   builders ya existentes. Contradice el criterio original de no construirlo
   (YAGNI: mientras nadie consumiera topics con comodín, un parser era código sin
   consumidor) — se justifica ahora precisamente porque aparece el primer
   consumidor real.

   **Ampliación (implementación del adapter concreto).** El QoS por dirección
   ya estaba decidido arriba (0 para ubicación, 1 para transiciones de
   estado), pero no se había anticipado que fuera el propio port quien debía
   exponerlo por llamada — se descubrió al implementar la clase concreta de
   `MqttClient`. El port `MqttClient.publish()` expone `qos: 0 | 1` como
   parámetro **requerido** (sin default), para que cada caller decida
   explícitamente en vez de heredar un valor implícito: evita que una
   transición de estado se publique por error con QoS 0 (pérdida silenciosa)
   por un olvido del caller.

5. **El estado del throttling de ETA vive en una columna, no en la memoria del
   proceso.** Se agrega `pickup_requests.eta_calculated_at` (`timestamptz`,
   nullable): marca cuándo se recalculó el ETA por última vez, y es contra ella
   que el `worker` evalúa la mitad temporal del throttling de ADR-024 punto 2
   (≥ 20 s). La mitad espacial (≥ 150 m) ya era computable contra `last_location`.
   Es el mismo patrón que `last_location`, `estimated_arrival_at` y `eta_seconds`:
   estado del trayecto, persistido en la fila del trayecto.

   Mantenerlo en memoria del `worker` se descarta: se pierde en cada reinicio
   (tras el cual el proceso recalcularía el ETA en la primera lectura de **cada**
   trayecto activo, un pico de llamadas facturables al `MapsProvider`) y no
   sobrevive a una segunda instancia del proceso.

6. **`StubMapsProvider` para no bloquear la Fase 6.** Implementación concreta de
   `MapsProvider` que estima el ETA por distancia haversine entre origen y
   destino a una velocidad promedio asumida, sin llamar a ningún proveedor
   externo ni requerir API key. Mismo patrón, y misma justificación, que
   `ConsoleEmailProvider` frente a `ResendEmailProvider` (ADR-009): el port ya
   está definido (ADR-017), así que el resto del slice puede construirse y
   testearse completo contra una implementación trivial.

   **No resuelve la decisión de fondo:** el proveedor real (Google Maps vs.
   Mapbox) sigue abierto en la tabla de pendientes de
   `docs/plan-implementacion.md`. El stub solo evita que esa decisión abierta
   bloquee el corazón del producto; el día que se elija proveedor, se sustituye
   la implementación sin tocar a quien la consume.

   **Enmienda — valores concretos del stub.** Velocidad promedio asumida:
   30 km/h (`STUB_AVERAGE_SPEED_KMH`,
   `apps/worker/src/maps/stub-maps.provider.ts`). Destino del cálculo:
   `institutions.location` (confirmado contra
   `specs/features/020-transicion-arriving.md`, que ya compara
   `last_location` contra la ubicación de la institución). Ambos son
   constantes del stub únicamente — no representan ninguna decisión sobre el
   proveedor real (Google/Mapbox), que sigue abierta.

7. **La acción de auditoría se renombra a forma participio.**
   `pickup_request.delivery_code_mismatch` (sustantivo) pasa a
   **`pickup_request.delivery_code_mismatched`** (participio), consistente con
   todas las acciones ya existentes: `enrollment.approved`,
   `student_guardian.added`, `institution.suspended`. La convención `entity.verb`
   de ADR-018 punto 9 pedía un verbo y se había colado un sustantivo; se corrige
   antes de que exista una sola fila con el nombre viejo, no después.

8. **Contenido de la fila de `audit_log` para esa acción.**
   `entity_type = 'pickup_request'`; `entity_id` = el id del `pickup_requests`
   sobre el que se intentó la entrega; `metadata = null`. **No se registra el
   código incorrecto que se tecleó**: minimización de datos (LFPDPPP): saber que
   hubo un intento fallido sobre ese trayecto, cuándo y quién lo hizo es todo el
   valor forense que la fila necesita aportar; el dígito equivocado no agrega
   ninguno.

**Consecuencias.**
- **Cambio de esquema:** nueva columna `pickup_requests.eta_calculated_at`
  (`timestamptz`, nullable). Actualiza `specs/entities/pickup_request.md` y
  `docs/modelo-datos.md`. **Sin migración todavía:** las tablas de
  `pickup_requests` ya existen desde `InitSchema`, así que la columna se agrega
  con su propia migración al implementar el módulo `pickups` (Fase 6), no en esta
  ronda de documentación.
- **Nueva función en `packages/shared`** (a implementar en la ronda de código, no
  en esta): parser inverso del topic de ubicación, compañero de los builders
  existentes.
- `docs/arquitectura.md` gana una sección concreta del `worker` (módulos, ciclo de
  vida MQTT, wiring de ports) y la mención del patrón de suscripción con comodín
  en la sección de topics.
- La convención HTTP del proyecto pasa de tres a **cuatro** categorías
  (400 / 401 / 409 / 422), documentadas juntas en ADR-022 punto 5.
- `specs/api-contracts/pickup-requests.md` pasa a documentar el `code` exacto de
  cada error, como `auth.md` — que hasta hoy era el único contrato que lo hacía.
- Reglas nuevas a forzar por test (ADR-021): el `deliveryCode` incorrecto
  responde `401 INVALID_DELIVERY_CODE`, deja el `pickup_requests` en `arrived`,
  no crea fila de historial de estado y **sí** crea la fila de `audit_log` con
  `metadata = null`; el throttling no recalcula el ETA si
  `now() - eta_calculated_at < 20 s` y el desplazamiento contra `last_location`
  es < 150 m.

## ADR-032 — Institución no aprobada también bloquea la creación de `pickup_request`

**Contexto.** Al implementar la feature 018 (`POST /pickup-requests`) se
encontró un hueco antes de escribir código: la precondición documentada
("el `enrollments` debe estar en `status = approved`", ADR-018 punto 2) solo
verifica el estado del `enrollments`, nunca el de su `institutions`. Pero
`institutions.status` puede transicionar `approved → suspended` **después**
de que sus `enrollments` ya fueron aprobados (ADR-018 punto 2 solo condiciona
la transición `pending → approved` del enrollment en el momento de su
aprobación, no impide que la institución se suspenda más tarde). Ni
`specs/features/018-crear-pickup-request.md` ni la tabla de errores de
`specs/api-contracts/pickup-requests.md` contemplan re-verificar
`institutions.status` en cada creación de `pickup_request`, dejando abierta la
posibilidad de que un tutor inicie una recogida sobre una institución
suspendida mientras el `enrollments` subyacente sigue en `approved`.

**Decisión.** Se agrega una verificación cruzada adicional al crear un
`pickup_request`: además de `enrollments.status = approved`, se exige
`institutions.status = approved` para la institución del enrollment
(denormalizada en `pickup_requests.institution_id`, ADR-018 punto 4). Se
**reutiliza** el `code` `INSTITUTION_NOT_APPROVED` (**422**) ya acuñado en la
Fase 5 para el mismo tipo de chequeo en `EnrollmentsService.approve()` — mismo
criterio de reutilización de ADR-031 punto 1: un frontend que ya traduce ese
`code` no debe aprender un sinónimo para la misma situación de negocio en un
endpoint distinto.

Queda fijado el orden de validación de `POST /pickup-requests`: ownership del
guardián (`NOT_STUDENT_GUARDIAN`/`GUARDIAN_NOT_ACTIVE`) → `enrollment.status`
(`ENROLLMENT_NOT_APPROVED`) → `institution.status`
(`INSTITUTION_NOT_APPROVED`) → recogida activa duplicada para el mismo
`enrollment_id` (`ACTIVE_PICKUP_REQUEST_EXISTS`).

**Consecuencias.**
- `specs/features/018-crear-pickup-request.md` gana una precondición nueva y
  un caso Given/When/Then de rechazo simétrico al de "enrollment no
  aprobado".
- `specs/api-contracts/pickup-requests.md` gana una fila nueva en la tabla de
  errores de `POST /pickup-requests`: `422 INSTITUTION_NOT_APPROVED`.
- Regla nueva a forzar por test (ADR-021): crear un `pickup_request` sobre un
  `enrollments` en `status = approved` cuya institución está `suspended`
  responde `422 INSTITUTION_NOT_APPROVED`, no `201`.
- No se modifica `ADR-018` ni `ADR-031`: las ADRs de este proyecto son
  append-only; esta corrección se documenta como decisión nueva, mismo
  tratamiento que ADR-025/026 sobre huecos de ADR-018.

## ADR-033 — Las entidades de TypeORM se mudan a `packages/shared`, tras un subpath

**Contexto.** El `worker` necesita las mismas entidades de TypeORM que el `api`
(`PickupRequest`, `LocationUpdate`, `Institution` y
`PickupRequestStatusHistory` como mínimo, para las features 019–023), pero las
14 entidades vivían solo en `apps/api/src/database/entities/`. `apps/worker` no
depende de `@casillego/api`, y `@casillego/api` es `private` y sin campo
`exports`: no había forma de importarlas sin duplicarlas —dos definiciones del
mismo esquema divergiendo en silencio— o sin acoplar un proceso al otro.
Detectado en la revisión previa a la implementación del `worker`, junto con dos
deudas que se arrastran en el mismo cambio: la columna `eta_calculated_at`
(decidida en ADR-031 punto 5, documentada en specs, nunca implementada — su
migración quedó huérfana entre dos tareas, porque el módulo `pickups` de
creación no la necesitaba) y las dependencias faltantes de `apps/worker`.

`docs/arquitectura.md` ya afirmaba que `api` y `worker` "comparten entidades de
TypeORM, ports y la máquina de estados de `packages/shared`". Era falso para las
entidades; esta decisión lo vuelve cierto.

**Decisión.**

1. **Las 14 entidades se mudan a `packages/shared/src/entities/`**, junto con
   `pickup-request-status.values.ts` (valor en runtime que consumen dos de
   ellas). Se mueven **las 14 completas**, no solo las que el `worker` necesita
   hoy: tener el esquema partido entre dos ubicaciones es peor que cualquiera de
   las dos ubicaciones por separado. El criterio es *framework-light* —las
   entidades dependen de `typeorm`, no de NestJS—, el mismo que ya permite un
   adapter concreto (`node-mqtt-client.ts`) en `packages/shared`.

2. **Se exponen tras el subpath `@casillego/shared/entities`, NO desde el barrel
   raíz `index.ts`.** Es el punto del que depende todo lo demás, y hay dos
   razones independientes, ambas bloqueantes:
   - **Colisión de nombres.** `packages/shared/src/types/*` ya exporta interfaces
     llamadas `User`, `Institution`, `PickupRequest`… — los mismos 14 nombres que
     las clases de entidad. Un `export * from './entities'` en el barrel raíz
     colisiona 14 veces. Los dos modelos son legítimos y distintos (la interfaz
     es la forma de cable, con `createdAt: string` ISO; la entidad es el mapeo de
     BD, con `Date`), así que conviven — pero no en el mismo barrel.
   - **Los frontends.** `portal`, `parent` y `board` dependen de
     `@casillego/shared` y heredan el `paths` de `tsconfig.base.json`
     (`@casillego/shared` → `packages/shared/src/index.ts`), así que su
     `tsc --noEmit` typechequea el **fuente** de shared, no su `dist`. Sin
     `experimentalDecorators` y con `useDefineForClassFields: true`, cualquier
     entidad en el barrel raíz rompe los tres builds con TS1240 — y `vite build`
     además arrastraría `typeorm` (Node-only) al bundle del navegador.

   **La analogía con `mqtt` no aplica, y conviene decirlo:** MQTT.js es
   isomórfico —los frontends lo usan legítimamente sobre WSS, es su cliente de
   tiempo real—, mientras que `typeorm` no tiene nada que hacer en un navegador.
   Que `mqtt` esté en el barrel raíz no autoriza a que `typeorm` lo esté.

3. **El subpath es CJS-only.** `tsconfig.esm.json` excluye `src/entities/**`.
   Sus únicos consumidores (`api` y `worker`) resuelven por `require`, y un doble
   build CJS+ESM produciría **dos identidades de clase distintas** para el
   registro global de metadata de TypeORM, que es un singleton de proceso. La
   copia ESM sería peso muerto cuyo único efecto posible es romper algo.

   El subpath se sirve bajo la condición **`default`**, no bajo `require`: vitest
   resuelve con la condición `import` y fallaba con `"./entities" is not exported
   under the conditions ["node","development","import"]`. La respuesta correcta
   **no** es compilar también a ESM —eso reintroduce exactamente la doble
   identidad que este punto evita—, sino servir **el mismo y único** artefacto CJS
   a cualquier condición. Un solo build, una sola identidad de clase, alcanzable
   desde herramientas ESM.

4. **Hacen falta `exports` y `typesVersions`, no solo `exports`.** `apps/api` y
   `apps/worker` compilan con `moduleResolution: "Node"` (node10), que **ignora
   el campo `exports`**. Node en runtime sí lo respeta; TypeScript no. Sin
   `typesVersions`, el subpath resuelve en ejecución pero no typechequea.

5. **`data-source.ts` deja de usar un glob.** Usaba
   `join(__dirname, 'entities', '*.entity.{ts,js}')`. Tras la mudanza eso resuelve
   a **cero entidades**, y TypeORM **no falla con un set vacío**: trataría el
   esquema como inexistente y `migration:generate` emitiría una migración que
   DROPea las 14 tablas. Pasa a `Object.values(entities)` sobre el import
   explícito, como ya hacía `database.module.ts`. De aquí se sigue un invariante:
   **`src/entities/index.ts` exporta solo las 14 clases** — nada de
   `PICKUP_REQUEST_STATUS_VALUES`, que TypeORM recibiría como si fuera una
   entidad más.

6. **`geo-point.ts` se muda también**, pero a `packages/shared/src/types/` y **sí**
   entra al barrel raíz: es una interfaz pura (la forma de cable de las columnas
   `geography(Point,4326)`), sin dependencia de typeorm, y `api` la necesita fuera
   de las entidades para su mapper de `LatLng`.

**Enmienda (extracción del patrón de transición compartido).** Al extraer
`applyPickupRequestTransition` (status + fila de historial, ver `packages/shared/src/pickup-request-transition.ts`)
apareció un tercer subpath, **`@casillego/shared/pickup-request-transition`**,
mismo mecanismo que `./entities` en los puntos 2–4 de arriba: condición
`default` + `typesVersions`, excluido del build ESM. La razón es la misma que
la del punto 2: `pickup-request-transition.ts` recibe un `EntityManager` de
`typeorm` y usa `PickupRequest`/`PickupRequestStatusHistory` como **valores**
(`manager.getRepository(...)`), no solo como tipos — igual que las entidades
mismas, no puede vivir en el barrel raíz sin reintroducir `typeorm` al bundle
de los 3 frontends. `pickup-request-payloads.ts` (los builders de payload de
board/cola, extraídos en el mismo cambio) sí vive en el barrel raíz: es
*framework-free*, sin un solo import de `typeorm`.

**Alternativas descartadas.**
- **Barrel raíz con las entidades renombradas** (`UserEntity`, …): resuelve la
  colisión pero no el problema real — los frontends seguirían typechequeando
  decoradores y `typeorm` seguiría entrando al bundle.
- **Paquete aparte `@casillego/db`**: más limpio en el grafo de dependencias
  (shared nunca declararía `typeorm`), pero un workspace nuevo por un problema que
  el subpath ya resuelve. Reconsiderable si `packages/shared` acumulara más
  dependencias Node-only.

**Consecuencias.**
- `packages/shared` gana `typeorm` y `reflect-metadata` como dependencias, y
  `experimentalDecorators`/`emitDecoratorMetadata` en sus **tres** tsconfigs
  (`tsconfig.cjs.json`, `tsconfig.json` y el que resuelven eslint y vitest). **No**
  se hoistean a `tsconfig.base.json`: se los impondría a los frontends.
- Los ~60 archivos de `apps/api` que importaban entidades por ruta profunda pasan a
  `@casillego/shared/entities`. Las migraciones no se tocan (son SQL crudo, no
  importan entidades).
- `packages/shared` pasa a alojar dos modelos paralelos de las mismas 14 tablas
  (interfaces en `types/`, clases en `entities/`). Es deliberado: sirven a
  consumidores distintos y ninguno puede sustituir al otro.
- El orden de `npm run check` (lint → format → build → test) se vuelve más frágil:
  el lint type-aware resuelve `@casillego/shared/entities` contra `dist/`, así que
  en árbol limpio hay que correr `npm run build:shared` antes. Ya era cierto para el
  barrel raíz; ahora aplica a más código.
- La columna `eta_calculated_at` queda por fin creada (migración
  `1784268553792-EtaCalculatedAt`). `specs/entities/pickup_request.md` y
  `docs/modelo-datos.md` ya la documentaban desde ADR-031: no se tocan.
- `apps/worker` gana `typeorm`, `@nestjs/typeorm`, `pg` (mismas versiones que el
  `api`) y `@nestjs/schedule` (feature 023, aún sin consumir). **Sin
  `@nestjs/config`**: el `worker` usará `process.loadEnvFile()`, igual que el `api`
  — que nunca usó `ConfigModule`, pese a que `docs/arquitectura.md` lo afirmaba.

## ADR-034 — Botón "Reportar incidencia" de la Consola de puerta: visible pero deshabilitado, implementación diferida

**Contexto.** El lienzo de Claude Design para la Consola de puerta (Fase 7,
`apps/portal`) incluye un botón "Reportar incidencia", heredado de
`docs/design-brief.md`. `specs/features/021-confirmar-llegada-y-entrega.md` ya
señaló esto como pregunta abierta y lo dejó explícitamente fuera de alcance:
**no existe entidad ni campo** en el modelo que respalde una incidencia (sin
tabla, sin endpoint, sin evento de dominio). Al sincronizar el design system
real vía `/design-sync`, el componente del botón se trae al repo tal cual está
dibujado en el lienzo — hace falta una decisión explícita sobre su estado en
esta fase para que Claude Code no le cablee un handler contra un endpoint que
no existe.

**Decisión.**
1. **El botón se renderiza, pero deshabilitado**, con una etiqueta o tooltip
   tipo "Próximamente" — no se omite del layout. Esto preserva la fidelidad
   visual del diseño ya aprobado en Claude Design (el layout completo de la
   Consola de puerta se conserva) sin fingir una funcionalidad que no existe.
2. **Sin wiring a ningún endpoint ni estado.** El botón no dispara ninguna
   llamada a la API, no abre ningún modal funcional, y no depende de ningún
   campo de `pickup_requests` ni de ninguna otra entidad. Su único
   comportamiento en esta fase es visual (estado `disabled`).
3. **La feature de incidencias queda diferida a un slice futuro**, con su
   propio ADR de diseño y su propia entidad (posiblemente algo como
   `pickup_request_incidents` o similar — sin definir aquí; es tarea del slice
   futuro, no de este ADR). Este ADR no prejuzga esa forma, solo constata que
   hoy no existe y que su ausencia es deliberada, no un olvido.
4. **Esta decisión es específica a Fase 7 / Consola de puerta.** Si en el
   futuro el mismo patrón de "elemento visual sin respaldo de datos" aparece
   en otra pantalla, se resuelve con su propio ADR — no se generaliza aquí una
   regla para todo el portal.

## Referencias

- `specs/features/021-confirmar-llegada-y-entrega.md` (Preguntas abiertas:
  exclusión original de "Reportar incidencia").
- `docs/design-brief.md` (origen visual del botón, sección Consola de puerta).
- `docs/plan-implementacion.md` (Fase 7 — Frontend: `apps/portal`).

## ADR-035 — Columna "Último acceso" en Personal: placeholder visual, campo diferido a un slice futuro

**Contexto.** El lienzo de Claude Design para la pantalla de Personal (Fase 7,
`apps/portal`) incluye, según `docs/design-brief.md`, una columna "Último
acceso" en la lista de miembros del staff de la institución. Ninguna spec de
entidad revisada (`specs/entities/user.md`, `specs/entities/institution_member.md`)
documenta un campo que registre el último inicio de sesión de un `user`. A
diferencia de "Reportar incidencia" (ADR-034), este no es un botón con acción
propia sino una columna de datos: su ausencia de campo real es igual de
real, pero su tratamiento visual es distinto (no hay "estado deshabilitado"
para un dato que no existe, solo un placeholder).

**Decisión.**
1. **La columna se muestra**, con un placeholder (ej. `—`) en cada fila, en
   vez de omitirse del layout — preserva la fidelidad visual del diseño ya
   aprobado en Claude Design.
2. **Sin wiring a ningún campo ni endpoint.** El placeholder es estático: no
   se calcula, no se ordena por él, no depende de ningún campo de `users` ni
   de `institution_members`. No confundir con un valor `null` traído de la
   API — no hay llamada de por medio, el frontend no espera ni pide este
   dato en esta fase.
3. **El campo real (`users.last_login_at` o similar — sin definir aquí; es
   tarea del slice futuro) queda diferido.** Este ADR no prejuzga su nombre,
   tipo, ni el mecanismo para poblarlo (¿se actualiza en cada login? ¿en cada
   refresh de token?) — todo eso corresponde a su propio ADR y feature cuando
   se aborde.
4. **Esta decisión es específica a la columna "Último acceso" de la pantalla
   de Personal.** Mismo criterio que ADR-034: no se generaliza una regla para
   todo el portal ante futuros huecos similares.

## Referencias

- `docs/design-brief.md` (origen visual de la columna, sección Personal).
- `specs/entities/user.md`, `specs/entities/institution_member.md` (ausencia
  del campo).
- ADR-034 (mismo patrón de decisión — elemento visual sin respaldo de datos —
  aplicado al botón "Reportar incidencia" de la Consola de puerta).

## ADR-036 — `@casillego/ui`: nuevo paquete para el design system, sin build propio, barrel único

**Contexto.** El proyecto **"CasiLlego Design System"**
(`claude.ai/design/p/cd01f4a5-739d-4e7b-abed-65176746dc0d`) ya existe con 10
componentes (`Button`, `Badge`, `Card`, `Avatar`, `Toggle`, `SegmentedTabs`,
`EmptyState`, `ErrorState`, `SkeletonRow`, `NavItem`), tokens de color/
spacing/tipografía, fuentes y guidelines — construido directamente en Claude
Design, no sincronizado desde este repo (no tiene `_ds_sync.json`). Es el
ítem que `docs/plan-implementacion.md` (Fase 7) dejaba abierto como
*"Resolver tokens del design system antes de esta fase"*. La skill
`/design-sync` solo empuja repo → claude.ai/design; aquí la dirección es la
inversa, así que los artefactos se leyeron a mano vía `DesignSync(get_file)`
y se portaron como código TS/TSX real.

Antes de portar nada hacía falta decidir dónde vive ese código: `apps/portal`
no tenía ni carpeta `components/`, y los propios tokens de estado traen el
comentario *"shared by all 3 CasiLlego frontends — DO NOT recolor"* — el
mismo sistema lo van a consumir `portal` (Fase 7), `parent` (Fase 8) y
`board` (Fase 9).

**Decisión.**

1. **Paquete nuevo `packages/ui`** (`@casillego/ui`), hermano de
   `packages/shared`. En este monorepo las apps no se importan entre sí,
   solo `packages/*` es compartible — mismo criterio que ADR-033 aplicó a
   las entidades TypeORM compartidas por `api` y `worker`.
2. **Sin build propio.** `package.json` expone `"exports"` apuntando
   directo a `src/index.ts` y `src/styles.css` (TS/TSX fuente, sin el
   `tsc -p tsconfig.cjs.json && tsc -p tsconfig.esm.json` que sí tiene
   `packages/shared`). A diferencia de `shared` — que además de los
   frontends alimenta `api`/`worker` (Node/CJS) y por eso necesita un
   `dist` real — `@casillego/ui` solo lo consumen apps de navegador vía
   Vite, que transpila TSX al vuelo desde el symlink de workspace; un
   segundo pipeline de build sería complejidad sin consumidor que la
   necesite.
3. **Un solo barrel raíz** (`@casillego/ui`), sin subpaths por grupo
   (`/core`, `/feedback`, `/navigation`). ADR-033 usa subpath en `shared`
   para resolver dos problemas puntuales — colisión de 14 nombres entre
   `types/*` y `entities/*`, y fuga de `typeorm` (Node-only) al bundle de
   navegador — que no existen aquí: los 10 nombres de componente no
   colisionan entre sí ni con nada existente, y todo el paquete es código
   de navegador.
4. **`apps/portal` se toca mínimamente**: `"@casillego/ui": "*"` en sus
   `dependencies` y `import '@casillego/ui/styles.css'` en `main.tsx`.
   Cero componentes usados todavía, cero pantallas — deja el portal listo
   para que las pantallas de una fase futura usen los primitivos sin
   configuración adicional.
5. **Metadata propia de Claude Design se descarta al portar**: la
   anotación `@startingPoint section="..." viewport="..."` de cada `.d.ts`
   y los comentarios `/* @kind other */` de los tokens no significan nada
   fuera del panel de esa herramienta. Los nombres de componentes y de
   custom properties CSS (`--brand`, `--status-en-route`, `--radius-lg`,
   etc.) se mantienen tal cual, sin traducir ni renombrar, para no romper
   la trazabilidad entre lo que se diseña en claude.ai/design y lo que
   vive en el repo.

**Consecuencias.**
- `eslint.config.mjs` gana `eslint-plugin-react-hooks` (nueva devDependency
  raíz) y un bloque de reglas de hooks aplicado tanto a `packages/ui/src`
  como a los tres frontends — es el primer código React real del repo,
  antes solo había globals de navegador sin reglas específicas. **No** se
  agrega `eslint-plugin-react`: su última versión publicada (7.37.5)
  declara peer `eslint@^3...^9.7` y no soporta ESLint 10 — mismo tipo de
  conflicto de versión bleeding-edge que TypeScript 7 en ADR-021. Se
  retoma cuando publique soporte, o se evalúa una alternativa nativa de
  flat config (p. ej. `@eslint-react/eslint-plugin`, que si declara
  `eslint: '*'`, pero no se adoptó en esta pasada por no tener su forma de
  configuración verificada). Tampoco se agrega `eslint-plugin-jsx-a11y`;
  ambos quedan para cuando se construyan pantallas reales. **Esta omisión
  queda registrada explícitamente en la tabla de "Backlog técnico" de
  `docs/plan-implementacion.md`** — es pérdida real de cobertura (p. ej.
  `react/jsx-key` no detectaría una `key` faltante en el `.map()` de
  `SegmentedTabs`), no una diferencia cosmética de versión, así que no debe
  quedar como omisión indefinida.
- `tsconfig.base.json` gana dos entradas en `paths`:
  `@casillego/ui` → `packages/ui/src/index.ts` y
  `@casillego/ui/styles.css` → `packages/ui/src/styles.css`.
- No se agregan tests de componentes: son ports de fidelidad visual 1:1 sin
  lógica de negocio propia. `vitest.config.ts` ya tiene
  `passWithNoTests: true`, así que el paquete no rompe `npm run test`.
- El inventario completo de `ui_kits/portal-admin` (pantallas de rol
  Institución y rol OPS) queda fuera de esta decisión — es trabajo de una
  fase futura, cuando se construyan las pantallas reales de `apps/portal`.

## Referencias

- `docs/plan-implementacion.md` (Fase 7 — Frontend: `apps/portal`, ítem
  "Resolver tokens del design system").
- ADR-033 (mismo criterio de "un solo lugar de verdad para código
  compartido", y precedente de cuándo sí usar subpaths de exportación).
- ADR-034, ADR-035 (decisiones previas que ya anticipaban el import del
  design system real vía `/design-sync`).
- `docs/plan-implementacion.md` (Fase 7 — Frontend: `apps/portal`).

## ADR-037 — Endpoint de búsqueda de instituciones por nombre: solo JWT, sin `InstitutionMembershipGuard`

**Contexto.** `specs/features/005-asociar-institucion.md` documenta dos caminos
de éxito para que un tutor solicite asociar un alumno a una institución: por
`join_code` (ya resuelto server-side dentro de `POST /enrollments`, sin
endpoint de búsqueda propio) y por **búsqueda de nombre** — que no tenía
ningún endpoint que lo respaldara. Todos los endpoints existentes de
`specs/api-contracts/institutions.md` (feature 008) exigen que el usuario ya
sea `institution_members` de la institución consultada, vía
`InstitutionMembershipGuard`. Ese guard no aplica aquí: un tutor que busca una
institución **todavía no tiene ninguna relación con ella** — es precisamente
el paso previo a crear esa relación (`enrollments`).

**Decisión.**
1. **El endpoint exige JWT (usuario autenticado) pero ningún guard de
   membresía.** Es el primer endpoint de `institutions.md` sin
   `InstitutionMembershipGuard` — no es un descuido, es la única forma
   correcta de modelar "buscar algo a lo que todavía no perteneces".
2. **Coincidencia parcial, case-insensitive**, sobre `institutions.name` (`ILIKE '%texto%'`
   en Postgres).
3. **Solo instituciones `status = approved`** — mismo criterio que la
   resolución por `join_code` (ADR-019 punto 4): una institución `pending` o
   `suspended` no debe aparecer en ningún resultado de búsqueda de un tutor.
4. **Paginado**, mismo patrón que otros listados del proyecto (`limit`/`offset`,
   default `20`/`0` — ADR-024 punto 9).
5. **Campos de respuesta mínimos** para la tarjeta de selección
   (`docs/design-brief.md`: "las tarjetas muestran el tipo... y, en
   actividades, la categoría"): `id`, `name`, `type`, `category`. No se
   exponen campos operativos (geocerca, radios, `joinCode`) — el tutor no
   tiene membresía todavía, y esos campos no son necesarios para elegir una
   institución a solicitar.

## Referencias

- `specs/features/005-asociar-institucion.md` (camino de búsqueda por
  nombre).
- ADR-019 (punto 4: visibilidad de instituciones no aprobadas).
- ADR-024 (punto 9: paginación `limit`/`offset`).
- `specs/api-contracts/institutions.md` (endpoint nuevo agregado).

## `GET /institutions?search=...`

Busca instituciones `approved` por coincidencia parcial de nombre. Ver
feature 005 (camino de asociación por búsqueda de nombre). A diferencia de
los demás endpoints de este contrato, **no** exige `InstitutionMembershipGuard`:
el usuario que busca todavía no tiene ninguna relación con la institución
que encuentre — es el paso previo a `POST /enrollments`. Solo exige JWT
válido (ADR-037).

**Query params**
| Param | Requerido | Notas |
|---|---|---|
| `search` | sí | coincidencia parcial, case-insensitive, sobre `name` (`ILIKE '%search%'`) |
| `limit` | no | tamaño de página; default `20` (ADR-024 punto 9) |
| `offset` | no | desplazamiento; default `0` (ADR-024 punto 9) |

**Response 200**
```json
{
  "institutions": [
    {
      "id": "uuid",
      "name": "string",
      "type": "school | extracurricular",
      "category": "string | null"
    }
  ],
  "limit": "number",
  "offset": "number",
  "total": "number"
}
```

Solo instituciones con `status = approved` (ADR-019 punto 4) — una `pending` o
`suspended` no debe aparecer en ningún resultado.

**Errores**
| Código | `code` | Caso |
|---|---|---|
| 400 | `INVALID_PAYLOAD` | `search` faltante o vacío |
| 401 | — | no autenticado (respuesta del `JwtAuthGuard`) |

## Referencias (actualizar sección existente del archivo)

Agregar a la lista de referencias de `institutions.md`:
- ADR-037 (endpoint de búsqueda sin `InstitutionMembershipGuard`; solo JWT).
- `specs/features/005-asociar-institucion.md` (camino de búsqueda por nombre).

## ADR-038 — Endpoint de métricas globales: `SuperAdminGuard` nuevo, ventanas de agregación

**Contexto.** `docs/design-brief.md` describe la pantalla "Métricas globales"
del super-admin (instituciones por status, solicitudes pendientes, tutores
registrados, recogidas totales con comparativo, top instituciones, tiempo
medio de recogida), pero no existía ninguna spec de feature ni contrato de
API que la respaldara — `docs/plan-implementacion.md` ya la marcaba como
"slice diferido en Fase 1 pendiente de especificar". El mecanismo de
autorización (`users.is_super_admin`, boolean global) ya existe en
`specs/entities/user.md`; lo que faltaba era el endpoint y las definiciones
exactas de cada métrica.

**Decisión.**
1. **Guard nuevo, `SuperAdminGuard`**, distinto de `InstitutionMembershipGuard`:
   verifica `request.user` → `users.is_super_admin === true`. No resuelve
   ningún recurso ni institución — es una verificación de flag global, más
   simple que el guard existente. Vive junto a él en
   `apps/api/src/auth/guards/`.
2. **Ventana de comparación: mes calendario actual vs. mes calendario
   anterior** (no "últimos 30 días rodantes"). Ej. si hoy es 19 de julio,
   compara 1–19 de julio contra 1–19 de junio (mismo corte de día, no el mes
   completo anterior) — comparación de periodo parcial vs. periodo parcial
   equivalente, no mes completo vs. mes parcial (que sesgaría el comparativo
   a la baja artificialmente).
3. **"Solicitudes pendientes" son dos métricas separadas**, no una sola:
   `enrollmentsPending` (conteo de `enrollments.status = pending`, a nivel de
   toda la plataforma) e `institutionsPendingApproval` (conteo de
   `institutions.status = pending` — el mismo dato que ya aparece dentro del
   desglose de instituciones por status, expuesto también aquí porque el
   super-admin actúa sobre estas dos colas de aprobación de forma
   independiente, con acciones y urgencias distintas).
4. **"Tutores registrados"**: conteo de `users` distintos con al menos una
   fila en `student_guardians` como `guardian_user_id`, sin filtrar por
   `status` del vínculo — "registrado" es más amplio que "activo".
5. **"Top instituciones por uso"**: top 5, ordenado por conteo de
   `pickup_requests` creados en la misma ventana del punto 2 (mes actual).
6. **"Tiempo medio de recogida"**: promedio de `completed_at - started_at`
   sobre `pickup_requests` con `status = delivered` en la ventana del punto
   2. Excluye `cancelled` (sin trayecto real completo) y estados no
   terminales.
7. **Sin caché ni pre-agregación en esta fase**: las consultas se calculan
   al vuelo con `COUNT`/`AVG` sobre las tablas existentes. Si el volumen de
   datos lo justifica más adelante, la optimización (vista materializada, job
   agendado) es una decisión de rendimiento separada, no de este ADR.

## Referencias

- `specs/entities/user.md` (`is_super_admin`, ya existente).
- `docs/design-brief.md` (sección "Rol: super-admin (operador)").
- `docs/plan-implementacion.md` (slice diferido de Fase 1, ahora resuelto).
- ADR-022 (punto 4: `InstitutionMembershipGuard`, contraste con el guard
  nuevo).

## ADR-039 — `GET /institutions/:id/members`: OR entre membresía y `is_super_admin`

**Contexto.** `specs/api-contracts/institution-members.md` gatea
`GET /institutions/:id/members` con `InstitutionMembershipGuard` puro,
exigiendo que el usuario sea `institution_members` de esa `:id`. Esto
rechaza a un super-admin (`users.is_super_admin = true`) que consulte el
personal de una institución a la que no pertenece — un caso legítimo de
soporte/operación de plataforma, coherente con que el super-admin ya tiene
visibilidad cross-institución en `GET /admin/metrics` (ADR-038).

**Decisión.**
1. **Este endpoint pasa a verificación manual en el `service`**, no
   `InstitutionMembershipGuard` puro: el usuario debe ser `institution_members`
   de esa `:id` (cualquier `role`) **O** tener `is_super_admin = true`.
2. **Manejo de existencia asimétrico según el lado del OR:**
   - Si pasa por el lado de membresía (institution_member normal): se
     conserva el comportamiento ambiguo ya documentado en
     `docs/arquitectura.md` — `403 NOT_INSTITUTION_MEMBER` tanto si la
     institución no existe como si existe sin membresía (no se revela
     existencia a quien no tiene acceso).
   - Si pasa por el lado de super-admin: **sí se resuelve existencia
     explícitamente** — `404 RESOURCE_NOT_FOUND` si la `:id` no corresponde a
     ninguna institución. No hay razón de privacidad para ocultarle
     existencia a un super-admin, que ya puede ver todo el sistema.
3. **Alcance limitado a este único endpoint.** Los demás endpoints de
   `institution-members.md` (`POST .../invite`, `PATCH`, `DELETE`) conservan
   `InstitutionMembershipGuard` + `role = admin` sin cambios — el super-admin
   no gestiona personal de instituciones ajenas, solo lo consulta. No se
   generaliza este patrón a otros endpoints del sistema en este ADR.

## Referencias

- `specs/api-contracts/institution-members.md` (endpoint actualizado).
- ADR-038 (`is_super_admin`, visibilidad cross-institución de plataforma).
- ADR-022 (punto 4: `InstitutionMembershipGuard`, contraste con la
  verificación manual de este endpoint).
- `docs/arquitectura.md` (patrón de verificación manual OR, ya usado para
  `pickup-requests`; ADR-039 introduce la variante con flag global en vez de
  relación con el recurso).

## ADR-040 — Aprobación/suspensión/reactivación de instituciones: endpoints por verbo, `SuperAdminGuard`, notificación por correo

**Contexto.** ADR-018 (punto 1) ya fija las transiciones válidas de
`institutions.status` (`pending → approved`; `approved ⇄ suspended`; sin
camino de vuelta a `pending`; sin estado de rechazo explícito) como acción
exclusiva del super-admin, y `specs/api-contracts/institutions.md` ya lo
menciona ("transiciones de `status` son de super-admin, no editables aquí").
Pero ningún contrato de API implementaba el endpoint real — hueco detectado
en la revisión previa de Fase 7, distinto del de métricas globales (ADR-038)
y del de búsqueda por nombre (ADR-037). El `design-brief.md` describe la
pantalla ("Aprobación de instituciones: cola de altas de escuelas por
validar") sin contrato que la respalde.

**Decisión.**
1. **Tres endpoints por verbo**, mismo patrón ya usado en el proyecto para
   transiciones de estado explícitas (`PATCH /enrollments/:id/approve`,
   `PATCH /pickup-requests/:id/cancel`), no un `PATCH` genérico de `status`:
   - `PATCH /institutions/:id/approve` (`pending → approved`)
   - `PATCH /institutions/:id/suspend` (`approved → suspended`)
   - `PATCH /institutions/:id/reactivate` (`suspended → approved`)
2. **Autorización: `SuperAdminGuard`** (el mismo guard creado en ADR-038),
   no `InstitutionMembershipGuard` — el super-admin no es miembro de la
   institución que aprueba.
3. **Listado/cola para el super-admin: `GET /admin/institutions`**, bajo el
   mismo namespace `/admin/` ya establecido por `GET /admin/metrics`
   (ADR-038) — no reutiliza `GET /institutions?search=...` (ADR-037), que es
   un endpoint de propósito y autorización distintos (tutor buscando
   instituciones ya `approved`, sin acceso a `pending`/`suspended`). Filtro
   opcional por `status`; sin filtro, devuelve todas.
4. **Notificación por correo en las tres transiciones** (vía `EmailProvider`,
   ADR-017), consistente con ADR-009 (eventos de cuenta van por correo, no
   MQTT). Se notifica a **todos** los `institution_members` con `role =
   admin` de esa institución (puede haber más de uno, a diferencia del
   `users` único creado en el registro inicial — feature 001). Un fallo de
   envío no revierte la transición ya persistida (misma política que
   `enrollments.approve`/`reject` en `EnrollmentsService`: el email es
   best-effort, no transaccional con el cambio de estado).
5. **Auditoría**: cada transición registra una fila en `audit_log` con
   `action` = `institution.approved` / `institution.suspended` /
   `institution.reactivated` (convención `entity.verb`, ADR-018 punto 9 —
   que ya cita `institution.suspended` como ejemplo de esa convención),
   `entity_type = 'institution'`, `entity_id` = el id de la institución,
   `actor_user_id` = el super-admin, `metadata = null`.
6. **Reactivar es una transición propia, no reusar `approve`.** Aunque
   ambas terminan en `status = approved`, `reactivate` parte de `suspended`
   y `approve` parte de `pending` — endpoints y `code` de auditoría
   distintos, para que el historial diferencie "primera aprobación" de
   "se levantó una suspensión".

## Referencias

- ADR-018 (punto 1: transiciones válidas de `institutions.status`; punto 9:
  convención `entity.verb` de `audit_log`, ya con `institution.suspended`
  como ejemplo).
- ADR-009 (correo transaccional para eventos de cuenta).
- ADR-017 (`EmailProvider` como port).
- ADR-037 (endpoint de búsqueda por nombre — propósito y autorización
  distintos, no se reutiliza aquí).
- ADR-038 (`SuperAdminGuard`, namespace `/admin/`).
- `docs/design-brief.md` (pantalla "Aprobación de instituciones").
- `specs/api-contracts/institutions.md`, `specs/api-contracts/admin-institutions.md`
  (nuevo).

## ADR-041 — `GET /institution-members/mine`: resolución de institución tras login

**Contexto.** Al preparar la Capa 3 de Fase 7 (primera pantalla real de
`apps/portal`) se detectó un hueco de plomería, no de una pantalla
específica: el access token (`POST /auth/login`) no incluye `institutionId`
ni `role` — deliberadamente, se resuelven por request contra
`institution_members` (`specs/api-contracts/auth.md`). Pero todos los
endpoints institution-scoped ya exigen `institutionId` como parámetro de
entrada, y ninguna spec definía cómo el frontend lo averigua la primera vez.
Sin esto, ninguna pantalla de "Rol: administrador de institución" puede
cargar.

**Decisión.**
1. **Endpoint nuevo: `GET /institution-members/mine`**, en
   `specs/api-contracts/institution-members.md`. Mismo patrón ya usado por
   `GET /enrollments/mine` — perspectiva propia del usuario autenticado, sin
   `InstitutionMembershipGuard` (sería circular: el guard necesita saber la
   institución que este mismo endpoint resuelve).
2. **Devuelve todas las membresías del usuario**, no una sola — un `users`
   puede pertenecer a más de una institución (ej. cubre personal en dos
   planteles). El frontend decide cómo presentar la selección (si hay una
   sola, se auto-selecciona; si hay más de una, corresponde a la Capa 3a de
   `apps/portal` decidir el selector — fuera de alcance de este ADR).
3. **Sin restricción de `role`** — cualquier miembro necesita resolver su
   propia institución, no solo los `admin`.

## Referencias

- `specs/api-contracts/auth.md` (claims del access token, `POST
  /auth/login`).
- `specs/api-contracts/enrollments.md` (`GET /enrollments/mine`, patrón ya
  establecido que se replica aquí).
- `specs/api-contracts/institution-members.md` (endpoint nuevo).
- ADR-022 (punto 4: `InstitutionMembershipGuard`, contraste con este
  endpoint que no lo usa).

## ADR-042 — Plomería frontend de `apps/portal`: router, cliente de API, sesión, contexto de institución

**Contexto.** `apps/portal/src` es un esqueleto (`App.tsx`/`main.tsx`, sin
router, sin cliente de API, sin manejo de JWT, sin pantalla de login). Antes
de construir la primera pantalla real (bandeja de aprobación, feature 006)
hace falta esta capa base — de lo contrario cada pantalla nueva reinventaría
su propio fetch, su propio manejo de sesión, y no habría forma de saber a
qué institución pertenece el usuario (ver ADR-041).

**Decisión.**
1. **Router: `react-router` (v7).** Estándar de facto para SPA de React,
   sin razón para desviarse. Rutas protegidas (`/login` pública; el resto
   exige sesión) mediante un wrapper `<ProtectedRoute>` que redirige a
   `/login` si no hay `accessToken` válido.
2. **Cliente de API en `packages/shared`**, no en `packages/ui` ni
   duplicado por app. Razón: es lógica de datos (fetch, manejo de error,
   inyección de JWT, refresh), no de presentación — no pertenece a `ui`
   (ADR-036, reservado a primitivos visuales). Y los tres frontends
   (`portal`/`parent`/`board`) lo van a necesitar igual, no solo `portal` —
   ponerlo en `shared` evita triplicarlo. Vive en un módulo nuevo
   (`packages/shared/src/api-client/`), sin dependencia de TypeORM, así que
   no hay riesgo de arrastrar el subpath de entidades (ADR-033) al bundle
   de navegador — se exporta desde el barrel raíz igual que el resto de
   `shared` consumido por frontends.
3. **Tokens en `localStorage`** (confirmado con el humano): sobrevive a
   cerrar el navegador, evita que un tutor/staff tenga que volver a
   iniciar sesión en cada visita. Trade-off aceptado: expuesto a XSS si
   algún día se introduce contenido no confiable en el DOM del portal — sin
   mitigación adicional en esta fase (ninguna pantalla actual inyecta HTML
   de terceros).
4. **Flujo de refresh: automático y transparente.** El cliente de API
   intercepta un `401` de cualquier llamada, intenta
   `POST /auth/refresh` una vez con el `refreshToken` guardado, reintenta la
   llamada original si el refresh tuvo éxito. Si el refresh también falla
   (401/403), limpia `localStorage` y redirige a `/login`.
5. **Contexto de institución (`InstitutionContext`):** al autenticarse,
   llama `GET /institution-members/mine` (ADR-041) una vez. Si devuelve
   exactamente una membresía (el caso esperado — confirmado con el humano
   que hoy no hay restricción de base de datos que impida a un usuario de
   personal pertenecer a más de una institución simultáneamente, aunque no
   sea el caso común), se auto-selecciona sin intervención del usuario.
   **Si devuelve más de una, esta capa solo guarda la lista completa y
   selecciona la primera por defecto — un selector real para cambiar entre
   instituciones queda fuera de alcance de esta capa**, no porque sea
   imposible que ocurra, sino porque hoy no hay ninguna pantalla que lo
   necesite con urgencia. Se construye cuando el caso real aparezca, con su
   propio ADR si hace falta más que un selector simple. Si devuelve un
   array vacío (usuario sin ninguna membresía, ej. un tutor puro accediendo
   al portal de institución por error), se muestra un estado vacío
   explicativo, no un error genérico.
6. **Sin gestión de estado global adicional** (Redux/Zustand/etc.) en esta
   capa — `AuthContext` + `InstitutionContext` (React Context nativo) son
   suficientes para lo que existe hoy. Si la complejidad crece en fases
   futuras, se reevalúa con su propio ADR, no se anticipa aquí.

**Consecuencias.** Toda pantalla nueva de `apps/portal` a partir de aquí
asume: sesión ya resuelta (`useAuth()`), institución ya resuelta
(`useInstitution()`), y llamadas a la API vía el cliente compartido — nunca
`fetch` crudo dentro de un componente de pantalla.

## Referencias

- ADR-036 (`packages/ui`, alcance reservado a primitivos visuales —
  contraste con dónde vive el cliente de API).
- ADR-033 (subpath de entidades TypeORM en `packages/shared`, aislado del
  bundle de navegador — el cliente de API nuevo no lo toca).
- ADR-041 (`GET /institution-members/mine`, consumido por
  `InstitutionContext`).
- `specs/api-contracts/auth.md` (`POST /auth/login`, `POST /auth/refresh`).
- `specs/features/006-aprobacion-enrollment.md` (primera pantalla que
  consume esta capa).
## ADR-043 — Detalles de implementación de la Capa 3a del portal: CORS, `Button` semántico, inyección de dependencias del cliente de API y elementos inertes del login

**Contexto.** Al implementar la plomería decidida en ADR-042 (router, cliente
de API, sesión, contexto de institución) aparecieron cuatro decisiones que
ADR-042 no cubría y que no son "sobre la marcha": tres bloqueaban la
verificación de punta a punta y una es un caso nuevo del patrón que ADR-034
punto 4 obliga a documentar cada vez que reaparece.

Como hallazgo previo, no como decisión: el commit `5ac3bae`
("feat: add endpoint `GET /institution-members/mine`…") tocó únicamente
`docs/decisiones.md` y `specs/api-contracts/institution-members.md` — el
endpoint quedó especificado (ADR-041) pero **sin una sola línea de código**.
`InstitutionContext` no tenía a qué llamar. Se implementa en esta capa contra
la spec ya existente, sin cambiarla.

**Decisión.**

1. **CORS explícito en `apps/api`, por allowlist.** `apps/api/src/main.ts`
   nunca llamó `enableCors()`, y ningún `vite.config.ts` tiene proxy: el
   navegador en `:5173` no podía llamar a la API en `:3000`, así que ninguna
   pantalla del portal era verificable. Se habilita con una lista explícita
   leída de `CORS_ORIGINS` (separada por comas), **nunca `origin: true`** —
   un comodín en una API multi-tenant con JWT en el header es un riesgo
   gratuito. `credentials: false`: los tokens viajan en `Authorization`, no
   en cookies (ADR-042 punto 3), así que no hace falta.

   Se descartó el proxy de Vite (`server.proxy`), que habría evitado CORS por
   completo en desarrollo: esconde el problema en vez de resolverlo, y en
   producción los tres frontends son orígenes propios servidos por nginx —
   tarde o temprano la API necesita la allowlist de todos modos. Con
   `CORS_ORIGINS` vacío el middleware no se registra, así que un despliegue de
   mismo origen no paga nada.

2. **`Button` de `packages/ui` pasa de `<span>` a `<button>`, con `type`.**
   Un `<span>` no envía formularios, no se activa con Enter ni con espacio, no
   entra al orden de tabulación y no expone `disabled` a las tecnologías de
   asistencia. Con un formulario de login de dos campos y ningún botón submit
   nativo, la especificación de HTML **no** dispara el envío implícito: el
   usuario que escribe su contraseña y presiona Enter no puede entrar. Se
   agrega `type?: 'button' | 'submit'` con default `'button'` — así ningún uso
   existente o futuro cambia de comportamiento por accidente — y `disabled`
   pasa al elemento nativo.

   **No es una variante nueva** (`.claude/rules/design-system.md` las
   prohíbe): los tokens, tamaños y variantes de color quedan idénticos. Es una
   corrección de semántica, invisible en pixeles.

   **Enmienda a ADR-036 punto 5.** El `components/core/Button.jsx` del
   proyecto de Claude Design también es un `<span>`, así que `packages/ui` era
   un port fiel: el `<span>` es una limitación del prototipo, no una decisión
   de diseño. El proyecto de diseño **se deja como está** — es un lienzo
   estático sin formularios reales, donde la distinción no significa nada.
   Queda anotado aquí para que la divergencia no se lea como un error de port
   la próxima vez que alguien compare ambos archivos.

3. **El cliente de API no toca APIs del navegador; las recibe inyectadas.**
   `packages/shared` compila con `lib: ["ES2022"]` (`tsconfig.base.json`), sin
   `DOM`, y lo consumen también `api` y `worker` en Node. Un `localStorage` o
   un `window.location` directos ahí dentro no compilarían y, peor, atarían un
   paquete compartido al navegador. Por eso `createApiClient` recibe
   `storage` (`TokenStorage`), `fetch` (`FetchLike`) y `onSessionExpired` como
   parámetros: es el mismo criterio de *ports* que ya usan `MapsProvider`,
   `EmailProvider` y `MqttClient` (ADR-017). El portal es quien pasa
   `window.localStorage` y el redirect a `/login`.

   `FetchLike` es un tipo estructural mínimo definido en el propio módulo, no
   el `fetch` global: mantiene a `packages/shared` libre de las tipificaciones
   de DOM y de undici, y hace que los tests del interceptor de refresh no
   necesiten jsdom ni ninguna dependencia nueva.

4. **Dos elementos del diseño de login se renderizan visibles pero inertes.**
   `ui_kits/acceso` del proyecto de diseño incluye dos afordancias sin
   respaldo en el modelo actual. Mismo patrón que ADR-034 (botón "Reportar
   incidencia") y ADR-035 (columna "Último acceso"), y misma resolución —
   ADR-034 punto 4 pide explícitamente un ADR propio cada vez que reaparece,
   en vez de generalizar una regla:
   - **"¿Olvidaste tu contraseña?"** — `specs/api-contracts/auth.md` no define
     ningún endpoint de recuperación de contraseña, y no se inventa uno para
     llenar un hueco visual. Se renderiza deshabilitado, sin wiring. La
     feature queda diferida a un slice futuro con su propia spec.
   - **"¿Primera vez en CasiLlego? Crear cuenta"** — aquí los endpoints sí
     existen (`POST /auth/register/institution`, `POST /auth/register/guardian`),
     pero las pantallas de alta (`choose`/`escuela`/`tutor` del kit) están
     fuera del alcance de esta capa, que es plomería. Se renderiza
     deshabilitado hasta que se construyan.

   En ambos casos se conserva el elemento en el layout, como en ADR-034/035:
   quitarlo obligaría a rediseñar la composición y a volver a agregarlo
   después.

5. **La ruta de la bandeja de aprobación es `/enrollments/pending`.** Dato de
   coordinación, no de arquitectura: esta capa deja ahí un placeholder
   protegido para que la primera pantalla real (feature 006) se monte sobre
   una ruta que ya existe, y `/` redirige a ella.

**Consecuencias.**

- `.env.example` gana `CORS_ORIGINS`, con los tres puertos de Vite
  (5173/5174/5175) como valor de desarrollo. Un `.env` existente sin la
  variable deja CORS apagado: el síntoma es un error de CORS en el navegador,
  no un fallo al arrancar la API.
- Cualquier pantalla futura con formulario ya puede usar
  `<Button type="submit">` sin envolturas ni botones nativos ocultos.
- `packages/shared/src/api-client/` es el primer módulo de `shared` pensado
  para los tres frontends que no es ni un tipo ni un port: vive en el barrel
  raíz (no necesita subpath, no importa `typeorm` — ADR-033).
- El login queda con dos afordancias muertas a la vista. Es deuda visible y
  deliberada, con la misma justificación que ADR-034/035.

## Referencias

- ADR-042 (la capa que este ADR completa: router, cliente de API, sesión,
  contexto de institución).
- ADR-041 (`GET /institution-members/mine`, especificado ahí, implementado
  aquí).
- ADR-036 (`packages/ui` — punto 5 enmendado por el punto 2 de este ADR).
- ADR-034 y ADR-035 (precedente del patrón "visible pero inerte"; ADR-034
  punto 4 exige este ADR).
- ADR-033 (`lib: ["ES2022"]` sin DOM en `packages/shared`, razón del punto 3).
- ADR-017 (ports solo para integraciones volátiles — criterio aplicado a
  `TokenStorage`/`FetchLike`).
- `specs/api-contracts/auth.md` y `specs/api-contracts/README.md` (forma de
  los errores, traducción por `code` en el frontend).
- `ui_kits/acceso` en el proyecto "CasiLlego Design System"
  (`claude.ai/design/p/cd01f4a5-739d-4e7b-abed-65176746dc0d`), origen del
  diseño del login.

## ADR-044 — `institution_id` en `NULL` al crear filas: la columna compañera de ADR-029 nunca se escribe; reemplazo por `@RelationId()`

**Contexto.** Al preparar la Capa 3a de Fase 7 se detectó que
`POST /auth/register/institution` dejaba `institution_members.institution_id`
en `NULL`. La investigación (ver diagnóstico completo en el historial de
esta sesión) encontró la causa raíz y confirmó que **no es un bug aislado de
una entidad**: es un defecto sistémico del patrón de "columna compañera de
solo lectura" introducido por ADR-029.

**Diagnóstico confirmado.**
1. **Son 6 entidades afectadas, no 5.** ADR-029 documentó el patrón para
   `enrollments`, `institution_members`, `delivery_points`,
   `dismissal_windows` y `dismissal_exceptions`. `pickup_requests` quedó
   fuera de ese ADR (ADR-018 punto 4 lo trató como "un problema distinto"),
   pero terminó implementado con el mismo patrón de columna compañera sin
   pasar por esa revisión — deriva silenciosa de un patrón copiado por
   similitud, no una decisión documentada. Hereda el mismo defecto.
2. **La premisa central de ADR-029 es incorrecta en TypeORM 1.0.0**: dice
   que `insert: false, update: false` en la columna compañera "asegura que
   solo la relación controla escrituras". En realidad, TypeORM fusiona la
   columna compañera y el `@JoinColumn` de la relación en un único
   `ColumnMetadata` para la misma columna física, y `insert: false` gana —
   `InsertQueryBuilder.getInsertedColumns()` descarta la columna por
   completo (`if (!column.isInsert) return false`). **No escribe la
   relación, no escribe nadie.** El orden de declaración de los
   decoradores no es la causa (se descartó empíricamente, con
   `pickup_request` como control: relación declarada primero, falla
   igual).
3. **No es un bug conocido/documentado de TypeORM** para este caso — se
   revisó el issue upstream #12234 (PR #12354, milestone 1.0), que corrige
   un problema relacionado pero solo en la ruta de `UPDATE`
   (`SubjectChangedColumnsComputer.computeDiffColumns`), no en `INSERT`. El
   caso de este proyecto es una variante distinta, no cubierta por ese fix.
4. **Nunca funcionó en este proyecto** — no es una regresión de una
   actualización de TypeORM; el proyecto nació con `typeorm ^1.0.0` (versión
   real y legítima, primer major en ocho años, publicada 2026-05-19), así
   que el patrón estuvo roto desde la primera entidad que lo usó.
5. **Ningún test lo atrapó** porque los 512+ tests existentes usan
   repositorios falsos en memoria — ninguno ejercita SQL real contra
   Postgres. El objeto que devuelve `.save()` trae `institutionId` poblado
   en memoria incluso cuando la fila en base de datos tiene `NULL`.

**Decisión.**
1. **Reemplazar la columna compañera (`@Column({insert:false,
   update:false})`) por `@RelationId()`** en las 6 entidades afectadas:
   `institution_members`, `enrollments`, `delivery_points`,
   `dismissal_windows`, `dismissal_exceptions`, `pickup_requests`.
   `@RelationId()` es el mecanismo de TypeORM diseñado específicamente para
   este caso — exponer el escalar de una FK de columna única sin cargar la
   relación completa — verificado con el mismo costo de una sola query que
   el patrón original pretendía lograr (sin `JOIN`, se resuelve leyendo el
   propio FK local).
2. **Piloto verificado end-to-end en `institution_members`** antes de
   aplicarlo al resto: persistencia real vía el service (`POST
   /institutions/:id/members/invite`), `InstitutionMembershipGuard` real
   sin `relations` cargadas, caso negativo (403 intacto), `UPDATE`
   verificado sin cambios, sin diff de esquema, 532 tests en verde.
3. **Rollout a las 5 entidades restantes exige la misma verificación
   end-to-end por entidad**, no solo el experimento aislado — en
   particular, `delivery_points` y `dismissal_*` construyen su respuesta
   HTTP desde el parámetro local justo después de `create()+save()`, sin
   releer la entidad; ese camino no quedó probado en el piloto (que sí lo
   probó en el experimento aislado, no en el service real) y debe
   confirmarse al migrar cada una.
4. **ADR-029 no se reescribe** — sigue vigente como el porqué de tener un
   escalar de FK sin cargar la relación completa (la necesidad del guard
   sigue siendo real). Lo que corrige este ADR es el *mecanismo*: dónde
   dice `insert: false, update: false` como columna explícita, ahora dice
   `@RelationId()`. Las specs de entidad de las 6 entidades afectadas
   (`specs/entities/*.md`) deben actualizar su texto de invariante para
   reflejar esto, citando ADR-044 en vez de (o junto con) ADR-029 para el
   mecanismo concreto.
5. **Categoría nueva de test: integración real contra Postgres**
   (`*.integration.spec.ts`, config y script propios —
   `npm run test:integration`), primera de su tipo en el proyecto.
   **Deliberadamente fuera de `npm run check`** — el gate principal no debe
   exigir una base de datos disponible. Se salta automáticamente si
   Postgres no responde; una transacción con rollback por archivo, sin
   dejar datos. **Riesgo aceptado y anotado en backlog** (no en este ADR):
   al quedar fuera del gate estándar, nada obliga a correrlos antes de
   cerrar una fase — depende de disciplina de proceso, no de tooling.

## Referencias

- ADR-029 (patrón original de columna compañera; premisa de mecanismo
  corregida aquí, razón de fondo sin cambios).
- ADR-018 (punto 4: exclusión original de `pickup_requests` del alcance de
  ADR-029 — resultó no evitar el defecto compartido).
- `specs/entities/institution_member.md`, `enrollment.md`,
  `delivery_point.md`, `dismissal_window.md`, `dismissal_exception.md`,
  `pickup_request.md` (texto de invariante a actualizar en las 6).
- Issue upstream `typeorm/typeorm#12234`, PR `#12354` (corrige un caso
  relacionado en `UPDATE`, no cubre el caso de `INSERT` de este proyecto).

## ADR-045 — `pickup_requests.institution_id`: migración `SET NOT NULL`, alineando esquema con `specs/entities/pickup_request.md` y ADR-018

**Contexto.** Al cerrar el rollout de ADR-044 se detectó que
`pickup_requests.institution_id` es `nullable` en la base de datos real,
pese a que `specs/entities/pickup_request.md` y ADR-018 lo tratan como
`NOT NULL` (columna denormalizada obligatoria, fijada al crear el registro,
inmutable después — ver ADR-018 y ADR-026). La divergencia existía desde
antes de ADR-044: la entidad declaraba el campo no-nullable en TypeScript,
pero la columna real de Postgres admitía `NULL`, y `migration:generate`
proponía un `SET NOT NULL` en cada corrida que, aparentemente, nunca se
aplicó. Con el reemplazo de la columna compañera por `@RelationId()`
(ADR-044), esa señal de drift desapareció — la divergencia queda ahora
silenciosa en vez de visible.

**Por qué esto importa más que un ajuste cosmético de esquema.**
`pickup_requests.institution_id` no es un campo cualquiera: es el que usa
`InstitutionMembershipGuard` para autorizar `PATCH
/pickup-requests/:id/deliver`, y el que resuelve a qué topic de MQTT se
publica cada actualización de estado (segmentación por institución,
aislamiento multi-tenant de fondo — ver `docs/arquitectura.md`). Sin un
`NOT NULL` real en base de datos, un futuro defecto similar al de ADR-044
podría dejar una recogida sin institución asignada, sin que ningún test ni
corrida de `migration:generate` lo vuelva a señalar como antes.

**Decisión.**
1. **Migración nueva: `ALTER TABLE pickup_requests ALTER COLUMN
   institution_id SET NOT NULL`**, siguiendo la convención de nombres y
   estructura ya usada por las migraciones existentes del proyecto.
2. **Antes de aplicarla**, verificar que no existan filas actuales con
   `institution_id IS NULL` en ningún entorno donde se vaya a correr la
   migración — si las hay, la migración falla en seco (comportamiento
   correcto: mejor que falle explícitamente a que se aplique sobre datos
   inconsistentes sin que nadie lo note).
3. **El tipo TypeScript de `institutionId` en la entidad** (poblado por
   `@RelationId()`, ADR-044) debe ser `string`, no `string | null` —
   consistente con el `NOT NULL` real de la columna tras esta migración.
4. **Esto es un cambio de esquema real**, a diferencia de ADR-044 (que no
   requirió migración) — se documenta aparte para que quede claro que esta
   sí toca la base de datos de cualquier entorno donde se aplique, no solo
   el código.
5. **Consecuencia no anticipada de ADR-044, resuelta aquí:**
   `@RelationId()` es virtual y no aporta metadata de columna — a
   diferencia de la columna compañera que reemplazó (que al no declarar
   `nullable` producía `NOT NULL` por default), la única fuente de verdad
   de nulabilidad que queda es el `@ManyToOne`, cuyo default es `nullable:
   true`. Sin corregirlo, `migration:generate` proponía deshacer esta
   misma migración (`DROP NOT NULL`) en la siguiente corrida. Se declara
   explícitamente `nullable: false` en el `@ManyToOne` de `institution` en
   `pickup-request.entity.ts` — es donde vive ahora esa verdad, y es
   necesario para que el punto 1 de esta decisión se sostenga en el
   tiempo, no una decisión independiente.

## Referencias

- ADR-044 (contexto: el rollout que expuso esta divergencia al eliminar la
  señal de drift que la delataba).
- ADR-018, ADR-026 (`institution_id` denormalizado, obligatorio, inmutable
  tras la creación).
- `specs/entities/pickup_request.md` (invariante ya documentada, ahora
  reflejada también en el esquema real).
- `docs/arquitectura.md` (segmentación de topics MQTT por institución,
  aislamiento multi-tenant).

## ADR-046 — `incremental` fuera de `apps/api` y `apps/worker`: la caché `.tsbuildinfo` vive fuera de `dist/` y sobrevive a `deleteOutDir`

**Contexto.** `npm run dev:api` fallaba de forma recurrente con `Cannot find
module '.../dist/main'`. El síntoma se "resolvió" antes borrando a mano el
archivo `.tsbuildinfo`, sin registrar la causa ni el arreglo; el fallo volvió,
como era de esperarse. Este ADR documenta la causa real y el arreglo
definitivo.

**Causa raíz.** Es la interacción de dos ajustes que por separado son
razonables:

1. `apps/{api,worker}/nest-cli.json` define `"deleteOutDir": true`, así que
   `nest build` borra `dist/` completo antes de cada compilación.
2. `apps/{api,worker}/tsconfig.json` definía `"incremental": true`, sin fijar
   `tsBuildInfoFile`.

El punto no evidente es **dónde** aterriza la caché. Con `outDir` y `rootDir`
ambos definidos, TypeScript resuelve la ruta por defecto del `.tsbuildinfo`
como `outDir` + la ruta relativa de `rootDir` al archivo de configuración.
Como `rootDir` es `./src` y el `tsconfig.build.json` está un nivel **arriba**
de `src/`, esa ruta relativa empieza con `..` y colapsa fuera de `dist/`:

```
resolvePath("apps/api/dist", "../tsconfig.build") -> apps/api/tsconfig.build.tsbuildinfo
```

Verificado consultando al propio compilador (`ts.getTsBuildInfoEmitOutputFilePath`,
TypeScript 5.9.3), no por inspección visual.

El resultado es que **la caché y los artefactos que describe tienen ciclos de
vida independientes**: `deleteOutDir` borra `dist/`, el `.tsbuildinfo`
sobrevive un nivel más arriba, y en la siguiente corrida `tsc` lee esa caché,
concluye que todo está al día y **no emite nada, saliendo con código 0**.

**Por qué esto es peor que un fallo de arranque.** El modo de falla no es solo
`dist/` vacío. Medido sobre `apps/api` (compilación completa = 363 archivos):

| Escenario | Archivos emitidos | Código de salida |
|---|---|---|
| Sin `.tsbuildinfo` (build en frío) | 363 | 0 |
| `dist/` borrado + `.tsbuildinfo` obsoleto, sin cambios en fuentes | **0** | 0 |
| `dist/` borrado + `.tsbuildinfo` obsoleto, **un** archivo modificado | **3** | 0 |

El tercer caso es el peligroso: `tsc` re-emite únicamente los archivos que
cambiaron, produciendo un `dist/` **silenciosamente incompleto** —
`dist/main.js` existe, pero casi todo lo que importa falta— y la compilación
reporta éxito. Un artefacto así puede llegar a un despliegue sin que nada lo
señale. `Cannot find module .../dist/main` era la variante ruidosa y afortunada
del mismo defecto.

**Decisión.** Quitar `"incremental": true` de `apps/api/tsconfig.json` y
`apps/worker/tsconfig.json`, con un comentario en cada archivo explicando por
qué no debe volver a activarse.

**Por qué esta opción y no las otras.** El criterio fue atacar la causa con el
mínimo de maquinaria:

- **Mover la caché dentro de `dist/`** (`tsBuildInfoFile: "./dist/..."`)
  también elimina la desincronización, porque `deleteOutDir` borraría caché y
  salidas juntas. Pero entonces la caché se destruye en cada build y toda
  compilación vuelve a ser completa: el mismo rendimiento que quitar
  `incremental`, con un ajuste extra de configuración que hay que mantener.
- **Un script `prebuild` que borre el `.tsbuildinfo`** es equivalente en efecto,
  pero traslada la garantía a un paso procedural que hay que replicar en cada
  punto de entrada (`build`, `start:dev`, y cualquier script futuro) y que
  requiere un borrado multiplataforma. Es fácil olvidarlo; el defecto vuelve.
- **Quitar `deleteOutDir`** haría funcionar la compilación incremental de
  verdad, pero cambia un problema de obsolescencia por otro: archivos de
  fuentes borradas o renombradas quedarían acumulados en `dist/`.

El argumento decisivo: **con `deleteOutDir: true`, la compilación incremental
nunca puede acelerar correctamente un build.** Si la caché sobrevive, la salida
es incorrecta; si no sobrevive, el build es completo de todos modos. La única
razón por la que alguna vez funcionó es que el `.tsbuildinfo` estaba ausente
(clon nuevo, o borrado a mano). La opción era pura exposición sin beneficio.

**Impacto en tiempos de build (medido, `apps/api`).** Ninguno en la práctica:
una compilación completa tarda ~4.5 s, y ese ya era el costo de todo build
correcto. La caché ahorraba ~1.1 s únicamente con `dist/` intacto, escenario
que `deleteOutDir` garantiza que `nest build` nunca alcanza. El modo `--watch`
no se ve afectado: `tsc` mantiene su estado incremental en memoria,
independientemente de la bandera `incremental`.

**Alcance.** `apps/worker` tenía exactamente la misma configuración y estaba en
el mismo estado roto al momento del diagnóstico (`dist/` vacío con
`.tsbuildinfo` presente); se corrige junto con `api`. `packages/shared` y los
frontends no usaban `incremental` y no están afectados. `.gitignore` ya cubría
`*.tsbuildinfo` y `dist/`, así que ninguna caché obsoleta llegó a versionarse.

## Referencias

- `apps/api/tsconfig.json`, `apps/worker/tsconfig.json` (comentario de
  advertencia en el sitio del cambio).
- `apps/api/nest-cli.json`, `apps/worker/nest-cli.json` (`deleteOutDir: true`,
  la otra mitad de la interacción).
- `docs/plan-implementacion.md`, tabla de backlog técnico (registro del defecto
  reincidente y de su prevención).
