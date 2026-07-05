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

---

## Fase 0 — Fundamentos documentales ✅ completo

- [x] Modelo de datos (`docs/modelo-datos.md`), 14 entidades
- [x] ADRs 001–018 (`docs/decisiones.md`): stack, dominio, arquitectura de
      capas (ADR-017), reglas de negocio de entidades (ADR-018)
- [x] Arquitectura y flujo de tiempo real (`docs/arquitectura.md`)
- [x] `specs/entities/*.md` — las 14 entidades especificadas con campos,
      relaciones, índices, invariantes y enums

## Fase 1 — Specs de features y contratos de API ⏳ siguiente paso

Esta fase está **bloqueada por una decisión pendiente**: con qué feature
arrancar el primer vertical slice. Opciones ya discutidas:
- Auth + aprobación de alumno (`enrollment`)
- Auth + flujo completo "voy en camino" (`pickup_request`)

- [ ] Decidir la feature de arranque
- [ ] `specs/features/001-{nombre}.md` — primera feature (Given/When/Then,
      entidades involucradas, referencia a ports si aplica — ver ADR-017)
- [ ] `specs/api-contracts/{recurso}.md` correspondiente
- [ ] Repetir para cada feature del vertical slice antes de tocar código

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

## Fase 4 — Módulo de autenticación

- [ ] `auth` module: JWT (access + refresh) + Passport.js (ADR-001, ADR-003
      del stack original)
- [ ] Endpoints de registro/login diferenciados institución vs. tutor (ver
      `docs/design-brief.md`, sección "Acceso")
- [ ] Implementación concreta de `EmailProvider` (Resend) para
      recuperación de contraseña / invitaciones (ADR-009)

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
- [ ] Preparar narrativa de defensa apoyada en `docs/decisiones.md` (los ADRs
      documentan el "por qué" de cada decisión técnica)

---

## Decisiones pendientes que bloquean fases futuras

Mantener esta lista corta — mover a "resuelto" (o eliminar la fila) en cuanto
se decida:

| Pendiente | Bloquea | Estado |
|---|---|---|
| Vertical slice de arranque (Fase 1) | Fase 1 en adelante | Abierto |
| Tokens del design system | Fase 7 | Abierto — pendiente pedirlos en el chat del proyecto de Claude Design |
| Proveedor concreto de `MapsProvider` (Google vs. Mapbox) | Fase 6 | Abierto |
