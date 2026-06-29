# CasiLlego (`school-pickup`)

Plataforma SaaS multi-tenant para reducir las filas de coches en la salida de
instituciones (escuelas y extracurriculares) en CDMX. Un tutor avisa que va en
camino ("ya voy"), el sistema calcula un ETA y la institución prepara al alumno,
mostrándolo en un tablero estilo "llegadas de aeropuerto".

> Estado actual: **esqueleto del monorepo** (stubs que compilan y arrancan). La
> lógica de dominio, MQTT real, entidades TypeORM y auth se construyen sobre esta
> base. Ver `docs/` y `CLAUDE.md`.

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

- Node.js >= 24 (ver `.nvmrc`)
- npm >= 11 (workspaces)
- **PostgreSQL + PostGIS** externo, accesible desde el host.
- **Broker MQTT (Mosquitto)** externo y compartido (ver `infra/README.md`).

> Postgres y el broker MQTT son servicios externos (no se contenerizan en este
> repo). `api` y `worker` corren directamente con npm y se conectan a ellos.

## Puesta en marcha

```bash
cp .env.example .env       # ajusta DB_* y MQTT_* a tus servicios externos
npm install                # instala y enlaza los workspaces
npm run build:shared       # compila @casillego/shared (lo consumen api/worker/frontends)
npm run dev:api            # API en http://localhost:3000 (GET /api/health)
npm run dev:portal         # portal en el puerto de Vite
```

Cada app expone sus propios scripts; ver `package.json` raíz para los atajos
(`dev:api`, `dev:worker`, `dev:portal`, `dev:parent`, `dev:board`).

## MQTT

El broker es **compartido con otras aplicaciones**, por lo que todos los topics
de CasiLlego cuelgan del prefijo raíz de proyecto `school-pickup/`. Las constantes y
helpers de topics viven en `@casillego/shared`.

## Notas de PWA (pendiente)

`parent` y `board` quedan PWA-ready (manifest básico). La integración de
`vite-plugin-pwa`, Wake Lock, `watchPosition` y TTS son fases posteriores.
