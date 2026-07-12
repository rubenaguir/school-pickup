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
   ADR-018 punto 9) para trazabilidad.
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

## ADR-029 — Columna compañera de solo lectura `institutionId` en 5 entidades, para `InstitutionMembershipGuard`

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
