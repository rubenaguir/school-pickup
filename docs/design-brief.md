# Design brief — CasiLlego

> Documento para alimentar **Claude Design** como contexto. Describe qué pantallas
> diseñar, su propósito, elementos clave y la dirección visual.
>
> **Idioma de la interfaz: español** (usuarios = padres y escuelas de CDMX).
> El código va en inglés (ver `CLAUDE.md`), pero TODO texto visible al usuario va
> en español. No diseñar la UI en inglés.

## Qué es CasiLlego

Plataforma que reduce las filas de coches en la salida de instituciones (escuelas
y actividades extracurriculares). El tutor avisa desde la app que va en camino a
recoger a un alumno; se calcula un ETA y la institución prepara al alumno y lo
muestra en un tablero estilo "llegadas de aeropuerto".

Son **tres frontends distintos** con públicos y contextos de uso distintos:
1. Portal administrativo (web, de escritorio).
2. App del padre (móvil, PWA).
3. Tablero de institución (pantalla grande, a distancia).

## Dirección visual

- **Personalidad**: confiable, calmada, clara, ágil. Resuelve una situación diaria
  estresante (tráfico, esperas), así que debe transmitir **alivio y orden**, no
  ser infantil pese a tratar sobre niños. Los usuarios son padres apurados y
  personal escolar ocupado.
- **Legibilidad ante todo**, sobre todo en el tablero (se lee a varios metros) y
  en la app (se usa de reojo mientras se conduce, con el coche detenido).
- **Tipografía** sans-serif de alta legibilidad, tamaños generosos.
- **Densidad**: el portal puede ser más denso (tablas de datos); la app debe ser
  de pocos elementos y objetivos táctiles grandes; el tablero, ultra-glanceable.

## Sistema de estados de recogida (compartido por los 3 frontends)

Estos estados y sus colores deben ser **consistentes** en toda la plataforma.
Texto visible en español; el identificador interno (inglés) va entre paréntesis.

| Estado (UI) | interno | Color sugerido | Significado |
|---|---|---|---|
| En camino | `en_route` | azul / neutro | el tutor inició el trayecto |
| Llegando | `arriving` | ámbar | ETA bajo o cerca de la institución |
| En puerta | `arrived` | verde azulado | el tutor llegó, alumno al área de entrega |
| Entregado | `delivered` | verde | recogida completada |
| Cancelado | `cancelled` | gris | el tutor canceló |

> Estos colores son candidatos a tokens del design system de CasiLlego.

---

## 1. Portal administrativo (web)

Tres roles conviven en el mismo portal; diseñar como vistas según rol. Marco con
★ las **pantallas hero** (las que definen el look, conviene diseñar primero).

### Acceso
- Login con distinción clara entre **registro de escuela** y **registro de tutor**
  (caminos de alta distintos).

### Rol: administrador de institución
- ★ **Bandeja de aprobación de alumnos**: lista de solicitudes pendientes de
  asociación alumno–institución; por cada una, datos del alumno y del tutor
  solicitante, y acciones **Aprobar / Rechazar**. Es la pantalla más importante
  del portal (control de la institución sobre quién entra al esquema).
- **Perfil de la institución + geocerca**: datos y un **mapa** para fijar la
  ubicación y el radio de llegada.
- **Horarios de salida**: configuración por día de la semana.
- **Personal del tablero**: cuentas del staff que opera la pantalla.
- **Reportes**: tiempo promedio de recogida, alumnos activos.

### Rol: tutor (padre)
- **Mis hijos**: lista de alumnos con las instituciones a las que está asociado
  cada uno y el estado de cada asociación.
- **Alta de alumno**: formulario con foto.
- **Asociar a institución**: buscar institución y enviar solicitud (genera
  pendiente de aprobación).
- **Tutores autorizados**: por alumno, gestionar quién más puede recogerlo
  (madre, padre, abuela, chofer), con estado de cada uno.

### Rol: super-admin (operador)
- **Aprobación de instituciones**: cola de altas de escuelas por validar.
- **Métricas globales**: instituciones activas, solicitudes, uso.

---

## 2. App del padre (PWA, móvil)

Es prácticamente "un botón con seguimiento". Pocas pantallas, objetivos táctiles
grandes, una sola acción dominante.

- **Inicio / Mis hijos**: lista de alumnos. Acción dominante y muy visible:
  **botón grande "¡Ya voy!"**.
- **Seleccionar institución**: al tocar "¡Ya voy!", como el alumno asiste a
  varias, elegir a cuál se dirige.
- ★ **Pantalla de seguimiento (hero)**: la principal. Debe mostrar:
  - **mapa** con la ruta hacia la institución,
  - **ETA grande y claro** ("Llegas en ~8 min"),
  - **estado actual** con el color del sistema de estados,
  - indicador de **"mantén esta pantalla encendida"** (Wake Lock),
  - botones **"Ya llegué"** y **Cancelar**.
- **Aviso "tu hijo ya está en el área de entrega"**: estado que llega en vivo y se
  destaca en esta misma pantalla (sin notificaciones push en el MVP).
- **Estado pausado**: si la app pierde el foco, mostrar claramente "seguimiento en
  pausa, vuelve a abrir" en vez de fingir datos frescos.

---

## 3. Tablero de institución (pantalla grande, kiosko)

Diseñado para leerse **a distancia** dentro de la institución, estilo panel de
"llegadas de aeropuerto". Una sola pantalla que se actualiza sola.

- **Encabezado**: nombre de la institución + reloj.
- ★ **Listado de alumnos próximos a recoger (hero)**: filas grandes y muy
  legibles, ordenadas por cercanía/ETA. Por fila: **nombre del alumno**, grupo/
  grado, **estado** (con su color) y **ETA / hora estimada**. Tipografía enorme,
  alto contraste.
- **Animación sutil** al cambiar de estado una fila (p. ej. al pasar a "En
  puerta") para llamar la atención del personal.
- Considerar **voceo automático** (TTS): cuando un alumno pasa a un estado, se
  anuncia por audio; reflejar visualmente ese momento.
- **Estado vacío / inactivo**: pantalla limpia cuando no hay recogidas en curso.

---

## Fuera de alcance (no diseñar)

- Carpool / un tutor recogiendo varios alumnos a la vez.
- Pantallas de configuración de notificaciones push.
- Flujos de app nativa / tiendas de aplicaciones.

## Cómo usar este brief en Claude Design

1. Crear un proyecto "CasiLlego" y adjuntar (o crear) su design system.
2. Subir este documento como contexto del proyecto.
3. Empezar por las pantallas hero (★) de cada frontend.
4. Iterar en el lienzo y luego hacer handoff / `/design-sync` hacia `school-pickup`.
