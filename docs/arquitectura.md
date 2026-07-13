# Arquitectura

> Documentación en español. Recuerda: todo el **código** va en inglés
> (ver `CLAUDE.md`).

## Resumen

Un backend en Node/TypeScript sirve a tres frontends en React, sobre PostgreSQL
con PostGIS, y usa un broker MQTT para el tiempo real. No hay microservicios: es
un monolito modular más un proceso worker dedicado al tiempo real.

## Componentes

### 1. `api` (NestJS)
REST API que atiende al portal y a la app del padre. Responsabilidades:
- Autenticación (JWT con access + refresh) y autorización por rol.
- CRUD de instituciones, usuarios, alumnos, tutores.
- Flujo de aprobación de asociaciones alumno–institución (`enrollment`).
- Aislamiento multi-tenant vía `InstitutionMembershipGuard`: cada institución
  solo ve y gestiona lo suyo (ver detalle en "Arquitectura de capas y
  convenciones de módulos" más abajo, y ADR-022).

### 2. `worker` (NestJS standalone)
Proceso de larga duración suscrito al broker MQTT. Responsabilidades:
- Ingerir las ubicaciones que publica la app del padre.
- Recalcular el ETA con throttling (no en cada tick del GPS) llamando a la API
  de mapas con tráfico en vivo.
- Persistir la última posición y el ETA en `pickup_request`.
- Publicar el estado actualizado al topic agregado del tablero y, cuando el
  `pickup_request` tiene `delivery_point_id` asignado, también al topic
  específico de esa cola de puerta.
- Purgar diariamente las `location_updates` fuera de la ventana de retención de
  90 días (feature 023).

> En Node este patrón es natural (modelo orientado a eventos). Se ejecuta como
> servicio bajo el orquestador (Docker / systemd).

Su estructura concreta (módulos, ciclo de vida de la conexión MQTT, wiring de
ports) está más abajo, en "Estructura del proceso `worker`".

### 3. `portal` (React + Vite)
Portal administrativo web. Tres roles conviven en el mismo SPA:
- **super-admin** (operador de la plataforma): aprueba instituciones, métricas.
- **admin / staff de institución**: aprueba alumnos, configura geocerca y
  horarios, gestiona el personal, los puntos de entrega y la consola de puerta.
- **tutor**: alta de alumnos, asociación a instituciones, tutores autorizados,
  catálogo de vehículos, preferencias de notificación.

### 4. `parent` (PWA React) — "Camino A"
App del padre como PWA instalable. No usa background tracking nativo. En su lugar:
- `navigator.geolocation.watchPosition` en primer plano.
- **Wake Lock API** para impedir que la pantalla se apague durante el trayecto.
- **Page Visibility API** para detectar pérdida de foco y marcar el estado como
  "pausado" en lugar de mostrar datos viejos como frescos.
- Publica la ubicación directo al broker con MQTT.js sobre WSS.

Diseñar la captura de ubicación detrás de una interfaz (`LocationProvider`) para
que, al migrar a Capacitor (Camino B), solo se sustituya esa implementación por
el plugin de background sin tocar el resto. Ver `docs/decisiones.md`.

### 5. `board` (PWA React, modo kiosko)
Pantalla grande dentro de la institución. Muestra el listado de alumnos próximos
a ser recogidos, estilo "llegadas de aeropuerto". Se suscribe por MQTT.js al
topic **agregado** de su institución y usa la Web Speech API (TTS) para el
voceo automático.

### 6. Broker MQTT (Mosquitto)
Transporte de tiempo real. Expone un listener WSS para los navegadores. El `api`
y el `worker` se conectan con la librería `mqtt` de Node.

### 7. PostgreSQL + PostGIS
Persistencia. PostGIS habilita geocercas y consultas de distancia (detectar
arribo, ordenar por cercanía). Ver `docs/modelo-datos.md`.

## Arquitectura de capas y convenciones de módulos

No se aplica Clean Architecture completa (sin casos de uso separados, sin
entidades de dominio desacopladas del ORM, sin interfaz de repositorio
genérica): el costo de ceremonia no se justifica en un proyecto de un solo
desarrollador con ORM y base de datos ya fijados (ADR-006) y con NestJS, que
ya aporta modularidad e inyección de dependencias. Ver ADR-017 para el
razonamiento completo.

**Capas por módulo NestJS:** Controller → Service → Entidad de TypeORM, sin
capas intermedias. Un módulo por contexto de dominio (`institutions`,
`students`, `enrollments`, `pickups`, `delivery-points`, `vehicles`, …).
Ejemplo ilustrativo para el módulo `institutions`:
```
institutions/
  institutions.controller.ts
  institutions.service.ts
  institution.entity.ts
```

**Inversión de dependencias solo en integraciones volátiles.** Se definen
interfaces (ports) con implementación concreta inyectada por NestJS
únicamente donde el proveedor externo es genuinamente propenso a cambiar:
- `MapsProvider` — cálculo de ETA con tráfico en vivo. Vive en el `worker`. La
  elección del proveedor real (Google Maps o Mapbox) **sigue abierta** en la
  tabla de pendientes de `docs/plan-implementacion.md`. Implementación concreta
  actual: **`StubMapsProvider`** — estima el ETA por distancia haversine entre
  origen y destino a una velocidad promedio asumida, sin llamar a ningún
  proveedor externo ni requerir API key. Es el mismo patrón que
  `ConsoleEmailProvider`: permite construir y testear el resto del slice completo
  sin que una decisión de proveedor aún abierta bloquee el corazón del producto.
  El día que se elija proveedor se sustituye la implementación sin tocar a quien
  la consume. Ver ADR-031 punto 6.
- `EmailProvider` — envío de correo transaccional. Implementación concreta
  actual: `ResendEmailProvider` (ver ADR-009); en desarrollo,
  `ConsoleEmailProvider`.
- `MqttClient` — wrapper del cliente MQTT usado por `api` y `worker`, para
  poder testear sin un broker real.

`LocationProvider` (ver sección de `parent` arriba y ADR-002) es parte de la
misma familia de decisión, aunque vive en el frontend y no en el backend.

**Máquina de estados de `pickup_request` en `packages/shared`.** Las
transiciones válidas del ciclo de vida (`en_route → arriving → arrived →
delivered/cancelled`, ver ADR-013 y `docs/modelo-datos.md`) se implementan
como función pura, sin dependencia de TypeORM ni de NestJS, en
`packages/shared/pickup-request-status-machine.ts` (nombre sugerido), con
funciones tipo `canTransition(from, to): boolean` y
`nextValidStates(from): Status[]`. Es la única pieza de lógica de dominio
aislada explícitamente, consumida tanto por `api` como por `worker` para
evitar que ambos procesos diverjan en su validación. Conjunto completo de
transiciones válidas documentado en ADR-024, punto 8. Ver ADR-017.

**Aislamiento multi-tenant vía `InstitutionMembershipGuard`.** Guard de
NestJS, ejecutado inmediatamente después del guard de autenticación JWT en
cualquier ruta que opere sobre datos de una institución. Verifica que exista
un `institution_member` con `(userId, institutionId)` antes de dejar pasar
el request; si no existe, corta con `403` antes de llegar al controller.
Dos estrategias de resolución de `institutionId` soportadas por el guard,
según el tipo de ruta:
- **Rutas anidadas** (`/institutions/:institutionId/...`): el guard lee
  `institutionId` directo del parámetro de ruta.
- **Rutas por recurso** (`PATCH /delivery-points/:id`,
  `PATCH /dismissal-windows/:id`, etc.): el guard resuelve la institución
  del recurso con una consulta mínima al repositorio correspondiente antes
  de comparar contra las membresías del usuario.
- **Colecciones filtradas por query param, fuera del guard** (ej.
  `GET /enrollments?institutionId=...`): no es ni ruta anidada ni `:id` de
  recurso — `institutionId` llega como parámetro de query sobre una
  colección, un caso que `InstitutionMembershipGuard` no resuelve (solo lee
  de `request.params` o de un recurso puntual por `:id`, nunca de la query
  string). Estas rutas no pasan por el guard: la verificación de membresía
  se hace a mano dentro del `service` correspondiente, contra
  `institution_member`, replicando el mismo `403 NOT_INSTITUTION_MEMBER` —
  ver `EnrollmentsService` como referencia. Es la excepción, no la regla:
  los dos patrones anteriores siguen siendo la forma preferida siempre que
  la forma de la ruta lo permita; extender el guard compartido para cubrir
  también este caso exigiría distinguir "ruta mal configurada" de "cliente
  omitió el query param" en un archivo usado por ocho módulos, para
  resolver una necesidad de uno solo.

**Rutas anidadas: 403 no distingue "institución inexistente" de "sin
membresía".** En modo ruta anidada el guard solo consulta
`institution_member(institutionId, userId)` — nunca consulta `institutions`
para confirmar que ese `institutionId` existe. Si el id no corresponde a
ninguna institución, simplemente no hay fila de membresía que coincida, y el
resultado es el mismo `403 NOT_INSTITUTION_MEMBER` que para un usuario real
sin acceso: ambos casos son indistinguibles para quien llama. Es
deliberado, no un hueco a corregir: no revela si un id de institución existe
a alguien sin derecho a verlo, mismo principio ya aplicado en login y
`resend-verification` (ADR-019) — ver `specs/api-contracts/auth.md`. Por
esto los `api-contracts` de rutas anidadas bajo `/institutions/:institutionId/...`
no documentan un `404` separado para "la institución no existe" en sus
endpoints `GET`/`POST`; solo las rutas por recurso (que sí resuelven y
existencia-verifican una entidad concreta) tienen un `404` alcanzable.

Complemento obligatorio, en la capa de servicio: cada `service` construye
sus queries filtrando siempre por el `institutionId` del contexto
autenticado (URL/JWT), **nunca** por uno que venga en el body de la
petición — defensa en profundidad ante un guard que falte en una ruta
nueva.

Se descarta Row-Level Security de Postgres para este propósito: es
ceremonia y complejidad operativa (fricción con TypeORM y connection
pooling) no justificada dado el mismo criterio de ADR-017. Ver ADR-022 para
el razonamiento completo.

**Forma concreta de `InstitutionMembershipGuard`.** Vive en
`apps/api/src/auth/guards/`, junto a `jwt-auth.guard.ts`:

- `institution-resource.decorator.ts` expone `@InstitutionResource(options)`
  (decorador de método, vía `SetMetadata`), con
  `InstitutionResourceOptions { entity, idParam = 'id', institutionColumn =
  'institutionId' }`. `entity` es el `EntityTarget` de TypeORM del recurso a
  resolver.
- `institution-membership.guard.ts` implementa `CanActivate`. Sin metadata
  `@InstitutionResource` en el handler, opera en modo ruta anidada y lee
  `institutionId` directo de `request.params`. Con metadata, resuelve el
  recurso vía `dataSource.getRepository(options.entity).findOne({ where: {
  id: resourceId } })` y lee `institutionColumn` del recurso (soporta
  dot-path, ej. `'institution.id'`, para navegar una relación TypeORM ya
  cargada — necesario porque entidades reales como `DeliveryPoint` o
  `InstitutionMember` modelan la institución como relación
  (`institution: Institution`), no como columna plana; queda a cargo de
  quien cablee el guard en cada ruta pasar el `institutionColumn` correcto
  y asegurar que esa relación esté disponible en el recurso resuelto).
- Recurso no encontrado → `404` con `{ code: 'RESOURCE_NOT_FOUND', message
  }`: categoría de fallo distinta de "no eres miembro" (el dato no existe,
  vs. existe pero no tienes acceso); el guard así absorbe la comprobación
  de existencia que si no cada controller duplicaría.
- Sin membresía → `403` con `{ code: 'NOT_INSTITUTION_MEMBER', message }`
  (idioma inglés en `code`/`message`, per ADR-028).
- Con membresía, el guard adjunta el registro resuelto en
  `request.institutionMembership` para que el controller/service lo
  reutilicen sin una segunda consulta. Este guard solo verifica membresía;
  no impone ninguna restricción por `role` (eso es responsabilidad de cada
  endpoint, ej. la restricción a `role = admin` de ADR-022 punto 1).
- Si `request.user` falta (el guard corrió sin `JwtAuthGuard` antes) o la
  ruta anidada no trae `:institutionId`, el guard lanza un `Error` plano
  (no `HttpException`) — señal de error de configuración en desarrollo, no
  una respuesta de negocio.

Nota de alcance: por ahora el guard es infraestructura transversal sin
consumidores (los módulos de Fase 5 — `institutions`, `delivery-points`,
etc. — todavía no existen); queda cubierto por tests unitarios con mocks
(`apps/api/src/auth/guards/institution-membership.guard.spec.ts`), sin
aplicarse todavía a ninguna ruta real.

## Estructura del proceso `worker`

Se documenta aquí, y no como una spec propia, por el mismo criterio que la
"forma concreta" del `InstitutionMembershipGuard`: es el cableado de un proceso,
no una feature de negocio. `specs/features/` describe comportamiento observable
(qué se ingiere, cuándo se recalcula el ETA, cuándo se transiciona a `arriving`);
esta sección describe cómo se ensambla el proceso que lo ejecuta. Ver ADR-031
punto 3.

**Es una aplicación NestJS standalone**, no un servidor HTTP: arranca con
`NestFactory.createApplicationContext()` (sin `listen()`), de modo que aprovecha
el sistema de módulos, la inyección de dependencias y los hooks de ciclo de vida
de NestJS sin exponer ningún puerto. El `api` es su contraparte HTTP; ambos
comparten entidades de TypeORM, ports y la máquina de estados de
`packages/shared`.

**Módulos.** Un módulo por responsabilidad, todos importados por el `AppModule`
raíz:
- `MqttModule` — provee la implementación concreta de `MqttClient` (el port de
  ADR-017) y gestiona la conexión al broker. Es también el que traduce cada
  mensaje entrante en una llamada al servicio de dominio correspondiente.
- `LocationIngestionModule` — features 019 y 020: persiste cada lectura en
  `location_updates`, aplica el throttling, recalcula el ETA vía `MapsProvider` y
  evalúa la transición automática a `arriving` contra la máquina de estados
  compartida.
- `MapsModule` — provee la implementación concreta de `MapsProvider`
  (`StubMapsProvider` hoy).
- `PurgeModule` — feature 023: el job diario de retención de `location_updates`,
  agendado con `@nestjs/schedule` (`@Cron`), de madrugada (ADR-024 punto 6).
- `TypeOrmModule` y `ConfigModule` — mismas entidades y misma configuración de
  base de datos que el `api`, apuntando al mismo Postgres.

**Ciclo de vida de la conexión MQTT.** La conexión es un recurso del proceso, no
de una petición, así que vive en los hooks de NestJS:
- **Conexión inicial** en `OnModuleInit` del `MqttModule`: conecta al broker con
  las credenciales del `.env` (nunca anónimo, siempre TLS) y se suscribe **una
  sola vez** al patrón con comodín
  `school-pickup/institution/+/pickup/+/location` (ADR-031 punto 4). Si la
  conexión inicial falla, el arranque falla ruidosamente: un `worker` vivo pero
  desconectado es peor que uno caído, porque nadie se entera.
- **Reconexión automática**, delegada a la librería `mqtt` de Node (que ya la
  implementa con backoff): el `worker` no reimplementa la lógica de reintento. Al
  reconectar, la suscripción se restablece — y como es **una sola** suscripción
  con comodín y no un set dinámico por trayecto, no hay estado que reconstruir.
  Esa es justamente la razón de fondo del comodín.
- **Desconexión:** las lecturas de ubicación publicadas mientras el `worker`
  está caído se pierden (QoS 0, ver abajo). Es aceptable y deliberado: el GPS
  del tutor emite una lectura nueva cada pocos segundos, así que el ETA se
  recupera solo en cuanto la conexión vuelve. No se persiste una cola de
  mensajes no procesados para ese stream. Las transiciones de estado no
  publicadas por una desconexión, en cambio, sí importan — ver QoS 1 abajo.
- **QoS distinto según la dirección del mensaje, no un valor único para todo
  MQTT:**
  - **QoS 0** ("at most once") en la ingesta de ubicación
    (`parent → worker`, topic `.../pickup/{pickupRequestId}/location`): es un
    stream de estado efímero donde la siguiente lectura de GPS reemplaza a la
    anterior, no un evento transaccional. Perder una lectura no tiene
    consecuencia — llega otra en segundos — y garantizar su entrega costaría
    latencia y estado en el broker para nada.
  - **QoS 1** ("at least once") en la publicación de transiciones de estado
    (`worker`/`api` → `board` y `delivery-point/.../queue`, features 018–022):
    a diferencia de la ubicación, una transición de `pickup_request.status`
    ocurre **una sola vez** en la vida del trayecto — no hay "el siguiente
    mensaje" que corrija una pérdida. Perder un `arrived` o un `delivered` por
    QoS 0 dejaría el tablero o la consola de puerta mostrando un estado
    obsoleto indefinidamente, sin ningún mensaje posterior que lo corrija. QoS
    1 admite duplicados (un consumidor idempotente por `pickupRequestId` +
    `status` los absorbe sin problema), pero no admite pérdidas silenciosas.
  - La fuente de verdad del trayecto sigue siendo Postgres, no el broker, en
    ambos casos: MQTT es el canal de tiempo real, no el sistema de registro.
- **Shutdown graceful:** `app.enableShutdownHooks()` ya está activo; en
  `OnModuleDestroy` el `MqttModule` cierra la conexión limpiamente
  (`MqttClient.disconnect()`) para no dejar sesiones colgadas en el broker.

**Wiring de los ports.** Los tres se inyectan por token (`Symbol`), nunca por su
clase concreta, exactamente como el `api` inyecta `EmailProvider`:
- `MQTT_CLIENT` → la implementación concreta sobre la librería `mqtt` de Node.
- `MAPS_PROVIDER` → `StubMapsProvider` (ver arriba; el proveedor real sigue
  pendiente).
- `EmailProvider` **no se inyecta en el `worker`**: ninguna de sus features
  (019–023) envía correo. Si en el futuro lo necesitara, se importa el mismo
  módulo que ya usa el `api`.

Los consumidores (`LocationIngestionModule`, `PurgeModule`) dependen solo de las
interfaces, así que los tests corren sin broker ni proveedor de mapas real,
que es el motivo de que estos tres sean ports y no clases concretas (ADR-017).

## Flujo de tiempo real (recogida)

1. El tutor toca "voy en camino" y elige la institución (el alumno asiste a
   varias). Se crea un `pickup_request` y, al crearlo, se resuelve
   automáticamente su `delivery_point_id` matcheando
   `enrollments.grade_or_group` contra `delivery_points.assigned_groups` (ver
   ADR-012).
2. La app `parent` publica su ubicación a
   `school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location`.
3. El `worker`, suscrito, recibe la ubicación, recalcula el ETA (con throttling)
   y persiste la última posición y `estimated_arrival_at`.
4. El `worker` publica el estado actualizado:
   - Siempre al feed agregado del tablero:
     `school-pickup/institution/{institutionId}/board`.
   - Cuando el `pickup_request` tiene `delivery_point_id`, también al topic
     específico de esa puerta:
     `school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue`.
5. El `board`, suscrito al agregado, refresca el listado en vivo. Cada consola
   de puerta, suscrita a su cola específica, ve solo los alumnos asignados a
   ese punto de entrega.
6. Cuando el alumno está en el área de entrega, el staff lo marca en la consola
   de puerta y verifica el `delivery_code` que el tutor muestra en su app;
   esa transición viaja por los mismos canales y la app del padre la recibe al
   instante (sin push).

## Estructura de topics MQTT y seguridad

- **Prefijo raíz de proyecto**: todos los topics cuelgan de `school-pickup/`. El
  broker (Mosquitto) es compartido con otras aplicaciones, así que este prefijo
  aísla el namespace de CasiLlego y evita colisiones con otros sistemas.
- Segmentación por institución (base multi-tenant) y, cuando aplica, por punto
  de entrega:
  ```
  school-pickup/institution/{institutionId}/board
      # feed agregado del tablero de la institución
  school-pickup/institution/{institutionId}/delivery-point/{deliveryPointId}/queue
      # cola específica de cada punto de entrega (para su consola)
  school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location
      # ubicación publicada por la app del padre
  ```
- **Patrón de suscripción del `worker` (comodín).** El `worker` no se suscribe a
  un topic de ubicación por cada trayecto: se suscribe una sola vez, al arrancar,
  al patrón con wildcards `+` (un solo nivel) que los cubre todos:
  ```
  school-pickup/institution/+/pickup/+/location
  ```
  Es un patrón de **suscripción del servidor**, no un topic de publicación:
  ningún cliente publica jamás a un topic con `+`. Como el payload no lleva
  `institutionId` ni `pickupRequestId` (viven solo en el string del topic), el
  `worker` los recupera con un parser inverso en `packages/shared`, compañero de
  los builders de topics. Ver ADR-031 punto 4 y
  `specs/api-contracts/pickup-realtime-mqtt.md`.
- **ACL por tenant** en el broker: cada cliente solo puede publicar/suscribirse
  a los topics de la institución a la que pertenece. Un tutor de una institución
  NO debe poder suscribirse a los topics de otra. Cualquier `institution_member`
  de la institución puede suscribirse a cualquiera de los topics de
  delivery-point de su institución (consistente con ADR-011: el acceso a la
  consola de puerta no está restringido por rol dentro del mismo tenant).
- TLS obligatorio (WSS). Autenticación por usuario/token en el broker, nunca
  anónimo. Tokens emitidos por el `api` tras el login.
- A nivel API (REST, no MQTT), el mismo principio de aislamiento por tenant lo
  aplica el `InstitutionMembershipGuard` (ver sección anterior).

## ETA y costo

- La API de mapas con tráfico en vivo (Google o Mapbox) es el principal costo
  variable. El `worker` aplica throttling: recalcula cada 20 segundos o cada
  150 metros recorridos, lo que ocurra primero (ADR-024, punto 2) — no en
  cada lectura del GPS.
- El tablero hace la cuenta regresiva por aritmética entre recálculos, así que la
  experiencia se ve fluida sin multiplicar las llamadas a la API.

## Privacidad y marco legal (LFPDPPP)

- Se manejan datos de **menores** + **ubicación**. Principio de diseño:
  rastrear **solo durante la ventana de recogida** y detener el tracking al
  finalizar. Nunca ubicación continua.
- Aviso de privacidad y consentimiento explícitos.
- `location_updates` se retiene 90 días desde `pickup_requests.completed_at`
  y luego se purga vía job diario (ADR-018 punto 8, ADR-024 punto 6).
- `audit_log` para trazabilidad de toda acción sensible.

## Identidad en la entrega (control de seguridad)

La asociación alumno–institución requiere aprobación de la institución, y cada
alumno tiene una lista de **tutores autorizados**. El `pickup_request` registra
qué tutor va en camino, de modo que la institución pueda verificar que quien
recoge es alguien autorizado.

Como capa adicional de verificación, cada `pickup_request` incluye un
**código de entrega de 4 dígitos** (`delivery_code`) que el tutor ve en su
app al alcanzar el estado "En puerta". El staff lo verifica en la consola de
puerta contra el valor del `pickup_request` antes de confirmar la entrega y
disparar la transición a `delivered`. Ver ADR-013.

El código es visible, vía `GET`, tanto para el tutor dueño del
`pickup_request` como para cualquier `institution_member` de la institución
asociada, sin restricción de `role` — consistente con ADR-011 (acceso
abierto a la consola de puerta). Un `delivery_code` incorrecto no bloquea ni
limita reintentos (es verificación presencial, no un vector de ataque
remoto): cada intento fallido responde `401 INVALID_DELIVERY_CODE` y se registra
en `audit_log` (`pickup_request.delivery_code_mismatched`, con `metadata = null`:
no se guarda el código tecleado) para trazabilidad. Ver ADR-024, puntos 4 y 11, y
ADR-031, puntos 1, 2, 7 y 8.
