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
- [x] ADRs 001–023 (`docs/decisiones.md`): stack, dominio, arquitectura de
      capas (ADR-017), reglas de negocio de entidades (ADR-018), resolución
      de preguntas abiertas del slice auth/enrollment (ADR-019), versiones de
      frontend (ADR-020), compuerta de calidad (ADR-021), resolución de
      preguntas abiertas del slice de configuración de institución (ADR-022),
      resolución de preguntas abiertas del slice de vehículos y tutores
      autorizados (ADR-023)
- [x] Arquitectura y flujo de tiempo real (`docs/arquitectura.md`)
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

## Fase 1 — Specs de features y contratos de API ⏳ en progreso

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
- [ ] Especificar los slices restantes antes de dar Fase 1 por completa
      (los módulos de Fase 5/6 los necesitan primero):
      - [x] Configuración de institución (geocerca, radios, horarios,
            puntos de entrega, personal)
      - [x] Catálogo de vehículos + tutores autorizados (`student_guardian`)
      - [ ] Flujo completo `pickup_request` (ADR-012, ADR-013, ADR-014) +
            topics MQTT (`MqttClient`, ver ADR-017)

## Fase 2 — Fundamentos de código compartido (`packages/shared`)

No depende de qué feature se elija primero — es la base que todas usan.

- [ ] Tipos TypeScript compartidos (entidades, enums) derivados 1:1 de
      `specs/entities/*.md`
- [ ] Máquina de estados de `pickup_request` (función pura, sin TypeORM ni
      NestJS) — ver ADR-017
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
- [ ] Nota de compatibilidad (ADR-021): TypeORM 1.0 exige Node ≥24.11; hoy se
      corre Node 24.7 — subir el runtime si se adopta esa versión de TypeORM

## Fase 4 — Módulo de autenticación

- [ ] `auth` module: JWT (access + refresh) + Passport.js (ADR-001, ADR-003
      del stack original)
- [ ] Endpoints de registro/login diferenciados institución vs. tutor (ver
      `docs/design-brief.md`, sección "Acceso")
- [ ] Implementación concreta de `EmailProvider` (Resend) para verificación
      de correo (ADR-019), recuperación de contraseña e invitaciones (ADR-009)

## Fase 5 — Módulos CRUD core

Orden sugerido por dependencia funcional (no todos son bloqueantes entre sí,
pero este orden minimiza retrabajo):

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
      throttling, implementación concreta de `MapsProvider`
- [ ] Publicación a topics de tablero y de punto de entrega (ADR-012,
      `docs/arquitectura.md`)
- [ ] Job programado de purga de `location_updates` a 90 días (ADR-018)
- [ ] `audit_log`: instrumentar en las acciones sensibles ya identificadas
      (aprobaciones, altas/bajas de tutores)

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
