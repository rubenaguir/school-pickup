# CasiLlego (`school-pickup`)

Plataforma SaaS multi-tenant para reducir las filas de coches en la salida de
instituciones (escuelas y extracurriculares) en CDMX. Un tutor avisa que va en
camino ("ya voy"), el sistema calcula un ETA y la institución prepara al alumno,
mostrándolo en un tablero estilo "llegadas de aeropuerto".

> Estado actual: **backend completo, incluido el flujo de recogida en
> tiempo real** (Fases 0–6 completas). El modelo de datos (14 tablas), las
> entidades de TypeORM (movidas a `packages/shared` para ser compartidas
> entre `api` y `worker`), las migraciones versionadas, el módulo de
> autenticación con `InstitutionMembershipGuard`, los 6 módulos CRUD de
> dominio, y el flujo completo de `pickup_request` (creación, ingesta de
> ubicación en tiempo real vía MQTT, cálculo de ETA con throttling,
> transición automática a `arriving`, las transiciones manuales
> `arrived`/`deliver`/`cancel`, y la purga diaria de `location_updates`)
> ya existen y funcionan de punta a punta. El proceso `worker` ya es un
> proceso real, no un esqueleto. Los dos `GET` de `pickup-requests`
> (detalle por `:id` y listado por `enrollmentId`) documentados en el
> contrato de API y pendientes de la auditoría de Fase 6 ya están
> implementados. Los frontends (`portal`, `parent`, `board`) se
> construyen ahora sobre esta base (Fase 7 en adelante). Ver `docs/` y
> `CLAUDE.md`, y `docs/plan-implementacion.md` para el detalle fase por
> fase.

## Funcionalidades principales

- Registro de instituciones participantes y aprobación por parte del super-admin.
- Alta de alumnos y tutores, y asociación alumno↔institución sujeta a aprobación
  de la institución.
- Aviso "voy en camino" desde la app del tutor (PWA `parent`), con tracking de
  ubicación en tiempo real vía MQTT.
- Cálculo automático de ETA y transición de estados de la recogida
  (`pending` → `approaching` → `arriving` → `arrived` → `deliver`/`cancel`).
- Tablero de institución estilo "llegadas de aeropuerto" (PWA `board`, modo
  kiosko), con voceo por TTS y alertas de atención.
- Gestión de puntos de entrega, horarios recurrentes y días especiales por
  institución.
- Invitación y administración de personal de institución y de tutores
  autorizados por alumno.
- Reportes y métricas por institución, y panel de métricas globales para el
  super-admin.
- Notificaciones push (Web Push/VAPID) y aviso de privacidad con
  consentimiento explícito en el registro (LFPDPPP).

## Stack tecnológico

- **Backend**: Node.js + TypeScript, NestJS (procesos `api` y `worker`).
- **Base de datos**: PostgreSQL + PostGIS, TypeORM con migraciones versionadas.
- **Tiempo real**: broker MQTT (Mosquitto); MQTT.js sobre WSS desde el
  navegador, mediado por `apps/api` (los navegadores nunca se conectan
  directo al broker).
- **Autenticación**: JWT (access + refresh) con Passport.js.
- **Frontend**: React 19 + Vite + TypeScript — `portal` (web), `parent` y
  `board` (PWA).
- **Correo transaccional**: Resend.
- **Geolocalización y ETA**: Mapbox (geocoding + directions API).
- **Notificaciones push**: Web Push / VAPID.
- **Infraestructura**: VPS Linode, nginx, certbot (Let's Encrypt), systemd
  (`casillego-api`, `casillego-worker`).

## Estructura

```
apps/
  api/        NestJS — REST API (auth, CRUD, aprobaciones)
  worker/     NestJS standalone — suscriptor MQTT, cálculo de ETA
  portal/     Portal administrativo (React + Vite)
  parent/     App del padre (PWA React)
  board/      Tablero de institución (PWA React)
packages/
  shared/     Tipos, entidades TypeORM, ports, adapters y la máquina de
              estados compartidos entre apps (@casillego/shared)
infra/        Referencia de infraestructura externa (postgres, mqtt, ACL)
docs/         Documentación (español)
```

## Requisitos

- Node.js >= 24.11 (ver `.nvmrc`; `>=24.11` es el piso real, requerido por
  TypeORM — ver ADR-021)
- npm >= 11 (workspaces)
- **PostgreSQL** externo, accesible desde el host. La extensión **PostGIS**
  se habilita automáticamente al correr las migraciones (no requiere
  instalación manual previa, salvo que el paquete `postgis` esté disponible
  en el servidor Postgres).
- **Broker MQTT (Mosquitto)** externo y compartido (ver `infra/README.md`).

> Postgres y el broker MQTT son servicios externos (no se contenerizan en este
> repo). `api` y `worker` corren directamente con npm y se conectan a ellos.

## Puesta en marcha

```bash
cp .env.example .env       # ajusta DB_* y MQTT_* a tus servicios externos
npm install                # instala y enlaza los workspaces
npm run build:shared       # compila @casillego/shared (lo consumen api/worker/frontends)
npm run migration:run      # crea el esquema: PostGIS, 14 tablas, índices, trigger de audit_log
npm run dev:api            # API en http://localhost:3000 (GET /api/health)
npm run dev:portal         # portal en el puerto de Vite
```

Cada app expone sus propios scripts; ver `package.json` raíz para los atajos
(`dev:api`, `dev:worker`, `dev:portal`, `dev:parent`, `dev:board`).

### Usuario super-admin (solo desarrollo)

El super-admin (`users.is_super_admin`, ADR-038) no tiene flujo de alta en la
aplicación: aprueba instituciones y ve las métricas globales, pero nadie lo
registra desde la UI. Para desarrollo se siembra con un script:

```bash
SUPER_ADMIN_EMAIL=superadmin@example.com \
SUPER_ADMIN_PASSWORD='una-contrasena-larga' \
SUPER_ADMIN_FULL_NAME='Super Admin' \
npm run seed:super-admin -w @casillego/api
```

- Las credenciales se leen del entorno, nunca del código — también funcionan
  puestas en el `.env` de la raíz (ver `.env.example`).
- Es idempotente: reejecutarlo sobre el mismo correo actualiza la contraseña y
  reafirma el flag, no falla por correo duplicado.
- Hashea con la misma función que el registro real
  (`apps/api/src/auth/password.util.ts`, Argon2).
- **No es una migración a propósito**: una migración correría en todos los
  entornos, y una cuenta con contraseña conocida solo tiene sentido en
  desarrollo. En producción el flag se activa a mano sobre una cuenta real.

## Base de datos

El esquema completo (14 tablas, índices —incluidos 7 únicos parciales que
excluyen estados terminales—, y un trigger que hace `audit_log` append-only)
vive en migraciones versionadas de TypeORM bajo `apps/api/src/database/`.

- `npm run migration:generate` — genera una migración nueva a partir de
  cambios en las entidades (`apps/api/src/database/entities/`)
- `npm run migration:run` — aplica migraciones pendientes
- `npm run migration:revert` — revierte la última migración

Ver `docs/modelo-datos.md` para el modelo entidad-relación y
`docs/decisiones.md` (ADR-018, ADR-024, ADR-026, ADR-027) para el porqué de
cada decisión de esquema.

## Correo transaccional

El envío de correo (verificación de cuenta, invitaciones, aprobación de
`enrollment`) usa el port `EmailProvider` (`packages/shared`). Dos
implementaciones, seleccionadas por la variable `EMAIL_PROVIDER`:

- `console` (default) — loguea el mensaje completo a consola, sin enviar
  nada real. No requiere cuenta de Resend.
- `resend` — envía correo real vía Resend. Requiere `RESEND_API_KEY` en
  `.env` (cuenta gratuita, permiso "Sending access" recomendado). Mientras
  el dominio `mail.casillego.com.mx` no esté verificado en Resend, el envío
  real solo llega al correo asociado a la cuenta de Resend usada (limitación
  de Resend, no del código).

## MQTT

El broker es **compartido con otras aplicaciones**, por lo que todos los topics
de CasiLlego cuelgan del prefijo raíz de proyecto `school-pickup/`. Las constantes y
helpers de topics viven en `@casillego/shared`.

## Despliegue

El proyecto está desplegado y en funcionamiento:

- **Landing**: https://casillego.com.mx
- **Portal administrativo** (instituciones / personal / super-admin):
  https://portal.casillego.com.mx
- **App del tutor** (PWA, "voy en camino"): https://app.casillego.com.mx
- **Tablero de institución** (PWA, modo kiosko): https://tablero.casillego.com.mx
- **API**: https://api.casillego.com.mx (health check: `/api/health`)

Infraestructura: VPS Linode con nginx como reverse proxy y TLS vía
certbot/Let's Encrypt; `api` y `worker` corren como servicios systemd
(`casillego-api`, `casillego-worker`). DNS gestionado en el panel de Linode
(dominio registrado en Akky, con nameservers apuntando a Linode).

## Notas de PWA (pendiente)

`parent` y `board` quedan PWA-ready (manifest básico). La integración de
`vite-plugin-pwa`, Wake Lock, `watchPosition` y TTS son fases posteriores.
