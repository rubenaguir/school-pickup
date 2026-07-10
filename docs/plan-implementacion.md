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
- [x] ADRs 001–026 (`docs/decisiones.md`): stack, dominio, arquitectura de
      capas (ADR-017), reglas de negocio de entidades (ADR-018), resolución
      de preguntas abiertas del slice auth/enrollment (ADR-019), versiones de
      frontend (ADR-020), compuerta de calidad (ADR-021), resolución de
      preguntas abiertas del slice de configuración de institución (ADR-022),
      resolución de preguntas abiertas del slice de vehículos y tutores
      autorizados (ADR-023), resolución de preguntas abiertas del slice de
      flujo de `pickup_request` (ADR-024), y las dos rondas de validación
      cruzada de cierre de Fase 1 (ADR-025 y ADR-026)
- [x] Arquitectura y flujo de tiempo real (`docs/arquitectura.md`), incluyendo
      el `InstitutionMembershipGuard` (aislamiento multi-tenant a nivel API,
      ADR-022)
- [x] `specs/entities/*.md` — las 14 entidades especificadas con campos,
      relaciones, índices, invariantes y enums

### Tooling y compuerta de calidad ✅ completo (ADR-020, ADR-021)

- [x] Frontends (`portal`, `parent`, `board`) en React 19.2 + Vite 8.1
- [x] Compuerta `npm run check`: ESLint 10 + typescript-eslint 8 (type-aware)
      → Prettier 3 (`format:check`) → build (typecheck real) → Vitest 4
- [x] TypeScript fijado en 5.9.3 (TS 7 rompe el linting type-aware por
      conflicto de peer dependency con `typescript-eslint`, ver ADR-021)
- [x] `.prettierignore`: Prettier formatea código, no `docs/`, `specs/` ni
      markdown en general
- [x] `CLAUDE.md` §"Reglas de implementación": spec como fuente de verdad,
      spec antes que código, invariante de negocio → test o constraint,
      verificar dependencias antes de importarlas
- [x] Node 24.18 instalado y `.nvmrc` fijado; `engines` del monorepo en
      `>=24.11` (piso real de TypeORM 1.0, ver ADR-021)

## Fase 1 — Specs de features y contratos de API ✅ completo

- [x] Decidir la feature de arranque → **Auth + aprobación de `enrollment`**
      (se pospuso el flujo completo de `pickup_request` para un slice
      posterior)
- [x] `specs/features/001-006-*.md` — slice auth/enrollment: registro de
      institución, registro de tutor, login, alta de alumno, asociar
      institución, aprobación de enrollment
- [x] `specs/api-contracts/{auth,students,enrollments}.md` correspondientes
- [x] **Resolver 5 preguntas abiertas** del slice (ADR-019): generación de
      `join_code`, `user.status = invited` hasta verificar correo, refresh
      token stateless (aceptado), visibilidad de instituciones no aprobadas,
      restricción de `role = admin` para aprobar/rechazar `enrollment`
- [x] `specs/features/007-verificacion-correo.md` — feature nueva derivada
      de ADR-019 (verificación de correo tras auto-registro), incluyendo
      límite de tasa de reenvío (3/hora por email) decidido directamente
      contigo al trabajar la spec
- [x] Slice auth/enrollment **cerrado** (sin preguntas abiertas pendientes)
- [x] `specs/features/008-013-*.md` — slice de configuración de institución:
      editar perfil/geocerca, gestionar puntos de entrega, horarios
      recurrentes, días especiales, invitar personal, aceptar invitación
- [x] `specs/api-contracts/{institutions,delivery-points,dismissal-windows,`
      `dismissal-exceptions,institution-members}.md` correspondientes
- [x] **Resolver 5 preguntas abiertas** del slice (ADR-022): rol `admin` para
      las acciones de configuración, `users.password_hash` nullable (usuario
      invitado sin contraseña) con invariante `active` ⇒ no nulo, activación
      por token unificada entre 007 y 013, `InstitutionMembershipGuard` para
      el aislamiento multi-tenant, y convenciones (422 para validaciones
      cruzadas, protección del último admin, reenvío de invitación vía
      re-invitación)
- [x] `specs/entities/user.md` y `docs/modelo-datos.md` actualizados:
      `password_hash` pasa a nullable (ADR-022, punto 2)
- [x] Slice de configuración de institución **cerrado** (sin preguntas
      abiertas pendientes)
- [x] `specs/features/014-017-*.md` — slice de vehículos y tutores autorizados:
      gestionar catálogo de vehículos, invitar tutor autorizado, aceptar
      invitación de tutor, gestionar tutores autorizados (revocar/reasignar
      primariedad)
- [x] `specs/api-contracts/{vehicles,student-guardians}.md` correspondientes
- [x] **Resolver 5 preguntas abiertas** del slice (ADR-023): promoción del
      principal al borrar un vehículo (seleccionada por el tutor), solo el
      guardián `is_primary` invita/revoca/reasigna, aceptación obligatoria en
      ambas ramas (incl. `user` ya activo, sin contraseña), reuso del endpoint
      compartido `POST /invitations/:token/accept`, y protección del principal
      (reasignar primariedad antes de revocar)
- [x] Slice de vehículos y tutores autorizados **cerrado** (sin preguntas
      abiertas pendientes); sin cambios de entidad (`is_primary`/`status` ya
      existían)
- [x] `specs/features/018-023-*.md` — slice de flujo de `pickup_request`: crear
      recogida, ingesta de ubicación + ETA, transición a `arriving`, confirmar
      llegada y entrega, cancelar, purga de `location_updates`
- [x] `specs/api-contracts/{pickup-requests,pickup-realtime-mqtt}.md`
      correspondientes (REST + contrato de tiempo real MQTT)
- [x] **Resolver 10 preguntas abiertas** del slice (ADR-024): bloqueo de
      recogida activa duplicada (422), throttling de ETA (20 s / 150 m),
      `arriving_lead_minutes` configurable por institución, `delivery_code`
      incorrecto sin bloqueo con registro en `audit_log`, "Reportar incidencia"
      fuera de alcance, purga diaria, `activation_radius_meters` solo
      client-side, conjunto de transiciones válidas (incl. `en_route → arrived`),
      paginación `limit`/`offset`, payloads MQTT diferidos a Fase 7–9,
      exposición de `delivery_code` en `GET` (tutor dueño + cualquier
      `institution_member`, sin restricción de rol)
- [x] `specs/entities/institution.md` y `docs/modelo-datos.md` actualizados:
      nueva columna `arriving_lead_minutes` (int, default 5; ADR-024 punto 3),
      añadida también a la configuración editable (feature 008 + `institutions.md`)
- [x] Slice de flujo de `pickup_request` **cerrado** (sin preguntas abiertas
      pendientes; "Reportar incidencia" y payloads MQTT son decisiones
      explícitas, no pendientes)
- [x] Los cuatro vertical slices de la Fase 1 especificados:
      - [x] Auth + aprobación de `enrollment` (001–007)
      - [x] Configuración de institución (008–013)
      - [x] Catálogo de vehículos + tutores autorizados (014–017)
      - [x] Flujo completo `pickup_request` + topics MQTT (018–023)
- [x] **Dos rondas de validación cruzada de cierre** de la Fase 1: correcciones
      de consistencia tras la primera validación (ADR-025) y de la validación
      final antes de Fase 2 (ADR-026): índices únicos parciales que excluyen
      estados terminales en `enrollments`/`student_guardians`, ampliación de la
      convención 409/422, protección append-only de `audit_log` a nivel de BD,
      consolidación de `audit_log.action` a `student_guardian.*`, y
      formalización del template de 7 secciones de `specs/entities/`

### Pendiente explícito para un slice futuro (no bloquea Fase 2)

- [ ] **Consola de super-admin — aprobar/suspender instituciones.** No existen
      features para que el super-admin apruebe (`institution.approved`) o
      suspenda (`institution.suspended`) una institución, pese a ser acciones
      auditables ya previstas en ADR-018 punto 1 y a que las transiciones de
      `institutions.status` son de super-admin (ADR-018). Es un gap de cobertura,
      no una contradicción; se especificará como un slice futuro, probablemente
      junto con el resto de la consola de super-admin, con sus acciones de
      `audit_log` (`institution.approved` / `institution.suspended`). Ver ADR-026
      punto 6.

## Fase 2 — Fundamentos de código compartido (`packages/shared`)

No depende de qué feature se elija primero — es la base que todas usan.

- [ ] Tipos TypeScript compartidos (entidades, enums) derivados 1:1 de
      `specs/entities/*.md`
- [ ] Máquina de estados de `pickup_request` (función pura, sin TypeORM ni
      NestJS) — ver ADR-017, conjunto de transiciones en ADR-024 punto 8
- [ ] Interfaces de los ports: `MapsProvider`, `EmailProvider`, `MqttClient`
      (solo las interfaces; las implementaciones concretas van en `api`/`worker`)
- [ ] Constantes de topics MQTT (prefijo `school-pickup/...`, ver
      `docs/arquitectura.md`)

## Fase 3 — Entidades TypeORM y migraciones (`apps/api`)

Seguir el orden topológico ya verificado en `specs/README.md` (users →
institutions → institution_members → delivery_points → students →
student_guardians → vehicles → enrollments → pickup_requests →
pickup_request_status_history → location_updates → dismissal_windows →
dismissal_exceptions → audit_log).

- [ ] Entidades de TypeORM 1:1 con `specs/entities/*.md`
- [ ] Migraciones versionadas, en el mismo orden
- [ ] Índices únicos parciales (`vehicles.is_primary`,
      `student_guardians.is_primary`) y compuestos (`dismissal_exceptions`) —
      ver ADR-018
- [ ] Verificar conexión a Postgres+PostGIS local (sin contenedor, ver
      `CLAUDE.md`)

## Fase 4 — Módulo de autenticación

- [ ] `auth` module: JWT (access + refresh) + Passport.js (ADR-001, ADR-003
      del stack original)
- [ ] Endpoints de registro/login diferenciados institución vs. tutor (ver
      `docs/design-brief.md`, sección "Acceso")
- [ ] Servicio de activación por token unificado (verificación de correo +
      aceptación de invitación de personal/tutor, parametrizado por si define
      contraseña o no; ver ADR-022, punto 3)
- [ ] `InstitutionMembershipGuard` (aislamiento multi-tenant a nivel API,
      ADR-022 punto 4; ver `docs/arquitectura.md`) — lo consumen todos los
      módulos de la Fase 5 en adelante
- [ ] Implementación concreta de `EmailProvider` (Resend) para verificación
      de correo (ADR-019), recuperación de contraseña e invitaciones (ADR-009)

## Fase 5 — Módulos CRUD core

Orden sugerido por dependencia funcional (no todos son bloqueantes entre sí,
pero este orden minimiza retrabajo). Todos protegidos por
`InstitutionMembershipGuard` (Fase 4) donde aplique aislamiento multi-tenant.

- [ ] `institutions` (incluye geocerca, horarios, puntos de entrega)
- [ ] `delivery-points`
- [ ] `dismissal-windows` + `dismissal-exceptions`
- [ ] `students` + `student-guardians`
- [ ] `vehicles`
- [ ] `enrollments` (flujo de aprobación — pantalla hero del portal)

## Fase 6 — Flujo de recogida (`pickup_request`) + `worker`

El corazón del producto. Depende de que Fase 5 esté completa (necesita
`enrollments` aprobados y `delivery_points` configurados).

- [ ] `pickups` module en `api`: creación de `pickup_request`, resolución
      automática de `delivery_point_id` (ADR-012), `delivery_code`
- [ ] `pickup_request_status_history`: registro de transiciones
- [ ] `worker`: suscripción MQTT, ingesta de ubicación, cálculo de ETA con
      throttling (20 s / 150 m, ADR-024 punto 2), implementación concreta de
      `MapsProvider`
- [ ] Publicación a topics de tablero y de punto de entrega (ADR-012,
      `docs/arquitectura.md`)
- [ ] Job programado diario de purga de `location_updates` a 90 días
      (ADR-018 punto 8, ADR-024 punto 6)
- [ ] `audit_log`: instrumentar en las acciones sensibles ya identificadas
      (aprobaciones, altas/bajas de tutores, `pickup_request.delivery_code_mismatch`
      — ADR-024 punto 4)

## Fase 7 — Frontend: `apps/portal`

- [ ] Resolver tokens del design system antes de esta fase (pendiente:
      pedirlos al chat del proyecto de Claude Design)
- [ ] `.claude/rules/design-system.md` con los tokens reales
- [ ] Pantallas en orden de prioridad del `design-brief.md`: bandeja de
      aprobación de alumnos (★) → perfil de institución/geocerca → puntos de
      entrega → consola de puerta → horarios → personal → reportes
- [ ] Vistas de tutor: mis hijos, alta de alumno, asociar institución,
      tutores autorizados, perfil (vehículos, notificaciones)
- [ ] Vistas de super-admin: aprobación de instituciones, métricas globales

## Fase 8 — Frontend: `apps/parent` (PWA)

- [ ] Onboarding (permisos de ubicación/notificaciones, vínculo con
      institución vía `join_code`)
- [ ] Pantalla de seguimiento (★ hero): mapa, ETA, Wake Lock, Page Visibility
- [ ] Código de entrega (QR + PIN)
- [ ] Estado pausado (pérdida de foco)

## Fase 9 — Frontend: `apps/board` (kiosko)

- [ ] Listado tipo "llegadas de aeropuerto" (★ hero)
- [ ] Suscripción MQTT al feed agregado de institución
- [ ] Voceo automático (TTS, Web Speech API)
- [ ] Estado vacío/inactivo

## Fase 10 — Pulido y defensa de tesis

- [ ] Revisión de cobertura de `audit_log` vs. acciones sensibles
      identificadas en `docs/arquitectura.md`
- [ ] Aviso de privacidad (LFPDPPP) reflejando la política de retención de
      `location_updates` (ADR-018)
- [ ] Resolver el backlog técnico de seguridad (ver tabla abajo) o
      documentar explícitamente por qué se deja fuera del alcance final
- [ ] Preparar narrativa de defensa apoyada en `docs/decisiones.md` (los ADRs
      documentan el "por qué" de cada decisión técnica)

---

## Decisiones pendientes que bloquean fases futuras

Mantener esta lista corta — mover a "resuelto" (o eliminar la fila) en cuanto
se decida:

| Pendiente | Bloquea | Estado |
|---|---|---|
| Tokens del design system | Fase 7 | Abierto — pendiente pedirlos en el chat del proyecto de Claude Design |
| Proveedor concreto de `MapsProvider` (Google vs. Mapbox) | Fase 6 | Abierto |

## Backlog técnico (no bloquea, pero no debe olvidarse)

Decisiones aceptadas conscientemente como limitación del MVP, con una mejora
futura ya identificada. Revisar antes de producción o antes de la Fase 10.

| Ítem | Origen | Mejora futura si se requiere |
|---|---|---|
| Refresh token stateless (JWT sin tabla de revocación) | ADR-019, punto 3 | Entidad de revocación (`revoked_tokens` o sesiones activas) para poder invalidar un token robado antes de que expire |
