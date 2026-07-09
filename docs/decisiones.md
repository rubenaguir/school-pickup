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
   `enrollment.approved`, `institution.suspended`, `guardian.added`), no un
   enum cerrado. Nuevos tipos de evento no requieren migración de esquema.
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
