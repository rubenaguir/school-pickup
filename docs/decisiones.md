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

     **Nota de acoplamiento frontend (detectada en Fase 7, Capa 3b/3c).**
     `PATCH /enrollments/:id/approve` responde **422** cuando
     `institutions.status != approved` (regla cruzada — la institución es una
     entidad distinta del `enrollment`), mientras que `PATCH /institutions/:id`
     responde **409** para el mismo escenario de fondo sobre sí misma (conflicto
     con su propio estado). Ambos códigos son correctos bajo esta convención,
     pero `apps/portal` **depende silenciosamente de esta distinción** para
     decidir el comportamiento de la UI: en la bandeja de aprobación
     (`usePendingEnrollments.ts`), `isStaleRow` solo considera "obsoleta" una
     fila ante `409`/`404` — un `422` deja la fila visible con un error inline
     (`setRowError`), en vez de refrescar el listado y hacerla desaparecer. Si
     en el futuro se "homogeneiza" el código de `approve` a `409` para que
     coincida con el de `institutions.md`, sin saberlo se rompe ese
     comportamiento del frontend en silencio — ningún test de la capa API lo
     detectaría, porque la convención en sí seguiría siendo válida. Cualquier
     cambio futuro al código HTTP de estos dos endpoints debe revisar
     `usePendingEnrollments.ts` explícitamente antes de aplicarse.
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
   a la baja artificialmente). **Caso borde de meses cortos (aclaración
   sobre la implementación):** cuando el mes anterior tiene menos días que
   el recorte del mes actual (ej. el 31 de marzo comparado contra 30 días
   desde el 1 de febrero, que caerían el 3 de marzo — días que el periodo
   actual ya cuenta), el periodo anterior se recorta para que **nunca se
   solape** con el inicio del mes actual, en vez de extenderse hacia el mes
   siguiente. El mes corto simplemente reporta menos días de comparación;
   es preferible subcontar unos días a contar una recogida dos veces en
   ambos periodos.
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

## ADR-047 — "Tutor solicitante" en la bandeja de aprobación: placeholder estático, sin ampliar el contrato de `GET /enrollments`

**Contexto.** `docs/design-brief.md` describe la bandeja de aprobación de
alumnos (★, feature 006) como una lista donde por cada solicitud se muestran
"datos del alumno **y del tutor solicitante**". El contrato real
(`specs/api-contracts/enrollments.md`, `GET /enrollments?status=pending&institutionId=...`)
no expone nada del tutor más allá de `requestedByUserId`: ni nombre, ni
correo, ni teléfono. No hay hueco que llenar con un campo existente — hay que
decidir explícitamente qué hace la pantalla, porque las dos salidas fáciles
están prohibidas por `CLAUDE.md` ("Reglas de implementación"): inventar el
campo en el frontend, o ampliar el endpoint sobre la marcha sin pasar por la
spec.

Mostrar el `requestedByUserId` crudo tampoco es una opción: es un UUID, no un
dato legible para un administrador escolar.

**Decisión.**
1. **La fila muestra la etiqueta "Tutor solicitante" con un placeholder
   estático (`—`)**, en vez de omitirla del layout. Mismo tratamiento que la
   columna "Último acceso" de ADR-035: es un dato ausente, no una acción
   deshabilitada, así que el placeholder es visual y no hay estado `disabled`
   que aplicar.
2. **Sin wiring a ningún campo ni endpoint.** El placeholder no se calcula ni
   se deriva de `requestedByUserId`; el frontend no pide ese dato ni lo espera.
   No confundir con un `null` traído de la API.
3. **Ampliar el contrato queda diferido a su propio slice.** Si la institución
   necesita ver quién solicitó (probable: es información útil para decidir),
   la ruta correcta es modificar primero
   `specs/api-contracts/enrollments.md` — decidir qué campos del tutor se
   exponen y con qué justificación de privacidad, dado que el tutor todavía no
   tiene relación aprobada con la institución en el momento de la revisión —
   y solo entonces implementarlo. Este ADR no prejuzga esos campos.
4. **Decisión específica a esta pantalla.** Igual que ADR-034 punto 4 y
   ADR-043 punto 4: no se generaliza una regla para el resto del portal; el
   próximo hueco visual se resuelve con su propio ADR.

**Consecuencias.** La bandeja identifica cada solicitud por alumno
(`studentFullName`, `gradeOrGroup`), código de enrollment y fecha de
solicitud — suficiente para decidir en el caso normal, donde el administrador
reconoce al alumno. Queda deuda visible y deliberada en la fila, en la misma
línea que ADR-034/035/043.

## Referencias

- `docs/design-brief.md` (origen visual del dato, sección "Bandeja de
  aprobación de alumnos").
- `specs/api-contracts/enrollments.md` (`GET /enrollments`, ausencia del dato).
- `specs/features/006-aprobacion-enrollment.md` (feature implementada por la
  pantalla).
- ADR-034, ADR-035 y ADR-043 punto 4 (precedente del patrón "elemento visual
  sin respaldo de datos"; ADR-034 punto 4 exige este ADR).
- `.claude/rules/design-system.md` ("Qué NO hacer" — no inventar el campo).

## ADR-048 — Mapbox GL JS para el widget de mapa interactivo del frontend

**Contexto.** La pantalla "Perfil de institución / geocerca" (feature 008,
`docs/design-brief.md`) necesita un mapa interactivo donde el admin arrastra
un pin y ajusta dos radios independientes (`geofenceRadiusMeters` de arribo,
`activationRadiusMeters` de activación — ADR-013). Esto es una decisión
distinta del `MapsProvider` que sigue abierto en la tabla de pendientes
(`docs/plan-implementacion.md`): ese es el port de cálculo de ETA con
tráfico en vivo, usado por el `worker` (`StubMapsProvider` hoy). Ninguna
spec ni ADR había decidido qué librería renderiza un mapa en el navegador.

**Decisión.**
1. **Mapbox GL JS** (`mapbox-gl`, sin el wrapper `react-map-gl` — un
   componente propio delgado sobre la librería base, consistente con el
   criterio ya usado en ADR-036: no sumar una dependencia de envoltura
   cuando la superficie de uso es acotada).
2. **Vive en `packages/ui`**, no solo en `apps/portal` — el
   `design-brief.md` también pide mapa en la pantalla de seguimiento de la
   app del padre ("mapa con la ruta hacia la institución"), así que el
   widget se construye pensando en ese segundo consumidor desde ahora,
   aunque `apps/parent` no lo use todavía. Mismo criterio de reutilización
   multi-frontend que ya justificó poner el cliente de API en
   `packages/shared` (ADR-042 punto 2).
3. **Token de acceso vía variable de entorno** (`VITE_MAPBOX_TOKEN` o
   equivalente ya usado en el monorepo), nunca hardcodeado. Nota: un token
   público de Mapbox no es un secreto en el sentido clásico (está pensado
   para exponerse en cliente), pero **debe restringirse por dominio/URL
   permitida desde el dashboard de Mapbox** — sin esa restricción,
   cualquiera podría usarlo desde otro sitio y consumir la cuota.
4. **Alcance de esta primera implementación**: pin arrastrable + dos
   círculos de radio ajustables sobre el mapa, con los valores numéricos
   también editables en un input de respaldo (para el caso de radios muy
   pequeños o precisión difícil de lograr solo arrastrando). **Sin
   autocompletado de direcciones** en esta fase — el admin ubica
   manualmente el pin; buscar por dirección queda diferido a un slice
   futuro si se necesita.
5. **Tres decisiones de implementación, cierre de esta misma decisión:**
   - El CSS de `mapbox-gl` se importa una sola vez desde
     `packages/ui/src/styles.css`, heredado por los tres frontends — mismo
     patrón que las fuentes y tokens ya centralizados ahí (ADR-036).
   - **El token de acceso se pasa como prop** al componente, en vez de que
     `packages/ui` lea `import.meta.env` directamente. `packages/ui` no
     debe asumir cómo cada app resuelve sus variables de entorno — cada
     frontend (`portal`, y a futuro `parent`) es responsable de leer su
     propia `VITE_MAPBOX_TOKEN` y pasarla.
   - **Los inputs numéricos de respaldo de los radios viven en la
     pantalla, no en el widget** — evita dos controles distintos
     gobernando el mismo valor dentro de la misma vista; el widget expone
     el valor y un callback, la pantalla decide cómo más exponerlo.

## Referencias

- `specs/features/008-editar-perfil-institucion.md`.
- `specs/api-contracts/institutions.md` (`PATCH /institutions/:id`, campos
  `location`, `geofenceRadiusMeters`, `activationRadiusMeters`).
- ADR-013 (dos radios independientes, no colapsables).
- ADR-036 (criterio de no sumar dependencias de envoltura sin necesidad
  clara; centralización de assets estáticos en `packages/ui/src/styles.css`).
- ADR-042 (punto 2: precedente de ubicar código reutilizable
  multi-frontend en un paquete compartido, no duplicado por app).
- `docs/design-brief.md` (mapa en la pantalla de seguimiento de
  `apps/parent`, segundo consumidor futuro de este mismo widget).
- `docs/plan-implementacion.md` (tabla de pendientes: `MapsProvider` del
  backend sigue abierto, decisión distinta a esta).

## ADR-049 — Pantalla de puntos de entrega: filtrado en cliente, entrada de etiquetas local y confirmación antes de desactivar

**Contexto.** La pantalla de puntos de entrega (feature 009,
`specs/api-contracts/delivery-points.md`) necesita tres cosas que las dos
pantallas anteriores del portal no habían enfrentado: un filtro por estado
que el contrato ofrece como query param (`GET
/institutions/:id/delivery-points?status=`), un campo `assignedGroups` que
es un `varchar[]` de texto libre (ADR-012) sin componente que lo represente
entre los diez portados en la Capa 0 (ADR-036), y una acción —desactivar—
que no borra nada pero sí saca al punto del flujo de recogidas en curso.

**Decisión.**
1. **El listado trae todos los puntos y el filtro activo/inactivo se resuelve
   en cliente**, sin usar el query param `status`. Dos razones: al desactivar
   un punto la fila tiene que seguir a la vista cambiando de estado (feature
   009: no hay borrado físico, la entidad se conserva siempre), y usar el
   filtro del servidor obligaría a re-consultar después de cada `PATCH` solo
   para que la fila reapareciera en la otra pestaña. El conjunto es de unas
   pocas puertas por institución, así que no hay argumento de volumen del
   otro lado. El query param sigue existiendo en el contrato para otros
   consumidores (la consola de puerta querrá solo los activos); esta pantalla
   simplemente no lo usa.
2. **La entrada de `assignedGroups` es un campo de etiquetas construido dentro
   de la pantalla**, no un `<input>` de texto separado por comas ni un
   componente nuevo de `@casillego/ui`. Un `<input>` obligaría al usuario a
   puntuar correctamente un array; el paquete de UI sigue teniendo los diez
   componentes de ADR-036 y sumar el undécimo es una decisión de design
   system, no de una pantalla. Mismo criterio que `Field` y `Alert`, que
   viven en `apps/portal/src/components/` por lo mismo. Si una segunda
   pantalla lo necesita, ahí se decide promoverlo.
3. **Desactivar pide confirmación en la propia fila; reactivar no.**
   Desactivar deja de asignar recogidas a ese punto mientras la institución
   opera, así que no puede ser un clic suelto. Reactivar no destruye nada y
   va directo. La confirmación es un bloque en línea dentro de la tarjeta, no
   un modal: el design system no tiene modal y no se inventa uno aquí.
4. **`active`/`inactive` no reutiliza la paleta de los 5 estados de recogida.**
   No es un estado de recogida, y `.claude/rules/design-system.md` reserva
   esos cinco colores para eso. La fila usa `Badge tone="neutral"` con el
   texto del estado y atenúa la tarjeta cuando está inactiva, en vez de
   agregarle una variante nueva a `Badge` (que sería, otra vez, tocar el
   design system desde una pantalla).
5. **El selector de operador se alimenta de `GET /institutions/:id/members`**
   (ADR-039), nunca de un uuid escrito a mano: `operator_user_id` debe ser
   miembro de la misma institución (ADR-018 punto 11), así que un campo libre
   solo serviría para provocar `422 OPERATOR_NOT_INSTITUTION_MEMBER`. El
   hook vive en `delivery-points/` porque el selector es su único consumidor
   hoy; cuando llegue la pantalla de Personal (feature 012) se mueve a su
   propio módulo. Un `operatorUserId` guardado que ya no aparece en el
   personal se conserva como opción marcada "Operador fuera de la
   institución" en vez de borrarse en silencio al guardar otro campo — y si
   se guarda así, el 422 se traduce y se muestra en el formulario.

**Consecuencias.** La pantalla mantiene una sola forma abierta a la vez
(alta o edición, nunca las dos), lo que deja exactamente un botón coral por
vista sin reglas extra: el submit del formulario cuando está abierto, el
"Nuevo punto de entrega" cuando no. El filtrado en cliente implica que la
pantalla siempre tiene la lista completa en memoria; si alguna institución
llegara a tener decenas de puntos, esta decisión es lo primero que hay que
revisar.

## Referencias

- `specs/features/009-gestionar-puntos-entrega.md`.
- `specs/api-contracts/delivery-points.md` (`GET`/`POST`
  `/institutions/:id/delivery-points`, `PATCH /delivery-points/:id`).
- `specs/api-contracts/institution-members.md` (`GET /institutions/:id/members`,
  fuente del selector de operador).
- ADR-012 (`assigned_groups` texto libre; asignación automática por grupo;
  cero puntos es un estado válido).
- ADR-018 (punto 11: `operator_user_id` debe ser miembro de la misma
  institución).
- ADR-022 (punto 1: escritura exige `role = admin`; punto 5: 422 para la
  validación cruzada).
- ADR-036 (los diez componentes de `@casillego/ui`; no se suma un undécimo
  sin decisión explícita).
- ADR-039 (`GET /institutions/:id/members`).
- `.claude/rules/design-system.md` (paleta de 5 estados, un solo coral por
  pantalla).

## ADR-050 — Puente WebSocket en `apps/api`: navegadores nunca se conectan directo al broker MQTT

**Contexto.** La Consola de puerta (feature 021, `docs/design-brief.md`)
necesita tiempo real: la cola de un punto de entrega se actualiza en vivo
según los `pickup_requests` cambian de estado. `docs/arquitectura.md` ya
documenta la intención de seguridad ("Autenticación por usuario/token en el
broker, nunca anónimo. Tokens emitidos por el `api` tras el login"), pero
nada de eso está construido — no existe endpoint que emita credenciales
MQTT, ni configuración de plugin de autenticación en el broker.

El broker Mosquitto (`wss://mqtt-jmra.com.mx:9001/mqtt`) es **infraestructura
compartida en producción**, dando soporte a otros sistemas además de
CasiLlego — el humano explícitamente no quiere arriesgar su funcionalidad
actual tocando su configuración. Conectar el navegador directo al broker,
aunque sea con topics "segmentados" por `institutionId`, **no es
aislamiento real**: el nombre de un topic no es un secreto (cualquier
`institution_member` de una institución conoce su propio `institutionId`,
y ese dato puede filtrarse por otros canales), así que sin autenticación ni
ACL reales en el broker, cualquiera con la URL del broker podría
suscribirse a topics de cualquier institución — rompiendo el aislamiento
multi-tenant que gobierna el resto del sistema (`docs/arquitectura.md`,
`InstitutionMembershipGuard`).

**Decisión.**
1. **El navegador nunca se conecta directamente al broker MQTT.** En su
   lugar, `apps/api` expone su propio servidor WebSocket nativo (NestJS,
   adaptador `ws` — no `socket.io`: no hace falta su protocolo propio ni
   sus transportes de respaldo, el navegador ya soporta WebSocket nativo, y
   evita una dependencia adicional sin necesidad clara, mismo criterio que
   ADR-036).
2. **Cero cambios al broker Mosquitto de producción.** `apps/api` se
   conecta al broker exactamente como ya lo hace hoy — no se agrega ninguna
   conexión nueva, ningún usuario nuevo, ningún plugin. Desde la
   perspectiva de Mosquitto, nada cambia.
3. **Autenticación y autorización del WebSocket: mismo JWT, misma regla que
   REST.** El cliente pasa el `accessToken` (query param en el handshake de
   conexión, ya que los headers `Authorization` no son controlables desde
   la API nativa `WebSocket` del navegador). El gateway valida el JWT y
   aplica la misma regla que `InstitutionMembershipGuard` ya aplica para
   `PATCH /pickup-requests/:id/deliver` — el usuario debe ser
   `institution_members` de la institución dueña del `delivery_point`
   solicitado, **sin restricción de `role`** (ADR-011: la consola de puerta
   no restringe por rol dentro del mismo tenant). No es una reimplementación
   paralela del guard — es la misma regla, adaptada al contexto de
   conexión WS en vez de request HTTP.
4. **Un canal por punto de entrega, no una conexión abierta a "todo".** El
   cliente se conecta indicando el `deliveryPointId` que quiere observar
   (consistente con el diseño: la consola opera un punto de entrega
   concreto a la vez, `docs/design-brief.md`). El servidor solo reenvía
   mensajes de ese punto de entrega a ese cliente.
5. **Suscripción del servidor al broker: wildcard, reutilizando los
   builders existentes.** `apps/api` se suscribe una sola vez (no por
   conexión de navegador) al wildcard ya usado por el patrón de
   "suscripción del servidor" que el `worker` ya implementa (ADR-031 punto
   4) para el topic de cola —
   `school-pickup/institution/+/delivery-point/+/queue` — y reutiliza
   `parseLocationTopic`-equivalente (o su análogo para este topic, si no
   existe todavía, créalo con la misma forma) de `packages/shared` para
   extraer `institutionId`/`deliveryPointId` del topic entrante. Al llegar
   un mensaje, el gateway lo reenvía solo a los WebSockets de navegador
   suscritos a ese `deliveryPointId` específico. El payload que viaja al
   navegador es el mismo que ya construye `buildQueuePayload()` — sin
   envoltura nueva.
6. **Snapshot inicial: REST, no dentro del WebSocket.** Mismo patrón ya
   establecido para `pickup-requests` al principio de esta fase (snapshot
   REST + deltas por tiempo real, dos mecanismos separados, no uno híbrido).
   Se agrega `deliveryPointId` como filtro nuevo de
   `GET /pickup-requests?deliveryPointId=...` (junto al `enrollmentId` ya
   existente) — **autorización distinta a la del filtro por
   `enrollmentId`**: aquí no aplica el lado "guardián" del OR (un punto de
   entrega no tiene una perspectiva de tutor individual), solo el lado
   `institution_member` de la institución dueña del punto. Devuelve solo
   `pickup_requests` en estados activos (`en_route`, `arriving`,
   `arrived`) — no historial completo, consistente con el propósito
   operativo de la cola.
7. **Reconexión y errores de red son responsabilidad del frontend**, no de
   este ADR — se resuelven al construir la pantalla (Capa 3e), con el mismo
   criterio de `ErrorState`/reintento ya usado en el resto del portal.

**Consecuencias.** Este mismo puente sirve, sin cambios de arquitectura,
para el feed agregado del tablero (`apps/board`, topic distinto,
`boardTopic`) y para el tracking del padre (`apps/parent`, topic de
ubicación) cuando se aborden esas fases — el patrón (WS en `apps/api`,
nunca conexión directa de navegador al broker) se reutiliza, cada consumidor
solo cambia a qué topic(s) se suscribe el gateway y qué regla de
autorización aplica.

## Referencias

- `docs/arquitectura.md` (intención original de tokens emitidos por el
  `api`, nunca implementada; ACL por tenant; TLS obligatorio).
- ADR-011 (consola de puerta sin restricción de `role` dentro del tenant).
- ADR-017 (`MqttClient` como port; mismo principio de abstracción aplicado
  aquí al lado del `api`).
- ADR-022 (punto 4: `InstitutionMembershipGuard`, regla que este ADR
  replica para WS).
- ADR-024, ADR-037 (patrón ya establecido de snapshot REST + tiempo real
  separado, aplicado antes a `pickup-requests`).
- ADR-031 (punto 4: patrón de suscripción del servidor por wildcard, ya
  usado por el `worker`, reutilizado aquí).
- `specs/api-contracts/pickup-realtime-mqtt.md` (topics existentes,
  `deliveryPointQueueTopic`, `buildQueuePayload`).
- `specs/api-contracts/pickup-requests.md` (endpoint `GET /pickup-requests`
  extendido con el filtro `deliveryPointId`).
- `specs/api-contracts/delivery-point-queue-ws.md` (contrato del puente:
  handshake, autorización y códigos de cierre 4400/4401/4403/4404).
- `specs/features/021-confirmar-llegada-y-entrega.md` (contexto operativo
  de la consola de puerta).

## ADR-051 — `deliveryCode` en el payload de cola (REST y WS), nunca en el de tablero

**Contexto.** Al construir la plomería de la Consola de puerta (ADR-050) se
detectó que ni el snapshot REST (`PickupRequestSummary`, genérico y
deliberadamente delgado) ni el payload de cola en tiempo real
(`PickupRequestQueuePayload`, lo que de verdad viaja por
`deliveryPointQueueTopic`) incluyen `delivery_code`. La consola no puede
cumplir su función central sin él — feature 021: *"el staff verifica el
`delivery_code`... la consola de puerta lo despliega directamente"*.
ADR-024 (punto 11) ya estableció que el código es visible para cualquier
`institution_member` de la institución, sin restricción de rol, vía
`GET /pickup-requests/:id` — este ADR extiende **dónde** se expone (también
en la cola en vivo), no relaja **a quién** se le expone.

**Decisión.**
1. **`deliveryCode` se agrega a `PickupRequestRealtimeSnapshot`**
   (`packages/shared/src/pickup-request-payloads.ts`) — el snapshot
   compartido de entrada que ya construye `pickups.service.ts` al publicar.
2. **Solo `buildQueuePayload()` lo incluye en su salida.**
   `buildBoardPayload()` **no cambia** — sigue sin `deliveryCode`,
   deliberadamente. El tablero (`apps/board`) es una pantalla pública en la
   recepción de la institución, visible a cualquiera que pase — mostrar ahí
   el código de verificación sería una exposición real, distinta del caso
   ya resuelto por ADR-024 (visible solo a `institution_members`
   autenticados, nunca a un público no identificado).
3. **Nueva forma de respuesta para `GET /pickup-requests?deliveryPointId=...`**,
   distinta de `PickupRequestSummary` (que se mantiene sin cambios para el
   filtro `enrollmentId`, deliberadamente delgado — perspectiva del tutor,
   sin necesidad operativa de estos campos). La nueva forma,
   `PickupRequestQueueSummary`, replica **exactamente** los campos de
   `PickupRequestQueuePayload` más `deliveryCode` — mismos nombres de
   campo, incluido `pickupRequestId` en vez de `id` (deliberadamente
   distinto de la convención genérica del resto de la API), para que el
   frontend pueda fusionar el snapshot inicial y los deltas del WebSocket
   sin ninguna transformación intermedia.
4. **Autorización sin cambios** — sigue siendo la misma regla ya
   establecida en ADR-050 punto 6 para el filtro `deliveryPointId` (solo
   `institution_member`, sin lado de tutor en la OR).

## Referencias

- ADR-024 (punto 11: `delivery_code` visible a cualquier
  `institution_member`, sin restricción de rol — la base de este ADR).
- ADR-050 (punto 6: snapshot REST del filtro `deliveryPointId`, forma
  original insuficiente).
- `specs/features/021-confirmar-llegada-y-entrega.md` (necesidad operativa
  del código en la consola).
- `packages/shared/src/pickup-request-payloads.ts`
  (`PickupRequestRealtimeSnapshot`, `PickupRequestQueuePayload`,
  `PickupRequestBoardPayload` — este último sin cambios, a propósito).
- `specs/api-contracts/pickup-realtime-mqtt.md`,
  `specs/api-contracts/pickup-requests.md` (formas de payload a actualizar).

## ADR-052 — Consola de puerta: excepción al refresh automático en el `401` del código de entrega, y decisiones de la pantalla en vivo

**Contexto.** Al construir la Consola de puerta (feature 021, Capa 3e) sobre
la plomería ya decidida (ADR-050 puente WebSocket, ADR-051 `deliveryCode` en
el payload de cola) aparecieron cinco decisiones que ninguno de esos ADR
cubre. Una de ellas es un defecto real de la capa compartida, no una
preferencia de pantalla: **el interceptor de refresh de ADR-042 punto 4 trata
todo `401` como sesión expirada**, y `PATCH /pickup-requests/:id/deliver`
responde `401 INVALID_DELIVERY_CODE` cuando el código tecleado no coincide
(ADR-031 punto 2) — que no es un fallo de autenticación, sino la verificación
fallida de un secreto compartido. Con el interceptor tal como estaba, un
operador que se equivoca al teclear provoca un refresh de token y **un
segundo envío del `PATCH`**: dos filas en `audit_log` por un solo intento
(contradiciendo feature 021, que registra una por intento), y —si el refresh
llegara a fallar— el cierre de sesión del operador por un error de tecleo.

**Decisión.**
1. **Nueva opción `skipRefreshForCodes` en el cliente de API compartido**
   (`packages/shared/src/api-client`): una lista de `code` cuyo `401` **no**
   es una sesión expirada y por tanto se devuelve tal cual al llamador, sin
   refrescar el token ni reintentar. La usa únicamente
   `PATCH /pickup-requests/:id/deliver`, con un solo elemento
   (`INVALID_DELIVERY_CODE`). La llamada sale autenticada como cualquier otra
   —a diferencia de `skipAuth`, que además omite el header—.

   **La exención se decide por el `code` del cuerpo de la respuesta, nunca
   por el endpoint.** Un mismo endpoint responde los dos tipos de `401`: el
   del código tecleado que no coincide, y el que `JwtAuthGuard` devuelve
   cuando el access token de verdad expiró — y cuál de los dos fue solo se
   sabe **después** de que la respuesta llega, no cuando se arma la petición.
   Una bandera booleana fijada de antemano trataría el token expirado del
   operador como si fuera un código mal tecleado: no es un agujero de
   seguridad (el servidor sigue rechazando la petición), pero sí una sesión
   que deja de renovarse sola y un mensaje equivocado en pantalla. Por eso el
   cliente lee el cuerpo del `401` antes de decidir; el `401` de
   `JwtAuthGuard` no trae `code` propio (colapsa a `UNKNOWN_ERROR`,
   ADR-028), no está en la lista, y refresca y reintenta como cualquier otro.

   Es una excepción explícita y acotada a un `code`, no un cambio de la regla
   general de ADR-042 punto 4: hoy `INVALID_DELIVERY_CODE` es el único `401`
   del API que no habla de la sesión (ADR-031 punto 2), y cualquier otro
   sigue significando exactamente lo que significaba.
2. **La cola de la consola se ordena por ETA ascendente**, con las filas sin
   ETA calculado al final y desempate por nombre del alumno. El endpoint
   devuelve `created_at DESC` (ADR-024 punto 9), que es el orden correcto
   para un histórico y el equivocado para una puerta:
   `specs/api-contracts/pickup-requests.md` ya lo anticipa al justificar por
   qué el payload de cola no lleva `startedAt` ("la consola ordena por ETA").
   Un ETA desconocido no es un ETA inminente, de ahí que hunda la fila en vez
   de subirla; el desempate por nombre existe para que dos renders de los
   mismos datos no reordenen la pantalla.
3. **Un delta en estado terminal (`delivered`/`cancelled`) saca la fila de la
   cola**, y un delta más viejo (`updatedAt` anterior) que el que ya está en
   pantalla se descarta. Lo primero mantiene la fusión coherente con el
   snapshot, que solo devuelve estados activos (ADR-050 punto 6); lo segundo
   evita que un mensaje que se adelanta a otro, o uno que estaba en vuelo
   mientras se re-pedía el snapshot tras una reconexión, resucite un estado
   viejo. La fusión (`mergeQueueDelta`) es una función pura y se prueba, no
   se clica.
4. **Confirmar la entrega no actualiza la fila localmente.** Tras un `PATCH`
   exitoso la pantalla marca la fila como confirmada, pero **quien la saca de
   la cola es el delta del WebSocket**, no el frontend: el canal en vivo es
   la única fuente de verdad de lo que la puerta está sosteniendo, y una
   actualización optimista discreparía de él en cuanto cualquier otra cosa
   fallara. Si el socket está caído en ese momento, la fila se va al
   reconectar, cuando se vuelve a pedir el snapshot.
5. **Reconexión: el socket primero, el snapshot desde su `open`.** Al abrir
   (también al reabrir) se pide el snapshot REST, y los deltas que llegan
   mientras esa petición está en vuelo se acumulan y se aplican encima del
   snapshot, en vez de perderse contra una respuesta que ya nació vieja.
   Backoff simple y con techo bajo (1s → 2s → 5s → 10s): esta pantalla vive
   en una tablet en la puerta durante una ventana de salida que dura minutos,
   así que una consola que tarda medio minuto en volver es una consola que se
   perdió el evento. Los cuatro códigos de cierre de aplicación
   (`4400`/`4401`/`4403`/`4404`) **no se reintentan** — el handshake fue
   rechazado, reintentarlo solo lo haría rechazar otra vez; se traducen por
   su `reason` (mismo criterio que los `code` REST, ADR-028) y se muestran
   como aviso. Cualquier otro cierre es un fallo de transporte y sí se
   reintenta, con indicador visible de "Reconectando…".
6. **El origen del WebSocket se deriva de `VITE_API_BASE_URL`** (`http`→`ws`,
   `https`→`wss`, sin el prefijo `/api`), no de una variable de entorno
   propia: un despliegue configura un solo origen, no dos que puedan quedar
   desincronizados.

**Consecuencias.** El puente WebSocket queda con un consumidor real y un
patrón de cliente reutilizable (snapshot desde `open` + buffer + backoff)
para el tablero (`apps/board`) y el tracking del padre (`apps/parent`) cuando
se aborden. `skipRefreshForCodes` queda disponible para cualquier `401`
futuro que no hable de la sesión, pero **no se aplica por defecto**: sumar un
`code` a la lista exige justificar por qué ese `code` concreto no es una
sesión expirada — y como la exención es por `code` y no por endpoint, agregar
uno nunca deja de renovar la sesión en el resto de los `401` de esa misma
llamada.

## Referencias

- ADR-011 (la consola de puerta no restringe por `role`: la ruta
  `/gate-console` no exige `admin`, a diferencia de las otras tres del
  portal).
- ADR-024 (punto 9: paginación por defecto de 20, que esta pantalla eleva a
  100 porque una puerta en hora de salida sostiene más de veinte coches y no
  hay paginador que recorrer; punto 11: el `deliveryCode` se despliega para
  que el operador lo compare).
- ADR-028 (los `code` en inglés se traducen en el frontend, incluido el
  `reason` de los cierres del WebSocket).
- ADR-031 (punto 2: `INVALID_DELIVERY_CODE` como `401` de tercera categoría —
  el defecto que el punto 1 corrige; puntos 7 y 8: la fila de `audit_log` que
  se duplicaba).
- ADR-034 (botón "Reportar incidencia": visible, deshabilitado, sin wiring —
  respetado tal cual en esta pantalla).
- ADR-042 (punto 4: refresh automático y transparente en cualquier `401` — la
  regla a la que el punto 1 abre una excepción explícita).
- ADR-049 (precedente de ADR de pantalla: decisiones de implementación de una
  pantalla del portal agrupadas en un ADR propio).
- ADR-050 (puntos 6 y 7: snapshot REST separado de los deltas; reconexión
  como responsabilidad del frontend, resuelta aquí).
- ADR-051 (punto 3: `PickupRequestQueueSummary` con los mismos campos que el
  payload de tiempo real — lo que permite que `QueueRow` sea un solo tipo).
- `specs/features/021-confirmar-llegada-y-entrega.md`,
  `specs/api-contracts/pickup-requests.md`,
  `specs/api-contracts/delivery-point-queue-ws.md`.

## ADR-053 — Pantalla de horarios de salida: una pantalla para dos entidades, normalización de `time` en la API y validación de cliente

**Contexto.** La pantalla de horarios (features 010 y 011,
`specs/api-contracts/dismissal-windows.md` y
`specs/api-contracts/dismissal-exceptions.md`) es la primera del portal que
cubre dos entidades a la vez, la primera con un borrado físico y la primera
que consume columnas `time` de Postgres. Al implementarla salieron tres
cosas que las tres pantallas anteriores no habían enfrentado.

**Decisión.**

1. **La API normaliza `time` a `HH:mm` antes de responder; no lo hace el
   cliente.** Los dos contratos documentan `HH:mm` en toda respuesta y los DTO
   de escritura lo exigen con `@IsMilitaryTime()`, que rechaza los segundos.
   Pero node-postgres devuelve una columna `time` como `HH:MM:SS`, así que la
   API estaba entregando un valor que ningún cliente podía devolverle: leer
   una ventana y hacerle `PATCH` con su propio `startTime` daba
   `400 INVALID_PAYLOAD`. Peor, un `PATCH` parcial mezclaba los dos formatos
   en una misma respuesta (el campo tocado venía del DTO en `HH:mm`, el resto
   de la fila en `HH:MM:SS`). El arreglo va en `toResponse` de los dos
   servicios, vía `apps/api/src/common/military-time.util.ts`, no en el
   frontend: es la API la que está fuera de su contrato, y el portal es solo
   su primer consumidor — el worker y el tablero heredarían el mismo defecto.
   Los segundos siempre son `00`; el dominio no tiene resolución sub-minuto.
2. **Una sola pantalla, dos secciones apiladas, dos hooks independientes.**
   Las dos entidades son la regla y su excepción (ADR-015): un día especial
   solo se entiende junto a la ventana que sobreescribe, y separarlas en dos
   rutas obligaría a saltar entre ellas para responder "¿a qué hora sale
   primaria el 20 de julio?". Se apilan en vez de ir en pestañas para que las
   dos estén a la vista sin un clic. Cada sección tiene su propio hook, su
   propio estado de carga, su propio `EmptyState` y su propio `ErrorState`:
   que fallen los días especiales no puede dejar en blanco los horarios
   recurrentes. El listado completo se trae de una vez y el filtro
   activos/pausados se resuelve en cliente, mismo criterio y mismas razones
   que ADR-049 punto 1.
3. **Los días especiales se traen sin `from`/`to`.** El contrato ofrece el
   rango, pero una institución configura un puñado de fechas por ciclo, y
   esconder las pasadas detrás de un selector volvería incomprensibles las
   colisiones: para entender un 409 o un 422 hay que poder ver la fila con la
   que se chocó. Si alguna institución llega a acumular años de historial,
   este es el primer punto a revisar.
4. **`weekday`, las horas y las fechas se validan en el cliente antes de
   enviar**, en `dismissal-schedule-validation.ts` — funciones puras con su
   test, porque la config raíz de vitest solo levanta `.ts` (ADR-021). La
   validación replica exactamente los DTO de `apps/api` y nada más: no hay
   regla `endTime > startTime` porque `specs/entities/dismissal_window.md` no
   define ninguna, y no se inventa un invariante desde una pantalla.
5. **`409 DUPLICATE_DISMISSAL_EXCEPTION` y `422
   CONFLICTING_DISMISSAL_EXCEPTION` se traducen distinto**, y "todos los
   niveles" es una casilla explícita en el formulario, no el efecto lateral de
   dejar el campo `level` vacío. Son dos choques distintos (ADR-018 punto 10):
   el 409 es misma fecha y mismo nivel, y se resuelve cambiando el nivel; el
   422 es "todos los niveles" coexistiendo con cualquier otra excepción de esa
   fecha, y cambiar el nivel no lo resuelve. Darles el mismo texto daría un
   consejo equivocado en la mitad de los casos. Como marcar la casilla es lo
   que hace que la fecha entera quede ocupada, tiene que ser una elección
   deliberada; un campo vacío no comunica eso.
6. **Borrar un día especial pide confirmación; pausar/activar una ventana no.**
   El borrado es físico y es el único de todo el portal (feature 011): la
   confirmación lo dice con esas palabras, a diferencia de la de "desactivar"
   en puntos de entrega (ADR-049 punto 3), que promete lo contrario. Pausar y
   activar son reversibles con un clic y no destruyen nada, así que van
   directo — la confirmación de ADR-049 punto 3 existía porque desactivar
   sacaba al punto del flujo de recogidas en curso, y pausar una ventana no
   quita nada equivalente.

7. **Las horas se capturan con `<input type="time">` nativo, aunque el
   navegador lo pinte en 12 horas.** `.claude/rules/design-system.md` pide
   reloj de 24 horas, y las filas del listado lo cumplen (`14:00 – 14:30`,
   `tabular-nums`). El control nativo no: Chrome lo renderiza según el idioma
   de la interfaz del navegador, no según el `lang` del documento ni el del
   propio input — se verificó poniéndole `lang="es-ES"` en caliente y no
   cambia —, así que en un navegador en es-MX muestra `12:15 p. m.`. El valor
   que viaja y el que se muestra en la fila siguen siendo `HH:mm` de 24 horas;
   lo único en 12 horas es la carátula del selector. Se acepta en vez de
   construir un control de hora propio, que sería sumar un componente al
   design system desde una pantalla — justo lo que ADR-036 y ADR-049 punto 2
   prohíben. El `hint` de cada campo dice "Reloj de 24 horas." para que no
   haya ambigüedad sobre lo que se guarda. Si esto llegara a molestar, la
   solución es una decisión de design system, no de esta pantalla.

**Consecuencias.** La pantalla puede tener dos formularios abiertos a la vez,
uno por sección, cosa que la de puntos de entrega no permitía. La regla de un
solo coral por vista se resuelve con la precedencia explícita: mientras haya
cualquier formulario abierto, su submit es el coral y los dos botones
"Nuevo…" bajan a `outline`. El punto 1 es un cambio de comportamiento de la
API, no solo del portal: cualquier consumidor que ya dependiera de recibir
`HH:MM:SS` se rompería — hoy no hay ninguno, el portal es el primero.

## Referencias

- `specs/features/010-gestionar-horarios-recurrentes.md`,
  `specs/features/011-gestionar-dias-especiales.md`.
- `specs/api-contracts/dismissal-windows.md`,
  `specs/api-contracts/dismissal-exceptions.md`.
- `specs/entities/dismissal_window.md`, `specs/entities/dismissal_exception.md`.
- ADR-015 (horarios recurrentes y excepciones en tablas separadas; `label`,
  `level`, `status`).
- ADR-018 (punto 10: restricción única `(institution_id, date, level)` y la
  validación de capa de aplicación para `level = NULL`).
- ADR-021 (la config raíz de vitest solo recoge `.ts`; los frontends no tienen
  entorno jsdom todavía).
- ADR-022 (punto 1: escritura exige `role = admin`; punto 5, ampliado por
  ADR-026 punto 3: 422 para la validación cruzada).
- ADR-028 (punto 1: los `code` en inglés se traducen en el frontend).
- ADR-049 (precedente de ADR de pantalla; punto 1: filtrado en cliente;
  punto 3: confirmación antes de una acción destructiva; punto 4:
  `active`/`inactive` no reutiliza la paleta de los 5 estados).
- `.claude/rules/design-system.md` (un solo coral por pantalla, estados
  vacíos factuales, reloj 24h con `tabular-nums`).

## ADR-054 — Pantalla de personal: un solo hook para el `GET`, los tres finales de la invitación, y la protección del último admin como prevención + manejo del 422

**Contexto.** La pantalla de personal (feature 012,
`specs/api-contracts/institution-members.md`) es la sexta del portal y la
primera que muta un listado que otra pantalla ya leía: el selector de
operador de puntos de entrega vive de `GET /institutions/:id/members` desde
la Capa 3d. Es también la primera con un endpoint cuya respuesta tiene tres
finales distintos para el mismo `201`, y la primera con una regla de negocio
(`422 LAST_ADMIN_PROTECTED`) que el cliente puede anticipar pero no
garantizar.

**Decisión.**

1. **El `GET` vive en un solo hook, en `institution-personnel/`, con dos
   consumidores.** `useInstitutionMembers` se movió de `delivery-points/`
   —donde su propio comentario ya anticipaba la mudanza— y ahora devuelve la
   fila completa del contrato, no la proyección que necesitaba el selector.
   Encima de él, `usePersonnel` agrega las tres escrituras. La separación no
   es ceremonia: el selector de operador no debe recibir funciones de
   invitar ni de dar de baja, y el `PATCH`/`DELETE` necesita escribir sobre
   la lista cargada, por eso el hook de lectura expone su `setMembers`. Con
   el hook se mudó también la traducción de los códigos de ese `GET`
   (`institutionMembersErrorMessage`), que la pantalla de puntos de entrega
   ahora importa desde `institution-personnel/`: dos mapas para el mismo
   endpoint terminarían divergiendo.
2. **El aviso posterior a invitar distingue los tres caminos, y el tercero
   se deduce del `id` de la membresía, no de un heurístico.**
   `POST .../members/invite` termina de tres formas —alta inmediata de
   alguien que ya tenía cuenta, primera invitación por correo, y reenvío a
   quien sigue `invited`— y las tres importan a quien invita: solo una envió
   un correo y solo una deja a la persona pudiendo entrar ya. `invitationSent`
   separa la primera de las otras dos, pero el cuerpo de una primera
   invitación y el de un reenvío son idénticos (ADR-022 punto 5: el reenvío
   reutiliza la fila existente). Lo que las separa es que el `member.id` que
   vuelve **ya estaba en el listado en pantalla**. Esa comparación es
   `inviteOutcome()`, función pura con su test, y no una adivinanza sobre el
   texto del correo o el `userStatus`.
3. **La protección del último admin se previene en la UI y además se maneja
   como error real.** Si el listado cargado muestra un solo `admin`, esa fila
   trae el selector de rol y el botón de baja deshabilitados, con el motivo
   en el `title` —mismo patrón que el resto del portal para acciones que el
   rol no permite—. Pero la lista es una foto: entre cargarla y actuar, otro
   administrador pudo haber sido dado de baja desde otra sesión, así que
   `422 LAST_ADMIN_PROTECTED` se traduce igual, con el mismo texto accionable
   ("nombra a otro administrador antes de…"), no con un error genérico.
   Deshabilitar es cortesía; el servidor es la garantía.
4. **Tras invitar, el listado se recarga; tras cambiar rol o dar de baja, no.**
   Es la primera pantalla que rompe el patrón de "la respuesta trae la fila de
   vuelta" de ADR-049, y por una razón concreta: la respuesta de `invite` trae
   solo la membresía (`id`, `userId`, `role`) — no el `fullName` ni el `email`
   de un `users` que ya existía, que es justo lo que la fila tiene que mostrar.
   Construirla a mano sería inventar datos. El `PATCH` y el `DELETE` sí se
   aplican en memoria: el primero solo puede haber cambiado `role`, y el
   segundo quita la fila entera.
5. **Listado en columnas dentro de una sola `Card`, con scroll horizontal,
   en vez de una tarjeta por persona.** El diseño describe "cuentas... con su
   estado y último acceso" (`docs/design-brief.md`), y una columna solo se lee
   como columna si las filas se alinean. En una ventana angosta la lista se
   desplaza de lado en vez de comprimir el selector de rol a un ancho
   inservible. "Último acceso" es un `—` estático, sin campo detrás, tal como
   fijó ADR-035.
6. **El estado del miembro es un `Badge` neutral, no uno de la paleta de
   recogidas.** "Activo"/"Invitado"/"Suspendido" es `users.status`, no un
   estado de recogida; mismo criterio que ADR-049 punto 4 con
   `active`/`inactive` de un punto de entrega.
7. **Resuelto en el mismo slice — no diferido:** cuando el `PATCH` que
   `changeRole` acaba de resolver cambió el rol del propio usuario
   autenticado (`saved.userId === session.sub`, comparado en `usePersonnel`
   contra `useAuth()`), se llama a `InstitutionContext.updateRole(institutionId,
   role)`. Es un setter nuevo sobre `memberships`, no un refetch de
   `GET /institution-members/mine`: aplica el rol en memoria y no pasa por
   `status = 'loading'`, así que ninguna pantalla que dependa de
   `useInstitution().role` parpadea. Es el único caso en que este `PATCH`
   cambia lo que el usuario autenticado puede hacer — cambiar el rol de
   *otro* miembro no toca `InstitutionContext` en absoluto.

**Consecuencias.** El punto 1 deja `delivery-points/` importando de
`institution-personnel/`, primera dependencia entre dos módulos de pantalla del
portal — la dirección es la correcta (el dueño del recurso es quien lo
gestiona), no al revés. `InstitutionContext` gana su primer setter puntual
(`updateRole`) además de `retry`; no se generaliza a un setter genérico de
`memberships` porque este es, por ahora, el único caso en que una pantalla
necesita corregir el contexto sin recargarlo entero.

## Referencias

- `specs/features/012-invitar-personal.md`,
  `specs/features/013-aceptar-invitacion-personal.md` (el otro extremo del
  camino de correo nuevo).
- `specs/api-contracts/institution-members.md`.
- `specs/entities/institution_member.md` (sin columna `status`; único
  `(institution_id, user_id)`), `specs/entities/user.md`.
- ADR-011 (roles organizacionales).
- ADR-022 (punto 1: escritura exige `role = admin`; punto 5: reenvío por el
  mismo endpoint y protección del último admin).
- ADR-025 (punto 9: `DELETE /institution-members/:id`).
- ADR-028 (punto 1: los `code` en inglés se traducen en el frontend).
- ADR-030 (`users.full_name` nullable mientras la invitación no se acepta).
- ADR-035 (columna "Último acceso": placeholder visual, sin campo detrás).
- ADR-039 (`GET /institutions/:id/members`: membresía o super-admin).
- ADR-049 (precedente de ADR de pantalla; punto 3: confirmación antes de una
  acción destructiva; punto 4: los estados propios no reutilizan la paleta de
  recogidas).
- ADR-053 (precedente inmediato: hooks independientes por sección, traducción
  distinta para códigos distintos).
- `.claude/rules/design-system.md`.
## ADR-055 — Plomería de rutas para super-admin: `AuthContext` expone `isSuperAdmin`, `SuperAdminRoute` sin `InstitutionContext`

**Contexto.** `HOME_PATH` (adonde redirige todo login exitoso) apunta a
`PENDING_ENROLLMENTS_PATH`, envuelto en `ProtectedRoute` →
`InstitutionProvider`/`InstitutionGate`. Un super-admin puro (sin ninguna
membresía — el caso real de `superadmin.capa3@example.com`) recibiría hoy
el mensaje "No perteneces a ninguna institución" inmediatamente después de
iniciar sesión, un mensaje falso y que bloquea el acceso a cualquier
pantalla, incluidas las de super-admin. Además, `AuthContext` no expone el
claim `isSuperAdmin`, aunque ya viaja en el JWT (`POST /auth/login`,
`specs/api-contracts/auth.md`).

**Decisión.**
1. **`AuthContext` expone `isSuperAdmin: boolean`**, decodificado del mismo
   JWT que ya provee `sub`/`email`.
2. **`SuperAdminRoute` nuevo**, paralelo a `ProtectedRoute`, sin envolver en
   `InstitutionProvider` — un super-admin no necesita ni tiene por qué
   tener contexto de institución para operar estas pantallas. Redirige a
   `/login` si no hay sesión; redirige a `HOME_PATH` si hay sesión pero
   `isSuperAdmin` es `false` (no es una pantalla que exista para pedir
   perdón, simplemente no es alcanzable por la ruta normal para quien no
   tiene el flag).
3. **Rutas nuevas**: `ADMIN_INSTITUTIONS_PATH = '/admin/institutions'`,
   `ADMIN_METRICS_PATH = '/admin/metrics'` — namespace `/admin/` espejo del
   ya usado en el backend (`GET /admin/metrics`, `GET
   /admin/institutions`, ADR-038/ADR-040).
4. **Redirección post-login condicional**: si `isSuperAdmin === true`, el
   login redirige a `ADMIN_INSTITUTIONS_PATH` en vez de `HOME_PATH` — es el
   equivalente de "pantalla hero" para este rol, misma lógica que
   `PENDING_ENROLLMENTS_PATH` lo es para un admin de institución (la cola
   de aprobación es la acción operativa más frecuente en ambos casos:
   solicitudes de alumnos para uno, instituciones para el otro).
5. **Caso híbrido (super-admin que también es `institution_member` de
   alguna institución) no se resuelve aquí** — la regla del punto 4 prioriza
   siempre el destino de super-admin. No hay ningún usuario de prueba en
   ese caso hoy; se refina cuando aparezca la necesidad real, no antes.
6. **Las seis pantallas existentes no cambian** — siguen bajo
   `ProtectedRoute`/`InstitutionContext` sin modificación. Un super-admin
   que navegue manualmente a una de ellas sigue viendo el estado vacío real
   ("no perteneces a ninguna institución"), que es factualmente correcto
   para ese caso.

## Referencias

- ADR-038 (`SuperAdminGuard`, namespace `/admin/` en el backend).
- ADR-042 (`InstitutionContext`, `ProtectedRoute` original).
- `specs/api-contracts/auth.md` (claim `isSuperAdmin` en el access token).


## ADR-056 — Plomería de vistas de tutor: `TutorContext`, layout combinado con switcher, "vacío" no bloquea

**Contexto.** Las cinco pantallas de tutor (mis hijos, alta de alumno,
asociar institución, tutores autorizados, perfil/vehículos —
`docs/design-brief.md`) necesitan su propia resolución de contexto, análoga
a `InstitutionContext` (ADR-042) pero con dos diferencias reales:

1. **No hay flag en el JWT.** A diferencia de `isSuperAdmin`, "tutor" se
   deriva de datos (`GET /students`, vacío o no — ver
   `specs/entities/user.md`, `specs/api-contracts/students.md`), no de un
   claim. Hay que consultarlo, no leerlo del token.
2. **El caso híbrido es plausible y común** (un padre que también es
   personal de una institución) — a diferencia del super-admin, donde se
   decidió ignorar el híbrido (ADR-055 punto 5), aquí el humano confirmó
   explícitamente que quiere un **switcher persistente**, no una prioridad
   fija.

**Decisión.**
1. **`TutorContext` nuevo** (`apps/portal/src/tutor/`), misma forma que
   `InstitutionContext`: `status` (`loading | ready | empty | error`),
   `students: StudentSummary[]`, `retry`. Resuelve `GET /students` una vez
   al montar.
2. **Asimetría deliberada con `InstitutionGate`: `status === 'empty'` NO
   bloquea.** Un tutor con cero hijos es el estado inicial normal de
   cualquier cuenta de tutor recién creada — debe poder llegar a "Alta de
   alumno" sin fricción. No existe un `TutorGate` que bloquee como
   `InstitutionGate`; cada pantalla maneja su propio estado vacío
   internamente (ej. "Mis hijos" muestra `EmptyState` invitando a agregar
   el primero). Solo `status === 'error'` (fallo real de red/servidor) se
   maneja a nivel de layout, igual que hoy.
3. **`AuthenticatedLayout` nuevo**, reemplaza el cuerpo actual de
   `ProtectedRoute`: monta `InstitutionProvider` **y** `TutorProvider`
   **siempre**, en paralelo, sin importar cuál vista esté activa —
   ninguno de los dos depende del otro para resolverse. `SuperAdminRoute`
   (ADR-055) no cambia, sigue siendo su propio árbol sin ninguno de estos
   dos providers.
4. **`activeMode: 'institution' | 'tutor'`**, estado nuevo (contexto
   ligero o parte de `AuthenticatedLayout`, implementación libre). Un
   switcher persistente en la navegación (visible **solo** cuando ambos
   `InstitutionContext.status === 'ready'` y `TutorContext.status` es
   `'ready'` **o** `'empty'` — es decir, cuando de verdad hay dos vistas
   entre las que cambiar) permite alternar sin recargar la página. Las
   rutas de cada vista siguen siendo alcanzables directo por URL sin pasar
   por el switcher — `activeMode` decide qué nav/pantalla de aterrizaje se
   muestra por defecto, no es un guard de autorización adicional (la
   autorización real la sigue dando cada contexto por separado).
5. **Prioridad de aterrizaje tras login** (orden, el primero que aplique
   gana): super-admin (ADR-055, sin cambios) → institución (si
   `InstitutionContext.status === 'ready'`, `HOME_PATH` actual) → tutor
   (`STUDENTS_PATH`, nuevo, aterrizaje por defecto para cualquier caso
   restante, incluido alguien sin institución y sin hijos todavía — el
   estado vacío de "Mis hijos" es la invitación natural a agregar el
   primero).
6. **No confundir con el switcher de multi-institución, todavía diferido**
   (ADR-042 punto 5: `current = memberships[0]`, sin cambios). Son dos ejes
   distintos — instituciones vs. institución/tutor — y este ADR no resuelve
   el primero.
7. **Alcance de esta tarea: solo plomería.** `STUDENTS_PATH` se monta con
   un placeholder simple (mismo patrón que ADR-055 con `/admin/*`) — las
   cinco pantallas reales son tareas siguientes, una por una, mismo ritmo
   que el resto de Fase 7.

## Referencias

- ADR-042 (`InstitutionContext`, `ProtectedRoute` original, switcher de
  multi-institución diferido en su punto 5).
- ADR-055 (precedente inmediato: plomería de rutas para un rol nuevo,
  `SuperAdminRoute`).
- `specs/api-contracts/students.md` (`GET /students`, fuente de verdad de
  "es tutor").
- `specs/entities/user.md` ("tutor" derivado de datos, no es un flag).
- `docs/design-brief.md` (las cinco pantallas de "Rol: tutor (padre)").

## ADR-057 — `GET /enrollments/mine` se enriquece con `institutionName`, `institutionType`, `institutionCategory`

**Contexto.** La pantalla "Mis hijos" (`docs/design-brief.md`) necesita
mostrar, por cada alumno, las instituciones a las que está asociado — el
brief pide explícitamente que las tarjetas muestren tipo y, en
actividades, categoría. `GET /enrollments/mine` (perspectiva de tutor)
solo devuelve `institutionId`, nunca el nombre. A diferencia de otras
pantallas del portal, aquí **no existe ningún camino alternativo** para
resolverlo: `GET /institutions/:id` exige `InstitutionMembershipGuard`
(el tutor no es personal de esa institución, y no tiene por qué serlo), y
`GET /institutions?search=...` (ADR-037) es búsqueda por nombre, no
resolución por id. Sin este cambio, la pantalla no puede mostrar lo que la
spec pide sin inventar un endpoint nuevo solo para esto.

**Decisión.**
1. **`GET /enrollments/mine` se enriquece** con `institutionName`,
   `institutionType`, `institutionCategory` (los mismos tres campos que ya
   expone `GET /institutions?search=...` para su propósito de tarjeta,
   ADR-037) — vía `JOIN` contra `institutions`, sin tabla nueva ni cambio
   de esquema.
2. **`GET /enrollments?institutionId=...` (perspectiva de institución) no
   cambia** — ya conoce su propia institución por contexto, agregar estos
   campos ahí sería redundante.
3. **Sin restricción adicional de `status` de la institución** — a
   diferencia de la búsqueda por nombre (ADR-037, que solo devuelve
   `approved`), aquí el tutor ya tiene una relación real (solicitó o es
   guardián activo de un `enrollments` existente) con esa institución sin
   importar su estado actual; ocultarle el nombre porque la institución
   está `pending`/`suspended` no protege nada y le rompe la pantalla.

## Referencias

- `docs/design-brief.md` (pantalla "Mis hijos": tipo y categoría en cada
  tarjeta).
- `specs/api-contracts/enrollments.md` (`GET /enrollments/mine`, forma
  enriquecida).
- ADR-037 (mismos tres campos, precedente de propósito distinto — no se
  reutiliza el endpoint, se reutiliza la forma de los campos).

## ADR-058 — Foto de alumno omitida en Alta de alumno: sin infraestructura de subida, y consideración de privacidad de menores diferida a propósito

**Contexto.** `docs/design-brief.md` pide "formulario con foto" para el
alta de alumno (feature 004). `POST /students` acepta `photoUrl` como
string opcional, pero es solo una URL de texto — no hay ningún mecanismo
de subida de archivos en el proyecto (sin proveedor de almacenamiento tipo
S3/Cloudinary decidido en ningún ADR ni spec).

**Decisión.**
1. **La pantalla de alta de alumno omite el campo de foto por completo en
   esta fase** — no se construye ni un input de URL simple ni una subida
   real. `photoUrl` queda `null` para todo alumno creado desde esta
   pantalla.
2. **La razón no es solo falta de infraestructura — es una decisión
   deliberada de privacidad.** Almacenar y servir fotografías de menores
   introduce consideraciones de seguridad/privacidad de datos (quién puede
   verlas, dónde se alojan, cuánto tiempo se conservan, qué pasa si se
   filtran) que el proyecto no ha abordado y que no deben resolverse de
   pasada como parte de construir un formulario. Cuando se aborde, merece
   su propio ADR con esa consideración explícita — no solo "elegir un
   proveedor de almacenamiento".
3. **`photoUrl` sigue existiendo en el modelo y en el contrato de API**
   (ya era opcional, `specs/entities/student.md`) — este ADR no cambia el
   esquema, solo el alcance de esta pantalla.

## Referencias

- `docs/design-brief.md` (formulario de alta de alumno, "con foto").
- `specs/features/004-alta-alumno.md`, `specs/api-contracts/students.md`
  (`photoUrl` ya opcional, sin cambios).
- `specs/entities/student.md`.

## ADR-059 — `GET/PATCH /users/me` + `POST /users/me/change-password`: datos personales, preferencias de notificación y contraseña

**Contexto.** El resto de "Perfil" de tutor (`docs/design-brief.md`: datos
personales, preferencias de notificación, cambio de contraseña — la huella
dactilar ya está confirmada fuera de alcance del backend,
`specs/entities/user.md`) no tenía contrato de API. Se resuelve aquí antes
de construir la pantalla.

**Decisión.**
1. **`GET /users/me`** — perspectiva propia, mismo patrón ya usado por
   `GET /enrollments/mine`/`GET /institution-members/mine`: solo
   `JwtAuthGuard`, sin restricción adicional. Devuelve `fullName`, `phone`,
   `email` (de solo lectura — ver punto 4), y los cuatro booleanos de
   notificación.
2. **`PATCH /users/me`** — edita `fullName`, `phone`, y los cuatro
   booleanos de notificación (`notifyEnrollmentApproved`,
   `notifyDismissalReminder`, `notifyDeliveryConfirmed`,
   `notifyProductNews`) en una sola llamada, edición parcial. Datos
   personales y preferencias comparten endpoint porque ambos son
   actualizaciones de campo simples sobre la misma entidad, sin reglas de
   negocio cruzadas que ameriten separarlos.
3. **`POST /users/me/change-password`, endpoint separado** — no se mezcla
   con el `PATCH` de arriba porque es una acción de seguridad con semántica
   distinta: exige `currentPassword` (verificado con `verifyPassword()`,
   ya existente en `password.util.ts`) antes de aceptar `newPassword`.
   Reutiliza la única regla de validación de contraseña que el proyecto ya
   tiene (`@MinLength(8)`, sin regla de complejidad adicional — mismo
   criterio que `RegisterGuardianDto`/`RegisterInstitutionDto`, no se
   inventa una política nueva solo para este endpoint).
4. **`email` no es editable por ningún endpoint de este ADR.** Cambiar de
   correo implicaría su propio flujo de re-verificación (mismo mecanismo
   que `specs/features/007-verificacion-correo.md`), fuera de alcance —
   se deja como campo de solo lectura en `GET /users/me`.
5. **Sin revocación de sesiones existentes al cambiar contraseña** —
   limitación aceptada, no resuelta aquí: el proyecto usa JWT sin lista de
   revocación, así que un `accessToken`/`refreshToken` ya emitido sigue
   siendo válido hasta su expiración natural, incluso después de cambiar la
   contraseña. Si en el futuro se necesita cerrar sesión en otros
   dispositivos al cambiar contraseña, es una decisión aparte (requeriría
   una lista de revocación o tokens con estado, cambio de arquitectura no
   trivial).
6. **Autenticación biométrica confirmada fuera de alcance del backend**
   (ya lo decía `specs/entities/user.md`) — este ADR no la introduce ni la
   contradice, la pantalla que se construya sobre este contrato
   simplemente no incluye esa sección.

## Referencias

- `specs/entities/user.md` (campos editables; biometría fuera de alcance
  del backend, ya confirmado).
- `apps/api/src/common/password.util.ts` (`hashPassword`/`verifyPassword`,
  reutilizados).
- `apps/api/src/auth/dto/register-guardian.dto.ts` (regla de contraseña
  reutilizada, `@MinLength(8)`).
- `specs/features/007-verificacion-correo.md` (mecanismo que tendría que
  reutilizarse si en el futuro se habilita cambio de correo).
- `docs/design-brief.md` (sección "Perfil" del tutor).

## ADR-060 — Reportes de institución: definiciones exactas de las cuatro métricas, resolución de "puntualidad"

**Contexto.** "Reportes" (`docs/design-brief.md`, rol administrador de
institución) es la última pantalla del checklist original de Fase 7 sin
spec. A diferencia de las métricas globales de super-admin (ADR-038,
alcance de plataforma), este reporte es **por institución** — mismo
patrón de autorización que el resto de pantallas de configuración
(`role = admin`, ADR-022 punto 1), no un endpoint nuevo de super-admin.

**Decisión.**
1. **Periodo del reporte: selector de rangos predefinidos**, no fechas
   libres — `today` (hoy), `last7Days`, `last30Days` (default, confirmado
   con el humano), `thisMonth`, `lastMonth`. El backend valida contra este
   enum cerrado, no acepta fechas arbitrarias en esta fase.
2. **`averagePickupDurationSeconds`** — misma definición que ADR-038 punto
   6 (promedio de `completed_at - started_at` sobre `pickup_requests` con
   `status = delivered`), pero acotado a esta institución y al periodo
   elegido, no al mes calendario fijo de la vista de super-admin.
3. **`activeStudentsCount`** — alumnos con `enrollment.status = approved`
   en esta institución **hoy** (padrón actual/censo, confirmado con el
   humano). **No depende del periodo del reporte** — es una fotografía del
   presente, a diferencia de las otras tres métricas, que sí son sobre el
   rango elegido. Documentarlo así explícitamente evita que se lea como
   inconsistencia.
4. **`punctualityRate`** — definición confirmada con el humano: un
   `pickup_request` con `status = delivered` cuenta como puntual si
   `completed_at` cae dentro de `institutions.arrival_tolerance_minutes`
   después del fin de la ventana de salida que le correspondía. Algoritmo
   de resolución de "la ventana que le correspondía":
   - Tomar la fecha calendario de `completed_at` y el `grade_or_group` del
     `enrollment` asociado.
   - Buscar primero una `dismissal_exceptions` para esa institución, esa
     fecha exacta, y ese `level` (o `level IS NULL`, "todos los niveles" —
     mismo criterio de colisión que ya usa ADR-018 punto 10). Si existe,
     su `time` es el fin de la ventana esperada.
   - Si no hay excepción, buscar la `dismissal_windows` recurrente que
     coincida en `weekday` (derivado de la fecha) y `level` (o `level IS
     NULL`), con `status = active`. Su `end_time` es el fin de la ventana
     esperada.
   - **Si no se encuentra ninguna ventana ni excepción aplicable, ese
     `pickup_request` se excluye del cálculo** — no cuenta como puntual ni
     como impuntual, porque no hay una expectativa contra la cual
     medirlo. El denominador de `punctualityRate` es "entregas con ventana
     resoluble", no "todas las entregas".
   - `punctualityRate` se expresa como porcentaje (`onTimeCount /
     resolvableCount * 100`, o `null` si `resolvableCount = 0` — sin
     datos suficientes, no `0%`).
5. **`deliveriesByDay`** — conteo de `pickup_requests` con `status =
   delivered` agrupado por fecha calendario de `completed_at`, dentro del
   periodo elegido. Forma de lista/serie simple (`[{date, count}]`), la
   pantalla decide si lo presenta como tabla o gráfico.
6. **Autorización: `InstitutionMembershipGuard` + `role = admin`**, mismo
   patrón que perfil/puntos de entrega/horarios/personal — no
   `SuperAdminGuard`, este reporte es de una institución, no de la
   plataforma.

## Referencias

- ADR-038 (definición base de tiempo promedio de recogida, adaptada aquí
  a alcance de institución).
- ADR-018 (punto 10: criterio de colisión `level = NULL` vs. específico,
  reutilizado para resolver la ventana aplicable).
- ADR-022 (punto 1: `role = admin` para pantallas de configuración de
  institución).
- `specs/entities/institution.md` (`arrival_tolerance_minutes`),
  `specs/entities/dismissal_window.md`, `specs/entities/dismissal_exception.md`.
- `docs/design-brief.md` (pantalla "Reportes").

## ADR-061 — `MapsProvider` real: Mapbox Directions API, mismo mecanismo de selección que `EmailProvider`

**Contexto.** El pendiente residual de Fase 6 (`docs/plan-implementacion.md`,
tabla de decisiones pendientes) — proveedor concreto de `MapsProvider`
(cálculo de ETA con tráfico en vivo, usado por `apps/worker`) — sigue
abierto desde antes de Fase 7, cubierto mientras tanto por
`StubMapsProvider` (estimación por distancia haversine a velocidad
promedio fija, ADR-031 punto 6). El humano ya tiene cuenta de Mapbox
(usada para el widget de mapa del frontend, ADR-048) y confirma el mismo
proveedor para el backend — evita manejar dos facturaciones de nube
distintas para el mismo tipo de servicio.

**Decisión.**
1. **`MapboxMapsProvider` nuevo**, implementa el port `MapsProvider` ya
   existente (`packages/shared/src/ports/maps-provider.ts`) sin cambiar su
   interfaz — llama a la **Mapbox Directions API** (perfil `driving`),
   mapea `routes[0].duration` → `etaSeconds` y `routes[0].distance` →
   `distanceMeters`.
2. **Token de acceso propio del `worker`, variable de entorno separada**
   (`MAPBOX_ACCESS_TOKEN`) — **no se comparte ni se importa** del
   `VITE_MAPBOX_TOKEN` de `apps/portal`. **Corrección tras verificación en
   vivo** (el texto original de este punto decía "en el `.env` de
   `apps/worker`", que resultó incorrecto): `apps/api` y `apps/worker`
   (los dos servicios Node/NestJS) cargan variables de entorno desde **el
   `.env` de la raíz del monorepo** (`process.loadEnvFile(join(__dirname,
   '../../../.env'))` en ambos `main.ts`), no de un `.env` propio por app
   — a diferencia de `apps/portal`/`parent`/`board` (frontends Vite), que
   sí leen cada uno su propio `.env` local. `MAPBOX_ACCESS_TOKEN` y
   `MAPS_PROVIDER` van en el `.env` raíz. Un `apps/worker/.env` separado,
   si llegó a crearse por asumir el patrón de los frontends, no lo lee
   ningún proceso — bórralo o dócumentalo como no usado para no repetir la
   confusión que causó el primer intento de verificación en vivo.
3. **Selección por variable de entorno, mismo mecanismo que
   `EmailModule`** (`apps/api/src/email/email.module.ts` —
   `process.env.EMAIL_PROVIDER === 'resend' ? ... : ConsoleEmailProvider`):
   `MapsModule` usa un `useFactory` análogo,
   `process.env.MAPS_PROVIDER === 'mapbox' ? new MapboxMapsProvider() :
   new StubMapsProvider()`. Default sigue siendo el stub — nadie paga
   llamadas a Mapbox en desarrollo local a menos que lo active
   explícitamente.
4. **Degradación ante fallo de la API real, no propagación de error.** Si
   la llamada a Mapbox falla (timeout, error de red, cuota excedida),
   `MapboxMapsProvider` cae de vuelta al mismo cálculo haversine que ya
   usa `StubMapsProvider` (reutiliza `haversine-distance.util.ts`, no lo
   duplica) y registra el fallo (log), en vez de lanzar una excepción que
   interrumpiría el procesamiento de la ubicación entrante. El cálculo de
   ETA no es tan crítico como para bloquear el flujo de ingesta de
   ubicación por una falla transitoria del proveedor externo.
5. **`StubMapsProvider` no se elimina** — sigue siendo el default de
   desarrollo/tests, y el mecanismo de degradación del punto 4 lo
   convierte además en la ruta de recuperación ante fallos del proveedor
   real.
6. **Verificado en vivo, no solo en código** (ver corrección del punto 2):
   ETA real de 970s (~4401 m, ruta real por Paseo de la Reforma) contra
   441s (~3671 m, línea recta) del cálculo haversine para el mismo par de
   puntos — confirma que `MapboxMapsProvider` llama la Directions API de
   verdad, no solo que compila y pasa tests mockeados. Con esto, el
   pendiente residual de Fase 6 (`docs/plan-implementacion.md`) queda
   cerrado de forma verificada, no solo documentada.

## Referencias

- ADR-031 (punto 6: `StubMapsProvider`, decisión de proveedor real
  diferida hasta ahora).
- ADR-017 (`MapsProvider` como port — este ADR no cambia esa interfaz).
- ADR-048 (Mapbox GL JS en el frontend; mismo proveedor, consumidor
  distinto).
- `apps/api/src/email/email.module.ts` (patrón de selección por variable
  de entorno, reutilizado aquí).
- `docs/plan-implementacion.md` (pendiente residual de Fase 6, ahora
  resuelto).

## ADR-062 — Ingesta de ubicación del padre: `POST` mediado por `apps/api`, nunca publicación directa del navegador al broker

**Contexto.** `docs/arquitectura.md` (anterior a ADR-050) documenta que
*"la app `parent` publica su ubicación"* directo al topic MQTT
`.../pickup/{pickupRequestId}/location`. Esa oración nunca se implementó
—`apps/parent` no existe todavía (Fase 8, arrancando ahora)— pero de
construirse tal cual está escrita, contradiría directamente ADR-050: el
navegador nunca debe conectarse directo al broker Mosquitto de
producción, ni para suscribirse ni, por la misma razón, para publicar. El
argumento de ADR-050 aplica igual aquí, y arguiblemente con más peso: un
cliente con credenciales directas al broker no solo podría leer topics
ajenos — podría publicar ubicaciones falsas en el `pickup_request` de
otra persona, corrompiendo un dato que el `worker` procesa sin volver a
verificar contra quién lo envió.

**Decisión.**
1. **`apps/parent` nunca publica directo a MQTT.** Envía su ubicación vía
   un endpoint REST nuevo — `POST /pickup-requests/:id/location` — que ya
   pasa por `JwtAuthGuard` y la misma verificación de propiedad que ya usa
   `PickupsService.assertOwner` (el `guardian_user_id` del `pickup_request`
   debe ser el usuario autenticado — mismo criterio que
   `PATCH .../arrived`/`.../cancel`, no un mecanismo nuevo).
2. **`apps/api` republica al broker** con su propia conexión MQTT ya
   existente (la misma que usa `PickupsService` para publicar
   transiciones de estado, `MQTT_CLIENT` inyectable) — al topic exacto que
   el `worker` ya espera
   (`school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location`),
   sin cambiar nada del lado del `worker`: sigue suscrito al mismo
   wildcard de siempre (ADR-031 punto 4), ajeno a que el mensaje ahora
   llega por un camino distinto.
3. **QoS 0 se mantiene** para este topic (ya justificado en
   `docs/arquitectura.md`: stream efímero, la siguiente lectura reemplaza
   a la anterior, perder una no tiene consecuencia) — el cambio de
   transporte (REST→MQTT en vez de MQTT directo) no cambia esa decisión.
4. **`docs/arquitectura.md` y `specs/api-contracts/pickup-realtime-mqtt.md`
   se corrigen** para reflejar el flujo real:
   `parent → POST /pickup-requests/:id/location → api → MQTT → worker`,
   no `parent → MQTT → worker` directo. Es una corrección de premisa
   desactualizada, mismo criterio que otras correcciones de esta sesión
   (ej. el comentario obsoleto de la migración 401, Fase 6) — no se marca
   como "ADR que supersede", se corrige el texto para que documente la
   realidad.
5. **Frecuencia de envío**: sigue siendo responsabilidad del cliente
   (`apps/parent`, `watchPosition` del navegador) decidir cuándo llama a
   este endpoint — el throttling real (20s o 150m, ADR-024 punto 2) sigue
   viviendo en el `worker` al recalcular ETA, no se duplica en el `api`.
   El `api` simplemente reenvía cada `POST` que reciba, sin agregar su
   propio throttling — evita dos lugares con la misma lógica de
   limitación pudiendo divergir.

## Referencias

- ADR-050 (principio "el navegador nunca se conecta directo al broker",
  extendido aquí de suscripción a publicación).
- ADR-024 (punto 2: throttling de recálculo de ETA, sigue en el
  `worker`, sin cambios).
- ADR-031 (punto 4: patrón de suscripción del `worker` por wildcard, sin
  cambios — el mensaje le sigue llegando igual).
- `docs/arquitectura.md` (texto a corregir: "la app parent publica su
  ubicación" → flujo mediado por `api`).
- `specs/api-contracts/pickup-realtime-mqtt.md` (topic de ubicación
  entrante, mismo topic, origen del mensaje corregido).
- `apps/api/src/pickups/pickups.service.ts` (`assertOwner`, reutilizado
  para este endpoint nuevo).

## ADR-063 — Plomería de `apps/parent`: PWA instalable, `LocationProvider` intercambiable, Wake Lock con degradación, sesión simplificada

**Contexto.** `apps/parent` es hoy un esqueleto (`App.tsx`/`main.tsx`, un
`manifest.webmanifest` placeholder con `theme_color` genérico e `icons: []`
vacío). Antes de construir las pantallas reales (feature 018 en adelante)
hace falta esta capa base, análoga a ADR-042 (`apps/portal`) pero con
requisitos que ningún otro frontend tuvo: instalación como PWA,
geolocalización del navegador, mantener la pantalla encendida, y pausa
por pérdida de foco.

**Decisión.**
1. **`vite-plugin-pwa`** (generación de service worker vía Workbox,
   estándar de facto para PWA con Vite) — **estrategia de caché mínima**:
   solo el app shell estático (JS/CSS/HTML de la build), **nunca**
   respuestas de API. Este es un tracker en tiempo real — servir un ETA
   cacheado y obsoleto es peor que no tener conexión. Todo `fetch` a la
   API va siempre a red, sin `runtime caching` para esos requests.
2. **Manifest corregido**: `theme_color`/`background_color` alineados a
   los tokens reales (`--brand: #fb6a45`, no el azul genérico actual),
   íconos generados desde `packages/ui/src/assets/pin-mark.svg` (ya
   existente, el isotipo de la marca) en los tamaños estándar que exige
   instalación en Android/iOS (192×192 y 512×512 como mínimo).
3. **`LocationProvider` como interfaz propia**, en
   `apps/parent/src/location/` (no en `packages/shared` — hoy solo lo
   consume esta app; se promueve si un segundo consumidor real aparece,
   mismo criterio de "no abstraer antes de tiempo" ya usado en todo el
   proyecto). Implementación inicial: `PwaLocationProvider`, sobre
   `navigator.geolocation.watchPosition`. Diseñada para que una futura
   migración a Capacitor (ya documentada como camino a futuro) solo
   implique escribir una segunda implementación de la misma interfaz, sin
   tocar las pantallas que la consumen.
4. **Wake Lock con degradación explícita, sin polyfill.** Soporte nativo ya
   amplio (Safari 16.4+, Chrome, Firefox 126+, >94% global a mayo 2026) —
   no se agrega `NoSleep.js` ni ningún truco de video en loop. Se detecta
   la característica (`'wakeLock' in navigator`) y, si no está disponible
   o la solicitud es rechazada (batería baja, modo ahorro), se muestra un
   mensaje claro invitando a no bloquear la pantalla manualmente — nunca
   falla en silencio. Re-solicita el lock al recuperar visibilidad
   (`visibilitychange`), ya que el sistema operativo libera el lock al
   perder foco.
5. **Estado "pausado" vía Page Visibility API** (`document.visibilityState`)
   — cuando la app pierde el foco, la pantalla de seguimiento debe
   mostrarlo explícitamente ("seguimiento en pausa, vuelve a abrir"), no
   fingir datos frescos. Estándar, sin decisión adicional que tomar.
6. **Sesión: `AuthContext` propio, no compartido con `apps/portal`.**
   Mismo cliente de API (`packages/shared/src/api-client/`, ya
   multi-frontend por diseño, ADR-042 punto 2), pero el `AuthContext` en sí
   se duplica en vez de extraerse a un paquete compartido — este frontend
   es de un solo rol (tutor), sin la complejidad de
   `InstitutionContext`/`SuperAdminRoute`/switcher que sí necesita
   `portal`. Duplicar ~50 líneas de contexto es más barato hoy que
   diseñar una abstracción cross-app prematura. Se reconsidera si
   `apps/board` termina necesitando el mismo patrón exacto y la
   duplicación empieza a doler de verdad.
7. **Routing simple**: sin split institución/tutor/super-admin — un único
   árbol protegido (sesión sí/no) más `/login` pública, mismo patrón base
   de `ProtectedRoute` pero sin nada de lo que le sobra a un frontend de un
   solo rol.
8. **`packages/ui` como dependencia**, mismo patrón exacto que
   `apps/portal` (ADR-042 punto 4) — import de `@casillego/ui/styles.css`
   en `main.tsx`, sin duplicar tokens ni componentes.

## Referencias

- ADR-042 (plomería equivalente de `apps/portal`, referencia de patrón).
- ADR-036 (`packages/ui`, multi-frontend por diseño).
- ADR-062 (`POST /pickup-requests/:id/location`, lo que `LocationProvider`
  termina llamando).
- `docs/design-brief.md` (app del padre: PWA, foreground-only,
  `watchPosition` + Wake Lock + Page Visibility).
- `packages/ui/src/tokens/colors.css` (`--brand`, color real del
  manifest).
- `packages/ui/src/assets/pin-mark.svg` (origen de los íconos de la PWA).

## ADR-064 — Pantalla de seguimiento: puente WebSocket para un solo `pickup_request` (perspectiva tutor), throttling de envío de ubicación en el cliente

**Contexto.** La pantalla de seguimiento (feature 018-022, hero ★ de
`apps/parent`) necesita ETA/estado en vivo mientras el tutor va en camino.
El puente WebSocket ya construido (ADR-050,
`delivery-point-queue.gateway.ts`) es del lado institución (cola de un
punto de entrega, autorización por membresía) — no sirve para esto: el
tutor no es `institution_members` de nada, necesita ver **un solo**
`pickup_request`, el suyo, autorizado por ser su `guardian_user_id`
dueño. El `worker` ya publica al topic de tablero
(`school-pickup/institution/{institutionId}/board`) en cada transición de
estado **y** en cada recálculo de ETA tras una actualización de ubicación
(`location-ingestion.service.ts`, confirmado) — ese payload
(`PickupRequestBoardPayload`) ya trae `status`/`estimatedArrivalAt`/
`etaSeconds`, todo lo que la pantalla necesita en vivo.

**Decisión.**
1. **Gateway WS nuevo en `apps/api`**, mismo patrón exacto que
   `delivery-point-queue.gateway.ts` (ADR-050): navegador nunca toca el
   broker directo, el `api` se suscribe una sola vez (wildcard) y reenvía
   filtrado por conexión autorizada.
   - Endpoint: `wss://{host}/ws/pickup-request-tracking?accessToken={jwt}&pickupRequestId={uuid}`
     (mismo criterio de query param para el token que ADR-050 punto 3 — no
     hay forma de fijar headers en el handshake nativo de `WebSocket`).
   - Suscripción del servidor: wildcard `school-pickup/institution/+/board`
     (reutiliza el topic de tablero ya existente, no crea uno nuevo — el
     mismo mensaje que ya recibe el tablero de institución sirve aquí,
     solo cambia quién puede verlo y con qué filtro).
   - Autorización al conectar: el `pickup_request` indicado debe existir y
     su `guardian_user_id` debe ser el usuario autenticado — mismo criterio
     que `assertOwner` ya usa `PickupsService` para
     `arrived`/`cancel`/`sendLocation`, no una regla nueva. **Sin el lado
     institución del OR** que sí tienen los endpoints REST de lectura —
     este canal es exclusivamente para el tutor dueño.
   - Reenvío: al llegar un mensaje del broker, compara `pickupRequestId`
     contra el que pidió esta conexión — si coincide, reenvía tal cual
     (`PickupRequestBoardPayload`, sin transformar).
2. **Snapshot inicial: REST**, mismo patrón ya establecido en todo el
   proyecto — `GET /pickup-requests/:id` al montar la pantalla (trae
   además `deliveryCode`, que el payload de tablero deliberadamente no
   incluye, ADR-051 — no hace falta en los deltas porque no cambia durante
   la vida del `pickup_request`, se muestra una vez que `status = arrived`
   con el valor ya obtenido del snapshot).
3. **Throttling de envío de ubicación: responsabilidad del cliente**
   (`apps/parent`, ya establecido en ADR-062 punto 5 — el `api` no
   throttlea). Se fija aquí la política concreta: el cliente llama
   `POST /pickup-requests/:id/location` **como máximo una vez cada 15
   segundos**, sin importar la frecuencia real de `watchPosition` del
   navegador (que puede disparar mucho más seguido). Ligeramente más
   frecuente que el umbral de recálculo del `worker` (20s, ADR-024 punto
   2) para que casi siempre haya una lectura fresca disponible cuando el
   `worker` decide recalcular, sin desperdiciar batería enviando cada
   evento crudo de GPS.
4. **El envío de ubicación se detiene** cuando el `pickup_request` deja de
   estar en `en_route`/`arriving` (llega a `arrived`, `delivered`, o
   `cancelled`) — seguir enviando ubicación de un trayecto ya resuelto no
   tiene propósito.
5. **Acciones de la pantalla** (`PATCH .../arrived`, `PATCH .../cancel`)
   reutilizan los endpoints ya existentes y completamente especificados
   (feature 021/022) — sin decisiones nuevas ahí, solo conectar la UI.

## Referencias

- ADR-050 (patrón del puente WebSocket, replicado aquí con autorización
  distinta).
- ADR-051 (`deliveryCode` fuera del payload de tablero, por qué no hace
  falta en los deltas de esta pantalla).
- ADR-062 (throttling de envío es responsabilidad del cliente — este ADR
  fija la política concreta).
- ADR-024 (punto 2: umbral de recálculo de ETA en el `worker`, 20s/150m).
- `apps/worker/src/location-ingestion/location-ingestion.service.ts`
  (confirmado: publica al tablero en cada recálculo, no solo en
  transiciones de estado).
- `specs/api-contracts/delivery-point-queue-ws.md` (formato de referencia
  para el contrato nuevo, `pickup-request-tracking-ws.md`).

## ADR-065 — `GET /pickup-requests/:id` se enriquece con `institutionLocation`, sin restricción de `InstitutionMembershipGuard`

**Contexto.** La pantalla de seguimiento (Capa 4d, hero ★ de `apps/parent`,
`docs/design-brief.md`) necesita un mapa con "la ruta hacia la
institución" — dos marcadores, tutor e institución. `GET
/pickup-requests/:id` (el snapshot inicial que precede al canal WS de
ADR-064) no trae la ubicación de la institución, y `GET /institutions/:id`
exige `InstitutionMembershipGuard` (el tutor no es `institution_members`
de ninguna institución de sus hijos, y no tiene por qué serlo). Sin este
cambio, la pantalla hero del brief no puede mostrar lo que pide sin
inventar un endpoint nuevo solo para esto — mismo vacío que ya resolvió
ADR-057 para "Mis hijos", aquí con un campo geográfico en vez de texto.

**Decisión.**
1. **`GET /pickup-requests/:id` se enriquece con `institutionLocation`**
   (`{ lat, lng }`, misma forma que ya expone `GET /institutions/:id` vía
   `geoPointToLatLng`) — vía el `institution` ya cargado por
   `findPickupRequestOrFail` (sin `JOIN` nuevo, la relación ya se resuelve
   para `institutionId`).
2. **Sin restricción adicional por `status` de la institución ni por
   membresía** — mismo criterio que ADR-057 punto 3: el tutor con un
   `pickup_requests` real ya tiene una relación activa con esa
   institución (su hijo está en un trayecto hacia ella en este momento);
   ocultarle dónde queda no protege nada y le rompe la pantalla hero.
3. **No se agrega a `PickupRequestBoardPayload`** (el canal WS de
   ADR-064): la ubicación de la institución no cambia durante la vida del
   `pickup_requests`, así que no hace falta repetirla en cada delta —
   mismo razonamiento que ya excluye `deliveryCode` de ese payload
   (ADR-051) y que hace que el snapshot REST, no el canal de deltas, sea
   la fuente de los campos estables. Al reconectar el WS (ADR-064,
   "Reconexión"), el cliente ya vuelve a pedir el snapshot REST completo,
   así que `institutionLocation` nunca queda desactualizado.
4. **No se agrega a `PickupRequestResponse`** (`POST /pickup-requests`,
   la respuesta de creación) ni a `PickupRequestSummary`/
   `PickupRequestQueueSummary` — ningún otro consumidor de esos contratos
   necesita este dato; se acota al único endpoint que la pantalla de
   seguimiento realmente llama.

**Consecuencias.** `institutions.location` pasa a ser legible por
cualquier tutor con un `pickup_requests` (histórico o activo) hacia esa
institución, no solo por su personal — una ampliación deliberada y
acotada de la superficie de lectura de `institutions`, documentada aquí
para que quede explícita y no se confunda con un descuido del guard.

## Referencias

- ADR-064 (el snapshot REST que este ADR enriquece precede al canal WS de
  tracking).
- ADR-057 (mismo patrón: enriquecer un endpoint de lectura del tutor con
  un dato de la institución que ningún otro camino expone).
- ADR-051 (mismo razonamiento — campos estables fuera del payload de
  deltas — aplicado aquí a `institutionLocation` en vez de `deliveryCode`).
- ADR-048 (`GeoPoint`/`geoPointToLatLng`, mismo mapper y misma forma
  `{ lat, lng }` ya usados por `GET /institutions/:id`).
- `docs/design-brief.md` (pantalla de seguimiento: "mapa con la ruta hacia
  la institución").
- `specs/api-contracts/pickup-requests.md` (`GET /pickup-requests/:id`,
  forma enriquecida).

## ADR-066 — Notificaciones push, alcance mínimo: solo confirmación de entrega a los demás tutores autorizados

**Contexto.** De los cuatro tipos de notificación ya modelados como
preferencia (`users.notify_*`, ADR-059) pero nunca conectados a ningún
mecanismo de envío real, se decide implementar **solo uno**:
`notify_delivery_confirmed`, y con un alcance más preciso que su nombre
sugiere — no es "avisarle al tutor que recogió que ya recogió" (esa
persona vio la transición en tiempo real en su propia pantalla de
seguimiento, ADR-064), es **avisarle a los demás tutores autorizados del
mismo alumno que no participaron en esta recogida** que ya se resolvió.
Es el caso de uso real: coordinación entre varios tutores (madre, padre,
abuela, chofer) cuando uno de ellos recoge y los demás no tienen forma de
saberlo sin abrir la app.

Los otros tres tipos (`notify_enrollment_approved`,
`notify_dismissal_reminder`, `notify_product_news`) **no se implementan**
en este slice — el primero y el segundo requerirían mecanismos que no
existen (el segundo, en particular, una tarea programada tipo `cron`
contra `dismissal_windows`/`dismissal_exceptions`, que el proyecto no
tiene todavía — el único job periódico existente es la purga de
`location_updates` en el `worker`), y el tercero no tiene ningún evento de
dominio que lo dispare. Quedan en backlog, sin implementar, hasta que
aparezca una necesidad concreta de cada uno por separado.

**Decisión.**
1. **Web Push API estándar** (VAPID) — protocolo abierto, sin dependencia
   de un servicio propietario de terceros. Backend: librería `web-push`
   (Node, la implementación de referencia del protocolo). Par de llaves
   VAPID generado una vez, variables de entorno del `.env` raíz (mismo
   mecanismo de carga que `MAPBOX_ACCESS_TOKEN`, ADR-061 — `apps/api`
   carga desde la raíz, no desde un `.env` propio de `apps/parent`).
2. **Entidad nueva `push_subscriptions`**: `id`, `user_id` (FK a `users`,
   `ON DELETE CASCADE`), `endpoint`, `p256dh_key`, `auth_key`,
   `created_at`. Un `users` puede tener varias — cada dispositivo/navegador
   donde acepte notificaciones genera su propia suscripción.
3. **Destinatarios de la notificación de entrega**: todos los
   `student_guardians` con `status = active` del `student` del
   `pickup_requests` recién entregado, **excluyendo** al
   `guardian_user_id` dueño de ese `pickup_requests` (ADR-066, confirmado
   con el humano — quien recogió ya lo sabe). De esos, solo a quienes
   tengan `notify_delivery_confirmed = true` (se respeta la preferencia ya
   existente, ADR-059) y tengan al menos una `push_subscriptions`
   registrada.
4. **Disparo: en `PickupsService.deliver()`, tras la transición exitosa,
   fuera de la transacción principal, best-effort** — mismo patrón ya
   usado para el correo de aprobación de institución
   (`EnrollmentsService.approve`): un fallo de envío push no revierte la
   entrega ya persistida, se registra (log) y sigue.
5. **Contenido del mensaje: incluye quién recogió** (confirmado con el
   humano — corrige la primera versión de este ADR, que proponía un
   mensaje genérico). Ej. "{nombre del alumno} fue recogido por {nombre
   completo del guardián que recogió}". Se resuelve leyendo
   `pickup_requests.guardian.fullName` (ya disponible vía la relación
   `guardian` que `PickupsService` ya carga — no hace falta una consulta
   nueva). **Fallback defensivo**: si por algún motivo ese `fullName`
   fuera `null` (no debería ocurrir en la práctica — quien ejecuta una
   recogida ya está `active`, y `active` exige `full_name` no nulo, ADR-030
   — pero el código no debe asumir la invariante ciegamente), usa el
   `relationship` del guardián como respaldo ("fue recogido por su
   madre/padre/etc."), nunca un mensaje roto o vacío. Al tocar la
   notificación, abre/enfoca la app en la pantalla de Mis hijos.
6. **`apps/parent` cambia de estrategia de PWA: `generateSW` →
   `injectManifest`** (`vite-plugin-pwa`) — la estrategia actual no
   admite un manejador de evento `push` personalizado. Se agrega un
   archivo de service worker propio (`push`/`notificationclick`), con el
   manifiesto de precaché inyectado igual que antes (ADR-063 punto 1 no
   cambia: sigue sin cachear respuestas de API).
7. **Suscripción del navegador**: se solicita el permiso de notificación
   de forma no intrusiva (no en cada sesión si ya se rechazó una vez;
   revisa `Notification.permission` antes de volver a pedir) — el momento
   exacto de la UI (pantalla de Mis hijos vs. perfil) queda a criterio de
   implementación, pero debe poder descartarse sin bloquear el uso normal
   de la app.
8. **Nuevo endpoint**: `POST /push-subscriptions` (registra una
   suscripción del usuario autenticado) y `DELETE
   /push-subscriptions/:id` (o equivalente para desuscribirse) — ver
   contrato nuevo.

## Referencias

- ADR-059 (`notify_delivery_confirmed`, preferencia ya existente,
  reutilizada aquí sin cambios).
- ADR-064 (por qué quien recogió no necesita la notificación — ya lo supo
  en tiempo real).
- ADR-061 (`.env` raíz para `apps/api`/`apps/worker`, mismo criterio para
  las llaves VAPID).
- ADR-063 (punto 1: sin cachear respuestas de API — sin cambios).
- `apps/api/src/enrollments/enrollments.service.ts` (`approve()`, patrón
  de envío best-effort fuera de transacción, reutilizado).
- `specs/features/028-notificacion-push-entrega.md`,
  `specs/api-contracts/push-subscriptions.md` (nuevos).

## ADR-067 — Rotación de `refreshToken` en `POST /auth/refresh`, sin lista de revocación

**Contexto.** `apps/board` corre en pantallas kiosco sin usuario presente
para volver a iniciar sesión — necesita mantenerse autenticado
indefinidamente mientras esté en uso activo. El `refreshToken` actual
tiene TTL fijo de 30 días **sin rotación** (`POST /auth/refresh` solo
devuelve `accessToken` nuevo, confirmado en `auth.module.ts` y en la nota
técnica de Capa 3a) — un kiosco se desloguearía a los 30 días exactos sin
importar cuánto tráfico genere, rompiendo su propósito de pantalla
desatendida. El mismo límite aplica hoy a `apps/portal`/`apps/parent`,
aunque ahí sea menos crítico (hay un humano presente para volver a
iniciar sesión).

**Decisión.**
1. **`POST /auth/refresh` emite un `refreshToken` nuevo en cada llamada**,
   con TTL fresco de 30 días desde ese momento — no solo `accessToken`.
   Mientras el cliente siga generando tráfico que dispare refreshes con
   regularidad (cualquier uso activo normal), la sesión se extiende
   indefinidamente sin intervención humana.
2. **Sin lista de revocación — sigue siendo completamente stateless**,
   mismo criterio que el resto del sistema (ADR-059 punto 5, ya aceptado
   como limitación). Esto es una honestidad importante: la rotación **no
   es un endurecimiento de seguridad contra un token robado** — un
   atacante con un `refreshToken` válido puede seguir refrescándolo
   indefinidamente igual que hoy, sin que el original quede invalidado del
   lado del servidor. El propósito real de este ADR es **longevidad de
   sesión para uso legítimo continuo** (el caso del kiosco), no detección
   de robo/reuso. Si en el futuro se necesita eso, es una decisión aparte
   (requeriría persistencia de qué `refreshToken` es el vigente por
   sesión, para detectar el reuso de uno ya rotado como señal de
   compromiso — infraestructura con estado que hoy el sistema
   deliberadamente no tiene).
3. **El cliente de API compartido** (`packages/shared/src/api-client/`)
   debe guardar el `refreshToken` nuevo de cada respuesta de refresh, no
   solo el `accessToken` — afecta a los tres frontends por igual
   (`portal`/`parent`/`board`), todos se benefician de la sesión más
   duradera, no solo el kiosco.
4. **`specs/api-contracts/auth.md` se actualiza**: `POST /auth/refresh`
   ahora devuelve `{ accessToken, refreshToken }`, no solo `accessToken`.

## Referencias

- ADR-042 (cliente de API compartido, manejo original de refresh sin
  rotación).
- ADR-059 (punto 5: limitación ya aceptada de stateless sin revocación,
  mismo criterio aplicado aquí).
- `specs/api-contracts/auth.md` (`POST /auth/refresh`, forma actualizada).
- `apps/api/src/auth/auth.module.ts` (`JWT_REFRESH_TTL`, 30 días — sin
  cambios, solo deja de ser un límite absoluto para sesiones activas).

## ADR-068 — Plomería de `apps/board`: sesión reutilizada de `institution_member`, snapshot + WS del feed completo, filtro por punto de entrega en cliente

**Contexto.** `apps/board` es hoy un esqueleto. Necesita: cómo se autentica
un kiosco sin usuario presente, un snapshot inicial del feed completo de
la institución (no existe — `GET /pickup-requests` solo filtra por
`enrollmentId` o `deliveryPointId`, ninguno sirve para "toda la
institución"), y su propio canal WebSocket (los dos existentes son de cola
por punto de entrega y de seguimiento individual, ninguno expone el feed
agregado completo).

**Decisión.**
1. **Sesión: login normal de `institution_member`, sin mecanismo nuevo.**
   Con la rotación de `refreshToken` ya resuelta (ADR-067), una sesión
   iniciada una sola vez al instalar el kiosco se mantiene indefinidamente
   mientras el tablero esté en uso activo — no hace falta un token de
   larga duración dedicado. **Sin restricción de `role`** (ADR-011, mismo
   criterio que la consola de puerta): cualquier `institution_member`
   puede dejar el kiosco autenticado. A diferencia de `apps/portal`, no
   hay switcher ni selección de institución — el kiosco muestra siempre la
   institución del `institution_member` que inició sesión (si esa persona
   pertenece a más de una, aplica la misma simplificación ya aceptada en
   `InstitutionContext`, ADR-042 punto 5: la primera).

   **Recomendación operativa (no técnica): cuenta dedicada por
   institución, no la personal de un admin/coordinador.** No existe
   ningún concepto de "usuario de kiosco" en el modelo — no hace falta
   construir uno: el flujo de "Invitar personal" ya existente
   (`POST /institutions/:id/members/invite`, feature 012) sirve tal cual
   para crear una cuenta genérica (ej. `tablero@nombreescuela.com`) que
   cada institución usa para autenticar su kiosco. Evita que el acceso del
   tablero dependa de que una persona específica siga siendo miembro de la
   institución — su `refreshToken` sigue siendo válido mientras
   `users.status = active`, sin revalidar membresía en cada uso (ver
   `specs/api-contracts/auth.md`, `POST /auth/refresh`). Esta
   recomendación debe quedar documentada en la guía de instalación del
   tablero (`docs/design-brief.md` o un README operativo), no solo aquí.
2. **`GET /pickup-requests?institutionId=...` nuevo**, tercer modo
   mutuamente excluyente junto a `enrollmentId`/`deliveryPointId` ya
   existentes. Autorización: `institution_member` de esa institución, sin
   restricción de `role` (mismo criterio que el resto de este ADR). Solo
   estados activos (`en_route`/`arriving`/`arrived`), mismo criterio que
   el filtro por `deliveryPointId`.
3. **Forma de respuesta nueva: `PickupRequestBoardSummary`** — **sin
   `deliveryCode`**, a propósito (ADR-051: el tablero es una pantalla
   pública, nunca debe mostrar el código de verificación, a diferencia de
   `PickupRequestQueueSummary` que sí lo trae para la consola de puerta,
   una pantalla autenticada y operada por staff). Mismos campos que
   `PickupRequestBoardPayload` (el payload que ya construye
   `buildBoardPayload()`) — mismo criterio de paridad de nombres entre
   REST y WS ya usado en cola/seguimiento, para fusionar sin transformar.
4. **Gateway WS nuevo**, mismo patrón que los dos anteriores
   (`board.gateway.ts`): se suscribe al wildcard de tablero
   (`school-pickup/institution/+/board`, ya usado también por
   seguimiento), autorización por membresía de institución (no por
   propiedad de un `pickup_request` — distinto del canal de seguimiento),
   reenvía filtrado por `institutionId` de la conexión.
5. **Filtro por punto de entrega: en cliente, sin endpoint nuevo.** El
   feed completo ya trae `deliveryPointId` por fila — filtrar/agrupar por
   punto de entrega es una operación local sobre los datos ya recibidos,
   no justifica una llamada aparte.
6. **TTS (voceo automático): Web Speech API del navegador**, sin decisión
   de arquitectura — estándar, sin servicio externo.
7. **`packages/ui` como dependencia**, mismo patrón que `portal`/`parent`
   (ADR-036/ADR-042 punto 4/ADR-063 punto 8).

## Referencias

- ADR-011 (consola de puerta y tablero sin restricción de `role` dentro
  del tenant).
- ADR-042 (punto 5: simplificación de "primera membresía" cuando hay más
  de una, reutilizada aquí sin selector).
- ADR-050 (patrón original del puente WebSocket).
- ADR-051 (`deliveryCode` fuera del payload/summary de tablero, a
  propósito).
- ADR-067 (rotación de `refreshToken`, la pieza que hace viable la sesión
  indefinida del kiosco sin mecanismo nuevo).
- `docs/design-brief.md` (sección "3. Tablero de institución").

## ADR-069 — Tablero de institución: decisiones de la pantalla en vivo

**Contexto.** Al construir la pantalla real de `apps/board` (Fase 9, hero
único) sobre la plomería ya decidida (ADR-068: sesión, snapshot REST
`GET /pickup-requests?institutionId=...`, canal WS de feed completo)
aparecen las mismas categorías de decisión que ADR-052 resolvió para la
Consola de puerta — tamaño de página, orden, fusión de deltas, reconexión —
más un problema nuevo, propio de este tablero: **el `worker` republica el
payload de tablero en cada ingesta de ubicación** (throttled a 20s, Fase 6),
no solo en transiciones de estado, así que una fusión ingenua dispararía el
voceo (ADR-068 punto 6) y la animación (`design-brief.md`, sección 3) cada
20 segundos por cada recogida activa — ruido constante en una pantalla que
debe ser "ultra-glanceable", exactamente lo opuesto a su propósito.

**Decisión.**
1. **Tamaño de página del snapshot: 200**, por encima del default de la API
   (20, ADR-024 punto 9) y también del que usa la consola de puerta (100,
   ADR-052 punto 2) — la consola opera un solo punto de entrega a la vez, el
   tablero muestra **toda la institución**, potencialmente varios puntos de
   entrega simultáneos en hora de salida. Sin paginador, mismo criterio que
   ADR-052: un tablero no se hojea.
2. **Orden: ETA ascendente, fila sin ETA al final, desempate por nombre del
   alumno** — mismo criterio exacto que la cola de la consola (ADR-052
   punto 2), reimplementado localmente en `apps/board` (no en
   `packages/shared`; ver punto 6). `design-brief.md` pide "ordenadas por
   cercanía/ETA", que es esta misma regla.
3. **Fusión de deltas: un delta en estado terminal (`delivered`/`cancelled`)
   saca la fila; uno con `updatedAt` anterior al ya mostrado se descarta**
   — mismo criterio que ADR-052 punto 3, coherente con que el snapshot REST
   de este ADR-068 también devuelve solo estados activos.
4. **Voceo (TTS) y animación disparan solo cuando el `status` de la fila
   cambia respecto al que ya estaba en pantalla, nunca en un delta que solo
   trae un `etaSeconds`/`estimatedArrivalAt` actualizado.** Este es el punto
   central de este ADR: sin él, cada recálculo de ETA del `worker` (cada 20s
   mientras el tutor está en camino) dispararía voceo y animación de forma
   idéntica a una transición real. `mergeBoardDelta` (función pura,
   `apps/board/src/board/board-rows.ts`, mismo patrón que `mergeQueueDelta`)
   devuelve, junto con las filas fusionadas, el conjunto de
   `pickupRequestId` cuyo `status` cambió en esta fusión — la pantalla usa
   ese conjunto, no una comparación implícita en el render, para decidir a
   quién animar/anunciar.
5. **Qué se anuncia por voz: solo transiciones a `arriving` y `arrived`**
   ("Llegando" y "En puerta"). No `en_route` (demasiado temprano, sin
   utilidad operativa para el personal — es el evento más frecuente y
   volvería el voceo constante), no `delivered`/`cancelled` (la fila ya
   salió de la pantalla en el mismo instante, ADR-052 punto 3 replicado
   aquí — anunciar una fila que ya no se ve es más confuso que útil). Texto
   fijo: *"{nombre del alumno} llegando"* / *"{nombre del alumno} en
   puerta"* — sin URL/ID, un locutor no lee identificadores. Usa
   `SpeechSynthesisUtterance` (`Web Speech API`, ADR-068 punto 6) con
   `lang = 'es-MX'`; el navegador ya serializa utterances en cola, sin lógica
   propia de cola.
   **Enmienda a ADR-069 punto 5 (verificación en vivo, post-implementación).**
   El timbre robótico de `SpeechSynthesisUtterance` local (sin voz
   descargada ni servicio externo, ADR-068 punto 6) se escuchó en vivo
   contra las dos transiciones reales y **se acepta a propósito, no como
   limitación temporal**: en el ambiente ruidoso de una salida escolar,
   que la voz suene inequívocamente sintética ayuda a que el personal la
   identifique de inmediato como el tablero automatizado hablando, no como
   una persona. No se evalúa un proveedor de TTS externo por ahora — no es
   un ítem de backlog, es una decisión cerrada.

6. **`mergeBoardDelta`/`sortBoardRows`/`parseBoardDelta` son app-local**
   (`apps/board/src/board/board-rows.ts`), no una extracción a
   `packages/shared` — mismo criterio que ADR-033/ADR-036 (sin mover código
   a un paquete compartido sin un segundo consumidor real que lo justifique
   *dentro de ese paquete*). Esto es, sin embargo, la **tercera**
   reimplementación del mismo patrón completo (fusión de deltas + orden +
   parseo defensivo + reconexión con backoff) tras `gate-console` (ADR-052)
   y el seguimiento del tutor (ADR-064) — ver Backlog técnico en
   `docs/plan-implementacion.md`, ítem nuevo: evaluar extraer un hook
   genérico de "canal WS con snapshot REST + deltas" a `packages/shared`
   cuando se retome Fase 10, no en este slice.
7. **Reconexión: mismo patrón exacto que ADR-052 punto 5** (socket antes que
   snapshot, deltas en vuelo bufferizados durante el fetch, backoff
   1s→2s→5s→10s, los 4 códigos de cierre de aplicación no se reintentan). El
   tablero vive encendido indefinidamente (a diferencia de la consola, que
   se usa durante una ventana de salida) — no cambia el backoff: seguir
   reintentando cada 10s el resto del día es aceptable y simple, no justifica
   un techo mayor.
8. **Filtro por punto de entrega: pastillas locales por `id`, no
   `SegmentedTabs`.** `SegmentedTabs` (`packages/ui`) representa cada opción
   como un `string` que es a la vez valor y etiqueta — nada impide en el
   modelo dos `delivery_points` con el mismo `name` en la misma institución
   (`specs/entities/delivery_point.md` no lo prohíbe), lo que colisionaría
   el filtro. En vez de tocar un componente del design system para un caso
   de uso, `apps/board` arma una fila de pastillas propia, con los mismos
   tokens visuales (`--surface-muted`, `--ink-900`, `--radius-lg` etc., ya
   usados por `SegmentedTabs`) pero indexada por `deliveryPointId`. Las
   etiquetas salen de `GET /institutions/:institutionId/delivery-points`
   (ya existe, Capa 3d) — llamada una sola vez al montar, sin tiempo real
   propio (los puntos de entrega no cambian a media ventana de salida). Una
   fila con `deliveryPointId = null` (captura libre sin punto resuelto)
   solo aparece bajo "Todos", nunca bajo una pastilla concreta.
9. **Encabezado: reloj con `setInterval` de 1s, formato `HH:mm` 24h,
   `es-MX`** — sin dependencia de servidor, mismo criterio que cualquier
   reloj de pantalla ambiente.
10. **Animación de fila: CSS puro (`@keyframes`), sin librería nueva.** El
    proyecto no tiene ninguna dependencia de animación en ningún frontend
    (mismo criterio de "sin dependencia sin necesidad clara" que ADR-036);
    un pulso de fondo de ~1.8s sobre la fila cuyo `pickupRequestId` está en
    el conjunto "cambió de estado" (punto 4) es suficiente para el
    requisito de `design-brief.md` ("animación sutil al cambiar de
    estado").
11. **Estado vacío: `EmptyState` de `packages/ui`**, mismo componente que
    `apps/portal`/`apps/board`'s `InstitutionGate` ya usan — sin
    recogidas activas es un estado normal y frecuente (fuera de horario de
    salida), nunca un error.

**Consecuencias.** El patrón de canal WS (snapshot-then-deltas, backoff,
merge puro y testeado) queda usado tres veces sin abstraer — decisión
consciente, no descuido (punto 6), con su propio ítem de backlog para no
perderse. `apps/board` queda como el tercer y último frontend construido
sobre el mismo puente WebSocket de ADR-050, cerrando su ciclo de
consumidores previstos.

## Referencias

- ADR-024 (punto 9: paginación por defecto de 20, el patrón que este ADR y
  ADR-052 elevan por la misma razón).
- ADR-033/ADR-036 (criterio de no extraer a `packages/shared` sin un
  segundo consumidor real dentro del paquete; sin dependencias nuevas sin
  necesidad clara).
- ADR-050 (patrón original del puente WebSocket, tercer y último
  consumidor).
- ADR-051 (`deliveryCode` fuera del payload de tablero — por eso
  `board-rows.ts` no lo maneja, a diferencia de `queue-rows.ts`).
- ADR-052 (precedente completo: mismas cinco categorías de decisión para la
  Consola de puerta — tamaño de página, orden, fusión de deltas,
  reconexión, y el propio precedente de "ADR de decisiones de pantalla en
  vivo").
- ADR-064 (segundo consumidor del mismo patrón de canal WS, del lado de
  `apps/parent`).
- ADR-068 (plomería completa de esta pantalla: sesión, snapshot REST,
  gateway WS, filtro en cliente, TTS sin arquitectura propia).
- `docs/design-brief.md` (sección "3. Tablero de institución": listado
  hero, animación, voceo, estado vacío, filtro por punto de entrega).
- `specs/entities/delivery_point.md` (sin unicidad de `name` — la razón del
  punto 8).
- `apps/portal/src/gate-console/queue-rows.ts`,
  `apps/portal/src/gate-console/queue-socket.ts`,
  `apps/portal/src/gate-console/useDeliveryPointQueue.ts` (el patrón que
  este ADR replica por tercera vez, ver punto 6).

## ADR-070 — Cierre de Fase 8: el QR del código de entrega se descarta deliberadamente, no se difiere por falta de tiempo

**Contexto.** `docs/design-brief.md` pide que la pantalla de código de
entrega de `apps/parent` (feature 021, Capa 4d) muestre "QR y PIN de 4
dígitos". Solo se construyó el PIN (Fase 8). Al auditar el cierre de la
fase, esto quedaba registrado en `docs/plan-implementacion.md` como un
ítem de Backlog técnico condicionado a que "el PIN de 4 dígitos resulte
insuficiente para la consola de puerta" — redacción que sugería una
omisión pendiente de tiempo/prioridad, no una decisión evaluada.

**Decisión.**
1. **El QR se descarta a propósito, confirmado con el humano al cerrar la
   fase — no es deuda técnica.** Dos razones concretas, no solo "se
   priorizó el PIN":
   - **Fricción en el momento equivocado.** La consola de puerta opera
     durante la ventana de salida, el momento de mayor presión operativa
     del staff (ADR-052: "una consola que tarda medio minuto en volver es
     una consola que se perdió el evento"). Un QR que falla al escanear
     (cámara sucia, pantalla del tutor con brillo bajo, ángulo, tablet sin
     cámara) agrega una fuente de fricción justo ahí — el PIN tecleado a
     mano no tiene ese modo de falla.
   - **Sin beneficio demostrado.** No hay ninguna institución real en
     producción todavía — no existe evidencia de que el PIN de 4 dígitos
     sea insuficiente en la práctica. Construir el QR ahora sería resolver
     un problema hipotético.
2. **Condición explícita para reabrir el ítem**: al menos una institución
   real en fase de pruebas, y una señal operativa concreta de que el PIN
   genera fricción real en la consola de puerta — no una preferencia
   estética de "el design-brief pedía ambos". Sin esa señal, no se
   implementa.
3. **No cambia nada del modelo ni del contrato de API** — `delivery_code`
   ya es el mismo valor que serviría de contenido a un QR futuro; esta
   decisión es exclusivamente de alcance de pantalla en `apps/parent`, no
   de esquema.

**Consecuencias.** Cierra formalmente Fase 8 (`docs/plan-implementacion.md`)
sin este ítem pendiente — queda en Backlog técnico únicamente como
condición de reapertura, no como trabajo diferido a corto plazo.

## Referencias

- `docs/design-brief.md` (pantalla de código de entrega, "QR y PIN de 4
  dígitos").
- ADR-052 (precedente del mismo criterio: la consola de puerta se diseña
  para no perder eventos durante la ventana de salida — la misma ventana
  cuya presión motiva descartar el QR aquí).
- ADR-058 (precedente de estructura: una omisión deliberada con su propia
  razón explícita, no una casilla sin marcar).
- `docs/plan-implementacion.md` — Fase 8, Backlog técnico.
