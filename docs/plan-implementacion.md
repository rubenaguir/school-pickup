# Plan de implementación — CasiLlego

> Guía de secuencia para saber "qué sigue" en cualquier momento del proyecto.
> No duplica contenido de otros documentos — solo referencia y ordena. Fuente
> de verdad de cada tema sigue viviendo en `docs/decisiones.md`,
> `docs/modelo-datos.md`, `docs/arquitectura.md` y `specs/`.
>
> Actualizar los checkboxes conforme se avanza. Es un documento vivo.

## Metodología

Este proyecto sigue Spec Driven Development (SDD): cada pieza se especifica en
`specs/` **antes** de escribir código de implementación. Ver `specs/README.md`
para el detalle de los 4 tipos de spec (`entities/`, `features/`,
`api-contracts/`, `ui-screens/`).

Orden general: **documentación de dominio → specs → código**. Nunca se salta
directo a código sin spec, salvo scaffolding trivial (configuración de
proyecto, tooling).

La compuerta de calidad (`npm run check`, ver ADR-021) es la defensa mecánica
de esta regla: `CLAUDE.md` §"Reglas de implementación" exige que ningún campo,
endpoint o invariante se implemente sin estar en su spec, y que toda
"Invariante de negocio" quede respaldada por un test o un constraint de BD.

---

## Fase 0 — Fundamentos documentales ✅ completo

- [x] Modelo de datos (`docs/modelo-datos.md`), 14 entidades
- [x] ADRs 001–033 (`docs/decisiones.md`)
- [x] Arquitectura y flujo de tiempo real (`docs/arquitectura.md`), incluyendo
      el `InstitutionMembershipGuard` (aislamiento multi-tenant a nivel API)
- [x] `specs/entities/*.md` — las 14 entidades especificadas con campos,
      relaciones, índices, invariantes y enums

### Tooling y compuerta de calidad ✅ completo

- [x] Frontends (`portal`, `parent`, `board`) en React 19.2 + Vite 8.1
- [x] Compuerta `npm run check`: ESLint 10 + typescript-eslint 8 (type-aware)
      → Prettier 3 (`format:check`) → build (typecheck real) → Vitest 4
- [x] TypeScript fijado en 5.9.3
- [x] `.prettierignore`: Prettier formatea código, no `docs/`, `specs/` ni
      markdown en general
- [x] `CLAUDE.md` §"Reglas de implementación"
- [x] Node 24.18 instalado y `.nvmrc` fijado; `engines` del monorepo en
      `>=24.11`

## Fase 1 — Specs de features y contratos de API ✅ completo

- [x] Los 4 vertical slices especificados, validados y cerrados:
      - [x] Auth + aprobación de `enrollment` (features 001–007, ver ADR-019)
      - [x] Configuración de institución (features 008–013, ver ADR-022)
      - [x] Catálogo de vehículos + tutores autorizados (features 014–017,
            ver ADR-023)
      - [x] Flujo completo `pickup_request` + topics MQTT (features 018–023,
            ver ADR-024)
- [x] 14 `specs/entities/*.md`, 12 `specs/api-contracts/*.md`, 23
      `specs/features/*.md`
- [x] Validación cruzada completa entre specs y `docs/` (ADR-025, ADR-026):
      índices únicos parciales que excluyen estados terminales en
      `enrollments`/`student_guardians`, convención 409/422 ampliada,
      protección append-only de `audit_log`, consolidación de
      `audit_log.action` a `student_guardian.*`

### Pendiente explícito para un slice futuro (no bloquea Fase 2) — ✅ resuelto

- [x] **Consola de super-admin — aprobar/suspender instituciones.** No existían
      features para `institution.approved`/`institution.suspended` pese a ser
      acciones auditables ya previstas (ADR-018 punto 1). Gap de cobertura,
      no contradicción — se especificó junto con el resto de la consola de
      super-admin. Ver ADR-026 punto 6. **Resuelto — ADR-040,
      `specs/features/025-aprobacion-suspension-institucion.md`,
      `institution-status.controller.ts` (`PATCH :id/approve`/`:id/suspend`).
      Encontrado sin marcar aquí durante la auditoría exhaustiva de esta
      sesión — el ítem ya se daba por resuelto en la tabla de "Decisiones
      pendientes" más abajo, pero no aquí.**

## Fase 2 — Fundamentos de código compartido (`packages/shared`) ✅ completo

- [x] Tipos TypeScript compartidos (`packages/shared/src/types/`), 14
      archivos, paridad 1:1 con `specs/entities/*.md`
- [x] Máquina de estados de `pickup_request`
      (`pickup-request-status-machine.ts`), función pura sin TypeORM ni
      NestJS, conjunto de transiciones validado contra ADR-024 punto 8 con
      cobertura de test exhaustiva (las 25 combinaciones posibles)
- [x] Interfaces de los ports (`packages/shared/src/ports/`): `MapsProvider`,
      `EmailProvider` (6 `kind` de mensaje, ver ADR-009), `MqttClient` — sin
      implementación concreta todavía (Fase 4/6), sin dependencia de framework
- [x] Constantes y builders de topics MQTT: ya existían en
      `packages/shared/src/index.ts` desde el scaffolding inicial
      (`boardTopic`, `pickupLocationTopic`, `MQTT_TOPIC_ROOT`); se agregó el
      builder faltante de `delivery-point/queue` extendiendo ese mismo
      archivo — no se creó un archivo nuevo
- [x] Validado contra specs y docs: compuerta de calidad end-to-end, paridad
      de tipos, máquina de estados, ports, y topics MQTT, sin discrepancias

## Fase 3 — Entidades TypeORM y migraciones (`apps/api`) ✅ completo

- [x] Entidades de TypeORM 1:1 con `specs/entities/*.md` (14, nombres de
      tabla en plural — ver ADR-027)
- [x] Migraciones versionadas, en el orden topológico verificado en
      `specs/README.md`: PostGIS → 14 tablas → 7 índices únicos parciales →
      trigger append-only de `audit_log`
- [x] Índices únicos parciales: `vehicles.is_primary`,
      `student_guardians.is_primary`, vínculo/solicitud activa única en
      `enrollments` y `student_guardians`, recogida activa única y
      `delivery_code` único activo en `pickup_requests` (ADR-018, ADR-024,
      ADR-026), más índice GIN en `delivery_points.assigned_groups`
- [x] Protección append-only de `audit_log` vía trigger de base de datos
      (`BEFORE UPDATE OR DELETE`, rechaza incondicionalmente) — corregido de
      la propuesta original de `REVOKE` (no protege contra el dueño de la
      tabla en Postgres), ver enmienda a ADR-026 punto 4. Probado con
      `INSERT`/`UPDATE`/`DELETE` reales contra la base local.
- [x] Conexión a Postgres+PostGIS local verificada (sin contenedor)
- [x] Scripts `migration:generate`/`migration:run`/`migration:revert` en
      `package.json`; `CLAUDE.md` actualizado con los comandos reales
- [x] `npm run check` en verde: lint, formato, build de los 5 workspaces,
      41/41 tests

## Fase 4 — Módulo de autenticación ✅ completo

- [x] `auth` module: JWT (access + refresh) + Passport.js — registro
      (institución + tutor, con reutilización de cuenta condicionada a
      contraseña, ADR-028 punto 2), login, refresh, verificación de correo,
      reenvío con límite 3/hora + cooldown 60s
- [x] Endpoints de registro/login diferenciados institución vs. tutor (ver
      `docs/design-brief.md`, sección "Acceso")
- [x] Servicio de activación por token unificado (`ActivationTokenService`),
      diseñado extensible a invitaciones de personal/tutor sin rediseño
      (ADR-022 punto 3) — el endpoint de aceptación en sí queda para Fase 5
- [x] Errores de la API con `{ code, message }` en inglés (ADR-028 punto 1);
      `code` `ACCOUNT_SUSPENDED` reutilizado consistentemente entre
      `login` y `refresh`
- [x] `InstitutionMembershipGuard` (aislamiento multi-tenant a nivel API,
      ADR-022 punto 4) — implementado y probado con mocks, sin consumidores
      todavía (los módulos de Fase 5 lo cablean); `@InstitutionResource`
      decorator para rutas por recurso, comportamiento por defecto para
      rutas anidadas
- [x] Escalar `institutionId` (solo lectura) agregado a
      `institution_member`, `delivery_point`, `dismissal_window`,
      `dismissal_exception`, `enrollment` (ADR-029) — necesario para que
      `@InstitutionResource` no requiera cargar la relación completa.
      **El mecanismo cambió después**: se implementó como columna compañera
      `@Column({ insert: false, update: false })`, que resultó dejar
      `institution_id` en `NULL` en toda fila nueva; hoy es `@RelationId()`
      y alcanza también a `pickup_request` (6 entidades en total). Ver
      ADR-044.
- [x] Los 7 índices únicos parciales + GIN (ADR-018, ADR-024, ADR-026)
      declarados también como `@Index()` en las entidades, espejo exacto
      del SQL crudo ya aplicado — elimina el diff fantasma que
      `migration:generate` proponía en cada corrida (verificado: migración
      vacía tras el cambio)
- [x] `ResendEmailProvider` implementado (los 6 `kind` de `EmailMessage` con
      templates en español, tono del design-brief); swap por variable de
      entorno dedicada `EMAIL_PROVIDER=console|resend` (default `console`);
      `ConsoleEmailProvider` se mantiene para desarrollo/tests

## Fase 5 — Módulos CRUD core ✅ completo

Todos protegidos por `InstitutionMembershipGuard` (Fase 4) donde aplique
aislamiento multi-tenant.

- [x] `institutions` (perfil/geocerca, regeneración de `join_code`; caso
      degenerado de `@InstitutionResource` para el id de la propia
      institución)
- [x] `delivery-points` (caso normal de `@InstitutionResource` vía el
      escalar `institutionId` de ADR-029, hoy `@RelationId()` por ADR-044;
      validación cruzada de
      `operatorUserId` → 422 `OPERATOR_NOT_INSTITUTION_MEMBER`)
- [x] `dismissal-windows` + `dismissal-exceptions` (borrado físico solo en
      exceptions; validación de conflicto `level = null` vs. específico en
      capa de servicio → 422 `CONFLICTING_DISMISSAL_EXCEPTION`, distinto
      del duplicado exacto atrapado por constraint → 409
      `DUPLICATE_DISMISSAL_EXCEPTION`; ver enmienda a ADR-026 punto 3)
- [x] `students` + `student-guardians` (alta transaccional de alumno +
      guardián primario `active`; invitar/revocar/reasignar tutores
      autorizados; endpoint compartido `POST /invitations/:token/accept`
      con punto de extensión explícito para `institution_member_invitation`
      — ya completado, ver abajo; `users.full_name` nullable, ADR-030,
      mismo criterio que `password_hash` ADR-022)
- [x] `institution-members` (invitar/listar/cambiar rol/dar de baja
      personal; estado "invitado" derivado de `users.status`, sin columna
      propia — a diferencia de `student_guardians`; protección del último
      admin en `PATCH` y `DELETE` vía `422 LAST_ADMIN_PROTECTED`; endpoint
      compartido de aceptación completado, ya no responde `501` para este
      caso)
- [x] `vehicles` (catálogo del tutor, sin `InstitutionMembershipGuard` —
      autorización por ownership; promoción de principal en `PATCH`
      desmarca-luego-marca, en `DELETE` borra-principal-luego-marca-nuevo
      para no violar el índice parcial sin paso intermedio; `422
      NEW_PRIMARY_VEHICLE_REQUIRED`/`NEW_PRIMARY_VEHICLE_INVALID`)
- [x] `enrollments` (flujo completo: `POST`/`GET /enrollments/mine` lado
      tutor, bandeja de aprobación lado institución con `role = admin`;
      `422 INSTITUTION_NOT_APPROVED` / `409 ENROLLMENT_NOT_PENDING`
      consistentes con la convención ampliada de ADR-022 punto 5;
      `audit_log` + correo de aprobación/rechazo en la misma transacción;
      tercer patrón de resolución de `institutionId` — colección filtrada
      por query param, verificación manual fuera del guard compartido,
      documentado en `docs/arquitectura.md`)

## Fase 6 — Flujo de recogida (`pickup_request`) + `worker` ✅ completo

El corazón del producto: creación de la recogida, ingesta de ubicación en
tiempo real, cálculo de ETA, transición automática a `arriving`, las tres
transiciones manuales (`arrived`/`deliver`/`cancel`), y la purga de datos.

- [x] `pickups` module en `api`: creación de `pickup_request`, resolución
      automática de `delivery_point_id` filtrando `status = 'active'` con
      desempate determinista por `created_at`, `delivery_code`, soporte
      de captura libre de vehículo (ADR-026 punto 3 vía ADR-014); chequeo
      de `institutions.status = 'approved'` en creación además del de
      `enrollments.status` (ADR-032); publicación MQTT post-commit,
      QoS 1, sin revertir la creación si el broker falla; `MqttClient`
      real (`node-mqtt-client.ts`, `packages/shared/src/adapters/`, mqtt
      ^5.15.2) con `parseLocationTopic()` inverso a los builders
- [x] Sistema de errores `INVALID_PAYLOAD` con `details` por campo
      (property + constraints reales de class-validator), único código
      muchos-a-uno del proyecto — resto de códigos sin cambio de shape,
      verificado estructuralmente (excepciones lanzadas a mano no pasan
      por el `exceptionFactory`); documentado en `specs/api-contracts/README.md`
- [x] Refactorización previa: las 14 entidades de TypeORM movidas de
      `apps/api` a `packages/shared/src/entities/`, expuestas por subpath
      `@casillego/shared/entities` (no en el barrel raíz — evita que
      `typeorm` entre al bundle de los 3 frontends, ADR-033); columna
      `eta_calculated_at` (ADR-031 punto 5, nunca migrada) creada y
      aplicada; dependencias del worker instaladas
      (`typeorm`/`@nestjs/typeorm`/`pg`, mismas versiones que `api`;
      `@nestjs/schedule`; sin `@nestjs/config`, mismo patrón
      `process.loadEnvFile()` que `api`)
- [x] Patrón compartido en `packages/shared`: `buildBoardPayload`/
      `buildQueuePayload` (barrel raíz, framework-free) y
      `applyPickupRequestTransition` (subpath propio
      `@casillego/shared/pickup-request-transition`, depende de
      `EntityManager`/entidades como valores — mismo criterio que
      `./entities`); `pickups.service.ts` (creación) refactorizado para
      consumirlos, comportamiento idéntico verificado explícitamente
- [x] `StubMapsProvider` (haversine, 30 km/h, destino `institutions.location`)
      — app-local en `apps/worker` (un solo consumidor, mismo criterio que
      `ConsoleEmailProvider`); desbloquea Fase 6 mientras Google/Mapbox
      sigue abierto
- [x] `worker`: bootstrap (`NestFactory.createApplicationContext`, shutdown
      hooks), conexión MQTT con suscripción por comodín
      (`school-pickup/institution/+/pickup/+/location`), ingesta de
      ubicación con validación defensiva de payload (descarta sin tumbar
      el proceso), throttling (20s / 150m, fórmula haversine consolidada
      en un solo lugar del worker — sin duplicar con `StubMapsProvider`),
      cálculo de ETA vía `MapsProvider`, transición automática a
      `arriving` (umbral de tiempo O geocerca, sin prioridad entre
      ambas — feature 020), publicación única a `board`/`delivery-point`
      por mensaje reflejando el status posterior a cualquier transición
- [x] Bug de infraestructura corregido en el camino: `NodeMqttClient` no
      envolvía `JSON.parse` del payload entrante en `try/catch` — un
      mensaje malformado tumbaba el proceso completo, contrario al
      requisito explícito de feature 019. Corregido en
      `packages/shared/src/adapters/node-mqtt-client.ts`.

### Transiciones manuales (`api`) ✅ completo

- [x] `PATCH /pickup-requests/:id/arrived` — solo el `guardian_user_id`
      dueño, sin `InstitutionMembershipGuard`; salto directo desde
      `en_route` o `arriving` permitido (ADR-024 punto 8)
- [x] `PATCH /pickup-requests/:id/cancel` — mismo dueño, desde cualquiera
      de los 3 estados no terminales; fija `completed_at`
- [x] `PATCH /pickup-requests/:id/deliver` — `InstitutionMembershipGuard` +
      `@InstitutionResource({ entity: PickupRequest })` sin overrides
      (columna compañera `institutionId` extendida a esta entidad,
      ADR-029), sin restricción de `role` (ADR-011); orden estado-antes-
      que-código (409 `INVALID_STATUS_TRANSITION` si no está `arrived`,
      sin evaluar `deliveryCode`); `401 INVALID_DELIVERY_CODE` sin límite
      de reintentos, con `audit_log` en cada intento fallido
      (`pickup_request.delivery_code_mismatched`); entrega exitosa NO
      escribe `audit_log` (solo `pickup_request_status_history`,
      confirmado contra `specs/entities/audit_log.md`)
- [x] Las 3 reutilizan `applyPickupRequestTransition` +
      `transitionAndPublish` compartido (sin duplicar orquestación de
      transacción/publicación); bug corregido en el camino:
      `publishRealtimeUpdate` hardcodeaba ETA `null` — ahora publica el
      ETA real ya calculado por el `worker` si existe
- [x] Job programado diario de purga de `location_updates` a 90 días
      (`apps/worker/src/purge/purge.service.ts`,
      `@Cron(CronExpression.EVERY_DAY_AT_3AM)`, `@nestjs/schedule`,
      ADR-018 punto 8, ADR-024 punto 6) — ya implementado, solo faltaba
      marcarlo aquí

### Cierre de hallazgos de auditoría ✅ completo

Hallazgo 1 de la auditoría de Fase 6 resuelto: se implementaron los dos
`GET` de `pickup-requests` ya especificados en el contrato de API (detalle
por `:id` y listado por `enrollmentId`), usando el patrón de verificación
manual OR (tutor dueño / institution_member) ya documentado en
`docs/arquitectura.md` § "colecciones filtradas por query param" — sin
nueva decisión de arquitectura, sin ADR nuevo. Hallazgo 2 (comentario
obsoleto en migración 401) corregido.

## Fase 7 — Frontend: `apps/portal` — reabierta tras auditoría contra el design system real ✅ completo

- [x] Resolver tokens del design system antes de esta fase — el proyecto
      "CasiLlego Design System" (`claude.ai/design/p/cd01f4a5-739d-4e7b-abed-65176746dc0d`)
      ya existe; tokens, fuentes y los 10 componentes base se portaron a
      `packages/ui` (`@casillego/ui`, ver ADR-036).
- [x] `.claude/rules/design-system.md` con los tokens reales
- [x] Plomería base de `apps/portal` (ADR-042 y ADR-043)
- [x] Pantallas en orden de prioridad del `design-brief.md` — funcionalmente
      completas y verificadas contra el backend real
- [x] Vistas de super-admin (Capa 3h) y de tutor (Capas 3i–3n) —
      funcionalmente completas
- [x] **Reabierto (ADR-072): el propio checklist original de esta fase ya
      señalaba "pendiente construir las pantallas reales de
      `ui_kits/portal-admin`" (ítem de arriba) — la fase se cerró de todas
      formas sin resolverlo, mismo patrón de fondo que se encontró y
      corrigió en Fase 9 (ADR-069/071).** Barrido rápido contra
      `design/casillego-design-system/ui_kits/portal-admin/` (agosto 2026)
      confirmó el hallazgo: no existe ningún shell de navegación
      persistente en ningún rol (cada pantalla es una tarjeta centrada
      independiente, sin la sidebar oscura del kit), y no existe ninguna
      pantalla de Dashboard — `HOME_PATH` es un alias literal de la
      bandeja de aprobación. Ver también el mismo patrón en la Consola de
      puerta (kit `puerta-consola`, layout de dos paneles vs. tarjeta
      centrada actual). Resuelto por las Fases A/B/C de abajo.
- [x] **Fase A (ADR-072)** — shell de navegación del rol
      Institución + Dashboard real:
  - [x] `InstitutionShell`: sidebar 250px + header, envolviendo las 7
        pantallas de institución (Dashboard nuevo incluido)
  - [x] Dashboard: 3 tarjetas KPI (En camino/En puerta/Entregados, sin
        Esperados ni %), "Por nivel" como conteo simple, "Requiere
        atención" con datos fijos (a poblar después), tabla de actividad
        en vivo reutilizando el feed `view=monitor` de Carril (ADR-071)
        sin backend nuevo — incluye conteo de entregados persistido
        contra refresh (`GET /institutions/:id/delivered-today`, sin
        restricción de `role` a diferencia de `/reports`)
  - [x] "Coordinación de salida" en la página de Institución, con dato
        real (`institution_member.role = coordinator` + `users.phone`,
        agregado a `InstitutionMemberListItem`)

  **Fase A completa** — auditada dos veces (implementación inicial +
  corrección de persistencia del conteo de entregados), `npm run check`
  en verde (941 tests).
- [x] **Fase B (ADR-073)** — Consola de puerta: layout de dos
      paneles fiel al kit `puerta-consola` (hoy tarjeta centrada
      `max-width: 820px`), más "Vocear" como evento cruzado hacia
      `apps/board`:
  - [x] Endpoint nuevo `POST /pickup-requests/:id/announce` (calco de
        `PickupDeliveryController`, sin restricción de `role`,
        `audit_log.action = pickup_request.announced`)
  - [x] Topic MQTT nuevo `board-announce`, multiplexado sobre la misma
        conexión `/ws/board` que Andén/Sereno ya mantienen (discriminador
        `kind: 'row' | 'announce'` nuevo en el wire format — **no** un
        sexto canal WS duplicado, ADR-072 punto 5 ya lo señaló como
        límite)
  - [x] `apps/board`: `parseBoardDelta`/`parseBoardAnnounce` con el
        discriminador nuevo, voceo manual reutiliza el mismo mecanismo de
        TTS + pulso que el automático (ADR-069)
  - [x] `apps/portal`: layout de dos paneles (barra superior con conteos +
        reloj, lista de fila de salida 452px, panel de detalle), selector
        de puerta integrado al encabezado, código de entrega con captura
        real (sin cambios de lógica, ADR-024 puntos 4/11), más
        `guardianFullName`/`guardianRelationship` agregados a
        `PickupRequestQueuePayload`/`PickupRequestQueueSummary` (enmienda,
        "Quién recoge") — gap real encontrado y corregido en ambos
        caminos (REST y MQTT) durante la implementación
  - [x] "Reportar incidencia" se conserva deshabilitado en el nuevo
        layout (ADR-024 punto 5, ADR-034 — sin cambios)

  **Fase B completa** — auditada en las 3 partes (backend, `apps/board`,
  `apps/portal`), ciclo completo verificado en vivo (consola → vocear →
  tablero suena), `npm run check` en verde (959 tests).
- [x] **Fase C (ADR-074)** — shell de navegación del rol
      Operador/OPS envolviendo `InstitutionApproval`/`GlobalMetrics`
      existentes:
  - [x] `OpsShell` nuevo (mismo patrón que `InstitutionShell`, ADR-072),
        3 ítems de navegación (Resumen/Instituciones/Perfil, el tercero
        agregado después por ADR-098) — no los 4 del kit,
        "Usuarios"/"Configuración" ni siquiera se muestran deshabilitados
        (diferido indefinidamente, sin fecha, ADR-074 punto 1)
  - [x] `AdminNav.tsx` eliminado — su razón original ("sin shell, solo
        dos destinos") se tomó antes de importar el design system real
  - [x] `GlobalMetrics.tsx` reagrupado al layout del kit — 5 de 6 campos
        ya eran reales, solo cambia el arreglo visual; nuevo
        `deliveriesByDay` en `AdminMetricsResponse` (único dato
        genuinamente nuevo, mismo patrón que `institution-reports`, sin
        filtro de institución); chip de variación mensual de
        "Instituciones activas" omitido (sin histórico agregado que lo
        respalde)
  - [x] `InstitutionApproval.tsx`: solo se le quita el `<main>` de página
        completa, su contenido no se rediseña (mismo criterio que
        Personnel/Reports en Fase A)

  **Fase C completa** — encontrada sin marcar durante la auditoría
  exhaustiva de esta sesión: el código real (`OpsShell.tsx`,
  `GlobalMetrics.tsx`, `InstitutionApproval.tsx`, ausencia de
  `AdminNav.tsx`) ya reflejaba el diseño completo, pero esta sección y el
  cierre de Fase 7 nunca se actualizaron para decirlo.
- ~~"Usuarios" y "Configuración" del rol Operador (secciones del kit
  OPS)~~ — **diferido indefinidamente, no es un pendiente de esta
  reapertura.** Confirmado con el humano: el concepto de roles ya
  vive donde importa (`Personnel.tsx`, roles a nivel institución); la
  configuración global que el kit imaginaba ya está resuelta de otra
  forma (puntos de entrega y perfil de institución por separado,
  notificaciones que cada tutor controla en `apps/parent`). Requeriría
  además modelo de roles nuevo para el equipo interno de CasiLlego
  (hoy `is_super_admin` es un booleano simple) — funcionalidad de
  producto nueva, no una corrección visual. Mismo criterio que el QR
  (ADR-070): se documenta, no se construye especulativamente.

**Completa.** Fase A, B y C (ADR-072/073/074) terminadas y verificadas
contra el código real. El trabajo funcional original de Fase 7
(pantallas, plomería, verificación contra backend) se conservó tal cual;
lo que se rehizo fue la capa de navegación/layout señalada como pendiente
desde el cierre original de la fase. **Corrección de esta auditoría:**
esta sección decía "No completa." pese a que las 3 sub-fases ya estaban
terminadas — verificado línea por línea contra `OpsShell.tsx`,
`Dashboard.tsx`, `GlobalMetrics.tsx`, `InstitutionApproval.tsx` y la
ausencia de `AdminNav.tsx` en el repo real.

## Fase 8 — Frontend: `apps/parent` (PWA) ✅ completo

- [x] Plomería base: PWA instalable, `LocationProvider` intercambiable,
      Wake Lock con degradación, Page Visibility, sesión, routing (ADR-063)
- [x] `POST /pickup-requests/:id/location` mediado por `apps/api`, nunca
      publicación directa del navegador al broker (ADR-062)
- [x] Puente WebSocket de seguimiento por `pickup_request` (ADR-064)
- [x] Inicio / Mis hijos (`GET /students`, botón "¡Ya voy!" dominante)
- [x] Seleccionar institución (instituciones `approved` del alumno,
      catálogo de vehículos / captura libre / caminando)
- [x] Pantalla de seguimiento (★ hero): mapa (dos marcadores + línea recta,
      no ruta real — ADR-065), ETA, Wake Lock, Page Visibility, aviso de
      área de entrega, código de entrega (**solo PIN, sin QR — ver Backlog
      técnico, decisión de producto, no un pendiente técnico**), estado
      pausado, "Ya llegué"/Cancelar
- [x] Notificaciones push (ADR-066): `push_subscriptions` (migración +
      entidad + índice único `user_id`+`endpoint`), `web-push` (VAPID),
      envío best-effort a los demás tutores autorizados tras
      `PATCH /pickup-requests/:id/deliver` (excluye a quien recogió),
      service worker propio vía `injectManifest` (`push`/
      `notificationclick`, abre "Mis hijos"), prompt de permiso no
      intrusivo en `apps/parent` que respeta `Notification.permission` y un
      descarte persistente por dispositivo — implementado en una sesión
      anterior, quedó sin marcar aquí hasta esta auditoría
- ~~Onboarding: vínculo con institución vía `join_code`~~ — **fuera de
  alcance de `apps/parent`**, esa acción ya vive en `apps/portal`
  ("Asociar institución", Capa 3k). Ítem desactualizado del plan original,
  antes de separar los roles de cada frontend con claridad.

**Fase 8 completa.** El QR del código de entrega (`design-brief.md`
original pedía PIN + QR) queda deliberadamente fuera de alcance — no es un
pendiente técnico, es una decisión de producto confirmada al cerrar esta
fase: agregaría fricción en el momento de mayor presión operativa (la
ventana de salida) a cambio de un beneficio no demostrado sin al menos una
institución real usando el sistema. Ver Backlog técnico para la condición
exacta que reabriría este ítem.

## Fase 9 — Frontend: `apps/board` (kiosko) ✅ completo

- [x] Plomería base: sesión (`institution_member` reutilizada, sin
      mecanismo nuevo), `InstitutionContext` (primera membresía, sin
      switcher), routing, manifest, `packages/ui` como dependencia
      (ADR-068, commit `c659658`)
- [x] Lógica de fusión de deltas con voceo/animación solo en cambio real
      de `status` — nunca en un recálculo de ETA (ADR-069), verificada en
      vivo
- [x] Voceo automático (TTS, Web Speech API) — solo transiciones a
      `arriving`/`arrived` (ADR-069 punto 5), confirmado por audio real
- [x] **Rediseño con los 3 modos reales del kit (ADR-071)**, tras corregir
      el handoff desde Claude Design que nunca se hizo antes de la Fase 9
      original — auditado línea por línea contra
      `design/casillego-design-system/ui_kits/tablero-institucion/index.html`:
  - [x] Modo **Andén** (público, oscuro, tabla simple, máx. 8 filas, pie
        con voceo persistido + contador) — filas con `flex: 1` para llenar
        la pantalla sin huecos, corregido tras auditoría
  - [x] Modo **Sereno** (público, claro, tarjetas, máx. 4, oculta
        entregado/cancelado)
  - [x] Modo **Carril** (staff autenticado, tabla densa con tutor/
        parentesco/vehículo/placa/barra de progreso, sin límite de filas,
        botón de cerrar sesión) — canal propio `/ws/board-monitor` +
        `view=monitor`, separado del feed público por seguridad (ADR-071
        punto 2); se conecta y desconecta según el modo activo, verificado
        por el ciclo de vida del `useEffect`
  - [x] Selector de modo (pastillas flotantes) persistido en `localStorage`
        por dispositivo (ADR-071 punto 6)
  - [x] Orden de filas corregido: prioridad de estado, ETA como desempate
        (ADR-071 punto 5), no ETA puro
  - [x] Barra de progreso de Carril aproximada con `advance_notice_minutes`
        de la institución (ADR-071 punto 4, sin migración)
  - [x] Subtítulo de ventana de salida vigente (`useDismissalWindow`), sin
        entidad nueva — reutiliza `dismissal_windows` ya existente
  - [x] `relationshipLabel` promovida de `apps/portal` a `packages/shared`
        — Carril es su segundo consumidor real (ADR-071 punto 3)
- [x] Filtro por punto de entrega en cliente (pastillas por `id`, catálogo
      vía `GET /institutions/:id/delivery-points`, ADR-069 punto 8) —
      re-skinneado con variante `light`/`dark` para los 3 temas
- [x] Estado vacío/inactivo (`EmptyState` de `packages/ui` en Sereno/
      Carril, bloque propio tematizado en Andén — sin tokens oscuros
      nuevos en `packages/ui`, ADR-071 punto 7)

**Fase 9 completa.** `npm run check` en verde de punta a punta (78 archivos
de test, 919 tests) — incluyendo `format:check`, tras excluir
`design/casillego-design-system/` de Prettier (export de solo lectura, no
código del repo). Auditada dos veces contra el mockup real, con una
corrección de fidelidad visual real encontrada y aplicada (`AndenBoard`:
filas sin `flex: 1` dejaban un hueco vacío con pocas recogidas activas —
el caso más común en producción).


**No completa.** El trabajo de Fase 9 original (voceo, fusión de deltas,
filtro por punto de entrega) era funcionalmente correcto y se conserva —
lo que se rehace es la capa visual completa más el canal nuevo de Carril.
Ver ADR-071 para la especificación completa.

## Registro y verificación de correo (ADR-080) ✅ completo — hueco encontrado tarde, no una fase original

Al auditar la integración de los 5 kits del design system contra las 3
apps se confirmó que `ui_kits/acceso` nunca se terminó de construir —
ADR-043 punto 4 lo dejó deshabilitado a propósito desde la plomería
inicial ("hasta que se construyan [las pantallas]"), y nadie volvió a
esto. Los endpoints (`POST /auth/register/institution`,
`POST /auth/register/guardian`, `POST /auth/verify-email`,
`POST /auth/resend-verification`) ya existían y funcionaban — cero
frontend los llamaba.

- [x] Registro de tutor (`apps/parent`) — más simple, se construyó
      primero (sin mapa, sin selector de tipo)
- [x] Verificación de correo en `apps/parent` (lee `?token=`, llama
      `POST /auth/verify-email`, reenvío con el throttling ya existente
      del servidor)
- [x] Registro de institución (`apps/portal`) — reutiliza `GeofenceMap`
      (ADR-048) para dirección/ubicación, con los radios de geocerca/
      activación en sus defaults de columna (100m/3000m), sin exponer su
      edición en este paso (el `disabled` único de `GeofenceMap` para
      pin+radios sigue permitiendo arrastrar los anillos, así que ambos
      `onGeofenceRadiusChange`/`onActivationRadiusChange` quedan cableados
      a estado local en vez de ignorados); sin geocodificación de
      dirección — no existe ese paquete en el repo, el pin abre en un
      punto de referencia fijo (Zócalo, CDMX, la misma coordenada de los
      fixtures del backend) y se arrastra a mano; selector de `type`
      (`school`/`extracurricular`) nuevo vía `SegmentedTabs`, no dibujado
      en el kit pero exigido por el DTO; `timezone` auto-detectado del
      navegador
- [x] Verificación de correo en `apps/portal` (calco de `apps/parent`,
      adaptado al layout `BrandPanel` de dos paneles en vez del `Card`
      centrado)
- [x] Mensaje post-registro ("revisa tu correo"), sin auto-login — ninguna
      respuesta de registro trae tokens; matizado en `apps/portal` para el
      caso de reutilización de cuenta (ADR-028 punto 2): si el correo del
      admin ya existía con esa contraseña y la cuenta ya estaba `active`,
      el mensaje dice que la institución quedó vinculada y que ya puede
      entrar, en vez de pedir revisar un correo que el backend no reenvía
      en ese caso

Sin backend nuevo en ningún punto — los 4 endpoints ya estaban completos y
verificados, este trabajo fue 100% frontend. `npm run check` en verde
(984 tests). Verificado también en vivo con Playwright contra el backend
local real: alta de institución (`extracurricular`, con categoría) sin
auto-login, activación con un token firmado a mano, login posterior,
visibilidad como `pending` en la bandeja de aprobación de super-admin, y
los dos lados de la reutilización de cuenta (ADR-028 punto 2) — misma
contraseña vincula sin error ("Institución vinculada"), contraseña
distinta da `409 EMAIL_ALREADY_REGISTERED` con el mensaje matizado.

## Fase 10 — Pulido y defensa de tesis

- [x] **Extracción del patrón "canal WS con snapshot REST + deltas"
      (ADR-075)** — 3 pasos de riesgo creciente, verificados entre cada
      uno:
  - [x] Paso 1: piezas puras (`reconnectDelayMs`, `fatalCloseReason`,
        `buildRealtimeSocketUrl`) a `packages/shared/src/realtime-channel.ts`
        — cambio mecánico, sin tests nuevos, ningún hook tocado
  - [x] Paso 2: `useRealtimeChannel` genérico en `packages/ui/src/hooks/`
        (React vive ahí, no en `packages/shared`), migrado
        `useDeliveryPointQueue` como primer caso de prueba —
        `asApiError` promovida de paso (17 duplicados detectados, solo
        este consumidor migrado, los otros 16 quedan en Backlog técnico
        aparte)
  - [x] Paso 3 (alcance corregido tras comparar el código real de los 4
        restantes): migrar **solo 2**, no los 4 —
        `useInstitutionBoardMonitor` de Carril (`apps/board`) y
        `useTrackingPickupRequest` (`apps/parent`, objeto único, no
        arreglo — la prueba de que la abstracción no asumió por
        accidente que siempre hay una lista). Ambos confirmados usando
        `useRealtimeChannel` en el código real (encontrado sin marcar
        aquí durante la auditoría exhaustiva de esta sesión).
        `useInstitutionBoard` (tablero público, multiplexa
        `kind: 'row'`/`kind: 'announce'`) y `useInstitutionBoardMonitor`
        del Dashboard (segundo sub-canal independiente de
        `delivered-today`) **se quedan sin migrar, a propósito** —
        forzarlos al contrato actual del hook genérico significaría
        ensuciarlo con conceptos que solo ellos necesitan
- [x] **Tiempo real para bandejas de aprobación (ADR-087)** — extiende
      `useRealtimeChannel`/`realtime-channel.ts` (ADR-075) a 2 pares de
      pantallas que hoy son REST-carga-única sin refresco:
  - [x] `usePendingEnrollments` (`apps/portal`) y `useMyEnrollments`
        (`apps/parent`) sobre un canal de enrollments con doble scope
        (`institutionId` para la institución, `userId` de tutor —un
        canal por tutor, no por enrollment— para el lado del tutor)
  - [x] Hook de `InstitutionApproval.tsx` (`apps/portal`) sobre un
        canal de instituciones de scope global (super-admin ve todas
        las pendientes, sin ACL por institución)
  - [x] `enrollments.service.ts` e `institutions.service.ts` publican
        a MQTT en create/approve/reject y approve/suspend/reactivate
        respectivamente, mismo patrón try/catch-log que
        `pickups.service.ts`
  - [x] Dos gateways nuevos en `apps/api`, mismo patrón que
        `DeliveryPointQueueGateway` (bridge MQTT↔WS, suscripción
        wildcard única por proceso)
- [x] **Cancelar/dar de baja una asociación alumno-institución
      (ADR-088)** — surgió al probar ADR-087 manualmente:
  - [x] Migración: valor `withdrawn` en `enrollments_status_enum` +
        columnas `withdrawn_at`/`withdrawn_by_user_id` —
        `1787725314674-EnrollmentWithdrawn.ts` (confirmada en el repo
        real durante la auditoría exhaustiva de esta sesión, sin marcar
        aquí)
  - [x] `EnrollmentsController`: `DELETE :id` (cancelar `pending`,
        solo el tutor propietario, borra la fila de verdad — nunca
        choca con la FK de `pickup_requests` porque esa solo referencia
        enrollments `approved`) y `PATCH :id/withdraw` (dar de baja su
        propio `approved`)
  - [x] `PATCH :id/withdraw` es **un solo endpoint** en
        `EnrollmentsController` para tutor e institución — corrección
        durante la implementación, ver el addendum de ADR-088. No se
        agrega ninguna ruta a `EnrollmentsDetailController`.
  - [x] Ambas acciones publican a los topics de enrollments ya
        existentes (ADR-087), sin gateway ni topic nuevo — `cancel`
        publica un evento `removed` dedicado (la fila desaparece, no
        hay "nuevo estado" que publicar)
  - [x] Botones correspondientes en `PortalStudents.tsx`/
        `AssociateInstitutionPanel.tsx` (`apps/parent`) y en
        `Students.tsx` (`apps/portal`, no `PendingEnrollments.tsx` —
        esa pantalla solo lista `pending`; el roster de `approved`
        vive en `Students.tsx` vía `useApprovedEnrollments`)
- [x] **Sidebar colapsable en móvil para `InstitutionShell` y
      `OpsShell` (ADR-090)** — replica el mecanismo ya construido en
      `TutorShell.tsx` (ADR-078 punto 3: `@media (max-width: 767px)`,
      topbar compacta con botón de menú, sidebar como panel de
      pantalla completa). Solo el mecanismo responsivo, no la lógica
      de negocio de `TutorShell` — cada shell conserva su propio
      contenido de nav/footer/badges
- [x] **Refresh de token confiable para WebSocket, reactivo + proactivo
      (ADR-091)** — detectado en pruebas E2E: el tablero y el tracking
      del tutor pierden la sesión tras ~15 min porque su tráfico es
      puramente WS y nunca dispara el refresh silencioso REST:
  - [x] `ApiClient.refreshToken()` público en
        `packages/shared/api-client/api-client.ts` (reutiliza
        `refreshOnce()`)
  - [x] Helper compartido: red → reintenta como caída de transporte;
        rechazo explícito del refresh token → fatal de verdad
  - [x] `useRealtimeChannel.ts`: intenta refresh una sola vez antes de
        rendirse, solo para el motivo `UNAUTHENTICATED`. Aplicado a los
        6 consumidores del hook genérico, más replicado a mano en
        `useInstitutionBoard.ts` (`apps/board`) — el tablero público es
        el propio caso que ADR-091 documenta, pero quedó fuera de la
        extracción de ADR-075 Fase 10 Paso 3 (multiplexa `kind:
        'row'`/`kind: 'announce'`), así que no pasa por el hook
        genérico. `useInstitutionBoardMonitor.ts` del Dashboard
        (`apps/portal/src/institution`, también sin migrar por la misma
        razón de Fase 10) se dejó fuera a propósito: es una pantalla
        atendida, no el caso crítico del ADR, y ya queda cubierta por
        la capa proactiva de todos modos
  - [x] `useProactiveTokenRefresh` en `packages/ui`, montado en el
        `AuthProvider` de las 3 apps, cada 5 min mientras haya sesión
- [x] **"¡Ya llegué!" fuera de vista + salida sin aviso de una recogida
      activa (ADR-092)** — detectado en pruebas E2E, `apps/parent`:
  - [x] `Tracking.tsx`: botón "¡Ya llegué!" fijo en la parte inferior
        mientras `isTracking`, contenido scrollable con padding para
        no quedar tapado
  - [x] Confirmación en línea antes de "Volver" mientras `isTracking`
        (mismo patrón que "Cancelar recogida" en el mismo archivo)
  - [x] `useActivePickupRequest` reutiliza `GET
        /pickup-requests?enrollmentId=X` (mismo endpoint y misma lista
        `ACTIVE_PICKUP_STATUSES`, ya compartida en
        `pickup-requests/active-pickup-request.ts`, que
        `lookupActivePickupRequest` en `SelectInstitution.tsx`; sin
        cambios de backend) para detectar una recogida activa por
        matrícula
  - [x] Banner en `Home.tsx` con enlace directo al tracking cuando hay
        una recogida activa
- [x] **Estado `approaching` (radio de activación) + cola de audio del
      tablero (ADR-093)**:
  - [x] Migración `1787900000000-PickupRequestApproachingStatus`: valor
        `approaching` en `pickup_requests_status_enum` y
        `pickup_request_status_history_status_enum` (recrea ambos tipos,
        no `ADD VALUE`, para poder usar el valor nuevo en la misma
        transacción); amplía los dos índices únicos parciales de
        `pickup_requests` con `'approaching'`
  - [x] `pickup-request-status-machine.ts`: `en_route → approaching`,
        `approaching → [arriving, arrived, cancelled]` (+ matriz 6×6 en
        el test)
  - [x] `location-ingestion.service.ts`: `arriving` primero (ahora
        válido también desde `approaching`); si no, y sigue en
        `en_route`, evalúa `activationRadiusMeters` (distancia haversine,
        mismo patrón que `geofenceRadiusMeters`) → `approaching`
  - [x] `apps/parent`: `TRACKING_STATUSES`, `CANCELLABLE_STATUSES`,
        `ACTIVE_PICKUP_STATUSES`, `isTrackingStatus`, badge "Cerca"
        (`--accent-violet`) para `approaching`
  - [x] `apps/board`/`apps/portal`: `isActive*Status`/`STATUS_PRIORITY`/
        `STATUS_META`/`BADGE_TONE`/guards de unión suman `approaching`
        (prioridad `arrived < arriving < approaching < en_route`);
        `apps/api` `ACTIVE_STATUSES` y el DTO de query también
  - [x] `apps/board/src/board/audio-queue.ts`: cola FIFO única (Web
        Audio API, sin assets) — `activation-chime` para `approaching`,
        `attention-chime` distinto antes de cada voceo, pausa fija
        (`GAP_MS` 650ms) entre ítems, inserción al frente para el
        anuncio manual del gate console (sin cortar lo que suena);
        `tts.ts` queda como helper puro de texto; test de orden con
        ítem prioritario incluido
- [x] **Notificación de actualización disponible, 3 apps (ADR-094)**
      — sin service worker nuevo, reutiliza el timer de ADR-091:
  - [x] Identificador de versión por build + `/version.json` — plugin
        Vite compartido (`@casillego/ui/vite-build-id`, `buildIdPlugin`)
        para las 3 apps: inyecta `__APP_BUILD_ID__` y sirve/emite
        `version.json` con el mismo id (dev: middleware `no-store`;
        build: `emitFile` a la raíz). Falta revisar cache headers de
        nginx en el servidor, fuera del repo
  - [x] `useProactiveTokenRefresh` gana `onTick` opcional (vía ref, no
        reinicia el `setInterval`); `useUpdateAvailable` +
        `parseDeployedBuildId` puro (con test) en `packages/ui`
  - [x] `UpdateBanner` compartido en `packages/ui` (barra navy anclada
        arriba, única acción coral), montado sobre el router en cada
        `AuthProvider` vía `updateAvailable` del contexto
  - [x] `apps/parent`: `AppUpdateBanner` no se muestra si
        `useActivePickupRequest()` devuelve una recogida activa (probe
        diferido hasta que hay actualización)
  - [x] `apps/portal`: se difiere mientras `queue.busyId !== null` en
        `GateConsole.tsx` (singleton `gate-console-activity.ts` +
        `useSyncExternalStore`, ya que el banner vive sobre el router)
  - [x] `apps/board`: `BoardAutoUpdate` recarga solo cuando
        `boardAudioQueue.isIdle()` (método nuevo, con test); guarda
        `selectedDeliveryPointId` en `sessionStorage` (uso único) y lo
        restaura al montar `Home.tsx`, con aviso breve en pantalla
        antes de recargar
- [x] **`apps/parent`: SW no activaba la versión nueva (ADR-095)**:
  - [x] `registerType: 'prompt'` (no `'autoUpdate'`) en `vite.config.ts`
  - [x] `sw-src/sw.ts`: listener de mensaje `SKIP_WAITING` →
        `self.skipWaiting()` (verificado presente en `dist/sw.js` tras
        el build)
  - [x] Registro del SW al iniciar vía `virtual:pwa-register`
        (`src/update/service-worker.ts`, llamado desde `main.tsx`);
        `updateSW` guardado en el módulo, expuesto como
        `applyPendingUpdate()`
  - [x] Botón "Actualizar ahora" del banner (ADR-094) llama
        `applyPendingUpdate()` → `updateSW(true)` en vez de
        `window.location.reload()` a secas
  - [x] No auto-actualiza nunca sin confirmación explícita — `'prompt'`
        + sin `onNeedRefresh`/`onOfflineReady`; la detección sigue
        siendo 100% de ADR-094
- [x] **Versión visible en las 3 apps (ADR-096)** — reutiliza
      `__APP_BUILD_ID__` de ADR-094, sin cambios de backend:
  - [x] `AppVersionLabel` compartido en `packages/ui` (prop `buildId`
        + prop `tone`: `muted` `--ink-300` / `faint` `--ink-100`)
  - [x] `apps/parent`: al final de `PortalProfile.tsx`
  - [x] `apps/portal`: al final de `Profile.tsx` (perfil de usuario,
        no configuración de institución)
  - [x] `apps/board`: esquina inferior izquierda de `Home.tsx` (fija,
        `ModeSwitcher` ocupa la derecha), casi invisible (`--ink-100`)
        — el tablero lo ve el público, no solo personal
- [x] **"Actualizar ahora" no recargaba en `apps/parent` (ADR-097)** —
      dos relojes de detección (ADR-094 vs. el chequeo nativo del
      navegador) nunca se sincronizaron:
  - [x] `service-worker.ts`: captura `registration` vía
        `onRegisteredSW`, conecta `onNeedRefresh`
  - [x] `applyPendingUpdate()`: si no hay confirmación del navegador
        todavía, fuerza `registration.update()`, espera con tope de
        tiempo corto antes de `updateSW(true)`, cae a
        `window.location.reload()` si se agota el tiempo
  - [x] ADR-094 (detección, criterio de momento ideal) sin cambios
- [x] **Separar navegación real de identidad/sesión en los 3 shells
      (ADR-098)** — "Perfil"/"App móvil" amontonados en el pie de
      sidebar junto a avatar/nombre/rol/cerrar sesión, `/profile` sin
      shell (`Profile.tsx` se renderiza suelto, sin sidebar ni topbar):
  - [x] `apps/portal/src/App.tsx`: `PROFILE_PATH` deja de ser hijo
        directo de `AuthenticatedLayout`; se registra dentro del árbol
        de `InstitutionShell` y, por separado, dentro del árbol de
        `OpsShell` — mismo componente `<Profile />` en ambas
  - [x] `Profile.tsx`: JSX raíz pasa de `<main>` propio (fondo/padding
        propios) al patrón de `<div>` simple que ya usa
        `InstitutionProfile.tsx` para pantallas dentro de un shell
  - [x] `InstitutionShell.tsx`/`OpsShell.tsx`: "Perfil" se agrega al
        arreglo `NAV` (10º ítem tras "Reportes" / 3er ítem tras
        "Instituciones"); el pie de sidebar se recorta a solo
        avatar+nombre+rol+"Cerrar sesión"
  - [x] `apps/portal/src/institution/icons.tsx`: ícono `'user'` nuevo
        (transcrito del mismo path que ya usa
        `apps/parent/src/portal-web/icons.tsx`)
  - [x] `apps/parent/src/portal-web/TutorShell.tsx`: "App móvil" se
        mueve del bloque de pie a un `NavItem` más, debajo de "Perfil"
        (fuera del arreglo `NAV` en sí, sin estado activo); pie
        recortado igual que los otros dos shells
- [x] Revisión de cobertura de `audit_log` vs. acciones sensibles
      identificadas en `docs/arquitectura.md` — hecha en la auditoría
      exhaustiva de esta sesión: `CLAUDE.md` define "acción sensible"
      como aprobaciones + alta/baja de tutores; las 16 acciones distintas
      que sí se registran hoy (`enrollment.*`, `institution.*`,
      `institution_member.*`, `student_guardian.*`,
      `pickup_request.delivery_code_mismatched`) cubren esa definición
      completa. Sin gap encontrado.
- [ ] **Aviso de privacidad y consentimiento explícito (ADR-099)** — gap
      real confirmado en la auditoría exhaustiva de esta sesión, el más
      importante encontrado; diseño ya confirmado con el humano, listo
      para implementar:
  - [ ] `docs/aviso-privacidad.md`: contenido final (texto corto +
        integral), ya escrito y revisado
  - [ ] `users`: columnas `privacy_accepted_at`/`privacy_notice_version`
        (nullable, ver `specs/entities/user.md`) — solo se completan en
        registros nuevos, ninguna cuenta existente se toca
  - [ ] `RegisterGuardianDto`/`RegisterInstitutionDto.admin`:
        `acceptedPrivacyNotice` con `@Equals(true)`, cae en el
        `400 INVALID_PAYLOAD` ya existente si falta o es `false`
  - [ ] Checkbox obligatorio + enlace al aviso integral (modal) antes del
        botón "Crear cuenta" en `TutorRegisterForm`
        (`apps/parent/src/screens/Login.tsx`) y
        `RegisterInstitutionForm` (`apps/portal/src/screens/Login.tsx`)
  - [ ] Contenido embebido como constante compartida en `packages/ui`,
        consumido por `apps/portal`/`apps/parent`; `apps/board` no lo
        necesita
  - [ ] Enlace persistente para releer el aviso: pie de los 3 shells
        (junto a "Cerrar sesión", ADR-098) y final de las pantallas de
        Perfil (patrón `AppVersionLabel`, ADR-096)
- [ ] Resolver el backlog técnico de seguridad (ver tabla abajo) o
      documentar explícitamente por qué se deja fuera del alcance final
- [x] **2 ADRs retroactivos de infraestructura** — ADR-010 describía "DNS
      en Akky" y "reverse proxy Caddy", ambos falsos en producción hoy
      (DNS en Linode, nginx). **Resuelto — ADR-100**: ambas desviaciones
      comparten la misma razón (practicidad, reusar el VPS de Linode que
      Rubén ya usaba para otras aplicaciones propias, con nginx ya
      corriendo ahí; en Akky solo se compró el dominio, nunca hosting).
      ADR-010 queda con una nota de corrección apuntando a ADR-100, sin
      reescribir su texto original.
- [x] `specs/ui-screens/` — **Resuelto — ADR-101**: se descarta como tipo
      de spec del proyecto, decisión final, no pendiente. Causa real
      (corregida tras aporte del humano): no fue solo "tokens
      bloqueados" — las pantallas siguieron desalineadas de los kits
      reales incluso después de ADR-036, hasta que auditorías tardías
      (ADR-071 tablero, ADR-072/073/074 portal) obligaron a
      regenerarlas. Nunca hubo un punto estable donde congelar la spec
      tuviera sentido; la complejidad de las 3 pantallas ya queda
      capturada en esos ADRs y en ADR-063–066 (Camino A).
      `specs/README.md` actualizado.
- [ ] Preparar narrativa de defensa apoyada en `docs/decisiones.md`
- [ ] Pasada de limpieza de prosa en `specs/` — la corrección de nomenclatura
      de tablas (ADR-027, singular→plural) dejó algunas oraciones en español
      con concordancia gramatical rota (ej. "un `users` invitado..."); no
      afecta funcionalidad ni trazabilidad, es puramente de redacción

### Auditoría exhaustiva de documentación (esta sesión) ✅ completo

A petición del humano ("qué nos está haciendo falta para terminar el
proyecto"), se reclonó el repo real y se verificó línea por línea todo
`plan-implementacion.md`, `decisiones.md`, `specs/` y `arquitectura.md`
contra el código real — no contra lo que cada documento afirmaba.
Resultado: el proyecto estaba bastante más avanzado que lo que la
documentación reflejaba. Encontrados y corregidos 8 puntos marcados como
pendientes (arriba, en Fase 1/7/10) que ya estaban implementados y
verificados en código real; solo 2 gaps genuinos de producto/código
salieron a la luz (aviso de privacidad, `specs/ui-screens/`), más los 2
ADRs retroactivos de infraestructura ya conocidos.

- [x] Checkboxes corregidos en este archivo (Fase 1, Fase 7 completa,
      Fase 10: Paso 3 de ADR-075, ADR-088, ADR-094, ADR-097, ADR-098) y
      tabla de "Decisiones pendientes" (`MapsProvider` → ✅ Resuelto,
      ADR-061)
- [x] `specs/README.md` § "Estado actual": conteos reales (17
      entities/30 features/25 api-contracts, antes 14/23/12) y
      descripción honesta del gap de `ui-screens/`
- [x] `docs/modelo-datos.md`: agregadas las 3 entidades faltantes
      (`institution_groups`, `delivery_point_groups`,
      `push_subscriptions`) — texto, tablas y diagrama ERD; corregidas
      las referencias obsoletas a `assigned_groups`/`grade_or_group`
      (columnas eliminadas por ADR-084, reemplazadas por `group_id`/
      `delivery_point_groups`) en las secciones de `delivery_points`,
      `enrollments` y `pickup_requests`
- [x] `specs/entities/push_subscription.md` escrita — única de las 17
      entidades reales sin su spec dedicada (ADR-066 la documentó inline
      en el ADR, nunca se promovió a spec propia)

### Panel "Requiere atención" del Dashboard — implementación real (ADR-105)

- [ ] `institutions.attention_wait_minutes` (`int`, default `20`) —
      migración + entidad + editable en `InstitutionProfile.tsx`, misma
      sección que `arrivalToleranceMinutes`/`advanceNoticeMinutes`/
      `arrivingLeadMinutes`
- [ ] Índice nuevo `(enrollment_id, guardian_user_id, status)` en
      `pickup_requests` — sin esto la consulta de `first_time_guardian`
      no tiene ningún índice que la resuelva
- [ ] `GET /institutions/:id/attention-items` — controller nuevo (mismo
      patrón que `DeliveredTodayController`), 3 consultas independientes:
      `waiting_too_long` (vía `pickup_request_status_history`),
      `cancelled_no_followup` (reutilizando
      `resolveDismissalWindowEnd`/`resolveDeadline` de
      `institution-reports/punctuality.ts`, sin reimplementar), y
      `first_time_guardian`
- [ ] `Dashboard.tsx`: `PLACEHOLDER_ALERTS` reemplazado por el fetch a
      `attention-items`, refrescado cada 60s por temporizador — no por
      el canal WS del tablero (la condición 1 cambia con el simple paso
      del tiempo, sin evento que la dispare)

---

## Decisiones pendientes que bloquean fases futuras

| Pendiente | Bloquea | Estado |
|---|---|---|
| ~~Proveedor concreto de `MapsProvider` (Google vs. Mapbox)~~ | Fase 6 | ✅ Resuelto — ADR-061, `MapboxMapsProvider` (`apps/worker/src/maps/mapbox-maps.provider.ts`), en producción |
| ~~Features de aprobación/suspensión de institución (super-admin)~~ | Fase 7 (vistas de super-admin) | ✅ Resuelto — ADR-040, `specs/features/025-aprobacion-suspension-institucion.md` |
| ~~Endpoint de búsqueda de instituciones por nombre~~ | Fase 7 | ✅ Resuelto — ADR-037, `GET /institutions?search=...` |
| ~~Pantalla de Reportes~~ | Fase 7 | ✅ Resuelto — ADR-060, `specs/features/027-reportes-institucion.md` |

## Backlog técnico (no bloquea, pero no debe olvidarse)

| Ítem | Origen | Mejora futura si se requiere |
|---|---|---|
| Código de entrega en `apps/parent` solo muestra el PIN numérico, sin QR — el `design-brief.md` original pedía ambos | Capa 4d (Fase 8) — decisión de cierre de fase, confirmada con el humano: el QR se evaluó y se descarta por ahora, no por falta de tiempo. Un escáner que falla en el momento de mayor presión del staff (la ventana de salida) agrega fricción justo donde menos se puede permitir, y sin una escuela real en producción no hay señal de que el PIN de 4 dígitos sea insuficiente — la consola de puerta ya lo verifica manualmente sin problema hoy | No implementar hasta tener al menos una institución real en fase de pruebas y observar ahí si el PIN genera fricción operativa real. Si esa señal aparece, agregar una librería ligera de generación de QR client-side (ej. `qrcode` o similar) — no antes, y no por precaución especulativa |
| Throttling de envío de ubicación del tutor fijado en 15s (`apps/parent`) como punto de partida razonable, sin optimizar todavía para el balance real entre consumo de red/batería y percepción de tiempo real | ADR-064 punto 3 — decisión inicial, confirmada como "por ahora" por el humano, no como definitiva | Revisar con datos reales de uso (no solo intuición): posibles mejoras — intervalo adaptativo según velocidad de desplazamiento, reducir frecuencia si la app está en segundo plano/pausada, o mover parte de la lógica de throttling al propio `LocationProvider` en vez de un temporizador fijo en la pantalla |
| Foto de alumno (`photoUrl`) omitida en Alta de alumno — sin infraestructura de subida de archivos en el proyecto, y deliberadamente diferida por consideración de privacidad de menores, no solo por falta de tooling | ADR-058 (Capa 3j) | Antes de implementar, resolver explícitamente: proveedor de almacenamiento, control de acceso a las imágenes, retención/borrado, y quién puede verlas — no solo "agregar un input de subida" |
| `<input type="time">` en la pantalla de Horarios se renderiza en 12h (AM/PM) en navegadores con esa configuración regional (Chrome ignora `lang="es-ES"` para esto) — el valor guardado y mostrado en las filas del listado sí es 24h correcto, solo el widget de captura varía | ADR-053 (Capa 3f) — un time-picker propio en 24h consistente requeriría sumar un componente nuevo a `@casillego/ui`, decisión de design system (ADR-036/ADR-049), no de esta pantalla | Evaluar un componente de hora propio en `@casillego/ui` si se confirma que es fricción real para el personal de instituciones, no solo una inconsistencia teórica — no construir sin esa señal |
| `resend-verification-throttle.spec.ts` es intermitente bajo carga paralela (falla ~1 de cada 2-3 corridas junto a otros tests, pasa siempre en aislado) — test de rate limit con temporizadores reales, ya era así antes del slice de super-admin, no relacionado a ningún cambio reciente | Detectado durante la verificación de `npm run check` al implementar `SuperAdminGuard`/`admin/` (no lo causó ese cambio) | Estabilizar con timers simulados (`vi.useFakeTimers()` o equivalente) en vez de temporizadores reales, o aislar este archivo de la ejecución paralela del test runner |
| ~~Refresh token stateless (JWT sin tabla de revocación)~~ | ADR-019, punto 3 | ✅ Resuelto — ADR-103: `users.token_version` (entero simple, no la tabla de revocación/sesiones que sugería esta nota) — se incrementa al cambiar contraseña, invalida de golpe todos los refresh tokens ya emitidos para esa cuenta. Sin endpoint ni UI dedicados, alcance confirmado con el humano. No cubre reuso automático ni revocación de una sola sesión — ver ADR-103 para el alcance exacto |
| ~~`npm run check` fallaba en un clon 100% fresco — `lint` corría antes de que `packages/shared` existiera compilado, disparando >2000 errores falsos de tipado en cascada~~ | Encontrado al verificar ADR-103 en un clon nuevo (nunca antes detectado porque el entorno local ya tenía `packages/shared` construido) | ✅ Resuelto — ADR-104: `build:shared` agregado como prepaso de `check`. Probado en clon 100% virgen sin ningún paso manual: 0 errores, 24 warnings, 1162 tests |
| `apps/api/src/auth/resend-verification-throttle.spec.ts` flaky bajo carga (TTL de reloj real de `@nestjs/throttler`) | Detectado durante `npm run check` de la refactorización de entidades (no causado por ella) | Mockear el reloj del throttler en el test, o aceptar el flake documentado si es infrecuente |
| ~~`packages/shared` sin `sideEffects: false`; `mqtt` (vía `NodeMqttClient` en el barrel raíz) probablemente ya entra al bundle de `portal`/`parent`/`board`~~ | Detectado durante la refactorización de entidades (preexistente, no causado por ella) | ✅ Resuelto — ADR-102: confirmado empíricamente (no solo "probablemente") que `mqtt` sí estaba en el bundle de `apps/portal`; con el flag agregado baja de 737.69 kB a 633.34 kB gzip (~14%) y `mqtt` desaparece. `apps/parent`/`apps/board` compilan sin cambios; `apps/api`/`apps/worker` no aplica (Node, sin bundler). 1160 tests sin cambios |
| ~~`npm run clean` roto (`rimraf` no instalado) — obligó a `rm -rf` manual de `dist/` para descartar artefactos de un build ESM fallido a medio camino~~ | Detectado al extraer el patrón de transición compartido (preexistente, no causado por ese cambio) | ✅ Resuelto — ADR-102: verificado que solo `packages/shared` tiene script `clean` (no los 6 workspaces que sugería la nota original); `rimraf` agregado ahí como devDependency |
| ~~Sin `eslint-plugin-react` en `packages/ui/src` ni en los 3 frontends — solo hay reglas de `eslint-hooks` (ADR-036). Pérdida real de cobertura, no cosmética: sin `react/jsx-key` no se detecta `key` faltante en listas (`SegmentedTabs` ya mapea un array), sin `react/no-unescaped-entities`/`react/jsx-no-duplicate-props`/etc. no se detecta JSX mal formado~~ | ADR-036 — última versión publicada de `eslint-plugin-react` (7.37.5) declara peer `eslint@^3...^9.7`, no soporta ESLint 10 | ✅ Resuelto — ADR-102: `@eslint-react/eslint-plugin` (sí soporta ESLint 10) agregado a `eslint.config.mjs`. Corrido contra todo el código real: 0 errores, 24 warnings menores (React 19, deps de `useEffect`) sin corregir en este ADR. `no-missing-key` (equivalente a `jsx-key`) activo como `error`, pasó limpio — no había bug escondido |
| ~~`npm run dev:api` falla con `Cannot find module .../dist/main`~~ — `incremental: true` + `deleteOutDir: true` dejaban un `.tsbuildinfo` obsoleto **fuera** de `dist/` (la ruta por defecto colapsa a `dist/../tsconfig.build.tsbuildinfo` porque `rootDir` es `./src`); `tsc` lo leía, creía que todo estaba al día y emitía 0 archivos saliendo con código 0 | Reincidente: se "resolvió" una primera vez borrando el `.tsbuildinfo` a mano, sin dejar registro, y volvió a aparecer | ✅ Resuelto — ADR-046, `incremental` retirado de `apps/api` y `apps/worker` (+ comentario de advertencia en ambos `tsconfig.json`). **Precedente a no repetir:** un síntoma de build que se arregla borrando un archivo a mano no está arreglado; si vuelve a aparecer un `dist/` vacío o incompleto, revisar la interacción caché/`deleteOutDir` antes de borrar nada |
| Tests de integración contra Postgres real (`*.integration.spec.ts`, `npm run test:integration`) quedan **fuera de `npm run check`** a propósito (el gate principal no debe exigir una base de datos disponible) — nada obliga a correrlos antes de cerrar una fase | ADR-044 — primera categoría de test de este tipo en el proyecto, introducida al diagnosticar y corregir el defecto de `institution_id` en `NULL` | Correr `npm run test:integration` explícitamente antes de cerrar cualquier fase que toque escritura de entidades con relaciones (no solo confiar en `npm run check`); evaluar más adelante si conviene integrarlo a CI si el proyecto adopta CI |
| ~~El patrón "canal WS con snapshot REST + deltas" (fusión pura, orden, parseo defensivo, reconexión con backoff) está reimplementado app-local cinco veces~~ | ADR-069 punto 6, confirmado de nuevo en ADR-071/072/073 | ✅ Resuelto — ADR-075: el análisis del código real mostró que era **dos patrones**, no uno (la capa de conexión sí era idéntica en las 5; la fusión solo lo era en 2 de 5, las otras 3 divergen de verdad — una de ellas, `apps/parent`, ni siquiera fusiona un arreglo). Extracción en 3 pasos de riesgo creciente, ver Fase 10 |
| ~~`asApiError` (normaliza un `catch (caught: unknown)` a `ApiError`) está duplicada en ~17 archivos de los 3 frontends — mucho más allá de las 5 del patrón WS de ADR-075~~ | Detectado al escribir el ADR-075 punto 2 (Paso 2): promovida a `packages/shared/src/api-client/api-error.ts`, pero solo migrado su único consumidor de ese prompt (`useDeliveryPointQueue.ts`) | ✅ Resuelto — ADR-102: eran 17 copias restantes, no 16 (conteo corregido); verificadas byte-idénticas por hash antes de migrar, las 17 reemplazadas por el import de `@casillego/shared` |
| ~~`enrollments.grade_or_group` y `delivery_points.assigned_groups` son texto libre sin ningún vínculo entre sí (ADR-012) — renombrar o reconfigurar el grupo de un punto de entrega deja huérfanas en silencio a las matrículas que apuntaban al nombre anterior~~ | ADR-083 (observación de mantenimiento real del humano) — ADR-012 ya sabía que tomaba este riesgo | ✅ Resuelto — ADR-084: catálogo `institution_groups` con FK, migración con backfill incluido. El radio de cambio real resultó mucho mayor de lo que esta nota anticipaba (~25 archivos leen el valor solo para mostrarlo); ADR-084 lo acota a escritura/matching sin tocar los lectores |
