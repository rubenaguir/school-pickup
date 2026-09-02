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
  del alcance del código de este repo. **Corrección retroactiva (ver
  ADR-100):** en el despliegue real, el DNS vive en Linode y el reverse
  proxy es nginx, no Caddy — este punto describe el plan original al
  momento de este ADR, no el estado final.

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

## ADR-071 — Tablero de institución: rediseño con los 3 modos reales del kit (Andén/Sereno/Carril) tras el handoff correcto del design system, enmienda de ADR-069

**Contexto.** ADR-069 se escribió a partir de la descripción en prosa de
`docs/design-brief.md` y una sola captura de pantalla, sin haber hecho
nunca el *handoff* real desde el proyecto de Claude Design — el export
completo del design system (`design/casillego-design-system/`, agregado en
esta misma sesión) no existía todavía en el repo. Al auditar el mockup
real (`ui_kits/tablero-institucion/index.html`) contra lo construido en
Fase 9 aparecieron tres discrepancias, confirmadas con el humano:

1. La captura que motivó esta auditoría no es *el* diseño del tablero — es
   uno de **tres modos de visualización** que el kit define, elegibles con
   un selector de pastillas (esquina inferior derecha): **A · Andén**
   (pantalla grande pública, oscuro), **B · Sereno** (kiosco público,
   claro, tarjetas), **C · Carril** (vista de staff, densa, con datos de
   tutor/vehículo). Lo que se implementó en Fase 9 no corresponde a
   ninguno de los tres con fidelidad — es una aproximación clara pero
   ligera del modo Andén, en tema claro (heredado sin querer de los
   tokens de `packages/ui` que ya existían para el portal).
2. Las letras A/B/C del selector de modo **no son** la "etiqueta de punto
   de entrega A/B/C" que menciona `docs/design-brief.md` — son dos ideas
   distintas que coinciden en el alfabeto por casualidad. El filtro por
   punto de entrega (ADR-069 punto 8) se mantiene, confirmado con el
   humano: el diseño original nunca contempló instituciones con varios
   puntos de entrega simultáneos, así que el kit no lo modela, pero sigue
   siendo un requisito real de `design-brief.md` — es una pieza
   independiente del selector de modo, no un reemplazo de este.
3. El orden de filas de Andén en el kit real no es "ETA ascendente" como
   fijó ADR-069 punto 2 — es **prioridad de estado primero**
   (`arrived` → `arriving` → `en_route`), **ETA como desempate dentro de
   cada estado**. En la práctica ambos órdenes casi siempre coinciden
   (`arrived`/`arriving` ya tienen ETA bajo por definición), pero no son
   la misma regla, y con suficientes filas activas simultáneas pueden
   discrepar.

**Decisión.**

### 1. Los 3 modos se construyen, con las audiencias confirmadas por el humano

- **Andén y Sereno son públicos**, para el kiosco físico de la
  institución — sin datos de tutor/vehículo/placa, mismo criterio de
  privacidad que ADR-051 ya estableció para el tablero.
- **Carril es una vista de staff autenticado** — no necesariamente el
  kiosco: aplica tanto a alguien monitoreando desde su oficina como al
  caso en que no hay pantalla grande con buena visibilidad y el único
  dispositivo disponible es una computadora o tablet operado por
  personal. Esto **no es un rol nuevo** — cualquier `institution_member`
  que ya tiene sesión en `apps/board` puede cambiar a este modo (mismo
  criterio "sin restricción de `role`" de ADR-011/ADR-068), la diferencia
  es de **datos expuestos**, no de quién puede verlos.

### 2. Carril necesita su propio canal — no reutiliza el feed de Andén/Sereno

**El hallazgo de seguridad que motiva este punto:** `apps/board` mantiene
una sola conexión WS por sesión (ADR-068). Si el payload de Carril
(tutor, parentesco, vehículo, placa) viajara por el mismo canal que ya
consumen Andén/Sereno, **cualquier kiosco físico público recibiría esos
datos por la red aunque la interfaz nunca los pinte** — alcanzables por
cualquiera con acceso físico al dispositivo (DevTools, inspección de
red). Rompería exactamente el principio que ADR-051 ya protege para
`deliveryCode`, aplicado ahora a datos todavía más sensibles (identifica
a un adulto y su vehículo, no solo un código de un solo uso).

Confirmado con el humano: **se separa**. Mismo criterio arquitectónico que
ya distingue la cola de la consola de puerta del feed del tablero
(ADR-050/051) — consumidor distinto, payload distinto, canal distinto.

1. **Tipo nuevo `PickupRequestBoardMonitorPayload`**
   (`packages/shared/src/pickup-request-payloads.ts`), junto a
   `PickupRequestBoardPayload`/`PickupRequestQueuePayload` existentes —
   mismos campos que `PickupRequestBoardPayload` más:
   `guardianFullName: string`, `guardianRelationship:
   StudentGuardianRelationship`, `vehicleDescription: string | null`,
   `vehiclePlate: string | null`. **Sin `deliveryCode`** — Carril tampoco
   lo muestra en el mockup real, ADR-051 no cambia para ningún modo del
   tablero, solo para la consola de puerta.
2. **Resuelto en `PickupsService`/`LocationIngestionService` con una
   consulta adicional a `student_guardians`**, mismo patrón ya usado en
   `notifyOtherGuardiansOfDelivery` (ADR-066 punto 5) para resolver el
   vínculo tutor-alumno — no una relación nueva, un lookup ya precedente.
   `vehicleDescription`/`vehiclePlate` ya se resuelven hoy para
   `buildQueuePayload`, se reutilizan sin cambios.
3. **Topic nuevo**: `boardMonitorTopic(institutionId)` →
   `school-pickup/institution/{institutionId}/board-monitor`
   (`packages/shared/src/index.ts`, junto a `boardTopic`/
   `deliveryPointQueueTopic`, con su `parseBoardMonitorTopic` inverso,
   mismo contrato defensivo — nunca lanza, `null` si no matchea). Se
   publica en los **mismos dos puntos** que ya publican `boardTopic`
   (`PickupsService.publishRealtimeUpdate`,
   `LocationIngestionService.publishRealtimeUpdate`) — mismo throttle de
   20s del `worker`, sin mecanismo nuevo de frecuencia.
4. **`BoardMonitorGateway` nuevo** (`apps/api/src/board/`), calco
   estructural de `BoardGateway` — mismo patrón de autorización
   (membresía de institución, sin restricción de `role`), mismos 4
   códigos de cierre, `path: '/ws/board-monitor'`. Se suscribe a
   `school-pickup/institution/+/board-monitor`.
5. **Snapshot REST**: nuevo query param `view` en
   `GET /pickup-requests?institutionId=...&view=monitor` (default
   `view=board` si se omite, sin romper el modo actual) — misma ruta,
   misma autorización, proyección de respuesta distinta
   (`ListPickupRequestsBoardMonitorResponse`). No es un filtro
   ortogonal a `institutionId`/`deliveryPointId`/`enrollmentId`
   (ADR-024/ADR-068) — es un modificador de *forma* de un request que ya
   está acotado por `institutionId`, no introduce una cuarta rama
   mutuamente excluyente.
6. **`apps/board` abre/cierra la suscripción de Carril según el modo
   activo** — no una conexión permanente de más: al entrar a Carril abre
   `useInstitutionBoardMonitor` (mismo esqueleto que
   `useInstitutionBoard`, snapshot-then-deltas, backoff idéntico); al
   salir de Carril, cierra el socket. Andén/Sereno nunca la abren.

### 3. Etiqueta de parentesco: se promueve a `packages/shared`

`apps/portal/src/students/student-labels.ts` ya tiene
`relationshipLabel()` (Madre/Padre/Abuelo-a/Chofer/Otro) — con Carril,
`apps/board` es un segundo consumidor real, así que **se mueve a
`packages/shared`** (mismo criterio de extracción que ADR-069 punto 6
exige: no se mueve nada sin un segundo consumidor real, y aquí ya existe
uno). `apps/portal` pasa a importarla en vez de mantener su copia local.

### 4. Barra de progreso de Carril: aproximada con `advance_notice_minutes`, sin cambio de esquema

Confirmado con el humano. `institutions.advance_notice_minutes` (ya
existe, configurable en Perfil de institución, expuesto por
`GET /institutions/:id`) se usa como el ETA "típico" de referencia:

```
progreso% = clamp(100 - (etaSeconds / (advanceNoticeMinutes * 60)) * 100, 0, 100)
```

Es una aproximación deliberada, no una medición real del trayecto — no
hay dato de ETA inicial guardado (`pickup_requests` solo tiene
`eta_calculated_at`, el momento del último cálculo, nunca el primero). Si
en el futuro se decide medir el progreso real, hace falta un campo nuevo
que capture el ETA al crear el `pickup_request` — no es parte de esta
decisión. `apps/board` resuelve `advanceNoticeMinutes` con una sola
llamada a `GET /institutions/:id` al montar (mismo patrón "una sola carga"
que `useDeliveryPoints`, ADR-069).

### 5. Orden de Andén corregido: prioridad de estado, ETA como desempate

`sortBoardRows` (`apps/board/src/board/board-rows.ts`) cambia de "ETA
ascendente puro" a la regla real del kit:
`arrived` (0) → `arriving` (1) → `en_route` (2), y dentro de cada grupo,
ETA ascendente (sin ETA al final), empate final por nombre. Sereno usa la
misma función — ya filtra `delivered`/`cancelled` aparte, así que el
cambio de orden no le afecta en la práctica pero mantiene una sola fuente
de verdad para las dos vistas públicas. Carril no reordena — el kit lo
muestra en el orden que llega, sin repriorizar (`sorted` completo, no un
`.slice`).

### 6. Selector de modo: persistido por dispositivo, no reseteado en cada carga

Decisión de implementación menor, sin ADR propio por su tamaño: el modo
activo se guarda en `localStorage` del navegador del kiosco/dispositivo.
Un kiosco configurado en Sereno, o una tablet de oficina configurada en
Carril, no debe volver a Andén por defecto tras una recarga o una
reconexión — el dispositivo casi nunca cambia de rol una vez instalado.

### 7. Tokens de tema oscuro: no se agregan a `packages/ui`

El kit real de Andén/Carril usa colores oscuros escritos directo en la
JSX del mockup (`#0A1622`, `rgba(255,255,255,.5)`, etc.), no variables
CSS nombradas — el proyecto de Claude Design nunca formalizó un token
`--dark-*`. Se replican como constantes locales en `apps/board`, mismo
criterio de ADR-069 punto 6 (app-local, sin segundo consumidor que
justifique extraerlas a `packages/ui`): ningún otro frontend del proyecto
usa tema oscuro.

**Consecuencias.** Enmienda ADR-069 puntos 2 (orden) y 10 (implícito: la
pantalla completa se reconstruye visualmente, la animación de pulso se
conserva sin cambios de mecanismo). No cambia nada de ADR-068 (sesión,
autorización base) ni del filtro por punto de entrega (ADR-069 punto 8),
que se mantiene intacto y se re-skinnea para los 3 temas.

## Referencias

- ADR-011, ADR-068 (autorización sin restricción de `role` dentro del
  tenant — Carril no es un rol nuevo, es una proyección de datos nueva).
- ADR-050/051 (precedente exacto: separación de canal/payload por
  consumidor — la base de la decisión del punto 2).
- ADR-066 punto 5 (patrón de lookup `student_guardians` ya usado,
  reutilizado aquí sin novedad).
- ADR-069 (decisión que este ADR enmienda en los puntos 2 y 10; puntos
  1/3/4/6/7/8/9/11 no cambian).
- `design/casillego-design-system/ui_kits/tablero-institucion/index.html`
  (fuente de verdad de los 3 modos — el mockup real, no una descripción).
- `design/casillego-design-system/tokens/colors.css` (confirmado idéntico
  a `packages/ui/src/tokens/colors.css` — sin tokens de tema oscuro en
  ninguno de los dos).
- `apps/portal/src/students/student-labels.ts` (`relationshipLabel`,
  promovida a `packages/shared` por este ADR).
- `specs/entities/institution.md` (`advance_notice_minutes`, campo
  reutilizado sin migración).

## ADR-072 — Portal admin, Fase A: shell de navegación del rol Institución + Dashboard real

**Contexto.** El barrido rápido de `apps/portal` contra
`design/casillego-design-system/ui_kits/portal-admin/` (mismo ejercicio de
handoff que ADR-071 hizo para el tablero) encontró un problema estructural,
no de estilo: **no existe ningún shell de navegación persistente** en
ningún rol. Cada pantalla de institución (`InstitutionProfile`,
`DeliveryPoints`, `DismissalSchedule`, `Personnel`, `Reports`,
`PendingEnrollments`) es una tarjeta centrada independiente
(`max-width` ~800px sobre `var(--bg-app)`), sin la barra lateral oscura de
250px que el kit usa consistentemente. Tampoco existe una pantalla de
Dashboard — `HOME_PATH` es un alias literal de `PENDING_ENROLLMENTS_PATH`.

Alcance de este ADR: **solo el rol Institución** (Fase A del plan
acordado con el humano: A → B → C, dejando el shell de OPS para un ADR
propio más adelante, y "Usuarios"/"Configuración" del rol operador
diferidos indefinidamente — ver Backlog técnico).

**Decisión.**

### 1. `InstitutionShell` — sidebar + header, envuelve las pantallas existentes

Componente nuevo (`apps/portal/src/institution/InstitutionShell.tsx`),
calco de la sidebar del kit: 250px, `var(--ink-900)`, isotipo + wordmark,
nombre de institución, 7 ítems de navegación (ver punto 2), contador de
pendientes sobre "Aprobaciones" (mismo dato que ya resuelve
`PendingEnrollments`), pie con iniciales + nombre + rol del usuario en
sesión. Header superior: 68px, blanco, breadcrumb
"Institución / {sección activa}" — **sin la caja de búsqueda del kit**:
no hay ninguna funcionalidad de búsqueda especificada para lo que
buscaría (¿alumnos? ¿solicitudes? ¿personal?, cada pantalla ya tiene su
propio filtro), así que agregar el control visualmente sin que haga nada
sería peor que omitirlo — mismo criterio que ya se aplicó a "Esperados"
en este mismo ADR (punto 3): no se construye un elemento que sugiere una
función que no existe.

`InstitutionShell` envuelve las rutas de institución como layout de React
Router (mismo mecanismo que `AuthenticatedLayout`/`InstitutionGate` ya
usan), no como wrapper manual en cada pantalla — una sola inserción en
`App.tsx`.

### 2. Navegación: 7 ítems, no los 6 del kit — se conserva la IA real ya construida

El kit consolida "puntos de entrega" como una tarjeta dentro de la página
"Institución" (junto con "Tolerancia y avisos" y "Coordinación de
salida"), sin ítem propio de navegación. La app real ya tiene
`DeliveryPoints` como pantalla independiente, con gestión completa
(asignación de grupos, operador, activar/desactivar) — mucho más que la
tarjeta de solo lectura del kit. **Se mantiene como ítem propio de
navegación**, no se consolida dentro de "Institución": replicar
literalmente el kit aquí significaría degradar una pantalla ya construida
y verificada a una tarjeta más simple, sin ninguna razón funcional para
hacerlo. Nav final: Dashboard, Aprobaciones, Institución, Puntos de
entrega, Horarios, Personal, Reportes.

### 3. Dashboard — alcance negociado con el humano, sin inventar datos que no existen

El kit muestra: 4 tarjetas KPI (Esperados/En camino/En puerta/Entregados
con %), un panel grande de "Avance de la salida" (barra + desglose
proporcional), "Por nivel" (barra de progreso por nivel), "Requiere
atención" (alertas), y una tabla de actividad en vivo filtrable.

Confirmado con el humano, campo por campo:

- **"Esperados" se omite por completo.** No existe ninguna lista de
  asistencia esperada — no hay entidad ni cálculo que determine cuántos
  alumnos se espera recoger en la ventana activa. Inventar un
  aproximado sería un dato falso presentado como real.
- **Tarjetas KPI: 3, no 4** — En camino / En puerta / Entregados, conteos
  simples derivados del feed en vivo (punto 5). La tarjeta de Entregados
  **no lleva el sub-texto de porcentaje** (dependía de "esperados").
- **El panel grande "Avance de la salida" (barra + desglose proporcional)
  se omite por completo** — depende del mismo denominador que "Esperados"
  para tener sentido; sin él, una barra de "% completado" sería engañosa,
  no solo incompleta.
- **"Por nivel" se conserva, pero como conteo simple, sin barra ni
  porcentaje** (ej. "Primaria: 12 entregados hoy") — no implica ningún
  total, solo cuenta lo que sí es real: cuántas recogidas de ese nivel se
  completaron hoy. Comparte fila con "Requiere atención" en el layout
  (ambos paneles quedaron más modestos que el original del kit, `1fr 1fr`
  en vez de `2fr 1fr`).
- **"Requiere atención" se conserva con datos fijos/placeholder** — el
  humano confirmó que le parece un panel importante, a poblar con datos
  reales más adelante (no existe todavía ningún concepto de alerta en el
  dominio — "lleva mucho tiempo en camino", geocerca sin activar, etc. —
  eso es una decisión de producto aparte, no de esta fase). El panel
  queda visualmente presente, con el mismo contenido de ejemplo del kit,
  explícitamente marcado en el código como no-funcional todavía.
- **Tabla de actividad en vivo: real**, ver punto 5.

### 4. "Coordinación de salida" — sí tiene dato real, se agrega a Institución (no al Dashboard)

A diferencia de "Esperados", esta tarjeta **sí es construible**:
`institution_member.role` ya incluye `coordinator` (ADR-011), y
`users.phone` ya existe en el esquema (nullable). El kit la ubica dentro
de la página "Institución", no del Dashboard — se respeta esa ubicación.
Pequeño ajuste de backend necesario: `InstitutionMemberListItem`
(`apps/api/src/institution-members/dto/responses.ts`) no expone `phone`
hoy, solo `fullName`/`email` — se agrega el campo (columna ya existente en
`users`, sin migración). Si no hay ningún miembro con `role: 'coordinator'`
en la institución, la tarjeta se omite — no es un estado de error, muchas
instituciones no habrán designado uno todavía.

### 5. Tabla de actividad en vivo del Dashboard reutiliza el canal de Carril

El feed `view=monitor` (`GET /pickup-requests?institutionId=&view=monitor`
+ `/ws/board-monitor`, ADR-071 punto 2) ya expone exactamente los campos
que esta tabla necesita (alumno, grupo, tutor, parentesco, vehículo,
placa, estado, ETA) y ya está autorizado para cualquier `institution_member`
sin importar `role` — el mismo criterio de acceso que necesita el
Dashboard. **Se reutiliza sin cambios de backend.** Los conteos de las 3
tarjetas KPI (punto 3) se derivan del mismo feed en cliente, no piden
nada aparte.

Esta es la **quinta** reimplementación del patrón "canal WS con snapshot
REST + deltas" (`gate-console`, `pickup-requests` de `apps/parent`,
`board` y `board-monitor` de `apps/board`, y ahora esta) — ver Backlog
técnico, la nota ya existente se actualiza para reflejar el conteo nuevo.
Se decide **no extraer todavía** en este ADR (mismo criterio de ADR-069/
071: sin bloquear una fase funcional por un refactor transversal), pero
esta quinta instancia es la señal más fuerte hasta ahora de que vale la
pena revisarlo pronto.

**Consecuencias.** El Dashboard queda deliberadamente más simple que el
mockup — tres piezas omitidas (Esperados, % de Entregados, el panel
grande de avance) por falta de dato real, no por alcance de tiempo. Puede
ampliarse más adelante si se decide construir una fuente real de
"esperados" (ej. lista de asistencia, o inferirlo de horarios recurrentes
+ matrícula) — eso es una decisión de producto nueva, no un pendiente de
esta fase.

## Referencias

- ADR-011 (roles de `institution_member`, incluye `coordinator` — la base
  del punto 4).
- ADR-042 (`InstitutionGate`, mecanismo de layout que `InstitutionShell`
  reutiliza).
- ADR-052/069/071 (precedentes del patrón de canal WS reutilizado en el
  punto 5, y del criterio de "no inventar datos sin fuente real" ya usado
  para el QR — ADR-070 — y para el timbre de voz del tablero).
- `design/casillego-design-system/ui_kits/portal-admin/index.html` (fuente
  visual de este ADR).
- `apps/api/src/institution-members/dto/responses.ts` (`phone` agregado a
  `InstitutionMemberListItem`, punto 4).

**Enmienda a ADR-072 punto 3 (verificación en vivo, post-implementación).**
El conteo de "Entregados"/"Por nivel" del Dashboard, tal como se
implementó primero, solo acumulaba entregas ocurridas *mientras la
pantalla estaba abierta y conectada* (`deliveredSinceConnect`, hallazgo
correcto de Claude Code: el canal `board-monitor` descarta
`delivered`/`cancelled` en cuanto llega el delta, ADR-071, así que no hay
snapshot que contarlos de otra forma) — un refresh de página reiniciaba el
contador a cero aunque ya se hubieran entregado alumnos antes. Confirmado
con el humano: debe sobrevivir un refresh.

`pickup_requests.completed_at` ya persiste este dato — `apps/api/src/institution-reports/institution-reports.service.ts`
ya prueba exactamente esta consulta (`status = 'delivered' AND completedAt
BETWEEN :start AND :end`) para su período `'today'`. **No se reutiliza ese
endpoint tal cual**: `GET /institutions/:id/reports` exige `role = admin`
(ADR-060 punto 6), mientras que el Dashboard es visible para cualquier
`institution_member` sin restricción de rol (mismo criterio de ADR-071
punto 1) — reutilizarlo habría filtrado el conteo solo para admins,
rompiendo la pantalla para coordinador/docente/operador de puerta sin que
fuera obvio por qué.

**Decisión.**

1. **Endpoint nuevo**: `GET /institutions/:id/delivered-today`
   (`apps/api/src/pickups/`, mismo controller/guard que ya usa
   `view=monitor` — cualquier `institution_member`, sin restricción de
   `role`). Respuesta:
   ```json
   { "asOf": "2026-08-15T20:03:00.000Z", "total": 12, "byGroup": [{ "label": "3°A", "count": 4 }] }
   ```
   `asOf` es el instante en que el servidor ejecutó la consulta (no un
   valor enviado por el cliente) — mismo query (`completedAt` entre inicio
   del día calendario y `asOf`) que `institution-reports.service.ts` ya
   valida, agrupado además por `enrollment.gradeOrGroup` (mismo criterio
   de `dashboard-grouping.ts`: sin inventar un campo "nivel" que no
   existe, agrupa por lo que sí hay).
2. **El cliente siembra su acumulador con esta línea base al montar y en
   cada reconexión** (mismo punto del ciclo donde ya recarga el snapshot
   REST del canal `board-monitor`) — no solo una vez al inicio.
3. **Sin doble conteo en la ventana de carrera**: un delta en vivo de
   `status: 'delivered'` solo se suma al acumulador si su `updatedAt` es
   **posterior** a `asOf` — evita contar dos veces una entrega que ocurrió
   justo en el instante en que el servidor ya la había capturado en la
   línea base pero el socket todavía no había entregado ese mismo evento
   como delta.
4. **Copy revertido**: "Entregas registradas desde que se abrió este
   panel" vuelve a "Entregados hoy" — ya es una afirmación honesta con la
   línea base real detrás.

**Consecuencias.** Es una consulta más por carga/reconexión del
Dashboard, sin nueva tabla ni migración — reutiliza una columna y un
patrón de consulta ya probados en producción (`institution-reports`).

## ADR-073 — Fase B: Consola de puerta a dos paneles, y "Vocear" como evento cruzado hacia el tablero

**Contexto.** Barrido del kit `puerta-consola`
(`design/casillego-design-system/ui_kits/puerta-consola/`) contra
`apps/portal/src/screens/GateConsole.tsx` real (mismo ejercicio que
ADR-071/072). Confirmado con el humano: seguimos con esta pantalla tras
cerrar la Fase A del portal.

A diferencia del Dashboard, la mayoría de lo que parecía "faltante" ya
tenía una decisión documentada:

- **"Reportar incidencia"** ya existe en el código real, visible pero
  deshabilitado (ADR-024 punto 5, ADR-034) — se conserva igual, solo se
  reubica dentro del nuevo layout.
- **El código de entrega no se simplifica al modelo del kit.** El kit solo
  *muestra* el código para verificación visual; el código real además lo
  **escribe** el operador, verificado por el servidor, sin bloqueo tras
  error (ADR-024 puntos 4 y 11). Se mantiene sin cambios de lógica — solo
  se re-diseña visualmente.
- **Selector de puerta**: el kit asume una sola puerta fija (su demo no
  lo necesita); la app real opera instituciones con varias puertas
  activas simultáneas. Se conserva la necesidad de elegir puerta, movida
  al encabezado del nuevo layout en vez de una tarjeta previa aparte.

Lo único genuinamente nuevo es **"Vocear"**: un botón de dos pasos en el
kit (Vocear → estado "voceando" animado → Confirmar entrega) que no
aparece en ningún ADR ni spec. Confirmado con el humano: no es una ayuda
visual local para el operador — **debe hacer sonar el voceo real en el
tablero** (`apps/board`, modos Andén/Sereno, TTS de ADR-068/069). Esto es
un evento en tiempo real cruzando de `apps/portal` a `apps/board`, algo
que el proyecto no ha construido todavía en esa dirección (hasta ahora
todo el tiempo real fluye de `pickup_request` hacia sus consumidores, no
de una acción manual de un frontend hacia otro).

**Decisión.**

### 1. "Vocear" es una acción efímera, sin escritura en base de datos

No es una transición de estado de `pickup_request` (ADR-024 punto 8 no
cambia — sigue con sus 5 transiciones, "vocear" no es una de ellas) ni
necesita sobrevivir una reconexión del tablero: si un Andén se reconecta
justo después de un voceo, simplemente no lo escucha — igual que nadie
espera "reproducir" un anuncio de audio que ya pasó. Sin tabla nueva, sin
columna nueva. Sí se registra en `audit_log`
(`action = pickup_request.announced`, convención `entity.verb`, ADR-018
punto 9 — participio, mismo criterio que `delivery_code_mismatched`,
ADR-031 punto 7) para trazabilidad de quién voceó a quién y cuándo — barato
de agregar, mismo patrón ya usado para los intentos de código fallidos.

### 2. Endpoint nuevo: `POST /pickup-requests/:id/announce`

Calco exacto de `PickupDeliveryController` (mismo
`InstitutionMembershipGuard` + `@InstitutionResource({ entity: PickupRequest })`,
sin restricción de `role` — ADR-011, cualquier `institution_member` opera
la consola). Válido solo para `pickup_request` en estado activo
(`en_route`/`arriving`/`arrived` — ADR-024 punto 8's
`ACTIVE_STATUSES`); 409 si ya está `delivered`/`cancelled` (mismo criterio
de estado que ya usa `deliver()`). Sin cuerpo — no hay nada que el
cliente deba enviar más que el `id` en la ruta. Publica a un topic MQTT
nuevo (punto 3) y escribe el `audit_log` (punto 1); no toca la fila del
`pickup_request` en sí.

### 3. Topic nuevo, mismo socket que ya existe — no un sexto canal

**No se abre una cuarta/quinta/sexta conexión WS duplicada** (el proyecto
ya señaló esto como una preocupación creciente, ADR-072 punto 5 — 5
instancias del patrón "snapshot + deltas"). "Vocear" no tiene snapshot que
sentido tenga replayar, así que no es ese patrón de todas formas — se
multiplexa sobre la **misma conexión `/ws/board`** que Andén/Sereno ya
mantienen abierta.

- `boardAnnounceTopic(institutionId)` →
  `school-pickup/institution/{institutionId}/board-announce`
  (`packages/shared/src/index.ts`, junto a `boardTopic`, con su
  `parseBoardAnnounceTopic` inverso, mismo contrato defensivo).
- **Se agrega un discriminador `kind` a los mensajes que ya viajan por
  `/ws/board`.** Es la primera vez que este canal necesita distinguir más
  de una forma de mensaje — momento correcto para hacerlo bien, y sin
  costo de compatibilidad hacia atrás real: el proyecto está en fase
  piloto, sin clientes en producción dependiendo hoy del formato viejo
  (ningún tablero real desplegado todavía fuera de las cuentas de
  verificación). `PickupRequestBoardPayload` (fila) gana
  `kind: 'row'`; el mensaje de voceo es un tipo nuevo,
  `PickupRequestBoardAnnouncePayload` (`kind: 'announce'`,
  `pickupRequestId`, `studentFullName`, `announcedAt`) — **sin** datos de
  tutor/vehículo (mismo criterio de privacidad de ADR-051/068: el tablero
  es público, este mensaje viaja por el mismo canal que ya respeta esa
  regla).
- `BoardGateway` se extiende para suscribirse también a
  `school-pickup/institution/+/board-announce` y reenviar ambos tipos de
  mensaje por la misma conexión ya autorizada por institución — sin
  gateway nuevo, sin ruta WS nueva.
- `parseBoardDelta` (`apps/board/src/board/board-rows.ts`) se actualiza
  para exigir `kind === 'row'` (rechaza cualquier otro valor, incluyendo
  uno que no reconozca — a prueba de futuro). Nuevo
  `parseBoardAnnounce`, mismo criterio defensivo.

### 4. El voceo manual suena igual que un voceo automático, con el mismo mecanismo

`useInstitutionBoard` (`apps/board`) ya tiene `onAnnounce` (ADR-069) para
transiciones automáticas a `arriving`/`arrived`. Un mensaje `kind: 'announce'`
dispara el mismo callback, con el mismo texto de `tts.ts` — se decide
**reutilizar la frase de "en puerta"** ("{nombre} en puerta") en vez de
inventar una tercera redacción: semánticamente el operador está llamando
al alumno porque su tutor ya está esperando, el mismo contexto que un
voceo automático de llegada. Si en el uso real esta frase no encaja bien
para un llamado manual, es un ajuste de texto trivial, no arquitectónico.
La fila también entra al conjunto de `recentlyChangedIds` (ADR-069 punto
10, animación de pulso) aunque su `status` no haya cambiado — mismo
tratamiento visual que un cambio real, y el pie de Andén ("Voceando:…")
se actualiza igual que con un voceo automático.

Sin límite de repetición ni debounce: `SpeechSynthesis` ya encola
utterances en orden (ADR-069), un doble clic simplemente repite el
anuncio dos veces seguidas — no se justifica lógica adicional para un
caso de uso de bajo riesgo.

### 5. Consola de puerta — layout de dos paneles, fiel al kit

- Barra superior oscura (`var(--ink-900)`): isotipo + institución + puerta
  seleccionada (con manera de cambiarla — el kit no lo necesita, nuestra
  realidad multi-puerta sí), 3 pastillas de conteo (en puerta/en camino/
  entregados), reloj+fecha, avatar de usuario.
- Panel izquierdo (452px, "Fila de salida"): lista de tarjetas, orden
  **prioridad de estado + voceo activo primero** (mismo criterio que
  Andén, ADR-071 punto 5, con "voceando" como nueva capa de prioridad más
  alta), indicador de voceo activo arriba de la lista.
- Panel derecho (detalle de la fila seleccionada): alumno + matrícula,
  "Quién recoge" (tutor/chofer, parentesco, vehículo+placa — mismos datos
  que `QueueRow` ya trae), código de entrega (mostrado **y** con el campo
  de captura real, punto 5 de arriba), pie de acciones: Vocear/Entrega
  directa **sin código no se construye** — la acción "Entrega directa" del
  kit se reemplaza por el flujo real (escribir código → Confirmar
  entrega), disponible en cualquier momento, no solo tras vocear.
  "Reportar incidencia" se conserva deshabilitado.

**Consecuencias.** Primera vez que un evento cruza en tiempo real de
`apps/portal` hacia `apps/board` — establece el patrón (topic dedicado +
discriminador `kind` sobre un canal ya existente) para cualquier evento
similar futuro, en vez de seguir sumando conexiones WS completas por cada
nueva idea.

## Referencias

- ADR-011 (autorización sin restricción de `role` — la base de quién
  puede vocear/entregar).
- ADR-018 punto 9 (convención `entity.verb` de `audit_log.action`).
- ADR-024 puntos 4, 5, 8, 11 (verificación de código, incidencia fuera de
  alcance, máquina de estados, exposición de `delivery_code` — ninguno
  cambia, todos se citan como restricciones que este ADR respeta).
- ADR-031 punto 7 (forma participio de `audit_log.action`).
- ADR-034 (botón de incidencia deshabilitado — precedente exacto para no
  reabrir esa discusión aquí).
- ADR-050/051 (patrón de gateway WS y separación de payload por
  consumidor — la base del punto 3, aplicado ahora *dentro* de un canal
  existente en vez de crear uno nuevo).
- ADR-068/069 (TTS del tablero — el mecanismo que "Vocear" reutiliza sin
  inventar uno nuevo).
- ADR-072 punto 5 (la señal de "van demasiadas conexiones WS duplicadas"
  que motivó multiplexar en vez de abrir una sexta).
- `design/casillego-design-system/ui_kits/puerta-consola/index.html`
  (fuente visual de este ADR).

**Enmienda a ADR-073 (previo a la implementación del frontend).**
`PickupRequestQueuePayload` (lo que la consola ya consume hoy) no trae
nombre ni parentesco del tutor — solo vehículo y placa. El panel "Quién
recoge" del kit los necesita. Extensión mínima: `PickupRequestRealtimeSnapshot`
ya carga `guardianFullName`/`guardianRelationship` desde ADR-071 (para
Carril/Dashboard) — `buildQueuePayload` pasa a copiar esos dos campos ya
resueltos, sin ninguna consulta nueva, sin tocar `resolveGuardianRelationship`.
Se agrega `guardianFullName: string` y
`guardianRelationship: StudentGuardianRelationship` a
`PickupRequestQueuePayload`. Justificación de producto, no solo visual: el
operador de puerta hoy solo confirma la entrega por el código — mostrar
quién dice ser el tutor es una verificación adicional razonable en un
contexto de seguridad escolar, consistente con por qué el código de
entrega existe en primer lugar (ADR-024).

## ADR-074 — Fase C: shell de navegación del rol Operador/OPS

**Contexto.** Mismo ejercicio que ADR-072 (Fase A), ahora para el rol
Operador/OPS. `apps/portal/src/admin/AdminNav.tsx` documenta hoy una
decisión explícita: *"Deliberately not the sidebar `NavItem` pattern of
the six institution screens: this context has no institution to show...
and only two destinations"* — tomada **antes** de que el design system
real (`design/casillego-design-system/`) se importara al repo. El kit
(`OpsRole()`, `ui_kits/portal-admin/index.html`) sí usa el mismo shell de
sidebar de 250px que el rol Institución, con 4 secciones (Resumen/
Instituciones/Usuarios/Configuración) — la razón que dio `AdminNav.tsx`
para omitirlo ya no aplica: el diseño real siempre lo contempló, la
decisión se tomó sin haber visto el kit.

A diferencia del Dashboard institucional (ADR-072), **la mayoría de los
datos de "Resumen" ya son reales** — `GlobalMetrics.tsx` ya renderiza los
6 campos de `AdminMetricsResponse` (`institutionsByStatus`,
`pendingRequests`, `registeredGuardiansCount`, `pickupRequestsTotal`,
`topInstitutionsByUsage`, `averagePickupDurationSeconds`), solo que en un
arreglo de tarjetas plano, no en la agrupación del kit. Un solo vacío
real: la gráfica "Recogidas por día" (últimos 14 días) no tiene ningún
campo detrás hoy.

**Decisión.**

### 1. `OpsShell` — mismo patrón que `InstitutionShell` (ADR-072), 2 ítems, no 4

Nuevo `apps/portal/src/admin/OpsShell.tsx`: sidebar 250px
(`var(--ink-900)`), insignia "OPS" junto al wordmark (el kit la tiene,
`InstitutionShell` no la necesitaba), eyebrow "OPERADOR" + "Consola
global", **2 ítems de navegación** (Resumen, Instituciones) — **no los 4
del kit**. "Usuarios" y "Configuración" ya se diferieron indefinidamente
al cerrar la Fase A (ADR-072, confirmado con el humano) — no se muestran
ni siquiera deshabilitados: a diferencia de "Reportar incidencia"
(ADR-024/034, con fecha implícita de "todavía no", tooltip "disponible
en una versión futura"), estos dos no tienen ningún horizonte — mostrar
un ítem de nav deshabilitado sugeriría lo contrario. El ítem
"Instituciones" lleva el mismo contador de pendientes que
`InstitutionApproval.tsx` ya calcula, no una consulta nueva. Header:
breadcrumb "Operador / {sección}" — **sin caja de búsqueda**, mismo
criterio y misma razón que ADR-072 punto 1 (nada que buscar todavía
detrás de ese control).

`OpsShell` se monta como layout de React Router **dentro** de
`SuperAdminRoute` (que ya es un layout con `<Outlet/>`, ADR-055 punto 2)
— mismo mecanismo exacto que `InstitutionShell` dentro de
`InstitutionGate`. `AdminNav.tsx` se elimina, no se deja sin usar.

### 2. `GlobalMetrics.tsx` — reagrupación visual, sin dato nuevo salvo uno

Los 6 campos existentes se reorganizan al layout del kit: 4 tarjetas KPI
en fila, "Instituciones por estado" + tiempo medio de recogida en una
columna, "Top instituciones por uso" con barras proporcionales — **datos
que ya se calculan**, solo cambia el arreglo visual, igual criterio que
tuvo el Dashboard institucional con lo que sí era real.

- **"Instituciones activas" pierde el chip "▲ N este mes"** del kit —
  `institutionsByStatus` es una foto del momento, no un histórico; no hay
  con qué calcular la variación mensual de instituciones activas sin
  agregar seguimiento de cambios de estado en el tiempo (`audit_log` ya
  registra transiciones individuales, pero agregarlas en una métrica es
  una pieza nueva, no una que ya exista). Se omite el chip, se conserva
  el número — mismo criterio que "Entregados" perdió su porcentaje
  cuando "Esperados" no tenía dato real (ADR-072 punto 3).
- **"Recogidas por día" (14 días) sí se construye** — a diferencia de
  "Esperados" (que no tenía ningún dato real detrás), esto es calculable
  con el mismo patrón ya probado en
  `institution-reports.service.ts` (`deliveriesByDay`,
  `status = 'delivered' AND completedAt BETWEEN :start AND :end`,
  agrupado por día) — aquí sin filtro de institución, ventana de 14 días
  natural (no la del mes calendario que ya usa
  `pickupRequestsTotal`/`resolveMetricsWindow`, son dos ventanas
  distintas con propósitos distintos). Campo nuevo
  `deliveriesByDay: DeliveriesByDayEntry[]` en `AdminMetricsResponse`
  — mismo tipo que ya exporta `institution-reports`, reutilizado, no
  redeclarado.

### 3. `InstitutionApproval.tsx` — solo se le quita el `<main>` de página completa

Mismo tratamiento que Personnel.tsx/Reports.tsx en la Fase A (ADR-072
punto 5): su contenido interno (aprobar/suspender/reactivar
instituciones) ya está construido y verificado, no se rediseña en esta
fase — solo deja de traer su propio `<main>` de altura completa, ahora lo
provee `OpsShell`.

**Consecuencias.** Cierra el patrón de shell para los dos roles del
portal que lo necesitaban (Institución en ADR-072, Operador aquí) — no
queda ninguna pantalla de `apps/portal` fuera de un shell salvo la
Consola de puerta (deliberadamente, ADR-073) y `Login`/`acceso` (no
aplica, es previo a cualquier sesión).

## Referencias

- ADR-055 punto 2 (`SuperAdminRoute`, el layout que `OpsShell` anida).
- ADR-038 (métricas globales — puntos 2/3/5/7 no cambian: ventana de
  comparación mensual, `pendingRequests` expuesto dos veces a propósito,
  top 5, sin caché).
- ADR-072 (precedente completo: mismo patrón de shell, mismo criterio de
  "omitir un dato sin fuente real en vez de inventarlo", mismo criterio
  de "no mostrar un pendiente indefinido como si tuviera fecha").
- `apps/portal/src/admin/AdminNav.tsx` (decisión que este ADR reemplaza —
  tomada sin haber visto el kit real).
- `apps/api/src/institution-reports/institution-reports.service.ts`
  (`deliveriesByDay`, el patrón que este ADR reutiliza sin institución).
- `design/casillego-design-system/ui_kits/portal-admin/index.html`,
  función `OpsRole()` (fuente visual de este ADR).

## ADR-075 — Extracción del patrón "canal WS con snapshot REST + deltas", en dos piezas, no en una

**Contexto.** El patrón aparece 5 veces: consola de puerta (ADR-052),
seguimiento del tutor en `apps/parent` (ADR-064), tablero público
(ADR-069), tablero Carril (ADR-071), Dashboard institucional (ADR-072).
Cada aparición decidió conscientemente no extraer todavía — señalado
como backlog en cada una de esas decisiones, con el conteo subiendo cada
vez. Antes de diseñar la extracción se comparó el código real de las 5
instancias, no solo la descripción — el hallazgo cambia el diseño:

**No es un solo patrón duplicado 5 veces — son dos patrones distintos.**

1. **La capa de conexión** (abrir el socket, pedir el snapshot REST desde
   `onopen`, bufferizar deltas que llegan mientras el snapshot está en
   vuelo, reconectar con backoff `[1000, 2000, 5000, 10000]`, detectar
   los 4 códigos de cierre fatal) es **casi idéntica** en las 5 —
   `reconnectDelayMs` y el constructor de URL del socket (misma forma,
   solo cambia el `path` y los parámetros de query) no divergen ni un
   carácter entre archivos. `fatalCloseReason` en sí tampoco divierge,
   pero **`FATAL_CLOSE_REASONS` no es idéntico**: el seguimiento del
   tutor en `apps/parent` usa `4403: 'NOT_STUDENT_GUARDIAN'` en vez de
   `'NOT_INSTITUTION_MEMBER'` — es el único canal orientado a tutores, no
   a personal de institución, y ese código de cierre significa algo
   distinto ahí. Las otras 3 posiciones (4400/4401/4404) sí son
   idénticas en las 5. Hallazgo verificado al comparar el código real
   justo antes de escribir el primer prompt de esta extracción —
   corrige la primera versión de este punto, que asumía el mapa completo
   idéntico sin haberlo confirmado letra por letra.
2. **La función de fusión (`merge`)** no es igual entre las 5:
   - `mergeQueueDelta` (consola de puerta) devuelve solo el arreglo.
   - `mergeBoardDelta` (tablero público) devuelve además
     `changedStatusIds` — lo necesita para la animación de pulso y el
     voceo (ADR-069), las otras cuatro no.
   - El seguimiento del tutor en `apps/parent` **no fusiona un arreglo en
     absoluto** — sigue un solo `pickup_request`, no una lista; su
     `applyDelta` reemplaza campos de un objeto, estructuralmente otro
     problema.
   - Solo **2 de las 5** (`mergeBoardMonitorDelta` de Carril y del
     Dashboard institucional) son copias exactas entre sí — la única
     fusión genuinamente duplicada.

Forzar las 3 fusiones distintas a una sola forma compartida sería
exactamente el riesgo que este backlog venía señalando: una abstracción
con un `if` especial por consumidor es peor que las copias simples que
hay hoy. No se hace.

**Decisión.**

### 1. `packages/shared/src/realtime-channel.ts` — piezas puras, sin React

`reconnectDelayMs`, `buildRealtimeSocketUrl(apiBaseUrl, path, params)`
(generaliza los 5 constructores de URL, que ya comparten forma), y
`fatalCloseReason(code, reason, knownReasons)` — **recibe el mapa como
parámetro, no lo trae adentro**: cada canal conserva su propio
`FATAL_CLOSE_REASONS` local (4 de los 5 comparten los mismos 4 valores,
`apps/parent` difiere en el 4403 — ver punto 1 del contexto). Centralizar
el mapa habría estandarizado silenciosamente ese mensaje para el único
canal donde significa algo distinto. También
`isActiveBoardStatus`/`mergeBoardMonitorDelta` — la única fusión
verdaderamente duplicada, movida junto con su predicado (hoy vive
duplicada en `apps/board` y re-declarada aparte en `apps/portal`).
`packages/shared` no tiene React como dependencia (solo `mqtt`/`typeorm`,
confirmado en `package.json`) — correcto para código que también corre
en `apps/api`/`apps/worker`, aunque estas piezas específicas hoy solo las
consume el frontend.

### 2. `packages/ui/src/hooks/useRealtimeChannel.ts` — el hook genérico, no en `packages/shared`

`packages/ui` **sí** tiene React como dependencia (confirmado en su
`package.json`) — es donde debe vivir cualquier hook, no en
`packages/shared`. Hook genérico parametrizado por:
- `buildUrl: (accessToken: string) => string`
- `fetchSnapshot: () => Promise<TState>`
- `applyDelta: (current: TState, delta: TDelta) => TState`
- `parseDelta: (raw: unknown) => TDelta | null`

Reemplaza el cuerpo del `useEffect` que hoy se repite en los 5 hooks
(`useDeliveryPointQueue`, `useInstitutionBoard`,
`useInstitutionBoardMonitor` ×2, `useTrackingPickupRequest`) — cada uno
pasa su propio `applyDelta`/`parseDelta`/tipo de estado, sin que el hook
genérico necesite saber si `TState` es un arreglo o un objeto único.

### 3. Migración en 3 pasos, no en un solo prompt

Riesgo creciente, verificado entre cada paso — las 5 pantallas ya están
en producción y verificadas, un refactor que las rompa es más caro que
el problema que resuelve:

1. **Extraer las piezas puras** (punto 1) a `packages/shared`, actualizar
   los 5 archivos `*-socket.ts` para importarlas en vez de redeclararlas
   — cambio mecánico, sin tocar ningún `useEffect`, verificable con los
   tests ya existentes sin escribir ninguno nuevo.
2. **Construir `useRealtimeChannel`** (punto 2) y migrar **un solo
   consumidor** (`useDeliveryPointQueue`, el original y el más probado) —
   probar el diseño contra el caso real más antiguo antes de tocar los
   otros 4.
3. **Migrar solo 2 de los 4 restantes** — **no los 4**, corrección hecha
   al comparar el código real de los 4 antes de escribir el prompt de
   este paso (mismo tipo de hallazgo que corrigió el punto 1 sobre
   `FATAL_CLOSE_REASONS`):
   - `useInstitutionBoardMonitor` de Carril (`apps/board`) — encaja
     limpio, misma forma que `useDeliveryPointQueue`.
   - `useTrackingPickupRequest` (`apps/parent`) — encaja limpio, y es la
     prueba real de que el hook genérico no asumió por accidente que
     `TState` siempre es una lista (aquí es un solo objeto).
   - **`useInstitutionBoard`** (tablero público, `apps/board`) **se
     queda sin migrar, a propósito**: multiplexa dos tipos de mensaje
     por el mismo socket (`kind: 'row'`/`kind: 'announce'`, ADR-073) con
     reacciones distintas — uno funde estado, el otro solo dispara un
     callback sin tocarlo. Forzarlo al contrato actual del hook
     (`parseDelta`/`mergeDelta` de una sola forma) significaría
     extenderlo con un concepto que le pertenece a este consumidor
     específico — exactamente el riesgo que el punto de la fusión ya
     evitó a nivel de función, ahora replicado un nivel más arriba.
   - **`useInstitutionBoardMonitor` del Dashboard** (`apps/portal`) **se
     queda sin migrar, a propósito**: trae un segundo sub-canal
     independiente encima (`GET /institutions/:id/delivered-today`, con
     su propio buffer y su propio corte por `asOf`, ADR-072 §6
     enmienda) — el hook genérico no tiene ningún concepto de "un
     segundo fetch con su propia lógica de espera" y no debería
     inventarlo solo para este caso.

**Consecuencias.** Cierra el ítem de backlog más señalado de todo el
proyecto — **3 de 5** instancias terminan sobre el hook genérico
(`useDeliveryPointQueue`, Carril, `apps/parent`), **2 de 5** quedan
documentadas como excepción deliberada, no como pendiente. El caso de
`apps/parent` confirma que la abstracción no se sobre-ajustó a "lista de
filas" — si el hook genérico solo hubiera funcionado para arreglos,
habría sido la señal de que la generalización estaba mal. Si en el
futuro `useInstitutionBoard`/el Dashboard necesitan evolucionar de forma
que su complejidad extra deje de justificarse, revisar si para entonces
el hook genérico puede extenderse sin ensuciarse — no es una decisión
final, es la lectura correcta con la información de hoy.

## Referencias

- ADR-050, ADR-052, ADR-064, ADR-069, ADR-071, ADR-072 (cada aparición
  del patrón, y el backlog que fue subiendo el conteo en cada una).
- `packages/shared/package.json`/`packages/ui/package.json` (confirmación
  real de qué paquete tiene React como dependencia — la base del punto 2).

## ADR-076 — `NodeMqttClient` descartaba en silencio el handler de un gateway cuando dos gateways compartían el mismo patrón de suscripción

**Contexto.** Durante la verificación en vivo del Paso 3 de ADR-075
(migrar `useTrackingPickupRequest` al canal genérico) se encontró que la
pantalla de seguimiento del tutor en `apps/parent` **nunca recibía un
solo delta en vivo por WebSocket** — cargaba el snapshot inicial
correctamente y ahí se quedaba, sin actualizarse jamás. No es un defecto
de ADR-075 ni de la migración: el bug real vive en
`packages/shared/src/adapters/node-mqtt-client.ts`, código de
infraestructura compartida sin relación con el canal WS que se estaba
migrando — apareció porque esta fue la primera vez en la sesión que se
probó con cuidado, en vivo, si el seguimiento del tutor recibía deltas
reales, no solo si cargaba.

**El bug, confirmado línea por línea contra el código anterior al fix:**

```ts
private readonly handlers = new Map<string, MessageHandler>();
// ...
async subscribe(topic: string, handler: MessageHandler): Promise<void> {
  this.handlers.set(topic, handler);
  await this.requireClient().subscribeAsync(topic);
}
```

Un solo handler por patrón de suscripción — `Map<string, MessageHandler>`,
no `Map<string, Set<MessageHandler>>`. `BoardGateway` y
`PickupRequestTrackingGateway` **suscriben al mismo patrón exacto**,
`school-pickup/institution/+/board` (confirmado: ambos declaran la misma
constante `BOARD_WILDCARD_TOPIC` con idéntico valor, ADR-064/ADR-068 — no
es una coincidencia de nombres, es el mismo wildcard, a propósito, cada
uno filtra del lado del cliente lo que le interesa). `PickupRequestTrackingModule`
se registra antes que `BoardModule` en `app.module.ts` — su `subscribe()`
corre primero durante el arranque, y cuando `BoardModule` arranca después,
su propio `subscribe()` al mismo patrón **sobrescribe** silenciosamente
la entrada del `Map`, sin ningún error, sin ningún log. El handler del
tablero público queda funcionando; el de seguimiento del tutor deja de
existir, aunque `subscribeAsync(topic)` sí se haya llamado (el broker
cree que el proceso sigue suscrito — la suscripción real al broker nunca
falló, la pérdida ocurre completamente del lado del cliente).

Una segunda falla relacionada, en el mismo método: `dispatch()` hacía
`return` apenas encontraba el primer patrón que matcheaba el topic
entrante — así que incluso en un escenario hipotético con dos patrones
*distintos* que ambos matchearan el mismo topic, solo el primero en
iteración habría recibido el mensaje. El fix corrige ambas fallas a la
vez.

**Decisión — el fix.**

1. `Map<string, Set<MessageHandler>>` en vez de
   `Map<string, MessageHandler>` — `subscribe()` agrega al `Set` en vez
   de reemplazar.
2. `dispatch()` recorre **todos** los patrones que matchean el topic
   entrante (no solo el primero) y, dentro de cada uno, llama a **todos**
   los handlers de ese patrón — el payload se parsea una sola vez (no una
   vez por handler) y se reutiliza.
3. Test de regresión nuevo que reproduce el escenario exacto: dos
   `subscribe()` al mismo patrón, un mensaje entrante, se verifica que
   **ambos** handlers reciban la llamada — con el código viejo este test
   habría fallado (solo el segundo handler se habría llamado).

**Impacto real.** El seguimiento en vivo del tutor
(`apps/parent`, ADR-064, la pantalla de "voy en camino") estuvo mostrando
únicamente el estado del momento en que se abrió la pantalla, sin
actualizarse jamás por WebSocket, desde que `BoardGateway` y
`PickupRequestTrackingGateway` coexisten en el proceso — es decir, desde
que se construyó el tablero (ADR-068), no algo introducido por esta
sesión. Ninguna verificación anterior de esta pantalla lo había atrapado
porque las verificaciones previas confirmaban que el snapshot inicial
cargaba bien, no que los deltas en vivo llegaran después — exactamente el
tipo de falla que solo aparece al probar con cuidado el comportamiento
sostenido, no solo la carga inicial.

**Consecuencias.** El fix es general — protege cualquier par futuro de
gateways que decidan compartir un patrón de suscripción, no solo este
caso puntual. Ya aplicado y verificado en vivo (Carril y seguimiento del
tutor actualizándose simultáneamente desde la misma transición real, tras
reiniciar `api`).

## Referencias

- ADR-064 (seguimiento del tutor — la pantalla afectada).
- ADR-068 (tablero público — el segundo suscriptor del mismo patrón).
- ADR-075 (el trabajo durante cuyo Paso 3 se encontró este bug, sin
  relación causal con él).
- `packages/shared/src/adapters/node-mqtt-client.ts`/`.test.ts` (el fix y
  su test de regresión).

## ADR-077 — La sesión elige rol al iniciar (Institución o Tutor), no alterna; reversión deliberada de ADR-056 puntos 2 y 4

**Contexto.** El humano señaló fricción real con el `ModeSwitcher`
persistente: aunque el caso híbrido (alguien que es personal de una
institución **y** tutor con un hijo ahí) es real y common, en la práctica
nadie necesita alternar entre las dos vistas *dentro de la misma sesión
de trabajo* — entra a hacer una cosa u otra. ADR-056 punto 2 había
decidido explícitamente lo contrario ("el humano confirmó que quiere un
switcher persistente, no una prioridad fija") — este ADR revierte esa
decisión con el mismo peso de deliberación, no la contradice por
descuido. Confirmado con el humano, dos preguntas que definen qué tan
lejos llega:

1. **No es solo cambiar el aterrizaje — las rutas de la vista no elegida
   quedan bloqueadas de verdad** hasta volver a iniciar sesión (reversión
   también de ADR-056 punto 4, que garantizaba ambas vistas alcanzables
   por URL directa sin importar el switcher).
2. **Sin escotilla para cambiar a mitad de sesión** — si hace falta la
   otra vista, se cierra sesión y se vuelve a entrar. No se construye
   ningún enlace de "cambiar de rol" dentro del shell.

**Decisión.**

### 1. Criterio de "caso híbrido" — más estricto que el que tenía el switcher

El switcher se mostraba cuando `InstitutionContext.status === 'ready'` **y**
`TutorContext.status` era `'ready'` **o** `'empty'` (ADR-056 punto 2) —
correcto para un switcher persistente, donde un tutor sin hijos todavía
merece ver la invitación a agregar el primero. Para una decisión **de una
sola vez al iniciar sesión**, ese criterio es demasiado amplio: casi
todo el personal de institución nunca ha usado el lado de tutor y tiene
cero hijos — su `TutorContext` igual resuelve `'empty'` sin error, así
que el criterio viejo les mostraría el selector sin necesidad. El criterio
correcto aquí es más estricto: **hay elección solo si hay membresía de
institución (`> 0`) Y `TutorContext.status === 'ready'`** (hijos reales
inscritos, no el estado vacío). Si el vacío no cuenta, no hay ambigüedad
real que resolver — la mayoría de las cuentas caen limpio en uno de los
dos casos sin ver nunca el selector.

### 2. Selector nuevo, dentro de `Login.tsx`, no una ruta aparte

Tras un login exitoso, `resolveLoginDestination` (que hoy devuelve
directamente un path) pasa a resolver tres casos: super-admin (sin
cambios), un solo rol real (navega directo, igual que hoy), o híbrido
(punto 1) — en el tercer caso, `Login.tsx` cambia de un estado local
`step: 'credentials' → 'choose-role'` y muestra un selector simple en el
mismo `BrandPanel`, en vez de navegar. No es una ruta nueva (`/login/...`)
para no dejar un estado intermedio alcanzable fuera de contexto por URL
directa.

### 3. `sessionRole` persistido junto al token, no en el backend

`localStorage` (mismo `tokenStorage` que ya usan los tokens), clave nueva
(`casillego.portal.sessionRole`, valor `'institution' | 'tutor'`) — **sin
cambio de backend**: la autorización real de cada endpoint la sigue dando
cada guard del lado del servidor exactamente igual que hoy (ADR-011 y
demás no cambian); este valor es puramente una decisión de qué mostrar y
qué bloquear del lado del cliente, análogo a como `activeMode` ya lo era
en ADR-056 punto 4 — solo que ahora sí actúa como guard, no solo como
preferencia de navegación. Se limpia junto con los tokens en
`AuthContext.logout()` — `discardTokens` (compartida en
`packages/shared`, usada también por `apps/parent`/`apps/board`) no se
toca, la limpieza de esta clave es una línea aparte, específica de
`apps/portal`.

**Sesión ya abierta sin esta clave** (alguien con una sesión activa desde
antes de este cambio): en vez de forzar un cierre de sesión por el
despliegue, cualquier guard que la necesite y la encuentre ausente la
resuelve al vuelo con el mismo criterio del punto 1 y la persiste en ese
momento — degradación silenciosa, no un error visible.

### 4. Compuertas de ruta — `InstitutionGate` extendida, `TutorRoleGate` nuevo

- `InstitutionGate` (ya existe) gana una verificación adicional:
  `sessionRole !== 'tutor'` antes de las que ya tiene — si no pasa,
  redirige a `STUDENTS_PATH` en vez de renderizar `<Outlet/>`.
- `TutorRoleGate` nuevo, mismo criterio invertido
  (`sessionRole !== 'institution'` → redirige a `HOME_PATH`), envuelve
  **solo** las rutas genuinamente exclusivas de tutor: `STUDENTS_PATH`,
  `NEW_STUDENT_PATH`, `ASSOCIATE_INSTITUTION_PATH`,
  `STUDENT_GUARDIANS_PATH`, `VEHICLES_PATH`.
- **`PROFILE_PATH` no se envuelve en ninguna de las dos** — confirmado en
  el código real que `Profile.tsx` no importa `useTutor` ni
  `useInstitution`: es genérico (datos personales, contraseña), aplica
  igual a cualquier sesión sin importar el rol elegido. Agruparlo bajo el
  gate de tutor solo porque comparte bloque de rutas en `App.tsx` hoy
  habría bloqueado por error al personal de institución de su propio
  perfil.

### 5. `AuthenticatedLayout` monta un solo provider, no los dos en paralelo

ADR-056 punto 3 montaba `InstitutionProvider` y `TutorProvider` siempre
juntos, sin importar la vista activa — correcto cuando ambas vistas
convivían en la misma sesión. Con el bloqueo real de rutas (punto 4), ya
no hay razón para pedir `GET /students` de fondo en una sesión que
`sessionRole` ya fijó como `'institution'` (ni `GET /institution-members/mine`
en una de `'tutor'`) — se monta solo el provider que corresponde al rol
de la sesión.

### 6. `ModeSwitcher` se elimina

Ya no hay nada que alternar dentro de una sesión — el componente y su
lógica de `activeLabel`/`canSwitch` se eliminan de
`AuthenticatedLayout.tsx`, no se dejan sin usar.

**Consecuencias.** El super-admin no se toca (`SuperAdminRoute` sigue sin
ninguno de estos dos providers, ADR-055 punto 2 — un rol ortogonal a
este, no un tercer caso de esta decisión). Alguien con cuenta híbrida que
necesite ambas vistas en la misma sesión de trabajo ya no puede — cierra
sesión y vuelve a entrar, confirmado como aceptable.

## Referencias

- ADR-042 (`InstitutionGate` original, `ProtectedRoute`).
- ADR-055 (`SuperAdminRoute`, sin cambios — rol ortogonal).
- ADR-056 (la decisión que este ADR revierte en sus puntos 2 y 4 — puntos
  1, 3, 5, 6, 7 no cambian: "tutor" se sigue derivando de datos, el
  "vacío" de `TutorContext` sigue sin bloquear *dentro* de la vista de
  tutor una vez elegida, la prioridad de aterrizaje para el caso no
  híbrido no cambia).
- `apps/portal/src/screens/Profile.tsx` (confirmado sin dependencia de
  `useTutor`/`useInstitution` — la base del punto 4).

## ADR-078 — El rol de tutor se muda por completo a `apps/parent`; el portal queda exclusivo de institución

**Contexto.** Al empezar a diseñar el shell compartido para la vista de
tutor dentro de `apps/portal` (continuación natural de ADR-072/074) se
encontró que el kit real (`design/casillego-design-system/ui_kits/app-padre/`)
**ya define esta pantalla — pero como parte de `apps/parent`, no del
portal**. El README del kit lo dice explícito: dos superficies, "App
móvil" (PWA, el flujo de recogida ya construido) y **"Portal web"**
(versión de escritorio del tutor: Mis hijos, Asociar institución,
Tutores autorizados, Perfil) — nunca se pensó como parte del portal de
institución. Las 5 pantallas de tutor que hoy viven en `apps/portal`
(Fase 7) se construyeron sin haber visto este kit, con una arquitectura
de información distinta a la real (rutas parametrizadas por alumno,
`/students/:id/...`, en vez de un selector de alumno en memoria dentro de
una sola vista).

Confirmado con el humano: la mudanza es completa. El portal deja de
servir cuentas de tutor por completo — no las redirige, no les muestra
nada propio. Esto revierte buena parte de ADR-077 (recién cerrado): el
selector híbrido, `TutorContext`, `TutorRoleGate` y el propio concepto de
`sessionRole` dejan de tener sentido cuando el portal solo tiene un rol.

**Mapa de reutilización — confirmado contra el backend real, no
asumido**: **cero endpoints nuevos**. Las 4 vistas del kit se resuelven
íntegramente con contratos que ya existen:

| Vista | Endpoint(s) |
|---|---|
| Mis hijos | `GET /students` + `GET /enrollments/mine` (ya enriquecido, ADR-057) |
| Asociar institución | `GET /institutions?search=` (ADR-037) + `POST /enrollments` |
| Tutores autorizados | `GET /students/:id/guardians` + `POST /students/:id/guardians/invite` + `PATCH /student-guardians/:id` |
| Perfil — cuenta/contraseña | `GET/PATCH /users/me` + `POST /users/me/change-password` (ADR-059) |
| Perfil — notificaciones | Mismo `PATCH /users/me`, 3 de los 4 booleanos ya existentes |
| Perfil — vehículos | `GET/POST/PATCH/DELETE /vehicles` |

Todo el trabajo de esta mudanza es frontend.

**Decisión.**

### 1. `apps/portal` queda exclusivo de institución — sin ruta de tutor alguna

Se eliminan de `apps/portal`: las 5 rutas/pantallas de tutor
(`STUDENTS_PATH`, `NEW_STUDENT_PATH`, `ASSOCIATE_INSTITUTION_PATH`,
`STUDENT_GUARDIANS_PATH`, `VEHICLES_PATH`), `TutorContext`/`TutorProvider`,
`TutorRoleGate`, `session-role.ts`, y la rama `choose-role`/el paso de
selector de `Login.tsx` (ADR-077 puntos 2-3). `AuthenticatedLayout` vuelve
a montar un solo `InstitutionProvider`, sin ninguna rama por rol —
`InstitutionGate` pierde la verificación de `sessionRole` que ADR-077
punto 4 le agregó (ya no hace falta distinguir nada, solo hay un rol).

`resolveLoginOutcome`/`Login.tsx` se simplifican a 3 casos: super-admin →
igual que hoy; cuenta con membresía de institución → `HOME_PATH`; cuenta
sin membresía → **no navega a ningún lado dentro del portal** — muestra
un estado informativo ("Esta cuenta no tiene acceso al portal de
instituciones — usa la app CasiLlego para continuar", sin nombrar
"tutor" explícitamente, ya que también cubre una cuenta sin ningún rol
todavía). No es un error, mismo criterio que el resto del proyecto usa
para "no tienes acceso a esto" (ej. "No perteneces a ninguna
institución", ADR-042 punto 5) — nunca alarmar, siempre explicar.

**Sin cambio de backend** — el login sigue autenticando cualquier cuenta
válida sin importar su rol (`apps/parent` usa el mismo mecanismo de auth);
esto es una decisión de enrutamiento del frontend del portal, no una
restricción nueva del servidor.

### 2. `Profile.tsx` del portal se recorta, no se elimina

Sigue existiendo para el personal de institución (`fullName`, `phone`,
cambio de contraseña) — pierde los 3 toggles de notificación específicos
de tutor (`notifyEnrollmentApproved`/`notifyDismissalReminder`/
`notifyDeliveryConfirmed`), que ahora solo tienen sentido dentro de
`apps/parent`, donde de verdad hay hijos que recoger.

### 3. `apps/parent` gana una segunda superficie: "Portal web"

Nuevo `TutorShell` dentro de `apps/parent`, calco visual de
`InstitutionShell`/`OpsShell` (250px, `var(--ink-900)`, mismo patrón de
ítem activo) — confirmado que el kit real usa exactamente esos valores,
no una improvisación. 4 ítems: Mis hijos, Asociar institución, Tutores
autorizados, Perfil (vehículos y notificaciones viven dentro de Perfil,
no como ítems propios — así lo define el kit, no las 5 rutas actuales
del portal).

**Arquitectura de información nueva, distinta a lo que existe hoy en el
portal**: "Asociar institución" y "Tutores autorizados" comparten una
sola vista con un selector de alumno en memoria (pestañas arriba, mismo
patrón que ya usa "Mostrando N de M" en otras pantallas de esta sesión —
estado de cliente, no parámetro de ruta) en vez de las rutas
`/students/:id/...` actuales. El backend sigue pidiendo por `studentId`
internamente (punto del mapa de reutilización) — lo que cambia es de
dónde sale ese id: de un párametro de URL a una selección en memoria.

**Es la primera pantalla de todo el proyecto que necesita ser
responsive** — confirmado, ningún frontend existente tiene hoy manejo de
breakpoints (`matchMedia`/`@media`/`innerWidth`, cero resultados en todo
el repo). `InstitutionShell`/`OpsShell` nunca lo necesitaron porque son
herramientas de escritorio sin expectativa de uso en teléfono. En
pantalla angosta, la sidebar de 250px colapsa a un menú compacto
(hamburguesa o barra inferior, decisión de implementación libre, sin
mockup del kit que lo defina) — las 4 vistas de contenido deben verse
bien en cualquier ancho, confirmado con el humano.

### 4. Selector de superficie: por ancho de pantalla al aterrizar, persistente por sesión, con salida deliberada en ambas direcciones

Confirmado con el humano, con la precisión que agregué y él no objetó:

1. **Al aterrizar** (primera carga de la sesión, no cada render): ancho
   ≥768px → Portal web directo; <768px → App móvil directo. 768px porque
   separa razonablemente teléfono de tablet-vertical-para-arriba/laptop —
   ajustable si se siente mal en el uso real, no es un valor con
   significado especial más allá de eso.
2. **La elección se guarda en `sessionStorage`, no `localStorage`** —
   deliberado: si alguien entra a Portal web desde el celular por el
   ícono de ajustes, un refresh de página no debe regresarlo a App móvil
   (lo que pidió el humano) — pero una apertura genuinamente nueva de la
   PWA (`sessionStorage` se limpia al cerrar la pestaña/app) sí vuelve a
   evaluar el ancho desde cero, en vez de recordar para siempre una
   preferencia declarada una sola vez hace semanas.
3. **Camino de ida y vuelta**: un ícono de ajustes discreto en "Inicio"
   (App móvil) navega a Portal web. `TutorShell` lleva un enlace de
   regreso a "App móvil" (ubicación exacta: decisión de implementación,
   cerca del pie de cuenta de la sidebar es lo más consistente con el
   resto del shell).

**Consecuencias.** Cierra el ciclo de alineación del design system para
los 3 roles del portal (Institución, Operador, y ahora ninguno de tutor —
se fue del portal en vez de alinearse dentro de él) más una superficie
nueva en `apps/parent`. Primera vez que el proyecto necesita diseño
responsive real, no solo un layout fijo de escritorio o uno fijo de
teléfono.

## Referencias

- ADR-037 (`GET /institutions?search=`, reutilizado sin cambios).
- ADR-057 (`GET /enrollments/mine` enriquecido, reutilizado sin cambios).
- ADR-059 (`GET/PATCH /users/me`, `POST /users/me/change-password` —
  fuente de los 3 toggles y los datos de cuenta, reutilizados sin
  cambios).
- ADR-072/074 (`InstitutionShell`/`OpsShell`, el patrón visual que
  `TutorShell` replica por tercera vez, ahora en una app distinta).
- ADR-077 (la decisión que este ADR revierte parcialmente — puntos 1
  (criterio de caso híbrido) y 3 (mecanismo de persistencia junto al
  token) quedan sin uso; el propio concepto de sesión de un solo rol
  pierde sentido cuando ya no hay dos roles que elegir dentro del
  portal).
- `design/casillego-design-system/ui_kits/app-padre/index.html`,
  función `TutorPortal()` (fuente visual completa de este ADR — leída
  íntegra, no solo el README).

## ADR-079 — "Cerrar sesión" visible en los 3 shells, no solo alcanzable por URL

**Contexto.** Tercer punto de fricción señalado por el humano: no hay
forma de cerrar sesión desde `InstitutionShell`. Confirmado en el código
real: la función existe y funciona (`apps/portal/src/screens/Profile.tsx`,
botón "Cerrar sesión" ya construido) — el problema es que `PROFILE_PATH`
nunca aparece en la navegación de `InstitutionShell` ni de `OpsShell`,
solo alcanzable escribiendo `/profile` directo. `TutorShell`
(`apps/parent`, ADR-078) sí tiene "Perfil" como ítem de navegación, pero
ningún botón de cerrar sesión en el shell mismo.

**Decisión.**

1. **"Perfil"/"Cerrar sesión" no se agregan a la lista principal de
   navegación de `InstitutionShell`/`OpsShell`** — esos ítems son
   secciones de la institución/operación, personal de institución
   navegando ahí espera ver Aprobaciones/Reportes/etc., no configuración
   de su propia cuenta. Se agregan como dos enlaces chicos, siempre
   visibles, debajo del bloque de avatar+nombre+rol que el pie de la
   sidebar ya tiene — mismo criterio visual discreto que el resto del pie
   (`rgba(255,255,255,.5-.6)`), sin menú desplegable ni popover: el
   proyecto no tiene ese patrón en ningún lado todavía y dos enlaces de
   texto siempre visibles son más simples y no necesitan lógica de
   cerrar-al-hacer-clic-afuera.
2. **`TutorShell` ya tiene "Perfil" en la nav principal** (correcto ahí —
   para un tutor, gestionar su propia cuenta *es* una de las tareas
   primarias del portal, a diferencia del personal de institución) — solo
   se agrega "Cerrar sesión" al mismo pie, mismo criterio visual.
3. El botón de cerrar sesión que ya existe dentro de
   `Profile.tsx`/`PortalProfile.tsx` **se conserva** — tener el acceso en
   dos lugares (pie del shell + dentro de la pantalla de perfil) no es
   redundante de forma dañina, es un patrón común.

**Consecuencias.** Cierra el tercer y último punto de fricción señalado
por el humano en esta ronda. Los 3 shells del proyecto (Institución,
Operador, Tutor) quedan con el mismo patrón de pie de cuenta.

## Referencias

- ADR-072/074/078 (los 3 shells que este ADR completa).
- `apps/portal/src/screens/Profile.tsx` (el botón de cerrar sesión ya
  existente, confirmado funcional, solo sin ruta de acceso desde la
  sidebar).

## ADR-080 — Construir el flujo de registro/verificación de `ui_kits/acceso`, deferido desde ADR-043

**Contexto.** Al auditar qué tan bien integrados están los 5 kits del
design system contra las 3 apps (el humano preguntó específicamente por
esto) se confirmó un hueco real: `ui_kits/acceso` describe un flujo
completo — Entrar → "Crear cuenta" → elegir tipo (Escuela/Tutor) →
formulario de alta — del que hoy solo existe el "Entrar". ADR-043 punto 4
ya documentó esto en su momento, explícitamente como plomería temporal:
*"se renderiza deshabilitado hasta que se construyan [las pantallas]"* —
nunca se construyeron. Confirmado en el código: `POST /auth/register/institution`
y `POST /auth/register/guardian` existen y funcionan, cero frontend los
llama. `apps/portal` conserva el enlace inerte con su comentario original;
`apps/parent` ni siquiera tiene eso.

Investigar el alcance real reveló dos cosas más, no visibles desde el
kit:

1. **El formulario de "Escuela" del kit está incompleto respecto al DTO
   real.** `RegisterInstitutionDto` exige `address`, `location.lat/lng`,
   `timezone`, `institution.type` — el kit solo pide nombre, responsable,
   correo, teléfono, contraseña. No es un caso de "el kit no lo pide, no
   se construye" (como el botón de incidencia, ADR-034) — es un caso de
   "el mockup simplificó un formulario que el backend exige completo", el
   mismo tipo de vacío que ya apareció varias veces esta sesión (ej. el
   Dashboard institucional, ADR-072).
2. **El registro no completa el ciclo sin verificación de correo.**
   `RegisterInstitutionResponse`/`RegisterGuardianResponse` no devuelven
   tokens — el `users` creado queda en `status = invited`
   (`specs/features/007-verificacion-correo.md`), y `POST /auth/verify-email`
   ya existe, pero ninguna pantalla de ningún frontend lee el token del
   link que llega por correo. Construir el registro sin esto dejaría a
   cualquiera que se registre atascado sin forma de activar su cuenta —
   se aborda en el mismo ADR, son la misma pieza de producto.

**Decisión.**

### 1. Campos adicionales del formulario de institución — reutiliza `GeofenceMap`, con defaults sin editar en este paso

`apps/portal/src/screens/InstitutionProfile.tsx` ya resuelve
dirección+ubicación con `GeofenceMap` (`@casillego/ui`, ADR-048) — se
reutiliza tal cual para el paso "Escuela" del registro, **sin exponer
edición de los radios de geocerca/activación en este formulario**: se
envían los defaults de columna (`geofence_radius_meters` 100,
`activation_radius_meters` 3000 — confirmado en
`packages/shared/src/entities/institution.entity.ts`), editables después
desde el perfil de institución una vez aprobada, no antes de que exista
la cuenta. Un selector simple de `type` (`school`/`extracurricular`,
radio o segmented control) se agrega al formulario — el kit no lo dibuja
porque su chooser de "Escuela o institución" no distingue el
subtipo, pero el DTO lo exige.

`timezone` se auto-detecta con
`Intl.DateTimeFormat().resolvedOptions().timeZone` del navegador — sin
pedírselo a quien se registra, editable después igual que los radios si
hace falta corregirlo.

### 2. Estructura de pantallas — calco del `Access()` del kit, dentro de `Login.tsx`

Mismo criterio que el selector de rol de ADR-077: estado local dentro del
componente de login existente (`step: 'login' | 'choose' | 'escuela' | 'tutor'`
en `apps/portal`; `apps/parent` solo necesita `'login' | 'tutor'`, no
tiene noción de institución), no rutas nuevas — evita un estado
intermedio alcanzable por URL fuera de contexto, mismo razonamiento que
ya se usó para el selector híbrido.

### 3. Verificación de correo — pantalla nueva, una por app

Ruta nueva en cada app (`/verify-email` o similar, decide el nombre
exacto consistente con el resto de `paths.ts`) que lee `?token=` de la
URL, llama `POST /auth/verify-email`, muestra éxito (con enlace a
login) o error (token expirado/inválido, con acceso a
`POST /auth/resend-verification` — ya tiene su propio throttling del
lado del servidor, 3 por hora, cooldown de 60s entre solicitudes,
`specs/features/007`, no se reinventa nada de eso en el cliente).

### 4. Tras un registro exitoso: mensaje, no auto-login

Ninguna respuesta de registro trae tokens — el flujo correcto es mostrar
un mensaje claro ("Revisa tu correo para activar tu cuenta") y volver a
`step: 'login'`, no intentar iniciar sesión automáticamente.

### 5. Secuencia de implementación — tutor primero, institución después

El registro de tutor es sustancialmente más simple (sin mapa, sin
selector de tipo) — se construye primero en `apps/parent` junto con la
pantalla de verificación de esa app, sirviendo de prueba del patrón antes
de abordar el formulario de institución en `apps/portal`, que sí necesita
`GeofenceMap` y tiene más campos.

**Consecuencias.** Cierra un hueco que estuvo documentado como diferido
desde ADR-043 sin que nadie volviera a él — la plataforma queda con alta
de cuenta funcional en los dos frentes, no solo login para cuentas ya
creadas por otro medio.

## Referencias

- ADR-019 (autogeneración de `join_code`, token de verificación firmado
  sin persistencia).
- ADR-028 punto 2 (reutilización de `users` existente si la contraseña
  coincide — caso de error a manejar en el formulario de institución si
  el correo del admin ya existe).
- ADR-043 punto 4 (la decisión original que dejó esto deshabilitado a
  propósito, citada aquí para no repetir la misma reflexión).
- ADR-048 (`GeofenceMap`, reutilizado sin cambios).
- ADR-077 (patrón de estado-dentro-del-componente-de-login que este ADR
  replica para el selector de tipo de cuenta).
- `specs/features/001-registro-institucion.md`,
  `002-registro-tutor.md`, `007-verificacion-correo.md`.
- `design/casillego-design-system/ui_kits/acceso/index.html` (fuente
  visual completa, leída íntegra).

## ADR-081 — `BrandPanel` compartido; `apps/parent` se alinea al mismo tratamiento de `ui_kits/acceso` que ya tiene `apps/portal`

**Contexto.** Señalado durante el trabajo de ADR-080: `apps/portal/src/screens/Login.tsx`
ya coincide con `ui_kits/acceso` (panel de marca de 470px + formulario a
1180px de ancho total) porque se construyó así desde el principio —
`apps/parent/src/screens/Login.tsx` nunca lo tuvo, es una tarjeta
centrada simple. `VerifyEmail.tsx` de `apps/parent` (ADR-080) se construyó
sobre ese mismo estilo simple, heredando el mismo desvío. El kit es
explícito: *"Compartido por los 3 roles"* — un solo `BrandPanel()`, sin
variación de copy por rol.

**Decisión.**

1. **`BrandPanel` se promueve de `apps/portal` a `packages/ui`** — a
   diferencia de casi todo lo demás duplicado esta sesión (5 canales WS,
   `asApiError` ×17, etc.), aquí no hay divergencia real que justifique
   mantenerlo separado: es el mismo componente, el mismo copy, para los 2
   consumidores. `packages/ui/src/assets/pin-mark-inverse.svg` ya existe
   sin ningún consumidor — confirma que se anticipó este movimiento en
   algún punto anterior de la sesión, sin haberse completado.
   `apps/portal/src/screens/Login.tsx` pasa a importar desde
   `@casillego/ui` en vez de su copia local — cambio mecánico, sin
   modificar su comportamiento.
2. **`apps/parent/src/screens/Login.tsx` se reconstruye al layout de
   1180px + `BrandPanel`** — mismo criterio estructural que
   `apps/portal`'s Login.tsx ya prueba en producción (3 estados ahí,
   2 aquí: `'login'`/`'tutor'`, sin `'choose'`/`'escuela'`, que son
   exclusivos de institución). Se usa como referencia directa, no se
   reinventa el patrón.
3. **`apps/parent/src/screens/VerifyEmail.tsx` recibe el mismo
   tratamiento** — mismo panel, mismo ancho.
4. **Sin cambios de comportamiento** — es una alineación puramente
   visual. Ningún endpoint, ninguna validación, ningún estado cambia.

**Consecuencias.** Cierra el último desvío visual conocido del kit
`acceso`. Con esto, los 5 kits del design system quedan correctamente
integrados en las 3 apps, confirmado exhaustivamente a lo largo de esta
sesión.

## Referencias

- ADR-043 punto 4 (primera vez que se documentó el estado de
  `ui_kits/acceso` en el proyecto).
- ADR-080 (registro/verificación — el trabajo que expuso este desvío).
- `apps/portal/src/screens/BrandPanel.tsx` (el componente a promover,
  ya fiel al kit desde su construcción original).

## ADR-082 — Aceptar invitación, alta de alumno, y dos bugs reales de enrutamiento de correo

**Contexto.** El humano pidió una verificación real del estado de la
plataforma, no solo documental — cruzar cada endpoint que muta datos
contra si algún frontend lo consume. De 39 endpoints reales, 2 quedaron
completamente huérfanos, y al investigar el primero aparecieron dos bugs
de enrutamiento adicionales, uno introducido en esta misma sesión
(ADR-080) y uno preexistente que ADR-080 dejó expuesto sin que nadie lo
notara.

**Hallazgo 1 — Aceptar invitación no existe en ningún frontend.**
`POST /invitations/:token/accept` funciona y maneja los dos casos
(`institution_member_invitation`/`student_guardian_invitation`) — cero
frontend lo llama, confirmado con una búsqueda amplia en los dos apps.
Sin esto, ninguna invitación enviada (Personal, Tutores autorizados)
puede completarse — el link que recibe la persona invitada no lleva a
ninguna pantalla real.

**Hallazgo 2 — Alta de alumno no existe en ningún frontend.**
`POST /students` funciona, cero frontend lo llama. Ya estaba
parcialmente anotado (`PortalStudents.tsx`, ADR-078 Paso 2, omitido a
propósito por falta de ruta) pero nunca se retomó. Confirmado con las
propias palabras del producto: el estado vacío de `Home.tsx` (móvil) dice
*"Da de alta a tu primer alumno desde el portal web"*, y el estado vacío
del propio Portal web dice lo mismo, sin ningún botón — un loop cerrado
sin salida.

**Hallazgo 3 — `VERIFY_EMAIL_PATH` no coincide con el link real que
manda el backend (bug introducido en ADR-080).** Las dos apps
construyeron `/verify-email`; `apps/api/src/email/email-templates.ts`
arma el link real como `/verificar-correo` — confirmado leyendo el
archivo completo, no una sola línea. Ninguna verificación de esta sesión
lo atrapó porque todas usaron un JWT firmado a mano para saltarse el
correo real, nunca el link tal cual el backend lo construye.

**Hallazgo 4 — el correo de verificación siempre manda a
`PARENT_APP_URL`, sin importar si quien se registra es tutor o
institución (bug preexistente, expuesto por ADR-080).**
`registerInstitution`, `registerGuardian` y `resendVerification` — los 3
disparan el mismo `kind: 'email_verification'` genérico
(`apps/api/src/auth/auth.service.ts`, confirmado en las 3 líneas), y la
plantilla (`email-templates.ts`) no distingue: siempre `PARENT_APP_URL`.
Esto significa que la pantalla de verificación que ADR-080 construyó en
`apps/portal` **nunca sería alcanzable por un correo real** — un admin de
institución que se registre recibe un link que lo manda a `apps/parent`,
no de vuelta al portal donde necesita entrar.

**Decisión.**

### 1. Corregir el path — mecánico, en las dos apps

`VERIFY_EMAIL_PATH` pasa de `/verify-email` a `/verificar-correo` en
`apps/portal/src/routes/paths.ts` y `apps/parent/src/routes/paths.ts` —
coincide con lo que el backend ya construye, sin tocar el backend.

### 2. `EmailMessage` gana un campo `audience` para `email_verification`

```ts
| { kind: 'email_verification'; to: string; token: string; audience: 'portal' | 'parent' }
```

(`packages/shared/src/ports/email-provider.ts`). `email-templates.ts`
usa `message.audience` para elegir `PORTAL_APP_URL`/`PARENT_APP_URL` en
vez de asumir siempre `PARENT_APP_URL`.

- `registerInstitution`/`registerGuardian` (`auth.service.ts`) ya saben
  su propio contexto — pasan `audience: 'portal'`/`'parent'`
  directamente, sin consulta nueva.
- `resendVerification` no lo sabe de antemano (solo tiene un correo) —
  resuelve con una consulta liviana:
  `dataSource.getRepository(InstitutionMember).exists({ where: { user: { id: user.id } } })`
  → `'portal'` si es verdadero, `'parent'` si no. `InstitutionMember` no
  está inyectado hoy en `AuthService` — usa `this.dataSource.getRepository(...)`
  en vez de agregar una inyección nueva al constructor, mismo criterio
  que ya usa `registerInstitution` internamente para sus repos
  transaccionales.

### 3. "Aceptar invitación" — pantalla nueva, una por app, mismo patrón que `VerifyEmail`

Ruta `/aceptar-invitacion` en las dos apps (coincide con el link real del
backend, confirmado en `email-templates.ts` — ambos casos usan el mismo
path, solo cambia el dominio base). Lee `?token=`, formulario mínimo
(nombre completo, contraseña — ambos opcionales según
`AcceptInvitationDto`, pero en la práctica siempre se piden para
completar el alta de la cuenta), llama
`POST /invitations/:token/accept`. El backend decide qué tipo de
invitación es a partir del token — el frontend no necesita saberlo de
antemano, ni bifurcar su formulario por tipo.

Éxito → mensaje de confirmación + enlace a login (mismo patrón de
`VerifyEmail`, sin auto-login — la respuesta no trae tokens). Errores:
`INVITATION_TOKEN_EXPIRED` (410), `INVALID_INVITATION_TOKEN` (400) —
mapear ambos, mismo criterio que `verifyEmailErrorMessage` ya establece.

### 4. "Agregar alumno" — pantalla nueva en `apps/parent`

Formulario simple (`POST /students`) dentro del Portal web —
`PortalStudents.tsx` gana de vuelta el botón "Agregar alumno" que se
omitió a propósito en ADR-078 Paso 2, ahora conectado a una ruta real.
Revisa el DTO real (`CreateStudentDto` o el nombre que tenga) antes de
asumir sus campos.

**Consecuencias.** Cierra los dos huecos críticos confirmados por la
verificación completa de la plataforma, más dos bugs de enrutamiento de
correo que habrían pasado desapercibidos hasta el primer registro real
fuera de un entorno de pruebas con atajos. Con esto, los 39 endpoints
mutantes del backend quedan con al menos un consumidor real en algún
frontend.

## Referencias

- ADR-013/016 (`specs/features/013-aceptar-invitacion-personal.md`,
  `016-aceptar-invitacion-tutor.md` — las features que Hallazgo 1 deja
  sin cerrar hasta este ADR).
- `specs/features/004-alta-alumno.md` (Hallazgo 2).
- ADR-078 Paso 2 (la omisión original de "Agregar alumno", documentada
  ahí, retomada aquí).
- ADR-080 (el trabajo que introdujo el Hallazgo 3 y expuso el Hallazgo 4
  sin que nadie lo notara en su momento).
- `apps/api/src/email/email-templates.ts` (fuente de verdad de los paths
  reales — leída completa, no una sola línea, antes de este ADR).

## ADR-083 — Alumnos sin grupo configurado: punto de entrega atrapa-todo, asignación al aprobar, y pantalla de edición post-aprobación

**Contexto.** Durante pruebas manuales del tablero tras el cierre de
ADR-082 (verificación de los 39 endpoints mutantes), el humano encontró
filas de `pickup_requests` sin punto de entrega asignado al filtrar por
una puerta específica. La causa está confirmada en código real:

- `apps/api/src/pickups/pickups.service.ts`, `resolveDeliveryPointId()`:
  si `enrollment.gradeOrGroup` es `null`, devuelve `null` sin buscar
  coincidencia — el `pickup_request` nunca tiene punto de entrega. El
  mismo resultado ocurre si `gradeOrGroup` tiene valor pero ningún punto
  de entrega activo lo tiene en `assigned_groups` (typo, o el punto se
  reconfiguró y dejó de cubrir ese grupo).
- `apps/board/src/screens/Home.tsx` (líneas 269-278): el filtro
  `row.deliveryPointId === selectedDeliveryPointId` esconde esas filas
  fuera de "Todos" — confirmado que el tablero no tiene lógica propia
  aquí, es un efecto secundario directo del bug de arriba.
- No existe ningún endpoint que permita asignar o corregir
  `gradeOrGroup` después de crear la inscripción (`approve()`/`reject()`
  no reciben `@Body()`).

Evaluando casos de uso reales, el humano identificó dos observaciones
que cambian el diagnóstico original:

1. **No todas las instituciones tienen grupos** (ej. una escuela de
   taekwondo con un solo punto de entrega). Forzar a asignar un grupo
   inventado solo para que el matching funcione es una solución
   equivocada — de hecho el propio ADR-012 ya declaraba como consecuencia
   que "instituciones con un solo punto de entrega no necesitan asignar
   grupos", pero `resolveDeliveryPointId()` nunca implementó ese caso.
   Es una omisión contra la propia especificación del proyecto, no un
   caso nuevo.
2. **El texto libre de `assigned_groups`/`grade_or_group` es frágil ante
   mantenimiento real**: si una institución reconfigura un punto de
   entrega (ej. deja de cubrir "1A" y pasa a cubrir "2A"), cualquier
   matrícula con `grade_or_group = "1A"` deja de matchear en silencio,
   sin aviso. Confirmado que hoy no existe ningún mecanismo que lo
   detecte.

La observación 2 (catálogo de grupos como entidad propia, con FK en vez
de texto libre) es un cambio de modelo de datos real que toca dos
entidades y revisita ADR-012 — se separa a **ADR-084** (pendiente,
`docs/plan-implementacion.md`), fuera de alcance de este ADR.

**Decisión.**

### 1. `resolveDeliveryPointId()` — matching en dos pasos, con atrapa-todo

```ts
private async resolveDeliveryPointId(enrollment: Enrollment): Promise<string | null> {
  const activePoints = await this.deliveryPointsRepository.find({
    where: { institution: { id: enrollment.institutionId }, status: 'active' },
    order: { createdAt: 'ASC' },
  });

  if (enrollment.gradeOrGroup) {
    const exactMatch = activePoints.find((point) =>
      (point.assignedGroups ?? []).includes(enrollment.gradeOrGroup as string),
    );
    if (exactMatch) return exactMatch.id;
  }

  // Atrapa-todo: cubre tanto al alumno sin grupo (gradeOrGroup === null)
  // como al que tiene un grupo que no está configurado en ningún punto
  // activo (typo, o reconfiguración que dejó huérfano al grupo). Único
  // por construcción — DeliveryPointsService lo garantiza al crear/editar
  // (punto 3 de este ADR), así que no hay ambigüedad de cuál usar.
  const catchAll = activePoints.find(
    (point) => !point.assignedGroups || point.assignedGroups.length === 0,
  );
  return catchAll?.id ?? null;
}
```

Reemplaza el `createQueryBuilder` actual — se resuelve en memoria sobre
la lista ya cargada de puntos activos en vez de dos queries separadas,
porque el segundo paso (atrapa-todo) necesita la misma lista que el
primero. El comentario existente sobre "no hay prioridad de negocio
entre puntos que se solapan en el mismo grupo" deja de aplicar: el punto
3 de este ADR hace que ese solape sea imposible por construcción, así
que el único `orderBy('createdAt', 'ASC')` que sobrevive es el que
ordena la carga inicial (irrelevante para el resultado, ya no hay
empate posible).

Consecuencia directa en el tablero, sin tocar `apps/board`: una vez que
`pickup_requests.delivery_point_id` apunta al atrapa-todo real, la fila
ya no es `null` — `Home.tsx` la muestra igual que cualquier otra al
filtrar por ese punto específico, porque el filtro es una simple
igualdad de `id`. Cubre exactamente lo que pediste: todo alumno sin
grupo, o con un grupo que no está configurado en ningún otro punto,
aparece en el punto atrapa-todo.

### 2. `gradeOrGroup` opcional en `PATCH /enrollments/:id/approve`

Nuevo DTO, mismo criterio que `CreateEnrollmentDto` (texto libre,
`@IsOptional`):

```ts
// apps/api/src/enrollments/dto/approve-enrollment.dto.ts
export class ApproveEnrollmentDto {
  @IsOptional()
  @IsString()
  gradeOrGroup?: string | null;
}
```

`EnrollmentsDetailController.approve()` gana `@Body() dto:
ApproveEnrollmentDto`. `EnrollmentsService.approve()` gana un tercer
parámetro; si viene definido, se asigna a `enrollment.gradeOrGroup`
antes del `save()`, dentro de la misma transacción que ya escribe
`status`/`reviewedBy`/`reviewedAt`. No toca `reject()`.

Sigue siendo útil pese al punto 1: instituciones que sí tienen grupos
reales quieren poder asignarlos al aprobar, no solo depender del
atrapa-todo.

### 3. Validación nueva en `DeliveryPointsService` — sin ella, el punto 1 sería ambiguo

Capa de servicio, no FK/trigger (mismo criterio que la validación
cruzada de `operatorUserId`, spec 009 + ADR-017):

```ts
const DUPLICATE_CATCH_ALL_DELIVERY_POINT = {
  code: 'DUPLICATE_CATCH_ALL_DELIVERY_POINT',
  message: 'Another active delivery point of this institution already has no assigned groups.',
} as const;

const DUPLICATE_ASSIGNED_GROUP = {
  code: 'DUPLICATE_ASSIGNED_GROUP',
  message: 'One or more groups are already assigned to another active delivery point.',
} as const;

private async assertNoGroupConflicts(
  institutionId: string,
  candidateGroups: string[] | null | undefined,
  excludeId?: string,
): Promise<void> {
  const others = await this.deliveryPointsRepository.find({
    where: { institution: { id: institutionId }, status: 'active' },
  });
  const otherActive = others.filter((point) => point.id !== excludeId);

  const groups = candidateGroups ?? [];
  if (groups.length === 0) {
    const hasOtherCatchAll = otherActive.some(
      (point) => !point.assignedGroups || point.assignedGroups.length === 0,
    );
    if (hasOtherCatchAll) throw new UnprocessableEntityException(DUPLICATE_CATCH_ALL_DELIVERY_POINT);
    return;
  }

  const taken = new Set(otherActive.flatMap((point) => point.assignedGroups ?? []));
  if (groups.some((group) => taken.has(group))) {
    throw new UnprocessableEntityException(DUPLICATE_ASSIGNED_GROUP);
  }
}
```

- `create()`: siempre corre (el punto siempre nace `active`).
- `update()`: corre cuando el estado **final** del punto (tras aplicar el
  DTO) es `active` — cubre tanto editar `assignedGroups` de un punto ya
  activo como reactivar uno que estaba `inactive` (podría chocar con lo
  que se configuró en otro punto mientras estuvo apagado). Puntos
  `inactive` quedan fuera del chequeo, igual que ya quedan fuera del
  pool de ruteo en `resolveDeliveryPointId`.
- Dos códigos nuevos en `SAVE_MESSAGES`
  (`apps/portal/src/delivery-points/delivery-point-error-messages.ts`),
  mismo mapa que ya traduce `OPERATOR_NOT_INSTITUTION_MEMBER` — sin
  cambio de UI más allá del mensaje, se muestra con el `Alert` que
  `DeliveryPoints.tsx` ya tiene.

Sin migración: valida sobre columnas que ya existen (`assigned_groups`,
`status`).

### 4. Pantalla nueva en `apps/portal`: "Alumnos" — buscar y editar matrículas `approved`

Ruta nueva `ALUMNOS_PATH = '/students'`, entrada nueva en el `NAV` de
`InstitutionShell.tsx` (8 items, ícono `'student'` nuevo en `icons.tsx`
— SVG propio, sin librería, ADR-036).

`useApprovedEnrollments(institutionId)` (nuevo hook,
`apps/portal/src/enrollments/`, mismo esqueleto que
`usePendingEnrollments.ts`): `GET /enrollments?status=approved&institutionId=...`
— ya soportado por `ListInstitutionEnrollmentsQueryDto`, sin cambio de
backend en el listado. Búsqueda por nombre en cliente (sin parámetro
nuevo en el DTO — sin evidencia de volumen que lo justifique, mismo
criterio que otros ítems del backlog técnico).

Endpoint nuevo dedicado a la edición, separado de `approve()` a
propósito: `approve()` exige `status = pending` y reenvía el correo de
aprobación en cada llamada — reusarlo para corregir una matrícula ya
aprobada dispararía un correo falso.

```ts
// PATCH /enrollments/:id/grade
export class UpdateEnrollmentGradeDto {
  @IsOptional()
  @IsString()
  gradeOrGroup?: string | null;
}
```

Mismo guard que `approve`/`reject`
(`InstitutionMembershipGuard` + `@InstitutionResource` + `assertAdmin`).
`EnrollmentsService.updateGrade(id, actorUserId, gradeOrGroup)` exige
`status = approved` (nuevo código `ENROLLMENT_NOT_APPROVED`, 409, mismo
patrón que `ENROLLMENT_NOT_PENDING`) y devuelve
`InstitutionEnrollmentListItem` (reusa `toInstitutionResponse()`). No
escribe `AuditLog` — es corrección de dato operativo, no una decisión de
control de acceso como aprobar/rechazar/invitar; si la revisión de
cobertura de `audit_log` ya prevista en Fase 10 concluye lo contrario, se
agrega ahí.

Cada fila: nombre, `gradeOrGroup` actual (o "Sin grupo"), campo de texto
libre editable — mismo criterio ADR-012, sin `<select>` nuevo. Solo
`role = admin` edita, mismo patrón `canReview`/`NOT_ADMIN_REASON` que
`PendingEnrollments.tsx`.

**Consecuencias.**
- Cierra el hueco operativo real sin forzar a instituciones sin grupos a
  inventar uno. El tablero muestra correctamente a estos alumnos en el
  punto atrapa-todo, sin ningún cambio en `apps/board`.
- Las dos validaciones nuevas de `DeliveryPointsService` son las que
  hacen que el atrapa-todo sea determinista — sin ellas, el punto 1
  tendría un empate sin criterio de negocio.
- No repara retroactivamente `pickup_requests` ya creados con
  `delivery_point_id = null` — `resolveDeliveryPointId()` solo corre al
  crear un `pickup_request` nuevo; la corrección aplica desde la
  siguiente solicitud del alumno en adelante.
- La fragilidad de fondo del texto libre (observación 2 del humano)
  queda explícitamente fuera de este ADR — ver ADR-084 (pendiente).
- Ninguna migración de esquema en ninguna de las cuatro piezas.

## Referencias

- `apps/api/src/pickups/pickups.service.ts` (`resolveDeliveryPointId`,
  líneas 790-807 — el hueco original).
- `apps/board/src/screens/Home.tsx` (líneas 227-286 — confirmado sin
  lógica propia, efecto secundario puro del bug de arriba).
- `apps/api/src/delivery-points/delivery-points.service.ts` — leído
  completo antes de este ADR; confirmado que hoy no valida ningún cruce
  entre puntos de entrega de la misma institución.
- ADR-012 (consecuencia ya declarada — "instituciones con un solo punto
  de entrega no necesitan asignar grupos" — nunca implementada hasta
  ahora; también el origen del criterio de texto libre que este ADR
  mantiene).
- ADR-017 y spec 009 (criterio de validación cruzada en capa de
  servicio, no FK/trigger — reutilizado para las dos reglas nuevas de
  puntos de entrega).
- spec 006 (`specs/features/006-aprobacion-enrollment.md` — precondición
  de `role = admin` reutilizada por el endpoint de edición).
- spec nueva `specs/features/029-editar-grupo-alumno.md` (a redactar
  junto con el prompt de implementación).
- ADR-084 (pendiente, `docs/plan-implementacion.md`) — catálogo de
  grupos como entidad propia, para la fragilidad de texto libre
  (observación 2 del humano), fuera de alcance aquí.

## ADR-085 — Logo de marca (`pin-mark.svg`) consolidado en `@casillego/ui`; deja de depender de copias manuales en `public/`

**Contexto.** El humano reportó, con captura de pantalla, el logo roto en
la barra lateral de `apps/parent` (pantalla "Asociar institución",
`TutorShell.tsx`). Causa confirmada en código real: la línea
`<img src="/pin-mark.svg" ... />` referencia un archivo que nunca existió
en `apps/parent/public/`.

Investigando el alcance real (no solo el síntoma puntual): la misma
referencia de texto a `/pin-mark.svg` o `/pin-mark-inverse.svg` aparece en
**siete lugares** repartidos en los tres frontends —
`apps/board/src/board/{SerenoBoard,AndenBoard,CarrilBoard}.tsx`,
`apps/portal/src/{admin/OpsShell,institution/InstitutionShell,screens/GateConsole}.tsx`,
y `apps/parent/src/portal-web/TutorShell.tsx`. Ninguna de las siete pasa
por `packages/ui` — cada una asume que el SVG existe como archivo estático
en el `public/` de su propia app. `apps/portal/public/pin-mark.svg` y
`apps/board/public/{pin-mark,pin-mark-inverse}.svg` sí existen —copiados
ahí a mano, en algún momento no documentado—, así que esas seis
referencias "funcionan" por esa copia manual, no porque el patrón sea
correcto. `apps/parent/public/` nunca recibió esa copia: es el único caso
que se rompió, pero el patrón subyacente es igual de frágil en las otras
seis.

`packages/ui/src/components/core/BrandPanel.tsx` ya resuelve esto
correctamente: `import pinMark from '../../assets/pin-mark-inverse.svg'`
— un import de módulo, que Vite empaqueta en build time y nunca puede
quedar roto por un archivo faltante en un `public/`. ADR-081 promovió
`BrandPanel` a `packages/ui` con ese mismo criterio, pero solo tocó las
pantallas del kit `acceso` (Login/VerifyEmail) — los logos de barra
lateral y tableros quedaron fuera de ese barrido, con el patrón viejo, sin
que nadie lo notara hasta este reporte.

**Decisión.**

1. `packages/ui/src/components/core/index.ts` exporta dos constantes
   nuevas, mismo criterio de "barrel único" ya establecido por ADR-036
   (el paquete no tiene build propio ni `exports` map que permita imports
   profundos — todo lo que expone pasa por `src/index.ts`):
   ```ts
   export { default as pinMarkUrl } from '../../assets/pin-mark.svg';
   export { default as pinMarkInverseUrl } from '../../assets/pin-mark-inverse.svg';
   ```
2. Las siete referencias `<img src="/pin-mark...svg">` se reemplazan por
   `<img src={pinMarkUrl} .../>` o `{pinMarkInverseUrl}` según corresponda,
   importado desde `@casillego/ui` — mismo paquete del que los tres apps
   ya importan `BrandPanel`, sin dependencia nueva que agregar a ningún
   `package.json`.
3. Se eliminan las copias duplicadas: `apps/portal/public/pin-mark.svg`,
   `apps/board/public/pin-mark.svg`, `apps/board/public/pin-mark-inverse.svg`.
   `apps/parent/public/` nunca tuvo una copia que borrar.

**Consecuencias.** Cierra el bug puntual del screenshot y, con el mismo
cambio, elimina la clase de bug completa: ningún logo de este proyecto
vuelve a depender de que alguien recuerde copiar un archivo a un `public/`
nuevo cuando se crea o se toca una pantalla. Único punto de origen para el
asset, consistente con el criterio que ADR-036 y ADR-081 ya habían fijado
para el resto del design system — este ADR solo termina de aplicarlo a
los dos lugares (barras laterales, tableros) que quedaron fuera. Sin
cambio de comportamiento visual: el logo se ve igual, solo cambia de
dónde se sirve. Ninguna migración, ningún endpoint, ningún `package.json`
tocado.

## Referencias

- `packages/ui/src/components/core/BrandPanel.tsx` (el patrón correcto ya
  existente, replicado aquí).
- ADR-036 (`@casillego/ui`: barrel único, sin build propio — criterio que
  motiva exportar por el barrel en vez de un `exports` map con imports
  profundos).
- ADR-081 (promoción de `BrandPanel` a `packages/ui`; mismo criterio de
  consolidar un asset duplicado en una sola fuente, aplicado entonces solo
  al kit `acceso` y ahora extendido a barras laterales y tableros).
- `design/casillego-design-system/ui_kits/app-padre/index.html` (mockup
  estático de referencia, confirma que el logo es el mismo asset en los 5
  kits del design system).

## ADR-084 — Catálogo de grupos (`institution_groups`) con FK, reemplaza el texto libre de `assigned_groups`/`grade_or_group`

**Contexto.** Pendiente desde ADR-083 (observación del humano: reconfigurar
un punto de entrega — ej. "1A" deja de estar ahí y pasa a otro punto — deja
huérfanas en silencio a las matrículas que apuntaban al nombre anterior,
sin aviso ni forma de detectarlo). ADR-012 ya sabía que tomaba este riesgo
al elegir texto libre; este ADR construye el catálogo curado que en su
momento se decidió posponer.

Antes de diseñar, se mapeó el radio de impacto real contra el código —
resultó ser mayor que "dos entidades, una migración": **más de 25
archivos** leen `gradeOrGroup`/`assignedGroups` solo para mostrarlos
(payload MQTT/WS de tiempo real usado por `board`/`board-monitor`/
`delivery-point-queue`/`pickup-request-tracking`, el panel "Por nivel" del
dashboard, reportes de puntualidad, la vista del tutor en `apps/parent`,
filas de tablero y consola de puerta). Solo un puñado de lugares
**escriben o validan** el valor: los tres DTOs de `enrollments`/
`delivery-points`, `resolveDeliveryPointId()`, y
`assertNoGroupConflicts()` (ambos en ADR-083).

**Decisión.**

### 1. Principio de diseño: el catálogo con FK resuelve la fragilidad solo en la escritura

Las respuestas de API **siguen exponiendo** `gradeOrGroup: string | null` en
`enrollments` y `assignedGroups: string[] | null` en `delivery_points` —
resueltas por join al nombre del catálogo, no por columna de texto. Cero
cambio en los ~20 archivos que solo leen y muestran el valor (payloads
WS, dashboard, reportes, tablero, consola de puerta, vista del tutor). El
cambio real de modelo de datos y de contrato de escritura queda acotado a
los DTOs de creación/edición y a la lógica de matching/validación de
ADR-083.

### 2. Entidad nueva `InstitutionGroup` (`institution_groups`)

```ts
@Entity('institution_groups')
@Index('IDX_institution_groups_name_ci', ['institution', 'name'], {
  unique: true,
  // Funcional, sobre lower(name) — case-insensitive a propósito: el punto
  // de este catálogo es eliminar la clase de ambigüedad "1A" vs "1a" que
  // el texto libre permitía. Ver migración, punto 6.
})
export class InstitutionGroup {
  id: uuid (PK)
  institution: Institution (@ManyToOne, onDelete: 'CASCADE')
  institutionId: string (@RelationId, mismo patrón ADR-044/ADR-029)
  name: varchar(100)
  createdAt: timestamptz
}
```

`Institution` gana `@OneToMany(() => InstitutionGroup, ...)`, mismo patrón
que sus otras relaciones (`deliveryPoints`, `enrollments`, etc.).

### 3. `enrollments`: `grade_or_group` (texto) → `group_id` (FK)

- Columna nueva `group_id uuid nullable`, FK → `institution_groups.id`,
  `ON DELETE SET NULL` — coincide con la decisión confirmada: borrar un
  grupo deja sin grupo a lo que lo usaba, no lo bloquea.
- `grade_or_group` se elimina de la tabla. La entidad TypeORM ya no la
  expone.
- **La respuesta de API no cambia de nombre**: `EnrollmentsService` sigue
  devolviendo `gradeOrGroup: string | null` en `toResponse()`/
  `toInstitutionResponse()`, ahora resuelto desde `enrollment.group?.name
  ?? null` (relación cargada, no columna).

### 4. `delivery_points`: `assigned_groups` (array de texto) → tabla de relación `delivery_point_groups`

Mismo criterio de tabla de relación que `student_guardians` (el precedente
ya existente en el proyecto), pero sin columnas adicionales — solo dos FK:

```ts
@Entity('delivery_point_groups')
export class DeliveryPointGroup {
  deliveryPoint: DeliveryPoint (@ManyToOne, onDelete: 'CASCADE', parte de la PK compuesta)
  group: InstitutionGroup (@ManyToOne, onDelete: 'CASCADE', parte de la PK compuesta)
}
```

`assigned_groups` (columna y su índice GIN) se elimina. La respuesta de
`DeliveryPointsService` sigue devolviendo `assignedGroups: string[] |
null`, resuelto por join a los nombres de los grupos relacionados.

### 5. Matching y validación (ADR-083) pasan a comparar IDs, no strings

- `resolveDeliveryPointId()`: el match exacto ahora compara
  `enrollment.groupId` contra las filas de `delivery_point_groups` de los
  puntos activos — comparación de UUID, ya no de texto. El atrapa-todo
  sigue siendo el único punto activo sin ninguna fila en
  `delivery_point_groups`. Mejora real, no solo paridad: elimina cualquier
  riesgo de mayúsculas/espacios que el texto libre permitía.
- `assertNoGroupConflicts()`: misma lógica de ADR-083 (máximo un
  atrapa-todo activo, ningún grupo repetido entre puntos activos), ahora
  sobre `groupIds: string[]` en vez de `assignedGroups: string[] | null`.

### 6. Endpoints nuevos — CRUD del catálogo (`InstitutionGroupsController`)

Mismo criterio de autorización que `delivery-points` (ADR-022 punto 1):
lectura para cualquier `institution_members`, escritura (`POST`/`PATCH`/
`DELETE`) restringida a `role = admin`.

- `GET /institutions/:id/groups` — lista con conteo de uso:
  `{ id, name, enrollmentsCount, deliveryPointsCount }[]`. Los conteos
  alimentan tanto la pantalla "Grupos" como la advertencia de borrado.
- `POST /institutions/:id/groups` — `{ name: string }`, `name` se
  recorta (`trim`) y se valida contra el índice único case-insensitive →
  422 `DUPLICATE_GROUP_NAME` si ya existe (con cualquier capitalización).
- `PATCH /groups/:id` — renombrar, misma validación de unicidad.
- `DELETE /groups/:id` — **requiere confirmación explícita si el grupo
  está en uso**, decisión confirmada con el humano:
  1. Sin `?confirm=true`: si `enrollmentsCount > 0` o
     `deliveryPointsCount > 0`, responde 409 `GROUP_IN_USE` con
     `{ enrollmentsCount, deliveryPointsCount }` — el frontend arma la
     advertencia ("N alumnos y M puntos de entrega se quedarán sin este
     grupo") a partir de esos números, no los inventa.
  2. Con `?confirm=true` (o si el grupo no está en uso, sin necesidad de
     confirmar): procede. El `ON DELETE SET NULL`/`CASCADE` del punto 3/4
     hace el resto — el service solo borra la fila del catálogo, no
     escribe él mismo los `NULL` ni borra las filas de
     `delivery_point_groups` a mano.

### 7. DTOs de escritura existentes — de texto libre a `groupId`/`groupIds`

Cambio de contrato deliberado, no un descuido — el propio campo pasó de
texto libre a referencia real, así que se renombra para reflejarlo:

- `ApproveEnrollmentDto.gradeOrGroup?: string | null` →
  `groupId?: string | null` (`@IsUUID`).
- `UpdateEnrollmentGradeDto` → **`UpdateEnrollmentGroupDto`**, mismo
  campo `groupId?: string | null`. El endpoint se renombra
  `PATCH /enrollments/:id/grade` → `PATCH /enrollments/:id/group` —
  coherente con que ya no es "un grado", es una referencia a un grupo del
  catálogo. `specs/features/029-editar-grupo-alumno.md` se actualiza para
  reflejar el nombre nuevo.
- `CreateDeliveryPointDto`/`UpdateDeliveryPointDto.assignedGroups?:
  string[]` → `groupIds?: string[]` (`@IsUUID({ each: true })`).
- Los tres, en el service correspondiente, validan que cada `groupId`
  pertenezca a la misma institución que el recurso — mismo criterio de
  validación cruzada en capa de servicio que ya usa `operatorUserId`
  (ADR-017/018) — 422 `GROUP_NOT_IN_INSTITUTION` si no.

### 8. Frontend — pantalla "Grupos" + autocompletar-o-crear en los inputs existentes

Decisión confirmada con el humano: ambas cosas, no una sola.

- **Pantalla nueva `apps/portal/src/screens/Groups.tsx`** — lista de
  grupos con sus conteos de uso, crear, renombrar inline, borrar con el
  flujo de confirmación del punto 6. Ruta nueva, entrada nueva en `NAV`
  (9 ítems), ícono nuevo en `icons.tsx`.
- **`DeliveryPoints.tsx`**: el input de chips de texto libre para
  `assignedGroups` se convierte en un autocompletar-o-crear sobre
  `useInstitutionGroups(institutionId)` — al escribir un nombre que no
  matchea ningún grupo existente, aparece la opción "Crear grupo
  '{texto}'"; seleccionarla llama `POST /institutions/:id/groups` de
  inmediato (no se batch-crea al guardar el punto de entrega) y añade el
  `id` resultante a la lista de chips, igual que hoy se añade un chip de
  texto.
- **`PendingEnrollments.tsx`/`Students.tsx`**: mismo tratamiento,
  autocompletar-o-crear de un solo valor en vez del `<input>` de texto
  libre actual.

### 9. Migración: una sola, con backfill incluido

`typeorm migration:generate` no basta aquí — hay una transformación de
datos real, no solo DDL. Pasos, en una sola migración (transaccional):

1. `CREATE TABLE institution_groups` + índice único funcional sobre
   `(institution_id, lower(name))`.
2. Backfill: por cada `institution_id`, unión de valores distintos de
   `enrollments.grade_or_group` **y** `unnest(delivery_points.assigned_groups)`
   — ambas fuentes alimentan el mismo catálogo por institución, no
   catálogos separados. Deduplicación **case-insensitive** confirmada por
   el humano (mismo criterio que el índice único): si "1A" y "1a" existen
   ambos hoy para la misma institución en cualquiera de las dos fuentes,
   se conserva una sola fila (la de aparición determinista más temprana,
   ej. por `id` de la fuente), no se inventa una regla de fusión más allá
   de eso. Reportar en el log de la migración cuántas colisiones de este
   tipo se resolvieron, para revisión posterior si el número es alto.
3. `ALTER TABLE enrollments ADD COLUMN group_id uuid`; `UPDATE` uniendo
   por `institution_id` + `lower(name) = lower(grade_or_group)`; `ADD
   CONSTRAINT ... FOREIGN KEY ... ON DELETE SET NULL`; `DROP COLUMN
   grade_or_group`.
4. `CREATE TABLE delivery_point_groups` (PK compuesta, dos FK `ON DELETE
   CASCADE`); backfill uniendo `unnest(assigned_groups)` contra el
   catálogo ya poblado; `DROP INDEX` GIN; `ALTER TABLE delivery_points
   DROP COLUMN assigned_groups`.
5. **Verificación de sanidad obligatoria** antes de considerar la
   migración terminada (no solo que corra sin error): el conteo de
   `enrollments` con `grade_or_group IS NOT NULL` antes debe igualar el
   conteo con `group_id IS NOT NULL` después; el conteo de
   `delivery_points` con `assigned_groups IS NOT NULL` antes debe igualar
   el conteo de `delivery_point_id` distintos en `delivery_point_groups`
   después. Si no coinciden, la migración se revisa antes de aplicar en
   ambientes reales — no se asume que "corrió" significa "correcta".

**Consecuencias.** Elimina la clase de bug que motivó ADR-083 punto 2:
renombrar/reconfigurar un grupo ahora es una operación atómica sobre el
catálogo (una fila), no una edición de texto dispersa en N lugares
desconectados. El radio de cambio real queda acotado a escritura/matching
— ningún consumidor de solo lectura (WS, dashboard, reportes, tablero,
consola, vista del tutor) se toca. Los dos endpoints de escritura de
`enrollments` cambian de contrato (`gradeOrGroup`→`groupId`,
`/grade`→`/group`) — aceptable porque son de ADR-083, todavía sin uso real
en producción. Migración con backfill, no reversible con datos si "1A"/"1a"
colisionaron y se fusionaron — el reporte de colisiones del punto 9.2 es
la única red de seguridad para detectarlo antes de que nadie lo note.

## Referencias

- ADR-012 (decisión original de texto libre, con el riesgo ya declarado).
- ADR-083 (el caso real de mantenimiento que confirmó el riesgo; DTOs y
  lógica de matching/validación que este ADR reescribe sobre IDs).
- `packages/shared/src/entities/student-guardian.entity.ts` (precedente
  de tabla de relación, seguido para `delivery_point_groups`).
- ADR-017/018 (validación cruzada en capa de servicio — mismo criterio
  para `groupId pertenece a la institución del recurso`).
- ADR-022 punto 1 (rol `admin` para escritura, lectura abierta a
  cualquier miembro — mismo criterio para el CRUD de grupos).
- ADR-029/044 (`@RelationId`, mismo mecanismo para `institutionId` en la
  entidad nueva).
- `specs/features/029-editar-grupo-alumno.md` (se actualiza: el endpoint
  y el campo cambian de nombre).

## Corrección post ADR-084 — `GroupCombobox`: el blur revertía la selección antes de que `PATCH .../group` resolviera

No es una decisión de diseño nueva, es un bug encontrado al verificar
visualmente la pantalla "Alumnos" tras el cierre de ADR-084 — se registra
aquí sin número de ADR propio a petición del humano, dado que es un bug
contenido a un solo archivo, sin alcance de producto.

**Síntoma reportado:** en "Alumnos", seleccionar un grupo y dar clic en
"Guardar" hacía que el campo se viera vacío inmediatamente después —
volvía a mostrar el valor correcto solo si se tocaba el campo una segunda
vez.

**Causa raíz confirmada:** `apps/portal/src/institution-groups/GroupCombobox.tsx`,
`handleBlur()` (modo `single`, usado por `PendingEnrollments.tsx` y
`Students.tsx`) revertía incondicionalmente el texto mostrado a
`props.initialName` en cada blur:

```ts
function handleBlur() {
  window.setTimeout(() => {
    setOpen(false);
    if (props.mode === 'single') {
      setQuery(props.initialName ?? '');
    }
  }, 120);
}
```

Clic en "Guardar" mueve el foco fuera del `<input>`, disparando este
`blur` antes de que el `PATCH /enrollments/:id/group` en vuelo resuelva.
En ese momento `props.initialName` todavía es el valor viejo (el padre
recién actualiza su estado cuando la respuesta llega), así que el timeout
pisaba la selección recién hecha con el valor anterior. El campo no se
resincronizaba solo después porque `query` es estado local de un
componente que nunca se desmonta entre renders (mismo `key` antes y
después de guardar) — necesitaba una interacción nueva (tocar el campo,
volver a hacer blur) para que `handleBlur` corriera otra vez, esta vez ya
con `initialName` actualizado.

**Corrección:** un estado local nuevo, `confirmedName`, que se actualiza
de forma síncrona en `selectGroup()`/`handleClear()` — en el mismo
instante en que el usuario confirma una elección, sin esperar el
round-trip del `PATCH`. `handleBlur()` revierte a `confirmedName`, no a
`props.initialName`, eliminando la carrera por completo. Cambio contenido
a `GroupCombobox.tsx`; corrige ambos consumidores (`Students.tsx` y
`PendingEnrollments.tsx`) sin tocarlos. El modo `multi`
(`DeliveryPoints.tsx`) no tenía este bug — sus chips se renderizan desde
`props.value`, controlado por el padre, no desde `query`.

**Limitación preexistente, no introducida por este fix:** si el nombre
del grupo cambia por una vía externa a este componente (otro admin
editándolo en paralelo, o un `reload()` de la lista) mientras la fila
sigue montada, el campo no se resincroniza solo hasta que se toca — mismo
criterio ya documentado en `DeliveryPointForm`/`Students.tsx` ("mounted
once, never re-seeded by effect"). No se corrige aquí.

## Corrección post ADR-072 — headers de pantalla: botones residuales copiados sin ajustar por pantalla

No es una decisión de diseño nueva, son tres bugs de limpieza mecánica
encontrados por el humano al navegar el portal en vivo. Se registran
juntos, sin ADR propio (mismo criterio que la corrección de
`GroupCombobox`), porque comparten la misma causa raíz: un bloque de
header boilerplate copiado de pantalla en pantalla a medida que se
construían (`Alumnos`, `Grupos`, `Reportes`, etc.) sin re-evaluar cada vez
qué botón residual le correspondía a esa pantalla en particular.

**1. "Cerrar sesión" duplicado en 8 pantallas.** `InstitutionShell.tsx`
(ADR-072) ya tiene el botón canónico en el pie de la barra lateral.
`PendingEnrollments.tsx`, `Students.tsx`, `Groups.tsx`,
`InstitutionProfile.tsx`, `DeliveryPoints.tsx`, `DismissalSchedule.tsx`,
`Personnel.tsx` y `Reports.tsx` además tienen su propia copia en el
header de la pantalla — comentario explícito en el código explicando por
qué se dejó ahí en su momento ("only sign-out stays here"), pero en la
práctica es la duplicación que se corrige. Se elimina de las 8; se
conserva el patrón intacto en `Dashboard.tsx` (nunca lo tuvo — es el
correcto) y no se toca `Profile.tsx` ni `GateConsole.tsx`, que están
deliberadamente fuera de `InstitutionShell` en `App.tsx` (comentarios
explícitos ahí mismo) y por tanto sí necesitan su propio botón.

**2. "Consola de puerta" en pantallas sin relación con puntos de
entrega.** Aparece en `DeliveryPoints.tsx` (correcto — es de donde nace
el flujo real), y también, por el mismo copy-paste, en
`DismissalSchedule.tsx`, `Reports.tsx` y `Personnel.tsx`. Se elimina de
estas tres.

**3. "Volver al portal" en `GateConsole.tsx` regresaba siempre a
`DASHBOARD_PATH`.** Con la corrección del punto 2, `DeliveryPoints.tsx`
queda como el único punto de entrada real a `GATE_CONSOLE_PATH`
(confirmado por búsqueda exhaustiva de `navigate(GATE_CONSOLE_PATH)` en
el repo). `onBack` pasa a `DELIVERY_POINTS_PATH` — mismo estilo ya
establecido en el resto del proyecto (constantes de ruta explícitas, no
`navigate(-1)`, sin precedente de ese patrón en ningún otro lugar del
código).

**4. El botón "Abrir tablero" del Dashboard se elimina — no tenía
respaldo de ninguna spec.** Primera respuesta a este punto: se descartó
como configuración local incorrecta (`VITE_BOARD_URL` apuntando al
puerto de `apps/parent` por error, dado que 5173/5174/5175 — portal/
parent/board — son consecutivos), citando "ADR-072 punto 6" como el
origen documentado de la decisión, tomado directamente de un comentario
ya existente en el código (`.env.example`, `vite-env.d.ts`).

Verificado después, a pedido del humano: **esa cita es falsa.** ADR-072
tiene 5 puntos, ninguno menciona este botón; búsqueda exhaustiva de
"Abrir tablero"/`VITE_BOARD_URL`/`boardUrl` en `docs/decisiones.md`: cero
resultados. No existe ninguna decisión documentada detrás de esta
feature — se construyó sin pasar por "spec antes que código", y el
comentario que la acompañaba citaba un ADR real (evitando así verse como
inventado) que en realidad no dice lo que el comentario afirma. El
criterio general que sí cita correctamente (mostrar deshabilitado en vez
de adivinar una URL) es real — ADR-034/035 lo establecen, para otras dos
features — pero eso no respalda que *este* enlace en particular deba
existir.

Sin una decisión real detrás, y sin que el humano le encuentre sentido de
producto (las apps son independientes; no hay flujo real que justifique
saltar del dashboard de institución a otra app en la misma sesión), se
elimina por completo: el botón en `Dashboard.tsx`, la variable
`VITE_BOARD_URL` (código, `.env.example`, `vite-env.d.ts`), y las citas a
"ADR-072 punto 6" que quedarían huérfanas. No se toca `VITE_PARENT_URL`
(tarjeta "Crear cuenta" → tutor) — es una pregunta aparte, no evaluada
aquí.

**5. Comentario huérfano en `Login.tsx`.** Detectado al verificar el
punto 4: la tarjeta "Tutor o familia" (`VITE_PARENT_URL`) tenía un
comentario que comparaba su patrón "visible pero deshabilitado" con *"the
Dashboard's 'Abrir tablero' (ADR-072 point 6)"* — la misma cita falsa,
apuntando además a una feature que ya no existe tras el punto 4. No
afecta comportamiento (`VITE_PARENT_URL` sigue intacto), solo el
comentario. Se corrige para citar el precedente real (ADR-034/035) en vez
de repetir la cita inventada.

**6. Ancho de contenido inconsistente en `Personnel.tsx`.** Las 8
pantallas de institución (excepto `Dashboard`, que no tiene `maxWidth`
por diseño) usan `maxWidth: 820` en su contenedor raíz —
`PendingEnrollments`, `Students`, `Groups`, `InstitutionProfile`,
`DeliveryPoints`, `DismissalSchedule`, `Reports`. Solo `Personnel.tsx`
usa `940`, sin ningún comentario ni ADR que lo justifique (confirmado:
cero menciones de "940" en `docs/decisiones.md`; el commit que lo
introdujo tampoco explica el valor). La tabla de personal (grid de 5
columnas, `minmax(210px, 2fr) 200px 120px 120px 130px`) ya tiene su
propio manejo de espacio angosto documentado en el código ("The list
scrolls sideways rather than squeezing the columns on a narrow window"),
así que bajar el contenedor a 820 no rompe la tabla — solo hace que ese
scroll lateral ya previsto se active un poco antes en ventanas angostas,
comportamiento ya construido para esto. Se estandariza `Personnel.tsx` a
`maxWidth: 820`, igual que las demás.

**7. Reversión del punto 6 — se estandariza a `940`, no a `820`.**
Verificado en vivo por el humano tras aplicar el punto 6: `maxWidth: 940`
evita el scroll lateral en la tabla de `Personnel.tsx` (el que el punto 6
asumía como comportamiento aceptable ya construido), y además es la
preferencia visual explícita del humano para las 7 pantallas restantes,
no solo para evitar el scroll. Evaluado contra el layout interno de las
7 — `PendingEnrollments`, `Students`, `Groups`, `InstitutionProfile`,
`DeliveryPoints`, `DismissalSchedule`, `Reports` —, ninguna tiene una
tabla de columnas fijas como la de `Personnel`; todas usan
`repeat(auto-fit, minmax(Npx, 1fr))` o filas en flex, el patrón
responsivo pensado exactamente para reflowear sin romperse ante un
contenedor más ancho. Se estandarizan las 7 a `940`, quedando las 8
iguales entre sí. `Profile.tsx` e `InstitutionApproval.tsx` también usan
`820` pero quedan fuera — no son parte del set de pantallas de
institución comparado (`Profile` está fuera de `InstitutionShell`,
`InstitutionApproval` es de `OpsShell`/super-admin).

## ADR-086 — Login (`apps/parent` y `apps/portal`) no era usable en retrato: `BrandPanel` se apila arriba del formulario bajo 767px

**Contexto.** Reportado en producción: en `app.casillego.com.mx` y
`portal.casillego.com.mx`, el login no se podía completar en modo
vertical/retrato. Ambos `Login.tsx` (heredados de ADR-081, mismo layout
de 1180px + `BrandPanel` de 470px de ancho fijo) usan `display: flex`
en fila sin ningún breakpoint. `BrandPanel`
(`packages/ui/src/components/core/BrandPanel.tsx`) fija `width: 470,
flexShrink: 0` — en un viewport angosto no cede espacio, y como el
contenedor padre tiene `overflow: hidden`, el panel del formulario
(`flex: 1, minWidth: 0`) queda comprimido a un ancho casi nulo y se
recorta fuera de la vista. A diferencia de `TutorShell.tsx` (`apps/parent`),
que sí tiene tratamiento responsivo real vía `@media (max-width: 767px)`
inyectado, Login nunca lo recibió — es un desvío no detectado hasta
ahora, no una regresión de un cambio reciente.

Verificado además: `BrandPanel` no es exclusivo de Login.
`VerifyEmail.tsx` y `AcceptInvitation.tsx`, en ambas apps (6 pantallas en
total), usan el mismo contenedor de 1180px + panel fijo de 470px
—heredado del mismo ADR-081— y por lo tanto el mismo bug en retrato.

**Decisión.**

1. **Breakpoint: 767px**, el mismo ya usado en `TutorShell.tsx` — no se
   introduce un segundo valor de corte en el proyecto.
2. **`BrandPanel` se apila arriba del formulario** bajo ese breakpoint,
   en vez de ocultarse — se evaluaron ambas opciones (ocultar por
   completo vs. apilar) y se confirmó apilar. **Revisión tras ver el
   render real:** la primera decisión (conservar todo el contenido —
   logo, headline, tagline y los 3 bullets — solo reducido de tamaño)
   se probó en producción y se vio saturada; demasiada densidad de
   texto para ~170px de alto. Contenido final apilado: **solo logo +
   headline** ("Menos fila. Más calma a la salida."). Tagline y los 3
   bullets se ocultan bajo el breakpoint y quedan exclusivos del
   layout de escritorio, donde sí hay espacio.
3. **Altura del panel apilado con tope fijo (~160–180px)**, no libre —
   prioridad explícita a que el formulario quede visible sin scroll
   adicional en el viewport típico de un teléfono en retrato.
4. **Alcance: las 6 pantallas que consumen `BrandPanel`** — `Login.tsx`,
   `VerifyEmail.tsx` y `AcceptInvitation.tsx`, en `apps/parent` y
   `apps/portal`. El fix vive en `BrandPanel` y en el contenedor
   compartido del layout de 1180px, no en Login específicamente, así
   que corrige las 6 por igual sin trabajo adicional por pantalla.

**Consecuencias.** Las 6 pantallas vuelven a ser usables en retrato en
producción. `BrandPanel` gana su primera variante de tamaño (compacta/
apilada) desde que se compartió en ADR-081 — cualquier futuro tercer
consumidor del componente hereda ambos modos.

## ADR-087 — Tiempo real para las bandejas de aprobación (enrollments e instituciones), reutilizando el canal genérico de ADR-075

**Contexto.** Detectado en pruebas manuales con cuentas reales en
producción: un tutor solicita asociar un alumno a una institución
(`AssociateInstitutionPanel.tsx`/`PortalStudents.tsx` en `apps/parent`,
vía `useMyEnrollments`), y la solicitud no aparece en la bandeja de
aprobación de la institución (`PendingEnrollments.tsx` en
`apps/portal`, vía `usePendingEnrollments`) hasta que el staff recarga
la página completa a mano — no hay botón de refrescar ni ningún
mecanismo de actualización en vivo. El mismo patrón de "REST cargado
una sola vez al montar, sin polling ni WebSocket" aplica también a
`InstitutionApproval.tsx` (bandeja de aprobación de instituciones del
super-admin). Confirmado en el código: ninguno de los tres hooks tiene
suscripción a MQTT/WS, y `enrollments.service.ts`/`institutions.service.ts`
no publican nada al aprobar/rechazar — a diferencia de
`pickups.service.ts`, que sí publica a varios topics en cada cambio de
estado de una recogida.

De las pantallas de "esperar una resolución de otra persona" que existen
hoy en el proyecto, se identificaron dos pares real: (1) tutor
esperando ↔ institución resolviendo (enrollments), y (2) institución
esperando ↔ super-admin resolviendo. Del segundo par solo existe el
lado del resolutor (`InstitutionApproval.tsx`) — el registro de una
institución nueva solo muestra un mensaje estático post-registro, no
hay una pantalla de espera en vivo del lado de la institución; ese
lado queda fuera de alcance porque no existe hoy.

**Decisión.**

1. **Se reutiliza la infraestructura genérica de ADR-075** —
   `useRealtimeChannel` (`packages/ui`) y las utilidades de
   `packages/shared/realtime-channel.ts` — sin crear un patrón nuevo.
   Los 3 hooks (`usePendingEnrollments`, `useMyEnrollments`, el de
   `InstitutionApproval`) se reconstruyen sobre ese hook genérico:
   snapshot REST inicial + deltas por WebSocket, mismo modelo que ya
   usa la cola del gate console.
2. **Dos gateways nuevos en `apps/api`**, mismo patrón que
   `DeliveryPointQueueGateway` (bridge MQTT↔WS, una sola suscripción
   wildcard al broker por proceso, el navegador nunca toca MQTT
   directamente):
   - **Canal de enrollments**, con doble scope: por `institutionId`
     (para `PendingEnrollments.tsx`, igual que la cola es por
     `deliveryPointId`) y por `userId` de tutor — **un canal por
     tutor que cubre todas sus solicitudes a la vez**, no uno por
     enrollment individual — para `useMyEnrollments`.
   - **Canal de instituciones**, de scope global (no por
     institución) — el super-admin ve todas las instituciones
     pendientes, así que no aplica ACL por institución, solo el guard
     de super-admin ya existente en la conexión.
3. **`enrollments.service.ts` e `institutions.service.ts` publican a
   MQTT** en `create`/`approve`/`reject` (enrollments) y
   `approve`/`suspend`/`reactivate` (institutions) — mismo patrón
   try/catch-log de `pickups.service.ts`: un fallo al publicar nunca
   tumba la respuesta REST, solo se registra en el logger.
4. **Alcance confirmado: todas las pantallas de este tipo de
   interacción que existen hoy** — enrollments (ambos lados) e
   instituciones (lado super-admin, único lado que existe). No se
   crea una pantalla de espera nueva del lado de institución-esperando-
   super-admin porque no existe hoy; si se agrega en el futuro, hereda
   el mismo canal.

**Consecuencias.** El objetivo explícito es que la comunicación se
sienta lo más cercana a tiempo real posible, sin que el usuario
necesite saber que debe recargar la página. Dos gateways y dos
publicadores nuevos, cero patrones nuevos — todo se apoya en la
abstracción ya validada por 5 consumidores desde ADR-075.

## Referencias

- ADR-050 (bridge MQTT↔WS original, gate console).
- ADR-075 (extracción de `useRealtimeChannel`/`realtime-channel.ts`).
- ADR-038/ADR-040 (`SuperAdminGuard`, namespace `/admin/`).
- `apps/api/src/pickups/pickups.service.ts` (patrón de publish
  try/catch-log a reutilizar).

## ADR-088 — Cancelar (`pending`) y dar de baja (`approved`) una asociación alumno-institución

**Contexto.** Surgió al probar ADR-087 manualmente: no existía forma
de deshacer una asociación alumno-institución desde ninguna de las dos
apps, solo `DELETE` directo en la base de datos. Se confirma que es
una funcionalidad real, faltante tanto en `apps/portal` (institución)
como en `apps/parent` (tutor).

Investigado en el código real antes de diseñar: `pickups.service.ts`
(línea 178) exige `enrollment.status === 'approved'` para crear
cualquier `pickup_request`. Esto es la pieza clave del diseño — un
enrollment en `pending` **nunca** puede tener una `pickup_request`
apuntándole vía la FK `pickup_requests.enrollment_id → enrollments.id`
(`ON DELETE RESTRICT`), así que cancelar un `pending` jamás puede
chocar con esa restricción. Un enrollment `approved`, en cambio, sí
pudo haber generado pickups reales — borrarlo de verdad sería
inseguro.

Sobre el caso de "reutilizar el registro" al reintentar la asociación:
no hace falta ningún mecanismo nuevo. El índice único parcial
`(student_id, institution_id) WHERE status IN ('pending', 'approved')`
ya resuelve esto exactamente igual que hoy resuelve el reintento tras
un `rejected` — en cuanto el estado sale de ese rango, una solicitud
nueva simplemente inserta una fila nueva; la vieja queda como
historial, sin conflicto.

**Decisión.**

1. **Cancelar** (`pending` → fila eliminada de verdad): **solo el
   tutor**, sobre su propia solicitud. Endpoint nuevo en
   `EnrollmentsController` (`DELETE`, mismo controlador de `create`/
   `listMine`, sin `InstitutionMembershipGuard` — el criterio de
   autorización es "soy quien la solicitó", no membresía de
   institución). Verificación en el servicio: `status === 'pending'`
   y `requestedByUserId === actorUserId` antes de borrar. Sin nuevo
   valor de enum — no hace falta, la fila desaparece.
2. **Dar de baja** (`approved` → `status = 'withdrawn'`, nuevo valor
   en `enrollments_status_enum`): **tutor o institución**, cada quien
   sobre las suyas.
   - Lado tutor: `PATCH :id/withdraw` en `EnrollmentsController`,
     misma verificación de propiedad que cancelar.
   - Lado institución: `PATCH :id/withdraw` en
     `EnrollmentsDetailController`, reutilizando
     `InstitutionMembershipGuard` ya existente ahí (mismo patrón que
     `approve`/`reject`).
   - Nuevas columnas `withdrawn_at`/`withdrawn_by_user_id`, mismo
     patrón que `reviewed_at`/`reviewed_by_user_id`.
3. **Tiempo real (ADR-087)**: ambas acciones publican a los mismos dos
   topics de enrollments (institución + tutor) que ya existen — no se
   crea infraestructura nueva de canal, solo dos publicadores más
   sobre el gateway ya construido.

**Consecuencias.** Migración nueva: valor `withdrawn` en
`enrollments_status_enum` + 2 columnas nullable. Ningún cambio al
índice único parcial (ya excluye cualquier estado fuera de
`pending`/`approved` por construcción). Los tests de `pickups.service`
que ya cubren "enrollment no aprobado" siguen validando el caso
`withdrawn` sin cambios, ya que ese servicio solo verifica
`=== 'approved'`.

**Corrección durante la implementación (endpoint único para `withdraw`).**
El punto 2 de la decisión original proponía `PATCH :id/withdraw` en dos
controladores distintos — `EnrollmentsController` (tutor) y
`EnrollmentsDetailController` (institución) — ambos montados sobre el
mismo `@Controller('enrollments')`. Es una colisión de ruta real: Nest
no resuelve dos rutas idénticas (mismo método + mismo path) declaradas
en controladores distintos del mismo módulo; solo la que se registra
primero en el array `controllers` de `EnrollmentsModule` (hoy
`EnrollmentsController`, antes que `EnrollmentsDetailController`) llega
a responder — la otra queda inalcanzable en silencio, sin error de
arranque que lo delate. Detectado al escribir el controlador, antes de
tocar ninguna ruta (ver CLAUDE.md, "Spec antes que código").

**Decisión revisada:** un único endpoint, `PATCH /enrollments/:id/withdraw`,
vive en `EnrollmentsController`, sin `InstitutionMembershipGuard`. La
regla "tutor o institución, cada quien sobre las suyas" se resuelve
dentro de `EnrollmentsService.withdraw()`, no en un guard: permitido si
`actorUserId === enrollment.requestedByUserId` (tutor dueño), o si
`actorUserId` es `institution_member` con `role = admin` de la
institución del enrollment (mismo nivel de privilegio que
`approve`/`reject`/`group`, verificado con una consulta directa a
`institution_members` — mismo patrón que ya usan en este archivo
`listForInstitution`/`assertActiveGuardian` para reglas de autorización
que no encajan en el guard genérico). Ninguna ruta nueva se agrega a
`EnrollmentsDetailController`. El contrato externo no cambia: sigue
siendo un solo `PATCH /enrollments/:id/withdraw`, ahora documentado como
tal en `specs/api-contracts/enrollments.md` en vez de como dos
endpoints separados.

**Corrección durante la implementación (evento `removed` de `cancel`).**
El punto 3 ("ambas acciones publican a los mismos dos topics... ya
existentes") no alcanza a `cancel`: `EnrollmentInstitutionPayload` y
`EnrollmentGuardianPayload` son field-for-field el mismo shape que sus
respuestas REST (invariante documentado en
`enrollment-realtime-payloads.ts` y explotado por
`pending-enrollment-rows.ts`/`my-enrollment-rows.ts` para fusionar
snapshot y delta sin transformar ninguno) — no tienen forma de decir
"esta fila ya no existe" sin inventar un valor de estado falso. Se
agrega un tercer tipo de mensaje, `EnrollmentRemovedPayload`
(`{ event: 'removed', id }`), que viaja por los mismos dos topics
(institución + tutor) solo desde `cancel()`. `parseDelta` en ambos hooks
distingue el mensaje por la presencia de `event: 'removed'` antes de
intentar parsear el shape completo; `mergeDelta` lo resuelve filtrando
la fila por `id`. `mergeMyEnrollmentDelta` (`apps/parent`), que hasta
ahora nunca quitaba filas (todo estado se conserva como historial),
gana su primer caso de remoción — coherente con que `cancel` borra la
fila de verdad, sin dejar rastro que mostrar.

**Corrección post-implementación (fila de instituciones sin `flexWrap`
en `PortalStudents.tsx`).** Detectado en producción tras el deploy: en
viewport angosto, el badge de estado ("Aprobada"/"Rechazada") se
desbordaba visualmente sobre el texto de tipo/categoría de la
institución, encimándose. Causa: la fila (`display: flex`, sin
`flexWrap`) tenía 3 elementos antes de este ADR (ícono, nombre/tipo,
badge) y cabían bien en el ancho disponible; los botones nuevos
("Cancelar solicitud"/"Dar de baja") suman un 4º elemento que no cabe
sin envolver, y el badge —sin `flexShrink: 0`— se encoge por debajo de
su contenido natural y lo desborda hacia afuera. Mismo patrón que ya
usa el resto de este archivo (líneas 288, 328) y
`PendingEnrollments.tsx` para filas equivalentes: se agrega
`flexWrap: 'wrap'` al contenedor de la fila. No requiere ADR propio —
es una corrección de la implementación de este mismo ADR, no una
decisión nueva.

**Segunda corrección post-implementación (layout de dos líneas en
móvil, mismo archivo).** El `flexWrap` de arriba evitaba el
encimamiento pero envolvía sin estructura predecible (el botón podía
quedar solo, o junto al badge, según el ancho exacto). Se reemplaza por
un layout de dos líneas fijas debajo de `max-width: 767px` — el mismo
breakpoint que ya usan `TutorShell`/`BrandPanel` (ADR-086), para no
introducir uno nuevo: arriba ícono + nombre/tipo, abajo estatus +
acción en los extremos (`justify-content: space-between`). El badge y
el botón se agrupan en un `<div className="enrollment-row-actions">`
con `flex-basis: 100%` bajo el media query, forzándolos a su propia
línea dentro del contenedor `.enrollment-row` (que solo activa
`flex-wrap: wrap` en ese mismo breakpoint). Arriba de 767px la fila
sigue en una sola línea, sin cambios. Tampoco requiere ADR propio.

**Tercera corrección post-implementación (mismo layout replicado en
`apps/portal/src/screens/PendingEnrollments.tsx`).** Confirmado por el
humano que se quería por consistencia entre `apps/parent` y
`apps/portal` — misma fila con info a la izquierda (avatar + nombre del
alumno) y acciones a la derecha (`Rechazar`/`Aprobar`) que se
encimaban/envolvían sin estructura en móvil. Mismo mecanismo exacto:
`ENROLLMENT_ROW_STYLE` (mismo contenido, `max-width: 767px`),
`className="enrollment-row"` en el contenedor de la fila,
`className="enrollment-row-actions"` en el `<div>` que agrupa los dos
botones (con `flexShrink: 0` agregado, mismo criterio que
`PortalStudents.tsx`). Verificado con Playwright: en ~375px de ancho
total la fila apila en dos líneas sin encimarse; en desktop
(1280px) queda idéntica a como estaba.

De paso, al verificar en 375px se confirmó que `InstitutionShell` (a
diferencia de `TutorShell`) **no colapsa su sidebar de 250px en
móvil** — a ese ancho el área de contenido queda en ~125px y los
propios botones `Rechazar`/`Aprobar` se desbordan horizontalmente. Es
un problema preexistente del shell, no introducido por este fix (con
o sin el layout de dos líneas, 125px no alcanza para dos botones), y
no se tocó: replicar el patrón `TutorShell` de sidebar colapsable a
`InstitutionShell` es un cambio de mayor alcance, no pedido en esta
sesión. Verificado en cambio con el viewport ensanchado a 640px (fila
igual de angosta apilada) para separar el defecto del shell del
comportamiento de la fila en sí, que si funciona.

## ADR-089 — Reset del margen de `<body>` en las 3 apps, vía `@casillego/ui/styles.css`

**Contexto.** Detectado al revisar el layout móvil de `PortalStudents.tsx`:
las 3 apps (`apps/parent`, `apps/portal`, `apps/board`) arrastraban los
8px de margen por defecto del user-agent stylesheet en `<body>` —
nunca se había reseteado. Restaba espacio real en cualquier pantalla,
más notorio en mobile por ser proporcionalmente mayor.

**Decisión.** `body { margin: 0; }` en `packages/ui/src/styles.css` —
el único archivo de estilos que las 3 apps ya importan
(`@casillego/ui/styles.css` desde cada `main.tsx`), así que una sola
regla se propaga a las 3 sin duplicar nada por app. Alcance
deliberadamente mínimo: solo el margen del body, no un reset general
(`box-sizing: border-box`, etc.) — se evaluó y se descarta por ahora,
fuera del problema puntual reportado.

**Consecuencias.** Cambio puramente visual, sin lógica. Al vivir en el
paquete compartido, cualquier app futura que importe
`@casillego/ui/styles.css` lo hereda automáticamente.

## ADR-090 — `InstitutionShell` y `OpsShell` colapsan su sidebar en móvil, replicando el patrón de `TutorShell`

**Contexto.** Hallazgo colateral al verificar ADR-088 en 375px reales:
`InstitutionShell.tsx` (`apps/portal`, rol institución, 9 ítems de
nav) tiene una sidebar de `width: 250` fija, sin ningún `@media` — a
diferencia de `TutorShell.tsx` (`apps/parent`), que desde ADR-078
punto 3 ya resuelve exactamente este problema (primera pieza
responsive del proyecto). En viewport angosto, el área de contenido
del portal de institución queda comprimida a ~125px, insuficiente para
casi cualquier pantalla — incluida la fila de dos líneas que ADR-088
acaba de agregar a `PendingEnrollments.tsx`, que en ese ancho vuelve a
desbordarse, pero por el shell, no por la fila.

Se revisó también `OpsShell.tsx` (rol super-admin) por tener la misma
estructura general (sidebar + header, mismo autor/patrón que
`InstitutionShell`, ADR-072/ADR-074) — mismo problema exacto: `width:
250` fija, sin `@media`.

**Decisión.** Replicar en ambos, sin modificaciones, el mecanismo ya
construido y probado en `TutorShell.tsx`:

1. Mismo breakpoint (`max-width: 767px`), mismo mecanismo — sidebar
   oculta por defecto bajo el breakpoint, una topbar compacta
   (`height: 56`, fondo `var(--ink-900)`) aparece con un botón de
   menú que abre la sidebar como panel de pantalla completa
   (`position: fixed; inset: 0; z-index: 30`).
2. **No se copia la lógica de negocio de `TutorShell`** (el enlace
   "App móvil"/`backToMobile`, los datos de `initialsOf` a partir del
   email) — solo el mecanismo responsivo (el `SHELL_STYLE` con
   `@media`, las clases `-sidebar`/`-sidebar-open`/`-topbar`, el
   patrón de `useState` para `menuOpen`). Cada shell conserva su
   propio contenido de sidebar (9 ítems + badge de pendientes en
   `InstitutionShell`, 2 ítems + contador de instituciones pendientes
   en `OpsShell`), footer, y texto de header — nada de eso cambia,
   solo cómo se oculta/revela en móvil.
3. El contador (`pendingCount` en `InstitutionShell`,
   `institutionsByStatus.pending` en `OpsShell`) que hoy vive como
   badge en el ítem de nav se conserva igual dentro del panel de
   pantalla completa — no se duplica en la topbar compacta.

**Consecuencias.** Con esto, las 3 superficies de portal
(`TutorShell`, `InstitutionShell`, `OpsShell`) quedan con el mismo
tratamiento responsive — deja de ser "la primera pieza responsive del
proyecto" un caso aislado. `apps/board` (tablero público, sin sidebar)
queda fuera por no aplicar.

## ADR-091 — Las conexiones WebSocket no renovaban el access token: refresh reactivo (antes de rendirse) + proactivo (por temporizador)

**Contexto.** Reportado en pruebas manuales de punta a punta en
producción: en la segunda recogida de la sesión de prueba, tanto la
pantalla de tracking del tutor (`apps/parent`) como el tablero
(`apps/board`) dejaron de actualizarse en vivo, mostrando "El
seguimiento en vivo se detuvo. Tu sesión expiró." — con la sesión de
verdad todavía válida.

Investigado en el código real: el `accessToken` dura 15 minutos
(`JWT_ACCESS_TTL`, default 900s). El refresh silencioso ya existe
(`createApiClient` en `packages/shared/api-client/api-client.ts`,
`runRefresh`/`refreshOnce`) pero es **enteramente reactivo a un 401 en
una llamada REST** — nunca se dispara desde una conexión WebSocket.
`useRealtimeChannel.ts` (ADR-075) sí relee el token vigente en cada
intento de conexión (`getSocketUrl()`, nunca capturado una sola vez),
pero si ese token ya expiró y ninguna llamada REST lo renovó mientras
tanto, la reconexión del WS falla con `4401 UNAUTHENTICATED` —
clasificado como **fatal, sin reintento**, por diseño
(`fatalCloseReason` en `packages/shared/realtime-channel.ts`).

El problema real: hay pantallas cuyo tráfico es puramente WebSocket,
sin ninguna llamada REST que dispare el refresh — la de tracking del
tutor, y sobre todo **el tablero**, pensado para quedarse abierto sin
interacción durante horas. Esto contradice directamente lo que
**ADR-067 ya prometía**: *"mientras el cliente siga generando tráfico
que dispare refreshes con regularidad, la sesión se extiende
indefinidamente"* — el tráfico del tablero nunca fue del tipo que
dispara un refresh, así que esa promesa nunca se cumplió en la
práctica para el caso que ADR-067 dice resolver.

**Decisión — dos capas, no una.**

1. **Reactivo (cierra el hueco inmediato).**
   `ApiClient` (interfaz en `packages/shared/api-client/api-client.ts`)
   gana un método público `refreshToken(): Promise<string>`, que
   reutiliza el `refreshOnce()` ya existente (mismo deduplicado: un
   refresh disparado por el WS y uno disparado en paralelo por una
   llamada REST en la misma pestaña comparten la misma promesa en
   vuelo, sin doble rotación). `useRealtimeChannel.ts` gana una opción
   nueva, invocada solo cuando el cierre es específicamente
   `UNAUTHENTICATED` (nunca para los otros motivos fatales — esos
   siguen siendo fatales de inmediato, no son problemas de token): un
   intento de refresh antes de rendirse, una sola vez por ciclo de
   conexión (se resetea en cada `onopen`, para no entrar en loop si el
   token recién refrescado también es rechazado por otra razón).
   - Refresh exitoso → reconecta de inmediato con el token nuevo.
   - Refresh falla por error de red → se trata como una caída de
     transporte normal (mismo backoff ya existente), **no** como fatal.
   - Refresh rechazado explícitamente (el refresh token también venció
     o fue revocado) → ahí sí es fatal de verdad, se muestra "sesión
     expirada" como hoy — es el límite real del sistema, no hay forma
     de evitarlo.
   - Esta política (red vs. rechazo explícito) vive en un helper
     compartido en `packages/shared`, reutilizado por los 3 apps —
     mismo criterio de "una implementación, wrappers delgados por app"
     que ya sigue `fatalCloseReason`.
2. **Proactivo (cierra el hueco de fondo, crítico para el tablero).**
   Hook nuevo en `packages/ui` (ej. `useProactiveTokenRefresh`),
   montado una vez dentro del `AuthProvider` de cada app (los 3 ya
   tienen uno propio, ADR-063 punto 6 — no se unifican, solo cada uno
   monta el mismo hook compartido). Mientras haya sesión, refresca el
   `accessToken` por temporizador cada 5 minutos — bastante por debajo
   del TTL de 15 minutos como para que, en operación normal, el token
   casi nunca llegue a expirar de verdad, sin depender de que el WS se
   desconecte para disparar el refresh. Un fallo de un tick proactivo
   se registra y ya —nunca fuerza un cierre de sesión por sí mismo—;
   si de verdad hay un problema, la capa reactiva o el interceptor REST
   lo van a encontrar cuando algo necesite un token válido de verdad.

**Consecuencias.** Ninguna capa por sí sola es 100% infalible — un
tablero verdaderamente abandonado más de 30 días sin ningún tick
proactivo exitoso (ej. el proceso estuvo caído) sí terminaría
desloguéandose, y es el límite correcto del sistema, no un bug. Con
ambas capas juntas, el escenario real que se dio en esta prueba (unos
minutos de diferencia) queda cubierto con altísima fiabilidad, y el
tablero deja de depender de que su WS se caiga por accidente para
mantenerse autenticado.

## Referencias

- ADR-067 (rotación de refresh token — la promesa que este ADR
  finalmente cumple para tráfico puramente WS).
- ADR-075 (`useRealtimeChannel`, `fatalCloseReason`).
- ADR-063 punto 6 (`AuthContext` propio por app, no compartido).
- `packages/shared/api-client/api-client.ts` (`refreshOnce`, el
  deduplicado que el nuevo `refreshToken()` público reutiliza).

## ADR-092 — El botón "¡Ya llegué!" quedaba fuera de vista; abandonar el tracking sin avisar dejaba la recogida huérfana

**Contexto.** Reportado en pruebas manuales en producción: con estado
`arriving`, el botón "¡Ya llegué!" (`Tracking.tsx`, `apps/parent`) es
el **último** elemento del contenido — después del mapa, la tarjeta de
ETA, y hasta después de la nota del wake lock — así que en un teléfono
normal queda fuera de la pantalla inicial sin hacer scroll. En la
prueba, el tutor no lo vio, tocó "Volver" (botón `ghost` en el header,
sin ninguna confirmación) y la recogida quedó activa sin nadie mirando
la pantalla que la controla.

Investigado: sí existe un camino de regreso, pero es un efecto
colateral, no algo diseñado — `SelectInstitution.tsx` atrapa
`ACTIVE_PICKUP_REQUEST_EXISTS` al intentar solicitar de nuevo y busca
la recogida activa (`lookupActivePickupRequest`) para reencaminar al
tracking. Funciona, pero depende de que al tutor se le ocurra volver a
intentar solicitar la recogida — no hay ningún indicio en `Home.tsx`
("Mis hijos") de que algo sigue en curso.

**Decisión — tres piezas.**

1. **El botón "¡Ya llegué!" pasa a estar fijo en la parte inferior de
   la pantalla** mientras `isTracking` (`en_route`/`arriving`), no
   sujeto al orden del contenido — mismo criterio que cualquier CTA
   primario de una app móvil (patrón "action bar" fijo). El resto del
   contenido (mapa, ETA, cancelar) sigue el flujo normal y hace
   scroll debajo de esa barra fija; el contenedor scrollable gana el
   padding inferior necesario para no quedar tapado por la barra.
2. **Advertencia antes de "Volver"** mientras `isTracking` — mismo
   patrón visual ya usado en este archivo para "Cancelar recogida"
   (confirmación en línea, no un modal nuevo): "Seguir aquí" /
   "Salir de todos modos". Fuera de `isTracking` (ej. ya entregado),
   "Volver" navega directo, sin cambios.
3. **Banner de recogida en curso en `Home.tsx`**. Hook nuevo
   (`apps/parent`) que, para cada matrícula del tutor
   (`useMyEnrollments`), reutiliza el mismo `GET
   /pickup-requests?enrollmentId=X` que ya usa
   `lookupActivePickupRequest` en `SelectInstitution.tsx` — sin
   ningún cambio de backend. Si aparece una activa, "Mis hijos"
   muestra un banner arriba de la lista de alumnos con enlace directo
   al tracking. Simplificación deliberada: si hubiera más de una
   recogida activa a la vez (poco común — más de un hijo en camino al
   mismo tiempo), el banner solo destaca la primera encontrada; no se
   diseña una lista de varias por ahora.

**Consecuencias.** Las tres piezas atacan capas distintas del mismo
problema: la 1 evita que pase en primer lugar, la 2 avisa si aun así
se intenta salir, la 3 da una salida de emergencia genuina (no un
efecto colateral) para cualquier otra forma de abandonar la pantalla
(cerrar la pestaña, que el teléfono se bloquee, etc.) que ni la 1 ni
la 2 pueden cubrir.

**Nota de respaldo.** Confirmado con una segunda captura en otro
dispositivo: ahí el botón sí era visible sin scroll — la variación es
real, depende del tamaño de fuente/densidad de pantalla configurados
en cada teléfono, no es un fallo universal. Esto confirma que
"reordenar el contenido" no habría sido una solución suficiente por sí
sola (seguiría siendo frágil según el dispositivo); el botón fijo en
la parte inferior (punto 1) es la elección correcta porque no depende
de cuánto contenido quepa arriba.

## Referencias

- `apps/parent/src/screens/SelectInstitution.tsx`
  (`lookupActivePickupRequest`, el patrón que el banner de `Home.tsx`
  reutiliza).
- `apps/api/src/pickups/pickups.service.ts`
  (`ACTIVE_PICKUP_REQUEST_EXISTS`, sin cambios — se reutiliza tal cual).

## ADR-093 — Nuevo estado `approaching` para el radio de activación; cola de audio con pausas y dos tonos distintos (aviso vs. atención)

**Contexto.** Al revisar el radio de arribo/activación (pregunta del
humano), se confirmó en el código que `activationRadiusMeters` es un
campo de configuración de institución (editable en
`InstitutionProfile.tsx`) **sin ningún consumidor** — ni en
`location-ingestion.service.ts` (worker), ni en la creación de
recogidas (`pickups.service.ts`), ni en `apps/parent`. La propia UI ya
documenta la intención original ("habilita el botón «ya voy» del
tutor"), pero nunca se implementó. Se descarta esa idea original — el
botón "¡ya voy!" nunca debe deshabilitarse — y se define un uso nuevo:
marcar en el tablero, mediante un cambio de estado real (no solo un
flag visual), que el tutor ya está cerca, con un tono breve — sin voz,
sin nombre del alumno.

De paso se identificó un riesgo real de escala: con muchos alumnos en
recogida simultánea (ej. 100 niños a la salida), los voceos existentes
(`arriving`/`arrived`) se encolan uno tras otro sin pausa
(`tts.ts` no tiene cola propia, depende del serializado nativo del
navegador) — ininteligibles en sucesión, sumado al ruido ambiente de
la salida.

**Decisión.**

1. **Nuevo estado `approaching`**, agregado a
   `pickup_requests_status_enum` y
   `pickup_request_status_history_status_enum` (migración nueva) y al
   tipo `PickupRequestStatus` compartido. Transiciones nuevas en
   `pickup-request-status-machine.ts` (única fuente de verdad,
   ADR-024 pt.8): `en_route → approaching` se suma a las ya
   existentes; `approaching → [arriving, arrived, cancelled]` (mismo
   conjunto que ya tiene `en_route`, ya que `approaching` es un punto
   intermedio del mismo tramo, no una rama distinta).
2. **Detección en el worker** (`location-ingestion.service.ts`),
   mismo lugar y mismo patrón que ya evalúa `arriving` (distancia vía
   `haversineDistanceMeters`): se evalúa primero si se cumplen las
   condiciones de `arriving` (como hoy, ahora también válido viniendo
   desde `approaching`, no solo desde `en_route`); si no, y el estado
   sigue en `en_route`, se evalúa si la distancia cae dentro de
   `activationRadiusMeters` → transición a `approaching`. Un tutor que
   arranca ya muy cerca puede saltar `approaching` directo a
   `arriving`/`arrived` — el estado nunca es obligatorio de pasar, la
   máquina de estados ya lo permite.
3. **`isActiveBoardStatus`, `STATUS_PRIORITY`, `CANCELLABLE_STATUSES`
   (`apps/parent`), `TRACKING_STATUSES`/`isTracking`**: todos suman
   `approaching` al conjunto correspondiente — el viaje sigue en
   curso exactamente igual que en `en_route`/`arriving` (wake lock,
   botón "Ya llegué" visible, aviso al presionar "Volver", se puede
   cancelar). Etiqueta nueva para el badge del tutor: "Cerca".
4. **Audio del tablero — cola única, con pausas, dos tonos
   distintos.** Nuevo módulo de cola en `apps/board` (sin dependencia
   de archivos de audio — tonos generados con Web Audio API,
   `oscillator`, para no depender de assets):
   - **Timbre de activación** (`approaching`): un tono corto y suave,
     sin voz, sin nombre — distinto del tono de atención (punto
     siguiente) para no confundirse.
   - **Tono de atención**, distinto al anterior, breve, inmediatamente
     antes de cada voceo hablado (`arriving`/`arrived`) — para que se
     note que viene un anuncio importante.
   - **Una sola cola compartida** para los tres tipos de evento
     (timbre de activación, atención+voceo de `arriving`, atención+voceo
     de `arrived`) — nunca se solapan. Cada ítem deja una pausa fija
     después de terminar antes de que arranque el siguiente (breathing
     room real entre anuncios, no la simple concatenación que hace hoy
     el navegador).
   - **El botón manual de "volver a anunciar" (gate console) tiene
     prioridad sobre todo lo demás y nunca se omite — es explícito,
     no un descuido.** Si se dispara mientras algo ya está sonando,
     no lo interrumpe (evita cortar audio a la mitad y que suene mal),
     pero se inserta al frente de la fila de espera, así que es lo
     próximo en sonar en cuanto termine lo que esté en curso — nunca
     detrás de un backlog de anuncios automáticos. Como la cola nunca
     descarta nada (FIFO puro salvo esta única excepción de orden),
     "nunca se omite" ya se cumple por diseño; lo que faltaba era la
     prioridad de orden, no la garantía de que suene.
   - Nada de esto cambia el volumen o la insistencia — un timbre que
     se repite mucho por muchos alumnos simultáneos debe seguir siendo
     tolerable al oído, no un problema aparte a resolver ahora (se
     deja para evaluar con uso real, no se sobre-diseña de entrada).

**Consecuencias.** Migración con nuevo valor de enum + entrada en la
máquina de estados. El tablero gana un subsistema de audio propio
(antes no existía ninguna cola, solo llamadas directas a
`speechSynthesis.speak`), reutilizable si en el futuro se agregan más
tipos de anuncio. `activationRadiusMeters` dejó de ser un campo muerto
en la configuración de institución.

## Referencias

- `apps/portal/src/screens/InstitutionProfile.tsx` (línea 346, la
  descripción original que prometía deshabilitar el botón — ya no
  aplica, el botón nunca se deshabilita).
- `packages/shared/src/pickup-request-status-machine.ts` (ADR-024
  pt.8, única fuente de verdad de transiciones).
- `apps/board/src/board/tts.ts` (el `announcePickup` actual, sin cola
  — se envuelve, no se reescribe desde cero).
- `apps/portal/src/screens/GateConsole.tsx` (botón manual de
  "volver a anunciar", entra a la misma cola nueva).

## ADR-094 — Notificación de actualización disponible en las 3 apps, sin service worker nuevo, reutilizando el temporizador de ADR-091

**Contexto.** Reportado como fricción real: al desplegar una versión
nueva en producción, una pestaña ya abierta (tablero, portal, tutor)
no tiene ninguna forma de enterarse ni de aplicar la actualización.
Investigado: solo `apps/parent` tiene service worker (VitePWA,
`registerType: 'autoUpdate'`), pero **sin ninguna UI conectada** — el
SW puede actualizarse solo de fondo, pero nada se lo indica a la
persona ni fuerza la recarga de la pestaña ya abierta.
`apps/portal`/`apps/board` no tienen service worker en absoluto.

Se evaluó y descartó agregar un service worker nuevo a portal/tablero
para este fin. Motivos (discutidos a fondo con el humano):

1. Un SW no da detección "instantánea" gratis — igual necesita algo
   que llame a `registration.update()` periódicamente; por debajo es
   el mismo "revisar cada tanto", con más capas encima.
2. Intercepta todas las peticiones de red del alcance del SW por
   defecto — un mal alcance/estrategia de cache termina sirviendo
   datos viejos sin que nadie se dé cuenta hasta después, justo el
   tipo de falla silenciosa que ya se ha perseguido en ADR-091/092.
3. La activación de la versión nueva (worker "esperando" hasta
   `skipWaiting`/`clients.claim`) es una de las partes más propensas a
   bugs del estándar — el clásico `ChunkLoadError` de JS viejo en
   memoria pidiendo un archivo con hash que ya no existe.
4. Portal y tablero se construyeron deliberadamente "network-first"
   (más sensibles a esto que `apps/parent`, que ya documentó el mismo
   riesgo en ADR-063 pt.1) — meter un SW ahí no es un paso incremental
   pequeño, es un subsistema entero nuevo con su propio ciclo de vida.

También se descartó polling con timer propio: reutiliza el mismo
temporizador de `useProactiveTokenRefresh` (ADR-091, cada 5 min, ya
montado en las 3 apps) en vez de agregar un segundo bucle
independiente — cero temporizadores nuevos en la app.

**Decisión.**

1. **Identificador de versión por build.** Cada build genera un
   identificador (ej. commit corto de git) inyectado en el bundle vía
   `define` de Vite, y escrito además a un archivo estático liviano
   (`/version.json`) servido con cache corto/nulo — necesario en
   nginx (fuera del repo, pendiente de revisión directa en el
   servidor junto con el resto de la config no versionada) para que
   ese archivo puntual nunca quede cacheado de más, aunque el resto de
   los assets con hash sí puedan cachearse agresivamente sin riesgo.
2. **`useProactiveTokenRefresh` (ADR-091) gana un `onTick` opcional**,
   invocado en cada ciclo junto al refresh de token — cada
   `AuthProvider` le pasa una función que hace `fetch('/version.json',
   { cache: 'no-store' })` y compara contra el id con el que arrancó
   la pestaña.
3. **`UpdateBanner` compartido** (`packages/ui`), on-brand,
   inconfundible, anclado arriba (no abajo, para no chocar con la
   barra fija de "¡Ya llegué!" de ADR-092) — texto claro + botón
   "Actualizar ahora" → `window.location.reload()`.
4. **Momento de mostrarlo, distinto por app:**
   - `apps/parent`: el chequeo corre siempre en el tick, pero el
     banner solo se muestra si `useActivePickupRequest()` (ADR-092) no
     devuelve una recogida activa — nunca interrumpe un seguimiento en
     curso.
   - `apps/portal`: mismo criterio de "momento ideal" — se difiere
     mientras `queue.busyId !== null` en `GateConsole.tsx` (una
     confirmación de entrega en curso). Fuera de eso, se muestra de
     inmediato.
   - `apps/board`: sin banner con botón — se **auto-actualiza**, pero
     solo cuando `boardAudioQueue.isIdle()` (nuevo método en la cola
     de ADR-093: `queue.length === 0 && !draining`) — nunca corta un
     timbre o un voceo a la mitad. Antes de recargar: guarda
     `selectedDeliveryPointId` (hoy vive en `useState` puro, se pierde
     en cualquier reload) en `sessionStorage`, muestra un aviso breve
     en pantalla, recarga, y al montar de nuevo restaura el filtro de
     puerta guardado.

**Consecuencias.** Cero temporizadores nuevos, cero service workers
nuevos. La detección queda acotada al mismo intervalo de 5 minutos de
ADR-091 — no es instantánea, pero es un salto real desde "nunca" a
"máximo 5 minutos", sin el riesgo de un SW mal configurado sirviendo
contenido viejo por accidente. `selectedDeliveryPointId` del tablero
deja de perderse en cualquier reload futuro, no solo en el de esta
actualización.

## Referencias

- ADR-091 (`useProactiveTokenRefresh`, el temporizador reutilizado).
- ADR-092 (`useActivePickupRequest`, el criterio de "momento ideal"
  en `apps/parent`; la barra fija inferior que define por qué el
  banner va arriba).
- ADR-093 (`boardAudioQueue`, `isIdle()` nuevo sobre esa misma cola).
- ADR-063 pt.1 (riesgo de cache stale ya documentado para
  `apps/parent`, la razón por la que no se repite en portal/tablero).

## ADR-095 — `apps/parent`: el service worker nunca activaba la versión nueva; se resuelve sin reabrir la puerta al auto-reload que ADR-094 evitó a propósito

**Contexto.** Detectado al ayudar a un usuario con la PWA instalada en
su teléfono desde antes de ADR-094: la app no detectaba ninguna
actualización. Investigado en el código real: `sw-src/sw.ts` (el
service worker propio de `apps/parent`, `strategies: 'injectManifest'`
por el handler de push de ADR-066 pt.6) nunca llama a
`self.skipWaiting()` ni escucha ningún mensaje para forzarlo. Con
`registerType: 'autoUpdate'`, `vite-plugin-pwa` sí inyecta un script de
registro en `index.html` que intenta activar la versión nueva y
recargar por su cuenta — pero como el SW nunca responde a esa señal,
la versión nueva se queda "esperando" indefinidamente mientras haya
una instancia vieja abierta. Ese es el bug inmediato.

Pero agregar solo la pieza que falta (el listener de `skipWaiting`)
sin más **reabre un problema que ADR-094 ya había resuelto a
propósito**: con `autoUpdate`, el script de `vite-plugin-pwa` recarga
la página por su cuenta en cuanto detecta la versión nueva, sin
coordinarse con nada — exactamente el auto-reload sin avisar que
ADR-094 evitó deliberadamente con `useActivePickupRequest` (nunca
interrumpir una recogida en curso). Confirmado explícitamente con el
humano: en `apps/parent`, la actualización **siempre** requiere
confirmación explícita del usuario — nunca debe aplicarse sola.

**Decisión.**

1. `registerType` cambia de `'autoUpdate'` a `'prompt'` — el script
   inyectado por `vite-plugin-pwa` deja de recargar por su cuenta;
   instala la versión nueva en silencio y espera.
2. `sw-src/sw.ts` gana el listener que falta:
   `self.addEventListener('message', (event) => { if (event.data?.type
   === 'SKIP_WAITING') self.skipWaiting(); })` — ahora sí puede
   activarse, pero solo cuando se le indique explícitamente.
3. `apps/parent` registra el SW una vez al iniciar (vía
   `virtual:pwa-register`, la API oficial del plugin) y guarda la
   función `updateSW` que expone. El botón "Actualizar ahora" del
   banner de ADR-094 deja de hacer `window.location.reload()` a secas
   y pasa a llamar `updateSW(true)` — que manda la señal de
   `SKIP_WAITING` correcta y solo entonces recarga.
4. **ADR-094 sigue siendo la única fuente de verdad de "hay una
   actualización" y de "cuándo es seguro mostrarla"** — la detección
   (comparación de `__APP_BUILD_ID__` contra `/version.json`, cada 5
   min vía el timer de ADR-091) y el criterio de "no interrumpir una
   recogida activa" no cambian. Este ADR solo corrige *qué pasa* una
   vez que la persona ya confirmó que quiere actualizar — antes,
   apenas si acaso llegaba a recargar; ahora sí toma la versión
   correcta del service worker.
5. No se usa `onNeedRefresh`/`onOfflineReady` del plugin — ADR-094 ya
   cubre la detección por su cuenta, no hace falta una segunda señal
   en paralelo.

**Consecuencias.** `apps/parent` sigue siendo la única de las 3 apps
con service worker, y ahora es la única con esta corrección — no
aplica a `apps/portal`/`apps/board`. Cualquier PWA instalada antes de
este cambio necesita, una única vez, cerrarse por completo y
reabrirse para recibir el service worker corregido — a partir de ahí,
el ciclo completo (detectar → avisar → confirmar → activar) queda
resuelto de punta a punta.

## Referencias

- ADR-094 (detección + criterio de "momento ideal" — la pieza que NO
  cambia aquí).
- ADR-066 pt.6 (por qué es `injectManifest` con un SW propio, no
  `generateSW` — el handler de push que obliga a tener `sw-src/sw.ts`
  a mano).
- ADR-063 pt.1 (precache de solo el app-shell, sin runtime caching de
  la API — tampoco cambia).

## ADR-096 — Versión visible en las 3 apps, reutilizando `__APP_BUILD_ID__` de ADR-094

**Contexto.** Pedido directo: poder confirmar qué versión tiene
instalada cada app, sin depender de adivinar por comportamiento. El
dato ya existe — `__APP_BUILD_ID__`, inyectado en build por
`buildIdPlugin` (ADR-094) — solo faltaba un lugar donde mostrarlo.
Ninguna pantalla nueva del lado del backend.

**Decisión.**

1. **Componente compartido** en `packages/ui` (ej.
   `AppVersionLabel`), texto pequeño tipo `v{buildId}`, reutilizado
   por las 3 apps — mismo dato, sin duplicar la lectura de
   `__APP_BUILD_ID__` en cada una.
2. **`apps/parent`**: al final de `PortalProfile.tsx` ("Perfil"), en
   el flujo normal de contenido. **`apps/portal`**: al final de
   `Profile.tsx` (perfil del usuario — lo usan tanto personal de
   institución como super-admin, no la pantalla de configuración de
   institución). Mismo tono visual que el resto del texto secundario
   de esas pantallas (`--ink-300`, "muted labels").
3. **`apps/board`**: sin pantalla de perfil, nadie navega nada en un
   kiosco. Confirmado con el humano que el tablero lo ve el público
   (padres/alumnos en la puerta), no solo personal — la etiqueta va
   en una esquina de la pantalla principal, deliberadamente casi
   invisible (`--ink-100`, "icon idle", el tono más tenue de la
   escala), pensada para quien la busca a propósito (soporte/debug),
   no para el ojo casual de un padre o alumno.

**Consecuencias.** Ningún cambio de datos ni de backend — solo
consume lo que ADR-094 ya expone. Sin cambios de comportamiento.

## Referencias

- ADR-094 (`__APP_BUILD_ID__`/`buildIdPlugin`, el dato que se
  reutiliza aquí sin cambios).

## ADR-097 — "Actualizar ahora" no recargaba: dos relojes de detección de versión nunca se sincronizaron

**Contexto.** Reportado por un usuario tras ADR-095/096: el banner de
actualización apareció, le dio clic a "Actualizar ahora", y la
pantalla no recargó — tuvo que cerrar la app por completo y reabrirla
para recibir la versión nueva.

Investigado directamente en el código real instalado
(`node_modules/vite-plugin-pwa@1.3.0/dist/client/build/register.js`,
no solo la documentación): `updateServiceWorker` (lo que exponemos
como `updateSW`) **no recarga la página por sí solo** — solo manda el
mensaje `SKIP_WAITING`. Quien recarga es un listener del evento
`'controlling'` que la librería arma interna y automáticamente, pero
**únicamente dentro de `showSkipWaitingPrompt()`**, que a su vez solo
se dispara cuando el propio chequeo del navegador (`wb.addEventListener
('waiting', ...)`, el mecanismo nativo de `ServiceWorkerRegistration`
que revisa si `sw.js` cambió) detecta una versión nueva por su cuenta
— con su propio calendario interno del navegador, no relacionado a
nada de este proyecto. `setupServiceWorker()` (ADR-095) nunca conectó
el callback `onNeedRefresh`, que es donde ese armado ocurre.

El problema de fondo: **dos relojes de detección corriendo sin
coordinarse.** ADR-094 compara `__APP_BUILD_ID__` contra
`/version.json` cada 5 min (rápido, y el que efectivamente mostró el
banner). El navegador revisa `sw.js` por su cuenta, en un calendario
propio mucho menos predecible. Si se hace clic en "Actualizar ahora"
antes de que el segundo reloj haya alcanzado al primero, la señal de
`SKIP_WAITING` se manda, pero el listener que recargaría la pantalla
nunca se armó — el clic no hace nada visible.

**Decisión.**

1. `setupServiceWorker()` (`apps/parent/src/update/service-worker.ts`)
   captura también el `ServiceWorkerRegistration` real (vía
   `onRegisteredSW`, ya disponible en las opciones de `registerSW`) y
   conecta `onNeedRefresh` para saber con certeza cuándo el navegador
   ya confirmó una versión nueva lista (y, como efecto colateral
   correcto de conectar ese callback, es también cuándo la propia
   librería arma su listener de recarga).
2. `applyPendingUpdate()` deja de asumir que ya hay una versión lista
   solo porque ADR-094 lo dice. Al hacer clic: si el navegador aún no
   confirmó nada, se fuerza `registration.update()` (el chequeo
   inmediato, en vez de esperar el calendario propio del navegador), y
   se espera (con un tope de tiempo corto) a que `onNeedRefresh`
   dispare antes de mandar `updateSW(true)`. Si aun así se agota el
   tiempo sin confirmación, se cae a un `window.location.reload()`
   simple — mejor eso que un botón que visiblemente no hace nada,
   aunque en ese caso extremo no hay garantía de tomar la versión más
   nueva en el primer intento.
3. La detección en sí (ADR-094, el banner, el criterio de "no
   interrumpir una recogida activa") no cambia — este ADR corrige
   únicamente la mecánica de activación una vez que la persona ya
   confirmó que quiere actualizar.

**Consecuencias.** "Actualizar ahora" pasa de ser "probablemente
funcione, dependiendo de qué tan rápido haya sido el chequeo interno
del navegador" a "siempre fuerza el chequeo en el momento del clic" —
determinístico, no depende de la suerte de cuándo cayó el calendario
interno del navegador. Cualquier PWA que ya haya recibido ADR-095 (no
solo instalaciones nuevas) hereda la corrección en el próximo
`sw.js` que reciba.

## Referencias

- ADR-095 (el service worker que esta corrección arregla — no lo
  reemplaza, corrige la mecánica de activación).
- ADR-094 (detección independiente vía `/version.json` — sigue siendo
  la única fuente de "hay una actualización", sin cambios).
- `node_modules/vite-plugin-pwa/dist/client/build/register.js` (código
  fuente real de la versión instalada — la referencia que reveló el
  problema, no la documentación pública del paquete).

## ADR-098 — Separar navegación real de identidad/sesión en los 3 shells: "Perfil" y "App móvil" dejan de vivir amontonados en el pie; `/profile` entra al shell correcto por rol

**Contexto.** Revisión de capturas reales de los 3 shells de portal
señaló el mismo problema de fondo en tres lugares distintos: mezclar
navegación real (pantallas a las que se puede ir) con el bloque de
identidad/sesión del usuario (avatar, nombre, rol, cerrar sesión), en
vez de separarlos con claridad visual.

Confirmado contra el código real:

1. `PROFILE_PATH` (`apps/portal/src/App.tsx`) está registrado como
   ruta hermana de `InstitutionGate`, no dentro de `InstitutionShell`
   ni de `OpsShell` — `Profile.tsx` se renderiza sin sidebar ni
   topbar, sin forma de navegar salvo el botón "atrás" del navegador.
   El comentario que justificaba esto citaba "ADR-078 point 1", que en
   realidad no dice eso — la razón real (verificada en
   `AuthenticatedLayout.tsx`) es que `InstitutionGate` bloquea con un
   estado vacío a cualquier cuenta sin membresía de institución,
   incluyendo cuentas OPS/super-admin; anidar `/profile` ahí dejaría a
   un operador sin poder llegar a su propio perfil. Por eso quedó
   fuera de todo shell, no por una decisión de layout.
2. `InstitutionShell.tsx`/`OpsShell.tsx`: el pie de sidebar
   (avatar+nombre+rol) trae debajo, en el mismo bloque, "Perfil" y
   "Cerrar sesión" como dos enlaces de texto — exactamente lo que
   ADR-079 punto 1 decidió a propósito ("esos ítems son secciones de
   la institución/operación... no configuración de su propia
   cuenta"). Confirmado con el humano: ese criterio seguía siendo
   razonable en su momento, pero ADR-079 no identificó el problema que
   motiva este ADR — el amontonamiento visual de 5 elementos
   (avatar, nombre, rol, "Perfil", "Cerrar sesión") en un bloque de
   pie pensado para 2. Se revierte ese punto específico.
3. `TutorShell.tsx` (`apps/parent`): mismo patrón — "App móvil"
   (`backToMobile`, decisión de ubicación de ADR-078 punto 4 ítem 3,
   "cerca del pie de cuenta... es lo más consistente") vive pegado
   arriba del bloque de avatar+"Cerrar sesión", en vez de la lista de
   navegación principal donde ya viven "Mis hijos"/"Asociar
   institución"/"Tutores autorizados"/"Perfil".

**Decisión.**

### 1. `Profile.tsx` se monta dentro del shell correcto según rol, no como ruta suelta

Se elimina el registro de `PROFILE_PATH` como hijo directo de
`AuthenticatedLayout` en `App.tsx`. Se registra dos veces, cada una
como hija del shell correspondiente — mismo componente `<Profile />`
reutilizado en ambas, ya que la pantalla es agnóstica de rol (usa
`useProfile()` sobre `/users/me`, no toca `useInstitution()`):

- Dentro del árbol de `InstitutionShell` (anidado en `InstitutionGate`,
  junto a las 9 rutas existentes) — para personal de institución.
- Dentro del árbol de `OpsShell` (anidado en `SuperAdminRoute`, junto
  a `ADMIN_INSTITUTIONS_PATH`/`ADMIN_METRICS_PATH`) — para operador.

De regalo, esto le da a `/profile` breadcrumb ("Institución / Perfil"
u "Operador / Perfil") y resaltado activo en la nav, que hoy no tiene.

`Profile.tsx` ajusta su JSX raíz: el `<main style={{minHeight:
'100vh', background: 'var(--bg-app)', padding: 'var(--space-10)'}}>`
propio se reemplaza por el mismo patrón de `<div>` simple
(`maxWidth: 820`, sin fondo ni padding propios) que ya usa
`InstitutionProfile.tsx` para pantallas que viven dentro de un
shell — el `<main>` del shell ya aporta fondo, padding y scroll; el
`<main>` propio de `Profile.tsx` duplicaría ambos y anidaría dos
landmarks `<main>`. El botón "Cerrar sesión" que ya tiene en su propia
tarjeta de cabecera se conserva sin cambio (ADR-079 punto 3 ya
estableció que el acceso duplicado — pie del shell + dentro de la
pantalla — no es dañino).

### 2. `InstitutionShell`/`OpsShell`: "Perfil" pasa a ser un ítem normal de navegación — revierte ADR-079 punto 1

Se agrega `{ path: PROFILE_PATH, label: 'Perfil', icon: 'user' }` al
arreglo `NAV` de ambos shells: 10º ítem en `InstitutionShell` (después
de "Reportes"), 3er ítem en `OpsShell` (después de "Instituciones").
El pie de sidebar se recorta a solo avatar+nombre+rol y "Cerrar
sesión" — se quita el span de "Perfil" y el separador `·`.

El set de iconos de `apps/portal` (`institution/icons.tsx`, compartido
por ambos shells) no tenía un ícono de persona individual — solo
`'users'` (grupo, ya usado por "Personal"). Se agrega un ícono
`'user'` nuevo, transcribiendo el mismo path (círculo + arco) que
`apps/parent/src/portal-web/icons.tsx` ya usa para su propio ítem
"Perfil" — mismo criterio que el propio archivo documenta (sin
librería de íconos, SVG plano, igual que el resto del proyecto).

### 3. `apps/parent`, `TutorShell`: "App móvil" pasa a ser un ítem normal de navegación

Se mueve del bloque de pie a un `NavItem` más, renderizado justo
después del `.map()` de `NAV` (debajo de "Perfil", el último ítem
real), usando el mismo componente que los 4 ítems reales — paridad
visual completa. No se integra al arreglo `NAV` mismo: no es una ruta
dentro de `TutorShell` (llama a `setSurface('movil')` y navega fuera,
a `apps/parent`'s superficie móvil), así que nunca lleva estado
activo. El pie se recorta al mismo patrón que los otros dos shells:
avatar+nombre+rol y "Cerrar sesión" únicamente.

**Consecuencias.** Los 3 shells del proyecto (Institución, Operador,
Tutor) convergen en el mismo pie de sidebar — identidad y sesión
únicamente, cero navegación — cerrando el ciclo que ADR-079 dejó
parcial (solo `TutorShell` tenía "Perfil" bien ubicado desde el
principio). Sin cambios de backend, sin endpoints nuevos. "Cerrar
sesión" no se mueve de ningún pie — sigue siendo la única acción de
sesión pura en los 3 shells, junto con el avatar/nombre/rol.

## Referencias

- ADR-072/074 (`InstitutionShell`/`OpsShell` originales, el patrón de
  pie de sidebar que este ADR recorta).
- ADR-078 punto 3 (`TutorShell`, patrón de shell replicado) y punto 4
  ítem 3 (ubicación original de "App móvil", que este ADR reubica).
- ADR-079 (decisión que este ADR revierte parcialmente — solo el punto
  1, para `InstitutionShell`/`OpsShell`; los puntos 2 y 3 — "Perfil"
  ya bien ubicado en `TutorShell`, botón de cerrar sesión duplicado
  dentro de `Profile.tsx` — quedan sin cambio).
- ADR-090 (colapso responsive de sidebar en los 3 shells, sin cambios
  de este ADR).

## ADR-099 — Aviso de privacidad y consentimiento explícito en registro (LFPDPPP)

**Contexto.** `docs/arquitectura.md` declara desde el inicio del proyecto,
como principio de diseño obligatorio, que al manejarse datos de
**menores** + **ubicación** debe existir "aviso de privacidad y
consentimiento explícitos". Nunca se implementó — encontrado como gap en
la auditoría exhaustiva de Fase 10 (a petición del humano, "qué nos está
haciendo falta para terminar el proyecto"): búsqueda exhaustiva en las 3
apps (`consent`, `acepto`, `términos`, `privacidad`, `privacy`) sin
ningún resultado, ni pantalla, ni checkbox, ni texto legal en ningún
lado. De los gaps reales encontrados en esa auditoría, es el único con
riesgo de producto/legal genuino — los otros dos (ADRs retroactivos de
infraestructura, `specs/ui-screens/` vacía) son puramente de
trazabilidad documental.

Verificado contra el código real: ni `RegisterGuardianDto` ni
`RegisterInstitutionDto` (`apps/api/src/auth/dto/`) tienen campo alguno
de consentimiento; ni `TutorRegisterForm`
(`apps/parent/src/screens/Login.tsx`) ni `RegisterInstitutionForm`
(`apps/portal/src/screens/Login.tsx`) tienen checkbox ni enlace legal
antes de su botón "Crear cuenta"; `users` no tiene ninguna columna
relacionada.

**Decisión.**

### 1. Alcance: solo registros nuevos de aquí en adelante

Confirmado con el humano — **no hay ningún mecanismo retroactivo** para
las cuentas que ya existen en producción hoy, ni bloqueante en su
próximo login ni recordatorio pasivo. No es deuda técnica pendiente, es
una decisión de producto explícita: dado el volumen real de cuentas en
este momento, el costo de construir un flujo retroactivo (interstitial
de bloqueo, o similar) no se justifica todavía. Puede reabrirse en el
futuro si el volumen de cuentas activas creadas antes de este ADR se
vuelve significativo.

### 2. Contenido: fuente única compartida, versionado como texto libre

El aviso vive en `docs/aviso-privacidad.md` — versionado en git como
cualquier otro documento del proyecto, no en base de datos. Cambiar el
texto en el futuro no requiere migración de esquema, solo actualizar ese
archivo e incrementar la constante `PRIVACY_NOTICE_VERSION` en el código
(valor inicial `"2026-08"`). Mismo criterio de versión como string libre
que ya usa `audit_log.action` (ADR-018 punto 9) — sin enum cerrado de
Postgres.

Contenido único compartido entre `apps/portal` y `apps/parent` (ambas
apps recolectan datos del mismo sistema, no tiene sentido tener dos
textos que puedan desincronizarse). Vive como constante embebida en
`packages/ui` — decisión de implementación de Claude Code, no
`packages/shared` (que es framework-free; el aviso solo lo consumen
componentes React). `apps/board` no lo necesita — no registra a nadie.

**Redactado por Claude, revisado y confirmado por Rubén Aguirre** — no
sustituye una revisión legal formal si el proyecto pasa a operar con
instituciones reales fuera de un entorno de prueba/tesis; para el
alcance actual (tesis, pilotos) el borrador razonado se consideró
suficiente. Responsable identificado: Rubén Aguirre, Ciudad de México;
contacto para derechos ARCO: `privacidad@casillego.com.mx` (buzón nuevo
por crear, distinto de `no-reply@mail.casillego.com.mx` que es
transaccional y sin revisión humana).

### 3. Mecanismo de aceptación: 2 columnas nuevas en `users`

`privacy_accepted_at` (timestamptz, nullable) + `privacy_notice_version`
(varchar(20), nullable). Nullable porque coexisten dos poblaciones en la
misma tabla: cuentas viejas (siempre `NULL`, permanentemente, por el
punto 1) y cuentas nuevas (obligatorio, nunca `NULL`). No se modela como
entidad propia — dos columnas bastan, mismo criterio minimalista que el
resto del proyecto (no construir especulativamente sin necesidad
demostrada, ADR-070/074).

`RegisterGuardianDto`/`RegisterInstitutionDto.admin` ganan
`acceptedPrivacyNotice: boolean`, validado con `@Equals(true)` de
`class-validator` (debe ser exactamente `true`, no cualquier booleano) —
ausente o `false` cae en el `400 INVALID_PAYLOAD` ya existente del
proyecto (con `details`, mismo mecanismo de siempre, sin código de error
nuevo). Checkbox `required` en ambos formularios, justo antes del botón
"Crear cuenta", con enlace inline al aviso integral (modal, sin sacar al
usuario del formulario). En el caso de reutilización de cuenta existente
(ADR-028 punto 2), el consentimiento se escribe igual sobre el `users`
reutilizado — es un evento real ocurriendo en ese envío, no se omite.

### 4. Acceso persistente después del registro

Enlace fijo para releer el aviso en cualquier momento — mismo lugar que
"Cerrar sesión" en el pie de los 3 shells que ADR-098 dejó limpio, y al
final de las pantallas de Perfil (mismo patrón que `AppVersionLabel`,
ADR-096).

**Consecuencias.** Sin impacto para las cuentas existentes — ningún
comportamiento suyo cambia. Dos campos nuevos obligatorios en 2
formularios de registro (institución, tutor); si el checkbox no se
marca, el registro no procede. Contenido legal versionado en texto
plano dentro del repo, no en base de datos — actualizarlo en el futuro
es un cambio de código simple, sin migración.

## Referencias

- `docs/arquitectura.md` § "Privacidad y marco legal (LFPDPPP)" — el
  principio de diseño que este ADR finalmente implementa.
- ADR-018 punto 8 (retención de 90 días de `location_updates`,
  referenciada en el contenido del aviso).
- ADR-028 punto 2 (reutilización de cuenta existente en registro de
  institución, caso que este ADR también cubre).
- ADR-096 (`AppVersionLabel`, patrón de enlace persistente en Perfil).
- ADR-098 (pie de los 3 shells, dónde vive el enlace al aviso).
- `docs/aviso-privacidad.md`,
  `specs/features/031-aviso-privacidad-consentimiento.md`,
  `specs/entities/user.md`.

## ADR-100 — Retroactivo: nginx en vez de Caddy, DNS en Linode en vez de Akky

**Contexto.** ADR-010 planeó el despliegue por subdominios asumiendo Caddy
como reverse proxy y Akky como administrador de DNS. La producción real
(`casillego.com.mx` y sus 4 subdominios) usa **nginx** y **DNS en
Linode** — ninguna de las dos coincide con lo planeado, y ninguna de las
dos tenía un ADR propio que explicara el cambio. Encontrado como gap en
la auditoría exhaustiva de Fase 10 (a petición del humano, "qué nos está
haciendo falta para terminar el proyecto"): de los 3 gaps reales
encontrados en esa auditoría, este es puramente de trazabilidad
documental, sin riesgo de producto — el sistema funciona bien con
nginx/Linode, solo faltaba que el registro escrito lo reflejara.

**Decisión — ambas desviaciones comparten la misma razón de fondo:
practicidad, reusar infraestructura propia ya existente y conocida, en
vez de adoptar herramientas nuevas solo porque el plan original las
mencionaba.**

### 1. nginx en vez de Caddy

El VPS de Linode donde se despliega CasiLlego no se aprovisionó desde
cero para este proyecto — es un servidor que Rubén ya usaba para
desplegar otras aplicaciones propias, con **nginx ya corriendo ahí** y
experiencia previa suya con nginx. Al llegar el momento de desplegar
CasiLlego, usar el reverse proxy que ya estaba montado y que ya conocía
fue más simple que introducir Caddy como herramienta nueva y separada
solo para este proyecto. Caddy no se descartó por ninguna limitación
técnica encontrada — nunca se llegó a evaluar en la práctica.

### 2. DNS en Linode en vez de Akky

En Akky **solo se compró el dominio** (`casillego.mx`, `casillego.com.mx`,
`casillego.com`) — nunca se contrató hosting ni panel de DNS ahí. Como
el VPS de Linode ya existía, usar la gestión de DNS que Linode ya ofrece
sobre ese mismo panel fue más simple que sumar el panel de Akky como un
sistema aparte que administrar — un solo lugar para VPS + DNS + (vía
certbot) certificados, en vez de dos. Los registros SPF/DKIM/TXT de
Resend (`mail.casillego.com.mx`) también viven ahí, mismo criterio.

**Consecuencias.** Sin cambios de código ni de comportamiento — es
documentación alcanzando a una realidad que ya llevaba meses en
producción. `ADR-010` queda con una nota apuntando aquí (no se reescribe
su texto original: describía el plan válido en su momento, no un error).
Cualquier futura migración de proveedor de DNS o de reverse proxy
debería evaluarse contra este mismo criterio de practicidad, no asumir
que Caddy/Akky siguen siendo la referencia por ser lo documentado
originalmente en ADR-010.

## Referencias

- ADR-010 (plan original que este ADR corrige retroactivamente, sin
  reescribirlo).
- `docs/decisiones.md` — nota de corrección agregada directamente en el
  texto de ADR-010, apuntando aquí.

## ADR-101 — `specs/ui-screens/` se descarta como tipo de spec del proyecto

**Contexto.** `specs/README.md` definía un 4to tipo de spec — una por
pantalla "hero" o compleja (tablero de institución, consola de puerta,
"Camino A" del tutor) — dejado vacío desde el inicio "pendiente de los
tokens del design system". Encontrado como gap en la auditoría exhaustiva
de Fase 10 — el tercero y último de los 3 gaps reales de esa auditoría
(los otros dos, aviso de privacidad y ADRs retroactivos de
infraestructura, ya se resolvieron en ADR-099 y ADR-100).

**La causa real no fue solo "tokens bloqueados, luego nadie volvió"**
(corrección aportada por el humano tras la primera versión de este
análisis): los tokens de ADR-036 llegaron, pero eso no significó
pantallas ya alineadas a los kits reales. Se siguieron construyendo
pantallas desalineadas de `ui_kits/portal-admin`, `tablero-institucion` y
`puerta-consola` durante buena parte del proyecto — tarjetas centradas
sueltas sin el shell del kit, tablero sin sus 3 modos reales. Ese
desalineamiento recién se detectó en auditorías tardías (ADR-071 para el
tablero; ADR-072/073/074 para el portal), que obligaron a **regenerar**
pantallas que ya estaban construidas para alinearlas de verdad al
design system. Es decir: las pantallas fueron un blanco móvil durante
la mayor parte del proyecto, no un objetivo estable — nunca hubo un
punto intermedio razonable donde congelar una spec de `ui-screens/`
tuviera sentido, porque para cuando los tokens ya existían, las
pantallas todavía no coincidían con el diseño real. Solo se
estabilizaron de verdad hasta esas auditorías, ya muy avanzada la Fase
7/9 del proyecto.

**Decisión.** Se descarta `ui-screens/` como tipo de spec del proyecto —
no queda pendiente, es una decisión final. La complejidad de las 3
pantallas que debía cubrir ya está capturada en otro lado:

- El **tablero de institución** (3 modos: Andén, Sereno, Carril) está
  documentado en ADR-071 (rediseño completo contra el kit real, la
  auditoría que detectó el desalineamiento) y ADR-069 (lógica de
  fusión/voceo).
- La **consola de puerta** (layout de dos paneles, código de entrega,
  "Vocear") está en ADR-073 (misma auditoría, mismo hallazgo) y ADR-024
  (flujo completo de `pickup_request`).
- **"Camino A"** (seguimiento del tutor: mapa, ETA, Wake Lock, código de
  entrega) está en ADR-063 a ADR-066 — esta pantalla no pasó por el
  mismo ciclo de regeneración tardía que el tablero/portal, se mantuvo
  más estable desde su construcción original.

Escribir `ui-screens/` retroactivamente, ahora que las 3 pantallas por
fin están construidas y estables, duplicaría esa documentación sin el
beneficio real que SDD busca — atrapar problemas de diseño **antes** de
construir, no documentar después de que ya se construyó, se descubrió
desalineada, y se reconstruyó. Mismo criterio que ADR-070 (QR de código
de entrega) y ADR-074 punto final (roles de OPS): documentar la decisión
de no construir/no escribir especulativamente, en vez de dejarlo como
pendiente indefinido sin resolver.

**Consecuencias.** `specs/ui-screens/` permanece vacía (`.gitkeep`) de
forma permanente — no es deuda técnica ni un hueco de metodología sin
cerrar, es una decisión informada por lo que realmente pasó: el tipo de
spec habría llegado tarde de cualquier forma, dado que las pantallas
tardaron en estabilizarse mucho más de lo que el plan original
anticipaba. `specs/README.md` actualizado para reflejar esto. Ninguna
pantalla nueva del proyecto necesitará este tipo de spec en el futuro
salvo que se revierta explícitamente esta decisión con su propio ADR.

## Referencias

- ADR-036 (tokens del design system — llegaron antes de que las
  pantallas estuvieran alineadas, no resolvieron el desalineamiento por
  sí solos).
- ADR-071 (tablero) y ADR-072/073/074 (portal) — las auditorías tardías
  que detectaron el desalineamiento y forzaron la regeneración de
  pantallas ya construidas; documentan de facto lo que `ui-screens/`
  hubiera cubierto.
- ADR-063–066 (Camino A) — la única de las 3 pantallas que no pasó por
  un ciclo de regeneración tardía.
- ADR-024 (flujo completo de `pickup_request`, consola de puerta).
- ADR-070 (QR), ADR-074 punto final (roles OPS) — mismo criterio de
  documentar una decisión de no construir/no escribir, en vez de dejarlo
  pendiente.
- `specs/README.md`.

## ADR-102 — Cierre de 4 ítems mecánicos del backlog técnico: `rimraf`, `sideEffects:false`, `@eslint-react/eslint-plugin`, deduplicación de `asApiError`

**Contexto.** A petición del humano de cerrar el backlog técnico
documentado en `docs/plan-implementacion.md` uno por uno, se separaron
los 12 ítems en 3 categorías: mecánicos sin decisión de producto (este
ADR), decisiones ya tomadas con condición de reapertura no cumplida
(sin cambios), y la revocación de refresh token (feature real, ADR
propio pendiente). Los 4 puntos de este ADR se investigaron y
**probaron de verdad** contra el repo real antes de escribir esta
decisión — no son cambios especulativos.

**Decisión.**

### 1. `npm run clean` — `rimraf` como devDependency de `packages/shared`

Verificado: de los 6 workspaces, **solo `packages/shared`** tiene un
script `clean` (`rimraf dist`) — la nota original del backlog
("verificar los 6 workspaces") sobreestimaba el alcance real. Se agrega
`rimraf` como devDependency de `packages/shared` únicamente.

### 2. `packages/shared`: `sideEffects: false`

Probado empíricamente, no solo razonado: sin el flag, `mqtt` (importado
a nivel de módulo en `node-mqtt-client.ts`, re-exportado por el barrel
raíz) sí termina en el bundle de producción de `apps/portal` —
confirmado con `grep` sobre el JS minificado real. Con `"sideEffects":
false` agregado, el bundle de `apps/portal` baja de 737.69 kB a 633.34
kB gzip (~14%, ~104 kB) y el string `mqtt` desaparece del bundle.
`apps/parent` y `apps/board` compilan sin cambios de comportamiento;
`apps/api`/`apps/worker` no se ven afectados (corren en Node vía
NestJS, sin bundler — `sideEffects` es un concepto de tree-shaking de
Vite/Rollup/webpack, no de resolución de módulos de Node). Los 1160
tests del repo pasan sin cambios.

### 3. `eslint-plugin-react` → `@eslint-react/eslint-plugin`

`eslint-plugin-react` sigue sin declarar soporte para ESLint 10 más de
un año después de publicada su última versión (7.37.5) — mismo tipo de
bloqueo que ADR-021 ya documentó para TypeScript 7.
`@eslint-react/eslint-plugin` sí lo soporta, instala limpio junto al
resto del stack del proyecto (`eslint-plugin-react-hooks@7.1.1`, que —
verificado — ya convivía bien con ESLint 10 pese a lo que sugerían los
issues públicos consultados; el bloqueo real era solo la mitad de reglas
JSX, no las de hooks) y no introduce ningún requisito de Node nuevo (el
proyecto ya declaraba `"engines": {"node": ">=24.11"}` desde antes,
exactamente lo que este plugin pide).

Agregado su config `recommended` al mismo bloque de archivos que ya
tenía las reglas de `react-hooks`, en `eslint.config.mjs`. Corrido
`npm run lint` contra todo el código real: **0 errores, 24 warnings**
(sugerencias de React 19 — `useContext`→`use`, deps faltantes en
`useEffect`, convención de nombres de setters — nada crítico). La regla
que específicamente preocupaba (`no-missing-key`, equivalente a
`react/jsx-key`, activa como `error` en el preset `recommended`) pasó
limpia en todo el repo — no había ningún bug de `key` escondido, pero
ahora si apareciera se detectaría.

**Los 24 warnings quedan tal cual, sin corregir en este ADR** — son
mejoras de código legítimas pero no son la deuda que este ADR cierra
(cobertura de lint ausente); corregirlas es trabajo aparte, opcional,
sin urgencia.

### 4. Deduplicación de `asApiError`

Verificado programáticamente (hash de las 17 copias): las 17
implementaciones locales de `asApiError` en los 3 frontends son
**byte-idénticas** entre sí y con la versión ya promovida a
`packages/shared/src/api-client/api-error.ts` (ADR-075 Paso 2). Se
reemplazan las 17 por el import de `@casillego/shared` — cambio
mecánico puro, sin ADR de diseño propio (ya lo decía así la nota
original del backlog), documentado aquí solo para cerrarlo formalmente
junto con los otros 3 puntos mecánicos de esta sesión.

**Consecuencias.** Sin cambios de comportamiento visibles para el
usuario en ninguno de los 4 puntos. `docs/plan-implementacion.md`
actualizado — estos 4 ítems salen de "Backlog técnico" y se marcan
resueltos. Los 8 ítems restantes del backlog (3 decisiones de producto
diferidas sin cambios, la nota sobre tests de integración que no es
deuda real, y la revocación de refresh token) no se tocan en este ADR.

## Referencias

- ADR-021 (compuerta de calidad; mismo tipo de bloqueo de ecosistema que
  motivó la elección de versión de TypeScript ahí).
- ADR-036 (design system; primera vez que se documentó la ausencia de
  `eslint-plugin-react`).
- ADR-075 (extracción de `asApiError` a `packages/shared`, Paso 2 —
  este ADR completa la migración de los consumidores restantes).
- `docs/plan-implementacion.md` § Backlog técnico.

## ADR-103 — Revocación de refresh token vía `token_version`, activada al cambiar contraseña

**Contexto.** ADR-019 punto 3 aceptó conscientemente el refresh token
stateless como limitación del MVP y lo dejó como ítem de backlog. Al
retomarlo (a petición del humano, cierre del backlog técnico), se
investigó el mecanismo real antes de diseñar nada:

- `POST /auth/refresh` ya revalida `users.status` en cada uso (enmienda
  de ADR-019 en Fase 4) — una cuenta suspendida bloquea la renovación
  con retraso máximo de 15 min (el TTL del access token). El hueco real
  es más angosto de lo que sugiere la nota del backlog: **un refresh
  token robado de una cuenta que sigue `active`** no se puede invalidar
  antes de sus 30 días.
- Cada llamada a `/auth/refresh` ya rota el refresh token (ADR-067,
  emite uno nuevo) — pero nunca invalida el anterior, que sigue siendo
  válido hasta su propio vencimiento. La rotación existe, no "quema"
  nada.
- No existe ningún endpoint de logout — cerrar sesión es 100% del lado
  cliente (`AuthContext.logout()` solo borra `localStorage`), sin aviso
  al servidor.
- `JwtStrategy` (protege cada request autenticado) es completamente
  stateless — sin consulta a base de datos por request. Cualquier
  diseño que agregue una consulta ahí afecta el costo de *todas* las
  llamadas autenticadas del sistema, no solo las de refresh.

**Decisión.** Se descarta una tabla de sesiones/tokens revocados (lo que
sugiere literalmente la nota original del backlog, `revoked_tokens`) a
favor de algo más liviano: **`users.token_version`, un entero simple**.
Confirmado con el humano — alcance mínimo, sin tabla de sesiones
individuales ni acción de administrador sobre otros usuarios.

- Columna nueva `users.token_version` (`integer`, `NOT NULL`, default
  `0`).
- El refresh token gana un claim `tokenVersion` (además de `sub`/`type`)
  con el valor de `users.token_version` al momento de emitirse.
- `POST /auth/refresh` compara `payload.tokenVersion` contra
  `user.tokenVersion` actual — si no coinciden, `401
  INVALID_REFRESH_TOKEN` (mismo código ya existente, sin código nuevo).
- **Único disparador que incrementa `token_version`: un cambio de
  contraseña exitoso** (`UsersService.changePassword()`). Hoy cambiar tu
  contraseña *no* invalida ningún token ya emitido — con esto, si
  alguien tenía un token robado de tu cuenta, cambiar tu contraseña lo
  saca. Confirmado con el humano: **sin endpoint ni botón de UI
  dedicados** ("cerrar sesión en todos los dispositivos") — queda
  exclusivamente como efecto secundario interno del cambio de
  contraseña, no como feature aparte.
- `JwtStrategy` no se toca — el chequeo vive únicamente en
  `POST /auth/refresh`. Un access token ya emitido antes del incremento
  sigue funcionando hasta su propio TTL de 15 min; mismo límite que ya
  existía para una cuenta que pasa a `suspended`, no una regresión.

**Lo que esto no resuelve, a propósito:**
- No hay detección automática de reuso de un token ya rotado (exigiría
  rastrear cada token individualmente, no un contador). Un token robado
  y usado por un atacante *antes* que el dueño legítimo no dispara
  ninguna alerta ni revocación automática — la revocación es siempre
  reactiva (el dueño cambia su contraseña), nunca proactiva.
- No se puede invalidar una sola sesión/dispositivo dejando las demás
  vivas — es todo o nada para ese usuario. Coincide con el escenario
  real que motiva esto (perdiste el dispositivo, no sabes cuál token
  robaron) mejor que con un panel de "dispositivos conectados" que el
  proyecto no tiene en ningún otro lado.
- Ningún admin puede forzar el cierre de sesión de otro usuario — sería
  una decisión de autorización aparte (¿puede un admin de institución
  sobre su propio personal? ¿solo super-admin sobre cualquiera?), fuera
  de alcance de este ADR.

**Consecuencias.** Sin nueva entidad, sin job de limpieza/purga (a
diferencia de `location_updates`, ADR-018, no hay una tabla que crezca —
es una sola columna por usuario). `specs/entities/user.md` y
`specs/api-contracts/{auth,users}.md` actualizados. Migración simple,
sin backfill (default `0` para todas las cuentas existentes).

## Referencias

- ADR-019 punto 3 y su enmienda (decisión original que este ADR retoma;
  el chequeo de `users.status` en refresh que ya existía y que este ADR
  no modifica).
- ADR-067 (rotación de refresh token en cada uso — el comportamiento que
  reveló que rotar no es lo mismo que revocar).
- ADR-059 punto 3 (`POST /users/me/change-password`, el endpoint donde
  vive el único disparador de este ADR).
- `specs/entities/user.md`, `specs/api-contracts/auth.md`,
  `specs/api-contracts/users.md`.

## ADR-104 — `npm run check` fallaba en un clon 100% fresco: `lint` corría antes de que `packages/shared` existiera compilado

**Contexto.** Encontrado al verificar la implementación de ADR-103: en
un clon genuinamente nuevo (sin `packages/shared/dist/` construido de
ninguna sesión anterior), `npm run check` fallaba con **más de 2000
errores falsos** (`@typescript-eslint/no-unsafe-assignment`,
`no-unsafe-member-access`, etc.) en cascada por todo el repo — nada
relacionado con código real. Causa: el script
`"check": "lint && format:check && build && test"` corre `lint`
**antes** de `build`; el linting type-aware no puede resolver los tipos
de `@casillego/shared` sin su `dist/` compilado (`packages/shared` es la
única pieza del monorepo con paso de compilación propio — `packages/ui`
no lo necesita, sus `exports` apuntan directo a `./src/index.ts`,
consumido crudo por Vite). Nunca se había detectado porque el entorno de
desarrollo local ya tenía `packages/shared` construido de sesiones
anteriores — el mismo síntoma que `npm run dev:api` tuvo en ADR-046, con
la misma causa de fondo: un paso que asume compilación previa sin
garantizarla.

**Decisión.** Se agrega `npm run build:shared` (ya existía como script)
como prepaso de `check`:

```json
"check": "npm run build:shared && npm run lint && npm run format:check && npm run build && npm run test"
```

Se eligió sobre la alternativa de reordenar a `build && lint && ...`
(construir los 5 workspaces antes de lintear) porque solo
`packages/shared` es la dependencia real que otros workspaces necesitan
resuelta para el linting type-aware — construir los otros 4 primero solo
alargaría el gate sin resolver nada que `lint` necesite.

Probado en un clon 100% virgen, sin ningún paso manual: `npm run check`
completo pasa limpio (0 errores de lint, 24 warnings esperados de
ADR-102, 1162 tests) partiendo de cero, sin `dist/` de ningún workspace
preexistente.

**Consecuencias.** Sin cambios de comportamiento del código — es
puramente el orden del script de calidad. Relevante para cualquier
revisión que clone el repo desde cero y corra `npm run check` para
verificar que todo funciona (defensa de tesis incluida) — antes de este
ADR, ese flujo exacto habría fallado con miles de errores falsos.

## Referencias

- ADR-021 (compuerta de calidad original, define el script `check`).
- ADR-046 (mismo patrón de causa raíz: un paso que asume estado
  compilado previo sin garantizarlo — ahí `npm run dev:api`, aquí
  `npm run check`).
- ADR-103 (la verificación de su implementación fue lo que reveló este
  problema).

## ADR-105 — Panel "Requiere atención" del Dashboard: implementación real de las 3 condiciones

**Contexto.** El Dashboard de institución (`apps/portal`) tiene desde
ADR-072 §6 un panel "Requiere atención" con contenido **fijo de
ejemplo**, marcado explícitamente en el código como no-real
(`PLACEHOLDER_ALERTS`, con un comentario que dice textualmente "NOT real
data — no alert concept exists yet in the domain"). A petición del
humano, se construyen las 3 condiciones reales — que resultan ser
exactamente los 3 ejemplos que ya estaban ahí, palabra por palabra.

Investigación previa al diseño, contra el código real:

- El feed que alimenta el resto del Dashboard (`view=monitor`,
  reutilizado de Carril, ADR-071) filtra explícitamente
  `status IN (ACTIVE_STATUSES)` — **excluye canceladas y entregadas a
  propósito**, correcto para un tablero operativo en vivo. Esto
  descarta extender ese mismo feed para cubrir el caso de recogidas
  canceladas: nunca llegan al cliente por ese canal.
- `pickup_request_status_history.changed_at` ya registra el momento
  exacto de cada transición de estado — no hace falta ninguna columna
  nueva para saber cuándo un viaje entró a `arrived`.
- `student_guardians.relationship` ya incluye `'driver'` en su enum
  desde el modelo original — el dato "es un chofer" ya existe, no hace
  falta agregarlo.
- Ya existe una función reutilizable,
  `resolveDismissalWindowEnd`/`resolveDeadline`
  (`apps/api/src/institution-reports/punctuality.ts`, ADR-060 punto 4),
  que resuelve la ventana de salida vigente de hoy **por nivel del
  alumno** (excepción del día gana sobre ventana recurrente,
  coincidencia de nivel gana sobre "todos los niveles") — ya la usa el
  cálculo de puntualidad de reportes.

**Decisión.**

### 1. Endpoint propio, no una extensión del feed en vivo

`GET /institutions/:id/attention-items` — mismo patrón de autorización
que `GET /institutions/:id/delivered-today` (ADR-072 §6 enmienda):
visible para cualquier `institution_member`, sin restricción de `role`
(a diferencia de `GET /institutions/:id/reports`, que exige `role =
admin`, ADR-060 punto 6). Mismo criterio de "endpoint propio, no
reutilizar el de reportes ni el feed en vivo" que ya se aplicó ahí.
Consultado una vez al montar el Dashboard y refrescado cada 60s por
temporizador del lado cliente — **no** por el canal WS del tablero: la
condición 1 (tiempo esperando) cambia de relevancia con el simple paso
del tiempo, sin que ocurra ningún evento que la dispare; forzarla al
patrón de deltas WS existente no encaja.

### 2. Las 3 condiciones, cada una con su propia consulta

- **`waiting_too_long`**: `pickup_requests.status = 'arrived'` cuya
  fila más reciente en `pickup_request_status_history` con `status =
  'arrived'` tiene `changed_at` más antiguo que
  `institutions.attention_wait_minutes` minutos (nuevo, ver punto 3).
- **`cancelled_no_followup`**: `status = 'cancelled'`, completado hoy,
  sin otro `pickup_requests` del mismo `enrollment_id` creado después,
  **y** todavía dentro de la ventana de salida de hoy — reutilizando
  `resolveDismissalWindowEnd`/`resolveDeadline` tal cual, sin
  reimplementar la lógica. Confirmado con el humano: la ventana se
  cierra "hasta que termine la ventana de salida del día", no las 24h
  completas — después de esa hora, una recogida cancelada sin
  seguimiento deja de mostrarse.
- **`first_time_guardian`**: viaje activo (no terminal) para el cual el
  `guardian_user_id` nunca completó un `delivered` previo para ese
  mismo `enrollment_id`. **Reemplaza la idea original de "marcar toda
  recogida por chofer autorizado"** — confirmado con el humano tras
  evaluarlo: marcar cada recogida de un chofer habitual sería puro
  ruido para una familia que lo usa a diario. Lo que de verdad amerita
  atención no es la `relationship` de quien recoge, sino que el staff
  nunca lo ha visto recoger a ese alumno específico — aplica igual a un
  chofer sustituto, un abuelo que nunca antes había recogido, o
  cualquier tutor autorizado en su primera vez. Requiere índice nuevo
  `(enrollment_id, guardian_user_id, status)` en `pickup_requests` — no
  existía ninguno que cubriera esta consulta.

### 3. `institutions.attention_wait_minutes`, configurable por institución

Columna nueva (`int`, `NOT NULL`, default `20`) — mismo patrón exacto
que `arrival_tolerance_minutes`/`advance_notice_minutes`/
`arriving_lead_minutes`, que ya existen con esta forma. Confirmado con
el humano: **20 minutos de arranque, no los 12 del ejemplo original** —
en Ciudad de México, 12 minutos es prácticamente puntual dadas las
condiciones de tráfico reales; además debe poder variar por
institución, dado que la accesibilidad de la zona no es uniforme.
Editable en `InstitutionProfile.tsx`, misma sección donde ya se editan
los otros 3 umbrales.

**Consecuencias.** El panel deja de mostrar contenido de ejemplo —
puede aparecer vacío (`EmptyState`) si ninguna de las 3 condiciones
aplica, cosa que `PLACEHOLDER_ALERTS` nunca permitía mostrar. Sin
cambios al feed `monitor` ni a Carril (`apps/board`) — las 3 consultas
nuevas viven aparte. `institutions.attention_wait_minutes` no tiene
backfill que decidir (default `20` cubre todas las instituciones
existentes).

## Referencias

- ADR-072 §6 (origen del panel, contenido de ejemplo marcado como no-real
  en el propio código).
- ADR-071 punto 1 (visibilidad del Dashboard a cualquier
  `institution_member`, sin restricción de `role`).
- ADR-072 §6 enmienda (patrón de `delivered-today`: endpoint propio, no
  reutilizar `institution-reports`).
- ADR-060 punto 4 (`resolveDismissalWindowEnd`/`resolveDeadline`,
  reutilizadas tal cual desde `institution-reports/punctuality.ts`).
- ADR-084 (nivel del alumno vía `enrollment.group?.name`, consumido igual
  aquí que en reportes).
- ADR-025 (`arrival_tolerance_minutes`/`advance_notice_minutes`, el
  patrón que `attention_wait_minutes` replica).
- `specs/features/032-panel-requiere-atencion.md`,
  `specs/api-contracts/pickup-requests.md`,
  `specs/entities/{institution,pickup_request}.md`.

## ADR-106 — `.gitattributes`: forzar LF sin importar el `core.autocrlf` de quien clone

**Contexto.** Durante la verificación de ADR-103 y de nuevo en ADR-105,
`npm run format:check` marcó archivos (`packages/shared/package.json`,
luego 6 archivos más: `auth.service.{ts,spec}`, `users.service.{ts,spec}`,
`user.entity.ts`) como mal formateados **en la máquina local de Rubén**
(Windows), sin poder reproducirse en ningún clon de verificación (siempre
Linux). Confirmado antes de decidir nada: un clon 100% fresco en Linux
tiene `format:check` limpio — el contenido real de cada blob del repo ya
está en LF. La causa es puramente de checkout: `core.autocrlf=true` en
Windows convierte a CRLF los archivos al bajarlos, y `prettier --check`
(que por default espera `eol: "lf"`) marca esa conversión como una
violación de formato — un falso positivo local que nunca fue un problema
del repositorio.

**Decisión.** `.gitattributes` en la raíz con `* text=auto eol=lf` —
fuerza LF en todo archivo de texto sin importar la configuración de
`core.autocrlf` de quien clone, sea cual sea su sistema operativo. Se
agregan también extensiones binarias explícitas (`.png`, `.ttf`, y otras
comunes que hoy no existen en el repo pero podrían agregarse después:
`.jpg`/`.gif`/`.ico`/`.woff`/`.woff2`) para que `text=auto` nunca intente
normalizarlas por error de detección de contenido.

Verificado con `git add --renormalize .` antes de commitear: **cero
archivos necesitaron cambiar** — confirma que todo blob ya almacenado
era LF puro, el fix es preventivo para el futuro, no una corrección de
contenido existente.

**Para que el checkout local de Rubén quede al día** (el `.gitattributes`
nuevo no toca retroactivamente archivos ya en el disco, solo aplica a
checkouts nuevos): re-clonar el repo desde cero es lo más simple y a
prueba de errores; la alternativa es `git add --renormalize .` sobre el
checkout existente después de traer este commit.

**Consecuencias.** Cierra la clase de falso positivo completa, no
archivo por archivo — sin este ADR, cualquier sesión futura en Windows
podía volver a producir el mismo síntoma en un archivo distinto. Sin
cambios de contenido en ningún archivo del repo.

## Referencias

- ADR-104 (mismo tipo de hallazgo: un falso positivo de `npm run check`
  que solo aparece en checkouts "distintos" al entorno de desarrollo
  habitual — ahí un clon 100% fresco sin build previo, aquí un checkout
  en Windows).

## ADR-107 — Landing page pública en `landing/`, fuera de los workspaces de npm

**Contexto.** `casillego.com.mx` está planeado como "landing/sitio
comercial" desde ADR-010 (el ADR fundacional de despliegue), como la 5ª
pieza del esquema junto a `portal.`/`app.`/`tablero.`/`api.` — nunca se
construyó. A petición del humano, se construye finalmente, con dos
requisitos explícitos: HTML plano (sin framework) para que los
buscadores la indexen sin depender de renderizado del lado del cliente,
y que transmita calidez/confianza además de explicar el producto.

**Decisión.**

### 1. Ubicación: `landing/` en la raíz del repo, no un workspace de npm

Confirmado con el humano en dos pasos — primero que la página en sí no
necesita build ni framework (coincide con el requisito de indexabilidad:
un SPA de React como los otros 3 frontends no sirve aquí sin
renderizado del lado del servidor, que sería sobre-ingeniería para una
sola página estática), y después, explícitamente, que la carpeta vive
en **este mismo repositorio** — no uno aparte. Las razones: ADR-010 ya
trataba este dominio como la misma familia de decisiones que los otros
4 subdominios; toda la disciplina de ADRs/specs de este proyecto vive en
un solo lugar, relevante para la trazabilidad de la defensa de tesis; y
el script de despliegue que ya cubre los otros 3 subdominios puede
extenderse para incluir esta carpeta sin coordinar dos repos.

`landing/index.html` + 2 fotos, sin `package.json`, sin lint/format de
`npm run check` (no es código, y `.gitattributes`/ADR-106 ya cubre el
único problema real que un archivo de texto plano podría tener — line
endings). Wiring de nginx para servir esta carpeta en el dominio raíz
queda fuera del repo, mismo límite que ya establecieron ADR-010/100
para el resto de la infraestructura — el humano lo configura
directamente en el VPS.

**Sin spec de `specs/features/`** — el template de feature (Given/When/
Then, entidades, contrato de API) no aplica a contenido estático sin
lógica de negocio ni backend; sería forzar la metodología donde no
encaja, mismo criterio que ya se aplicó a ADR-098 (reordenamiento de UI
sin tocar datos).

### 2. Identidad visual: tokens del design system existente, sin uno nuevo

Reutiliza los tokens reales de `packages/ui/src/tokens/` (coral de marca
`#fb6a45`, tonos navy, tipografía Schibsted Grotesk) embebidos
directamente en el `<style>` del HTML — visualmente consistente con las
3 apps sin necesitar un pipeline de build compartido. El comentario
`/* Brand (coral pin) */` de `colors.css` inspiró el logotipo nuevo: un
pin geométrico simple en ese mismo color, junto al wordmark — no existía
ningún logo previo en el repo.

### 3. Contenido: sin afirmaciones que no se puedan sostener

Confirmado el criterio de contenido: nada de estadísticas ni testimonios
inventados, ni una sola institución real hoy en producción (confirmado
en la sesión de backlog técnico). El cierre dice "pensado para
instituciones de Ciudad de México", no una afirmación de tracción que
sería falsa. La estructura (hero / problema / cómo funciona / CTA doble
/ footer) confirmada con el humano.

El hero muestra el journey de 4 estados (En camino → Llegando → En
puerta → Entregado) con los colores reales de `pickup_requests.status`
— más específico y honesto que una foto de stock genérica o un
gradiente, aunque terminó reubicado dentro de "Cómo funciona" (punto 4)
cuando se agregaron fotos al hero.

### 4. Fotografía: generada por IA, editada para quitar una señalización ficticia problemática

El humano generó 2 fotos con un generador de imágenes, a partir de
prompts detallados que esta sesión escribió (composición, luz,
encuadre, y explícitamente "sin letreros ni logos de escuela visibles").
Ambas imágenes resultantes sí mostraban el nombre de una institución
("St. Mary's Elementary School", "Oakwood Elementary") en letreros de
fondo, pese a la instrucción — se difuminó esa zona específica en cada
imagen (`ImageFilter.GaussianBlur` sobre la región exacta, sin recortar
ni alterar el resto de la composición) antes de integrarlas. Usar el
nombre de una institución específica, real o con apariencia de serlo,
en el sitio de un producto sin relación con ella habría sido engañoso
— se corrigió antes de publicar, no se dejó pasar.

**Consecuencias.** 3 archivos nuevos (`landing/index.html`,
`landing/hero-photo.jpg`, `landing/cierre-photo.jpg`), cero cambios a
código existente. `docs/plan-implementacion.md` actualizado. Pendiente
fuera de este ADR: configurar nginx en el VPS para servir esta carpeta
en `casillego.com.mx` (dominio raíz) — mismo patrón que ya existe para
los otros 4 subdominios, documentado fuera del repo desde ADR-010/100.

## Referencias

- ADR-010 (planeó `casillego.com.mx` → landing/sitio comercial desde el
  inicio del proyecto).
- ADR-100 (límite ya establecido: configuración de infraestructura fuera
  del repo).
- ADR-099 (`/privacy`, enlazada desde el footer de la landing).
- ADR-098 (mismo criterio de "sin spec de feature cuando no aplica SDD").
- ADR-106 (`.gitattributes`, cubre line endings de `landing/index.html`
  igual que el resto del repo).
- `docs/design-brief.md` (posicionamiento y personalidad de marca,
  fuente del copy).

## ADR-108 — `pin-mark.svg`/`pin-mark-inverse.svg`: `viewBox` con espacio vacío asimétrico, corregido en la fuente

**Contexto.** Al ajustar el logo de `landing/index.html` (ADR-107) a
petición del humano, se encontró que el `viewBox="0 0 100 116"` del pin
no está centrado alrededor de la forma que dibuja: el pin ocupa
verticalmente el rango y≈30–113 dentro de esas 116 unidades — 30 de
margen vacío arriba, solo 3 abajo. Cualquier consumidor que centre la
caja del SVG por flexbox (`align-items: center`) termina con el pin
visiblemente corrido hacia abajo, porque centra la caja, no la forma
visible dentro de ella. En `landing/index.html` se corrigió recortando
el `viewBox` a `0 28 100 88` en la copia embebida ahí (ADR-107 ya
decidió que esa carpeta vive fuera de los workspaces, sin poder
importar de `packages/ui` — la duplicación de estas rutas SVG entre
`landing/` y `packages/ui` es una consecuencia ya aceptada de esa
decisión, no algo nuevo que resolver aquí).

El mismo bug existe en la fuente real que sí consume la aplicación:
`packages/ui/src/assets/pin-mark.svg` y su variante
`pin-mark-inverse.svg` (mismo `viewBox`, solo invierte los colores —
pin blanco/anillo coral en vez de pin coral/anillo blanco). Único
consumidor real: `BrandPanel.tsx` (panel izquierdo de las 6 pantallas
de acceso — `Login`/`VerifyEmail`/`AcceptInvitation` en `apps/parent` y
`apps/portal`, ADR-081), vía `<img src={pinMark}>` con las clases
`.cll-brand-panel-logo-mark` (`29×34` escritorio, `20×23` móvil,
ADR-086).

**Decisión.** Se corrige en la fuente, no en cada consumidor — mismo
criterio que ya se aplicó al centralizar `asApiError`
(ADR-075/ADR-102) o `resolveDismissalWindowEnd` (reutilizada, nunca
reimplementada, ADR-105): un solo lugar que arreglar, todo consumidor
presente y futuro se beneficia sin más cambios.

- `packages/ui/src/assets/pin-mark.svg` y `pin-mark-inverse.svg`:
  `viewBox` de `0 0 100 116` a `0 28 100 88` — igual que el recorte ya
  probado en `landing/index.html`, sin tocar los `path`/`g` internos.
- `BrandPanel.tsx`, clase `.cll-brand-panel-logo-mark`: las
  dimensiones se recalculan para la nueva proporción (`100:88` en vez
  de `100:116`), manteniendo el mismo alto que ya tenía cada breakpoint
  — el ancho es lo único que cambia, calculado como
  `alto × (100/88)`. Escritorio: `29×34` → `39×34`. Móvil: `20×23` →
  `26×23`. No es una decisión de tamaño nueva — es la proporción
  correcta para el mismo alto ya elegido en ADR-086.

**Consecuencias.** Las 6 pantallas de acceso (`Login`, `VerifyEmail`,
`AcceptInvitation` × 2 apps) quedan con el logo correctamente
centrado respecto al wordmark "CasiLlego", mismo criterio visual que
ya tiene `landing/index.html`. Sin cambios de contenido, solo
geometría del `viewBox` y las 4 dimensiones de la clase CSS.

## Referencias

- ADR-107 (el recorte de `viewBox` ya probado en `landing/index.html`,
  que este ADR replica en la fuente real).
- ADR-081 (las 6 pantallas de acceso que usan `BrandPanel`).
- ADR-086 (dimensiones actuales de `.cll-brand-panel-logo-mark` por
  breakpoint, que este ADR ajusta en proporción, no en alto).
- ADR-075/ADR-102, ADR-105 (mismo criterio de corregir en la fuente
  compartida, no en cada consumidor).
