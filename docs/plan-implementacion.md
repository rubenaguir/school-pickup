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
- [x] ADRs 001–030 (`docs/decisiones.md`)
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
- [x] Columna compañera `institutionId` (solo lectura) agregada a
      `institution_member`, `delivery_point`, `dismissal_window`,
      `dismissal_exception`, `enrollment` (ADR-029) — necesaria para que
      `@InstitutionResource` no requiera cargar la relación completa
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
- [x] `delivery-points` (caso normal de `@InstitutionResource` vía la
      columna compañera de ADR-029; validación cruzada de
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

## Fase 6 — Flujo de recogida (`pickup_request`) + `worker`

El corazón del producto. Depende de que Fase 5 esté completa (necesita
`enrollments` aprobados y `delivery_points` configurados).

Los huecos que una revisión previa encontró en las specs de esta fase quedaron
resueltos en **ADR-031** (códigos de error, estructura del `worker`, suscripción
por comodín, `eta_calculated_at`, `StubMapsProvider`, nombre y contenido de la
fila de `audit_log`). Las specs ya reflejan esas decisiones; esta fase solo
implementa.

- [ ] Migración de la columna `pickup_requests.eta_calculated_at` (timestamptz,
      nullable; ADR-031 punto 5) — no existe en `InitSchema`
- [ ] Dependencia `mqtt` (librería de Node) e implementación concreta del port
      `MqttClient`, consumida por `api` y `worker` (hoy solo existe la interfaz)
- [ ] `parseLocationTopic()` en `packages/shared`: parser inverso del topic de
      ubicación, compañero de los builders (ADR-031 punto 4)
- [ ] `pickups` module en `api`: creación de `pickup_request`, resolución
      automática de `delivery_point_id` (ADR-012), `delivery_code` con reintento
      ante colisión (`specs/entities/pickup_request.md`), soporte de captura
      libre de vehículo (ADR-026 punto 3 vía ADR-014), códigos de error de
      ADR-031 punto 1
- [ ] `pickup_request_status_history`: registro de transiciones, usando la
      máquina de estados ya implementada en `packages/shared`
- [ ] `worker`: suscripción MQTT por comodín (ADR-031 punto 4, usando
      `MqttClient` y los builders/parser de topics), ingesta de ubicación,
      cálculo de ETA con throttling (20 s / 150 m, ADR-024 punto 2, contra
      `eta_calculated_at` y `last_location`), y `StubMapsProvider` como
      implementación de `MapsProvider` (ADR-031 punto 6). Estructura de módulos y
      ciclo de vida MQTT en `docs/arquitectura.md` § "Estructura del proceso
      `worker`"
- [ ] Publicación a topics de tablero y de punto de entrega (ADR-012,
      `docs/arquitectura.md`)
- [ ] Job programado diario de purga de `location_updates` a 90 días
      (ADR-018 punto 8, ADR-024 punto 6) — requiere `@nestjs/schedule` en el
      `worker`
- [ ] `audit_log`: instrumentar en las acciones sensibles ya identificadas
      (aprobaciones, altas/bajas de tutores y de personal,
      `pickup_request.delivery_code_mismatched`)

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
| Proveedor concreto de `MapsProvider` (Google vs. Mapbox) | Fase 6 | Abierto — **ya no bloquea**: `StubMapsProvider` (haversine a velocidad fija, sin proveedor externo ni API key) permite construir y testear todo el slice de Fase 6, igual que `ConsoleEmailProvider` frente a `ResendEmailProvider`. La decisión de fondo sigue pendiente; al tomarla se sustituye la implementación sin tocar a quien la consume. Ver ADR-031 punto 6 |
| Features de aprobación/suspensión de institución (super-admin) | Fase 7 (vistas de super-admin) | Abierto — slice sin especificar |
| Endpoint de búsqueda de instituciones por nombre (`institutions`) — solo existe alta por `joinCode`/`institutionId` ya conocido; falta para la pantalla "Asociar a institución" | Fase 7 (necesita spec antes) | Abierto — detectado al implementar `enrollments` |

## Backlog técnico (no bloquea, pero no debe olvidarse)

| Ítem | Origen | Mejora futura si se requiere |
|---|---|---|
| Refresh token stateless (JWT sin tabla de revocación) | ADR-019, punto 3 | Entidad de revocación (`revoked_tokens` o sesiones activas) para poder invalidar un token robado antes de que expire |
