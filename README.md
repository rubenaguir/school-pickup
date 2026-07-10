# CasiLlego (`school-pickup`)

Plataforma SaaS multi-tenant para reducir las filas de coches en la salida de
instituciones (escuelas y extracurriculares) en CDMX. Un tutor avisa que va en
camino ("ya voy"), el sistema calcula un ETA y la institución prepara al alumno,
mostrándolo en un tablero estilo "llegadas de aeropuerto".

> Estado actual: **backend con esquema real** (Fases 0–3 completas). El
> modelo de datos (14 tablas), las entidades de TypeORM, las migraciones
> versionadas y los fundamentos de código compartido (tipos, máquina de
> estados de `pickup_request`, ports) ya existen y corren contra PostgreSQL+
> PostGIS. Los módulos de NestJS (auth, CRUD, MQTT real) se construyen ahora
> sobre esta base (Fase 4 en adelante). Ver `docs/` y `CLAUDE.md`, y
> `docs/plan-implementacion.md` para el detalle fase por fase.

## Estructura

```
apps/
  api/        NestJS — REST API (auth, CRUD, aprobaciones)
  worker/     NestJS standalone — suscriptor MQTT, cálculo de ETA
  portal/     Portal administrativo (React + Vite)
  parent/     App del padre (PWA React)
  board/      Tablero de institución (PWA React)
packages/
  shared/     Tipos y constantes TypeScript compartidos (@casillego/shared)
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

## MQTT

El broker es **compartido con otras aplicaciones**, por lo que todos los topics
de CasiLlego cuelgan del prefijo raíz de proyecto `school-pickup/`. Las constantes y
helpers de topics viven en `@casillego/shared`.

## Notas de PWA (pendiente)

`parent` y `board` quedan PWA-ready (manifest básico). La integración de
`vite-plugin-pwa`, Wake Lock, `watchPosition` y TTS son fases posteriores.
