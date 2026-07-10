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
- [x] ADRs 001–027 (`docs/decisiones.md`)
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

### Pendiente explícito para un slice futuro (no bloquea Fase 2)

- [ ] **Consola de super-admin — aprobar/suspender instituciones.** No existen
      features para `institution.approved`/`institution.suspended` pese a ser
      acciones auditables ya previstas (ADR-018 punto 1). Gap de cobertura,
      no contradicción — se especifica junto con el resto de la consola de
      super-admin. Ver ADR-026 punto 6.

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

## Fase 3 — Entidades TypeORM y migraciones (`apps/api`)

Seguir el orden topológico ya verificado en `specs/README.md` (users →
institutions → institution_members → delivery_points → students →
student_guardians → vehicles → enrollments → pickup_requests →
pickup_request_status_history → location_updates → dismissal_windows →
dismissal_exceptions → audit_log).

- [ ] Entidades de TypeORM 1:1 con `specs/entities/*.md`
- [ ] Migraciones versionadas, en el mismo orden
- [ ] Índices únicos parciales: `vehicles.is_primary`,
      `student_guardians.is_primary` (ADR-018); recogida activa única en
      `pickup_requests`, vínculo/solicitud activa única en `enrollments` y
      `student_guardians` excluyendo estados terminales (ADR-024, ADR-026);
      y compuesto en `dismissal_exceptions` (ADR-018)
- [ ] Protección append-only de `audit_log` a nivel de BD (revocar
      `UPDATE`/`DELETE` del rol de la app) — ADR-026 punto 4
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
- [ ] Implementación concreta de `EmailProvider` (Resend) — los 6 `kind` de
      `EmailMessage` ya están definidos en `packages/shared/src/ports/`

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
      automática de `delivery_point_id` (ADR-012), `delivery_code`, soporte
      de captura libre de vehículo (ADR-026 punto 3 vía ADR-014)
- [ ] `pickup_request_status_history`: registro de transiciones, usando la
      máquina de estados ya implementada en `packages/shared`
- [ ] `worker`: suscripción MQTT (usando `MqttClient` y los builders de
      topics ya implementados), ingesta de ubicación, cálculo de ETA con
      throttling (20 s / 150 m, ADR-024 punto 2), implementación concreta de
      `MapsProvider`
- [ ] Publicación a topics de tablero y de punto de entrega (ADR-012,
      `docs/arquitectura.md`)
- [ ] Job programado diario de purga de `location_updates` a 90 días
      (ADR-018 punto 8, ADR-024 punto 6)
- [ ] `audit_log`: instrumentar en las acciones sensibles ya identificadas
      (aprobaciones, altas/bajas de tutores y de personal,
      `pickup_request.delivery_code_mismatch`)

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
      (requiere especificar primero el slice diferido en Fase 1)

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
- [ ] Preparar narrativa de defensa apoyada en `docs/decisiones.md`
- [ ] Pasada de limpieza de prosa en `specs/` — la corrección de nomenclatura
      de tablas (ADR-027, singular→plural) dejó algunas oraciones en español
      con concordancia gramatical rota (ej. "un `users` invitado..."); no
      afecta funcionalidad ni trazabilidad, es puramente de redacción

---

## Decisiones pendientes que bloquean fases futuras

| Pendiente | Bloquea | Estado |
|---|---|---|
| Tokens del design system | Fase 7 | Abierto — pendiente pedirlos en el chat del proyecto de Claude Design |
| Proveedor concreto de `MapsProvider` (Google vs. Mapbox) | Fase 6 | Abierto |
| Features de aprobación/suspensión de institución (super-admin) | Fase 7 (vistas de super-admin) | Abierto — slice sin especificar |

## Backlog técnico (no bloquea, pero no debe olvidarse)

| Ítem | Origen | Mejora futura si se requiere |
|---|---|---|
| Refresh token stateless (JWT sin tabla de revocación) | ADR-019, punto 3 | Entidad de revocación (`revoked_tokens` o sesiones activas) para poder invalidar un token robado antes de que expire |
