# CasiLlego — Design System

**CasiLlego** es una plataforma SaaS multi-tenant para coordinar la salida
vehicular de estudiantes en colegios de México: los padres avisan cuando van
en camino a recoger a su hijo, y el colegio ve en tiempo real quién está por
llegar. (Nombre anterior: **YaVoy**, descartado por conflicto con una app
española existente — este sistema documenta la marca ya migrada.)

Mercado: instituciones educativas mexicanas (B2B, quien decide/compra) y
padres de familia (B2C, uso diario). Tono de marca: cálido, confiable, cercano
— nunca corporativo/frío ni infantil.

## Fuentes

Este sistema se extrajo de las pantallas ya construidas del producto
(en el mismo proyecto/repo): portal de administración, app del padre y
tablero de institución, más el documento `uploads/design-brief.md` y la
exploración de logo `Marca CasiLlego - Direcciones de logo.dc.html`.
No hay Figma ni codebase de producción adjuntos — este sistema es la fuente
de verdad hasta que exista uno.

## Identidad

El nombre "CasiLlego" es una frase coloquial genérica del español mexicano
("ya merito llego"), así que el logo carga el peso de la diferenciación: un
**pin de ubicación con un anillo de progreso casi cerrado** (dirección de
logo "Casi completo", aprobada tras explorar 3 direcciones — coral, violeta,
frambuesa). Wordmark **CasiLlego** con "Llego" en coral.

## Índice

- `styles.css` — entry point, importa todos los tokens.
- `tokens/colors.css` — marca (coral+navy) y **los 5 estados de recogida** (no recolorear).
- `tokens/typography.css` — Schibsted Grotesk, escala tipográfica.
- `tokens/spacing.css` — spacing, radios, sombras, motion.
- `assets/` — isotipo (pin) en positivo/negativo, SVG.
- `guidelines/` — specimen cards (colores, tipografía, radios).
- `components/core/` — Button, Badge, Card, Avatar, Toggle, SegmentedTabs.
- `components/feedback/` — EmptyState, ErrorState, SkeletonRow (estados transversales).
- `components/navigation/` — NavItem (sidebar).
- `ui_kits/acceso/` — Login → elegir tipo de cuenta → alta escuela/tutor (compartido por los 3 roles).
- `ui_kits/portal-admin/` — selector Institución (Dashboard en vivo, Bandeja de aprobación, Institución, Horarios, Personal, Reportes) / Operador global OPS (Resumen, Instituciones, Usuarios, Configuración).
- `ui_kits/app-padre/` — selector App móvil (Inicio→Seguimiento→Confirmación) / Portal web (Mis hijos, Asociar institución, Tutores autorizados, Perfil).
- `ui_kits/tablero-institucion/` — selector de 3 modos: Andén, Sereno, Carril.
- `ui_kits/puerta-consola/` — consola operativa de la puerta (fila + detalle + vocear/entregar).
- `guidelines/estados-transversales.card.html` — patrones de carga/vacío/error + anatomía del patrón.
- `templates/` — 5 starting points para Claude Code / proyectos consumidores (uno por UI kit, ver abajo).
- `SKILL.md` — manifiesto para uso como Agent Skill.

## Fundamentos de contenido

- **Idioma:** español (es-MX), es la única UI visible al usuario — nunca inglés.
- **Voz:** cálida y directa, cercana pero profesional (la usan tanto padres
  como administradores de colegio). No es un chatbot ni un vendedor.
- **Pronombres:** tú (nunca usted). "¿A quién recoges hoy?", "Vincula a tu hijo".
- **Botones/acciones:** verbos imperativos cortos, sentence case — "Invitar
  usuario", "Reintentar", "Confirmar recogida". La acción dominante de la app
  del padre es literalmente **"¡Ya voy!"**.
- **Estados vacíos:** factuales, nunca "¡Ups!" — "Sin recogidas pendientes".
- **Errores:** mensaje real del backend + fallback "Error desconocido" + código
  técnico discreto en mono + "Reintentar" siempre visible.
- **Eyebrows/etiquetas de sección:** MAYÚSCULAS, tracked — "MIS HIJOS", "HOY".
- **Números y horas:** `es-MX`, reloj 24h (`14:06`), tabular-nums en horas/ETAs.
- **Emoji:** no se usan. El único glifo decorativo es el `›` dentro del botón
  "¡Ya voy!" (sensación de "avanzar"), y el punto medio `·` como separador.

## Fundamentos visuales

- **Color:** paleta fría/neutra (navy + grises azulados) con **un solo acento
  cálido**: el coral de marca (`--brand`). El coral se reserva a la acción
  primaria, la navegación activa y el isotipo — nunca se usa para más de un
  elemento dominante por pantalla. Los **5 colores de estado son un sistema
  aparte y fijo** (en_route azul, arriving ámbar, arrived teal, delivered
  verde, cancelled gris) — no se recolorean ni se sustituyen por el coral.
- **Tipografía:** Schibsted Grotesk en toda la interfaz, pesos 400–900. Los
  números clave (ETA, reloj del tablero, ratio ETA) se ven en tamaños
  enormes (30–66px) con `font-variant-numeric: tabular-nums`.
- **Fondos:** app chrome en `--bg-app` (gris azulado clarísimo, `#E9EEF3`);
  el tablero de institución usa modo oscuro (`#0A1622`) para legibilidad a
  distancia. Sin texturas, sin ilustraciones, sin patrones repetidos.
  El único gradiente permitido es un sutil coral→durazno para copy de marca
  ("Más **calma** a la salida") — nunca como fondo de página ni de botón.
- **Bordes y radios:** bordes 1px fríos (`--border` `#E2E9F0`). Radios
  generosos y consistentes: 11px botones/nav, 14–16px tarjetas, pill para
  badges/toggles. Nunca esquinas cuadradas en superficies interactivas.
  El tablero de kiosko no usa borde-izquierdo de color para indicar estado —
  usa badges de píldora completos.
- **Tarjetas:** fondo blanco, borde 1px, sombra casi imperceptible
  (`--shadow-xs`). Sin acento de color en el borde izquierdo.
- **Sombras:** tinte navy oscuro en todas (cohesión con la tinta de texto).
  Los CTAs coral llevan una sombra de color a juego (`--shadow-md`) para
  destacarlos como la acción dominante.
- **Motion:** transiciones cortas (120–200ms), color/posición únicamente. El
  tablero usa `yv-pulse` (glow suave) en la fila "En puerta" para llamar la
  atención sin ser agresivo, y un pulso de tres barras para "voceando".
  Loaders: skeleton shimmer para listas, nunca spinner de pantalla completa.
- **Transparencia:** overlays oscuros (`rgba(14,31,48,.34)`) solo para
  bloquear contenido en el estado "seguimiento en pausa" de la app del padre.
  Sin `backdrop-blur`.
- **Layout:** portal de escritorio con sidebar fija de 240px; app del padre
  mobile-first (390px) con hoja inferior (bottom sheet) para el detalle de
  seguimiento sobre el mapa; tablero a pantalla completa sin chrome de navegador.

## Iconografía

Íconos de línea dibujados a mano en SVG inline (stroke 1.8–2.4, sin relleno),
siguiendo la convención de trazo de **Lucide** pero no se usa el paquete —
si se retoma producción real, sustituir por `lucide-react` (mismo grosor de
trazo) para consistencia y mantenibilidad. No hay sprite ni fuente de íconos
propia todavía. Emoji: nunca.

## Intentional additions

No hubo fuente externa (Figma/codebase) que definiera un inventario de
componentes — el set de `components/` se derivó de los patrones que ya se
repetían en las pantallas construidas (Button, Badge, Card, Avatar, Toggle,
SegmentedTabs, EmptyState, ErrorState, SkeletonRow, NavItem). No se añadió
ningún primitivo especulativo fuera de ese uso observado.

## Caveats

- No se proporcionó un archivo de fuente para Schibsted Grotesk — se carga
  desde Google Fonts en cada consumidor; si existe una versión con licencia
  propia, reemplazar el `@font-face` en `tokens/typography.css`.
- Los `ui_kits/` cubren ahora el inventario completo de pantallas del proyecto
  origen: Institución (incl. Dashboard en vivo — antes faltante), Operador
  global, App móvil, Portal tutor, Tablero en sus 3 modos, Puerta, Acceso, y
  el patrón "Estados transversales" (ahora en `guidelines/`). Solo quedan
  fuera: onboarding y código QR de entrega de la app móvil, historial de
  recogidas, y 2 documentos que ya cumplieron su propósito de exploración
  (direcciones de logo, direcciones de tablero) cuyo resultado ya vive en
  `assets/` y en `Tablero - Producción`.
- `templates/` da cobertura a los 5 flujos principales (Acceso, Portal admin
  rol Institución, App padre, Tablero modo Andén, Puerta) como starting points
  para Claude Code. Simplificaciones respecto al `ui_kits/` completo: Portal
  admin template no incluye el rol Operador global ni las pantallas
  Institución/Horarios/Personal/Reportes (sí están en el `ui_kits/` de
  referencia); Tablero template solo cubre el modo Andén (no Sereno/Carril);
  App padre template no incluye el Portal tutor web. Usa el `ui_kits/`
  correspondiente como referencia si necesitas esas partes.
- El logo es una exploración propia (no hay marca preexistente que copiar);
  documentado como tal, no como asset legal/registrado.

**Pide iterar:** si algo del color, tono o componentes no se siente bien,
dilo — este sistema se ajusta rápido mientras el producto es joven.
