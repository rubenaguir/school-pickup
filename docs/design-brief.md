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
  ubicación. Incluye los dos radios (activación del botón "ya voy" y arribo/
  detección de llegada), tolerancia de llegada y aviso anticipado.
- **Puntos de entrega**: gestión de las puertas/accesos físicos de la
  institución (nombre, descripción, operador asignado, grupos o niveles que
  llegan por ese punto, estado activo/inactivo). La asignación de alumnos a
  puntos de entrega es **por grupo/nivel a nivel institucional**, no por
  padre: cambiar por dónde sale un alumno significa cambiar el grupo de
  alumnos entero.
- **Consola de puerta**: pantalla operativa (no kiosko) que el staff usa en
  su tablet o PC para trabajar en un punto de entrega concreto. Muestra la
  fila de alumnos asignados a esa puerta, permite verificar el **código de
  entrega** de 4 dígitos que el tutor muestra en su app (QR o PIN), y
  confirmar la entrega o reportar una incidencia. Cualquier miembro del
  personal puede acceder, independientemente de su rol (para que un
  coordinador pueda cubrir a un operador ausente sin reconfiguración).
- **Horarios de salida**: configuración de ventanas recurrentes por día de la
  semana (con nombre, nivel opcional y estado activo/pausado) y **días
  especiales** que sobreescriben el horario normal (ej. fin de cursos, ensayo
  cívico).
- **Personal**: cuentas del personal de la institución (administrador,
  coordinador, docente, operador de puerta), con su estado y último acceso.
- **Reportes**: tiempo promedio de recogida, alumnos activos, puntualidad,
  entregas por día.

### Rol: tutor (padre)
- **Mis hijos**: lista de alumnos con las instituciones a las que está asociado
  cada uno y el estado de cada asociación.
- **Alta de alumno**: formulario con foto.
- **Asociar a institución**: buscar institución por nombre o código y enviar
  solicitud (genera pendiente de aprobación). Las tarjetas muestran el tipo
  (escuela / actividad) y, en actividades, la categoría (Ballet, Natación,
  Robótica, etc.).
- **Tutores autorizados**: por alumno, gestionar quién más puede recogerlo
  (madre, padre, abuela, chofer), con estado de cada uno.
- **Perfil**: datos personales, **mis vehículos** (catálogo reutilizable:
  descripción, placa, marcar uno como principal), **preferencias de
  notificación** (aprobación de asociación, recordatorio de salida,
  confirmación de entrega, novedades del producto) y seguridad (cambiar
  contraseña, inicio con huella del dispositivo).

### Rol: super-admin (operador)
- **Aprobación de instituciones**: cola de altas de escuelas por validar.
- **Métricas globales**: instituciones activas/pendientes/suspendidas,
  solicitudes pendientes, tutores registrados, recogidas totales con
  comparativo vs. periodo anterior, top instituciones por uso, tiempo medio
  de recogida.

---

## 2. App del padre (PWA, móvil)

Es prácticamente "un botón con seguimiento". Pocas pantallas, objetivos táctiles
grandes, una sola acción dominante.

- **Inicio / Mis hijos**: lista de alumnos. Acción dominante y muy visible:
  **botón grande "¡Ya voy!"**.
- **Seleccionar institución**: al tocar "¡Ya voy!", como el alumno asiste a
  varias, elegir a cuál se dirige. Incluye la selección de **vehículo** (del
  catálogo del perfil o captura libre) o la opción de indicar que **llega
  caminando**.
- ★ **Pantalla de seguimiento (hero)**: la principal. Debe mostrar:
  - **mapa** con la ruta hacia la institución,
  - **ETA grande y claro** ("Llegas en ~8 min"),
  - **estado actual** con el color del sistema de estados,
  - indicador de **"mantén esta pantalla encendida"** (Wake Lock),
  - botones **"Ya llegué"** y **Cancelar**.
- **Aviso "tu hijo ya está en el área de entrega"**: estado que llega en vivo y se
  destaca en esta misma pantalla.
- **Código de entrega**: al alcanzar el estado "En puerta", el tutor accede a
  una pantalla con **QR y PIN de 4 dígitos** que muestra al staff en la
  puerta. Vigente solo durante la ventana de salida activa. Es el mecanismo
  de verificación que el staff usa antes de confirmar la entrega.
- **Estado pausado**: si la app pierde el foco, mostrar claramente "seguimiento en
  pausa, vuelve a abrir" en vez de fingir datos frescos.

> El **punto de entrega** (por qué puerta sale el alumno) NO es una elección del
> padre: se resuelve automáticamente por el grupo del alumno según la
> configuración de la institución. La app puede mostrarlo como información
> ("Presenta el código en la Puerta principal"), pero nunca como selector.

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
- **Filtro por punto de entrega**: el tablero puede indicar por qué puerta
  sale cada alumno (etiqueta A/B/C o nombre corto), útil cuando la
  institución opera con varios puntos simultáneos.

---

## Fuera de alcance (no diseñar)

- Carpool / un tutor recogiendo varios alumnos a la vez.
- Flujos de app nativa / tiendas de aplicaciones.

## Cómo usar este brief en Claude Design

1. Crear un proyecto "CasiLlego" y adjuntar (o crear) su design system.
2. Subir este documento como contexto del proyecto.
3. Empezar por las pantallas hero (★) de cada frontend.
4. Iterar en el lienzo y luego hacer handoff / `/design-sync` hacia `school-pickup`.
