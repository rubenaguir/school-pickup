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
- Consola de puerta con verificación por código de entrega de 4 dígitos.

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
  shared/     Tipos, entidades TypeORM, ports, adapters y la máquina de
              estados compartidos entre apps
infra/        Referencia de infraestructura externa (postgres, mqtt, ACL)
docs/         Documentación (español)
```

## Convenciones

- `snake_case` en base de datos; `camelCase` en TypeScript. Las entidades de
  TypeORM hacen el mapeo entre ambos.
- Identificadores de dominio en inglés: `institution`, `student`,
  `student_guardian` (la relación tutor–alumno; el tutor en sí es un `user`
  referenciado por `student_guardians.guardian_user_id`, no una tabla `guardian`),
  `enrollment`, `pickup_request`, `location_update`, `delivery_point`, `vehicle`.
- Todos los topics MQTT cuelgan del prefijo raíz de proyecto `school-pickup/`
  (el broker es compartido con otras aplicaciones; así se evita la colisión de
  namespaces). Dentro de ese prefijo, segmentados por institución y, cuando
  aplica, por punto de entrega (ver `docs/arquitectura.md`). ACL por tenant
  en el broker. Un cliente NUNCA debe poder suscribirse a topics de otra
  institución.
- Aislamiento multi-tenant a nivel API (REST) vía `InstitutionMembershipGuard`
  (NestJS): verifica `institution_member(userId, institutionId)` antes de
  dejar pasar cualquier request sobre datos de una institución. Los services
  nunca confían en un `institutionId` recibido en el body. Ver ADR-022 y
  `docs/arquitectura.md`.
- Convención HTTP: `422 Unprocessable Entity` para peticiones bien formadas
  que violan una regla de negocio cruzada entre entidades (ej. un
  `operator_user_id` que no pertenece a la institución, o dejar una
  institución sin ningún `admin`). `400` queda reservado para peticiones mal
  formadas. Ver ADR-022, punto 5.
- Toda acción sensible (aprobaciones, alta/baja de tutores) se registra en
  `audit_log`.
- Comunicación TLS en todo (HTTPS y WSS). MQTT con autenticación, nunca anónimo.
- Backend en capas simples por módulo NestJS (Controller → Service → Entidad
  TypeORM), sin Clean Architecture completa. Interfaces (ports) solo para
  integraciones volátiles: `MapsProvider`, `EmailProvider`, `MqttClient`. La
  máquina de estados de `pickup_request` es la única lógica de dominio
  aislada, como función pura compartida en `packages/shared`. Detalle
  completo en `docs/arquitectura.md` y ADR-017.

## Reglas de implementación (IMPORTANTE)

Guardrails para que el código no se desvíe de las specs. Ver ADR-021.

- **La spec es la fuente de verdad.** No implementar ningún campo, endpoint,
  código de error, valor de enum, índice ni invariante que no esté en su spec
  (`specs/entities`, `specs/features`, `specs/api-contracts`). Si algo no está
  especificado, no se inventa.
- **Spec antes que código.** Si al implementar se descubre que la spec está
  incompleta o equivocada, PARAR: actualizar primero la spec (y el ADR
  correspondiente si es una decisión de fondo), y solo entonces escribir el
  código. Nunca al revés, nunca "sobre la marcha".
- **Cada invariante de negocio → un test o un constraint de BD.** Las reglas de
  la sección "Invariantes de negocio" de cada spec de entidad deben quedar
  forzadas por el esquema o por una prueba; el compilador no las atrapa.
- **Dependencias:** antes de importar un paquete, confirmar que está en el
  `package.json` correspondiente. No asumir que una librería o API existe;
  verificarlo. Versiones fijadas y compatibles (ver ADR-020/021).
- **La compuerta manda.** Antes de dar por terminado un cambio no trivial,
  `npm run check` debe pasar (lint type-aware + formato + build + tests).
  TypeScript en 5.9.x (no 7 todavía; rompe el lint type-aware). Prettier
  formatea código, no la documentación en markdown.
- **Artefactos de verificación puntual (capturas, snapshots, logs de
  herramientas MCP como Playwright) van dentro de `.playwright-mcp/`**
  (ignorado por git), nunca sueltos en la raíz del repo ni en ninguna otra
  carpeta del proyecto. Si una verificación termina y deja algo fuera de
  ese directorio, bórralo antes de dar el cambio por terminado — no
  confíes en que el patrón de `.gitignore` lo vaya a atrapar por nombre.

## Documentos de referencia

- `docs/arquitectura.md` — arquitectura y flujo de tiempo real.
- `docs/modelo-datos.md` — modelo entidad-relación.
- `docs/decisiones.md` — registro de decisiones (ADR).

## Comandos

- Instalar dependencias (monorepo): `npm install`
- Compilar tipos compartidos: `npm run build:shared`
- Desarrollo: `npm run dev:api` · `dev:worker` · `dev:portal` · `dev:parent` · `dev:board`
- Build de todo: `npm run build`
- Compuerta de calidad: `npm run check` (lint + formato + build + tests). Ver ADR-021.
- Lint / formato / tests por separado: `npm run lint` · `npm run format` · `npm run test`
- Requiere Postgres+PostGIS y broker MQTT externos (config en `.env`, ver `.env.example`).
- Migraciones (`apps/api`): `npm run migration:generate` · `migration:run` ·
  `migration:revert` (TypeORM CLI contra `src/database/data-source.ts`).
