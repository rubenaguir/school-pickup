# CLAUDE.md — CasiLlego

> Memoria de proyecto para Claude Code. Léelo al inicio de cada sesión.
> Mantener breve y de alta señal. El detalle vive en `docs/`.
>
> Plataforma: **CasiLlego** · Repo / directorio raíz: `school-pickup`

## Visión general

**CasiLlego** es una plataforma SaaS multi-tenant para reducir las filas de coches en
la salida de instituciones (escuelas y actividades extracurriculares) en CDMX. Un
tutor avisa desde la app que va en camino a recoger a un alumno (el "ya voy"); el
sistema calcula un ETA y la institución prepara al alumno para entregarlo,
mostrándolo en un tablero estilo "llegadas de aeropuerto".

## Regla de idioma (IMPORTANTE)

- TODO el **código** en **inglés**: nombres de variables, funciones, clases,
  tablas, campos de base de datos, endpoints, comentarios de código y mensajes
  de commit.
- La **documentación** (`docs/`, este archivo) va en **español**.
- Nunca mezclar: identificadores en inglés, prosa explicativa en español.

## Stack

- **Backend**: Node.js + TypeScript + NestJS. Dos procesos: `api` y `worker`.
- **Base de datos**: PostgreSQL + PostGIS. ORM: TypeORM con migraciones versionadas.
- **Tiempo real**: broker MQTT (Mosquitto). Clientes web vía MQTT.js sobre WSS.
- **Auth**: JWT (access + refresh) con Passport.js.
- **Frontends** (React + Vite + TypeScript):
  - `portal` — portal administrativo (web).
  - `parent` — app del padre (PWA, "Camino A": primer plano + Wake Lock + watchPosition).
  - `board` — tablero de institución (PWA en modo kiosko, con TTS para el voceo).
- **Infra**: PostgreSQL+PostGIS y el broker MQTT (Mosquitto) son servicios
  **externos** (no contenerizados en este repo; el broker es compartido con
  otras apps). `api` y `worker` corren como procesos Node y se conectan a ellos.
  Despliegue en Linux + nginx.

## Alcance del MVP

DENTRO:
- Multi-institución por alumno (un alumno asiste a primaria + extracurriculares).
- Tutores autorizados múltiples por alumno (madre, padre, abuela, chofer).
- Asociación alumno–institución con aprobación por parte de la institución.
- Tracking en primer plano + ETA con throttling.
- Tablero en vivo vía MQTT.

FUERA (por ahora):
- Carpool / un tutor recogiendo varios alumnos a la vez.
- Notificaciones push (no hacen falta en Camino A; el aviso llega por MQTT con la
  app abierta).
- App nativa / publicación en tiendas (migración futura a Capacitor; ver
  `docs/decisiones.md`).

## Estructura del repo (monorepo)

```
apps/
  api/        NestJS — REST API (auth, CRUD, aprobaciones)
  worker/     Suscriptor MQTT — ingesta de ubicación, cálculo de ETA
  portal/     Portal administrativo (React)
  parent/     App del padre (PWA React)
  board/      Tablero de institución (React)
packages/
  shared/     Tipos TypeScript compartidos entre apps
infra/        Referencia de infraestructura externa (postgres, mqtt, ACL)
docs/         Documentación (español)
```

## Convenciones

- `snake_case` en base de datos; `camelCase` en TypeScript. Las entidades de
  TypeORM hacen el mapeo entre ambos.
- Identificadores de dominio en inglés: `institution`, `student`, `guardian`,
  `enrollment`, `pickup_request`, `location_update`.
- Todos los topics MQTT cuelgan del prefijo raíz de proyecto `school-pickup/`
  (el broker es compartido con otras aplicaciones; así se evita la colisión de
  namespaces). Dentro de ese prefijo, segmentados por institución:
  `school-pickup/institution/{institutionId}/...`, con ACL por tenant en el
  broker. Un cliente NUNCA debe poder suscribirse a topics de otra institución.
- Toda acción sensible (aprobaciones, alta/baja de tutores) se registra en
  `audit_log`.
- Comunicación TLS en todo (HTTPS y WSS). MQTT con autenticación, nunca anónimo.

## Documentos de referencia

- `docs/arquitectura.md` — arquitectura y flujo de tiempo real.
- `docs/modelo-datos.md` — modelo entidad-relación.
- `docs/decisiones.md` — registro de decisiones (ADR).

## Comandos

- Instalar dependencias (monorepo): `npm install`
- Compilar tipos compartidos: `npm run build:shared`
- Desarrollo: `npm run dev:api` · `dev:worker` · `dev:portal` · `dev:parent` · `dev:board`
- Build de todo: `npm run build`
- Requiere Postgres+PostGIS y broker MQTT externos (config en `.env`, ver `.env.example`).
- Migraciones / tests / lint: _(TODO al crear los módulos de dominio)_
