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
- Aislamiento multi-tenant: cada institución solo ve y gestiona lo suyo.

### 2. `worker` (Node/TypeScript)
Proceso de larga duración suscrito al broker MQTT. Responsabilidades:
- Ingerir las ubicaciones que publica la app del padre.
- Recalcular el ETA con throttling (no en cada tick del GPS) llamando a la API
  de mapas con tráfico en vivo.
- Persistir la última posición y el ETA en `pickup_request`.
- Publicar el estado actualizado al topic del tablero de la institución.

> En Node este patrón es natural (modelo orientado a eventos). Se ejecuta como
> servicio bajo el orquestador (Docker / systemd).

### 3. `portal` (React + Vite)
Portal administrativo web. Tres roles conviven en el mismo SPA:
- **super-admin** (operador de la plataforma): aprueba instituciones, métricas.
- **admin / staff de institución**: aprueba alumnos, configura geocerca y
  horarios, gestiona el personal del tablero.
- **tutor**: alta de alumnos, asociación a instituciones, tutores autorizados.

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
topic de su institución y usa la Web Speech API (TTS) para el voceo automático.

### 6. Broker MQTT (Mosquitto)
Transporte de tiempo real. Expone un listener WSS para los navegadores. El `api`
y el `worker` se conectan con la librería `mqtt` de Node.

### 7. PostgreSQL + PostGIS
Persistencia. PostGIS habilita geocercas y consultas de distancia (detectar
arribo, ordenar por cercanía). Ver `docs/modelo-datos.md`.

## Flujo de tiempo real (recogida)

1. El tutor toca "voy en camino" y elige la institución (el alumno asiste a
   varias). Se crea un `pickup_request`.
2. La app `parent` publica su ubicación a
   `school-pickup/institution/{institutionId}/pickup/{pickupRequestId}/location`.
3. El `worker`, suscrito, recibe la ubicación, recalcula el ETA (con throttling)
   y persiste la última posición y `estimated_arrival_at`.
4. El `worker` publica el estado a `school-pickup/institution/{institutionId}/board`.
5. El `board`, suscrito a ese topic, refresca el listado en vivo.
6. Cuando el alumno está en el área de entrega, el staff lo marca; ese estado
   viaja por el mismo canal y la app del padre lo recibe al instante (sin push).

## Estructura de topics MQTT y seguridad

- **Prefijo raíz de proyecto**: todos los topics cuelgan de `school-pickup/`. El
  broker (Mosquitto) es compartido con otras aplicaciones, así que este prefijo
  aísla el namespace de CasiLlego y evita colisiones con otros sistemas.
- Dentro de ese prefijo, segmentado siempre por institución:
  `school-pickup/institution/{institutionId}/...`.
- **ACL por tenant** en el broker: cada cliente solo puede publicar/suscribirse
  a los topics de la institución a la que pertenece. Un tutor de una institución
  NO debe poder suscribirse a los topics de otra.
- TLS obligatorio (WSS). Autenticación por usuario/token en el broker, nunca
  anónimo. Tokens emitidos por el `api` tras el login.

## ETA y costo

- La API de mapas con tráfico en vivo (Google o Mapbox) es el principal costo
  variable. El `worker` aplica throttling: recalcula cada N segundos o cada X
  metros recorridos, no en cada lectura del GPS.
- El tablero hace la cuenta regresiva por aritmética entre recálculos, así que la
  experiencia se ve fluida sin multiplicar las llamadas a la API.

## Privacidad y marco legal (LFPDPPP)

- Se manejan datos de **menores** + **ubicación**. Principio de diseño:
  rastrear **solo durante la ventana de recogida** y detener el tracking al
  finalizar. Nunca ubicación continua.
- Aviso de privacidad y consentimiento explícitos.
- `audit_log` para trazabilidad de toda acción sensible.

## Identidad en la entrega (control de seguridad)

La asociación alumno–institución requiere aprobación de la institución, y cada
alumno tiene una lista de **tutores autorizados**. El `pickup_request` registra
qué tutor va en camino, de modo que la institución pueda verificar que quien
recoge es alguien autorizado. (Mecanismo de confirmación en el punto de entrega
—QR/PIN— es una mejora prevista, no parte del MVP mínimo.)
