# infra

CasiLlego depende de dos servicios de infraestructura que son **externos** (no se
levantan como contenedores de este repo):

## PostgreSQL + PostGIS

Corre ya en el host. Configura la conexión vía `.env` (ver `.env.example`):
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (o `DATABASE_URL`).

Requisito: la base debe tener la extensión **PostGIS** habilitada
(`CREATE EXTENSION IF NOT EXISTS postgis;`), necesaria para geocercas y
consultas de distancia.

Requisito adicional: la base debe tener la extensión **pgcrypto** habilitada
(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`), que provee `gen_random_uuid()`
para las columnas `uuid` de las entidades. En Postgres < 13 (sin
`gen_random_uuid()` nativo) esto requiere superusuario — el dueño de la base
no basta. Ninguna de las dos extensiones se habilita desde una migración de
este repo: son prerequisitos de la infraestructura externa, igual que el
propio servidor de Postgres.

## Broker MQTT (Mosquitto)

Es un broker **compartido con otras aplicaciones**. Por eso todos los topics de
CasiLlego cuelgan del prefijo raíz `school-pickup/` (ver `packages/shared`). Configura
la conexión vía `.env`: `MQTT_URL`, `MQTT_WS_URL`, `MQTT_USERNAME`,
`MQTT_PASSWORD`.

- `mosquitto/acl.reference` — plantilla de las reglas de ACL que el operador del
  broker debe aplicar para aislar a CasiLlego y a cada institución (tenant). Es
  documentación de referencia, no se consume en runtime.

## Procesos de la aplicación

`api` y `worker` se ejecutan directamente con npm en el entorno de desarrollo
(`npm run dev:api`, `npm run dev:worker`) y se conectan a los servicios externos
de arriba. No hay docker-compose en este repo.
