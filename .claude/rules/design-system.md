# Design system — CasiLlego

> Referencia rápida para construir cualquier pantalla de `apps/portal`,
> `apps/parent` o `apps/board`. Fuente de verdad completa:
> `claude.ai/design/p/cd01f4a5-739d-4e7b-abed-65176746dc0d` ("CasiLlego
> Design System"). Los primitivos ya están portados a código real en
> `packages/ui` (`@casillego/ui`, ver ADR-036 en `docs/decisiones.md`).

## Cómo usarlo

```tsx
import { Button, Card, Badge } from '@casillego/ui';
import '@casillego/ui/styles.css'; // ya importado una vez en cada app, en main.tsx
```

Un solo barrel raíz — no hay subpaths por grupo (`/core`, `/feedback`, etc.).

## Componentes disponibles (11)

| Componente | Grupo | Uso |
|---|---|---|
| `Button` | core | `variant`: primary/outline/ghost/destructive/subtle · `size`: sm/md/lg. Solo un `primary` (coral) por vista. |
| `Badge` | core | `tone`: los 5 estados de recogida (`en-route`/`arriving`/`arrived`/`delivered`/`cancelled`) + `approaching` (6º estado, ADR-093, acento violeta de activación) + `brand`/`neutral`. |
| `Card` | core | Superficie base (fondo blanco, borde 1px, sombra `--shadow-xs`) para paneles/listas/stats. |
| `Avatar` | core | Iniciales, acento rotativo por `index` (paleta de 6 colores). |
| `Toggle` | core | Interruptor on/off, coral cuando está activo. |
| `SegmentedTabs` | core | Filtro tipo pastilla, activo en navy. |
| `EmptyState` | feedback | Vacío factual ("Sin recogidas pendientes"), nunca "¡Ups!". |
| `ErrorState` | feedback | Mensaje del backend + código técnico en mono + "Reintentar" siempre visible. |
| `SkeletonRow` | feedback | Shimmer de fila de lista — nunca spinner de pantalla completa. |
| `UpdateBanner` | feedback | Aviso fijo arriba de "hay nueva versión" + acción coral única (ADR-094). Anclado arriba para no chocar con la barra de "¡Ya llegué!" (ADR-092). |
| `NavItem` | navigation | Ítem de sidebar oscuro, activo en coral, badge de conteo opcional. |

Fuente exacta de cada uno: `packages/ui/src/components/{core,feedback,navigation}/*.tsx`.

## Tokens — colores (`packages/ui/src/tokens/colors.css`)

- **Marca:** `--brand` `#FB6A45` (coral) — reservado a la acción primaria, la
  navegación activa y el isotipo. Nunca más de un elemento dominante por
  pantalla. `--brand-strong`, `--brand-soft`, `--brand-shadow` para variantes.
- **Ink (navy):** `--ink-900`…`--ink-50` — texto y superficies oscuras
  (sidebar). `--ink-900` para headings, `--ink-400` para body copy.
- **Superficies:** `--bg-app` `#E9EEF3` (canvas), `--surface` blanco (tarjetas),
  `--surface-muted`, `--surface-sunken`, `--surface-row-alt`.
- **Bordes:** `--border` `#E2E9F0`, `--border-strong`, `--border-hairline`.
- **Sistema de 5 estados de recogida — compartido por los 3 frontends, NO
  recolorear:**
  - `en_route` → `--status-en-route` azul (`#3B82F6`)
  - `arriving` → `--status-arriving` ámbar (`#F59E0B`)
  - `arrived` → `--status-arrived` teal (`#0EA5A4`)
  - `delivered` → `--status-delivered` verde (`#22C55E`)
  - `cancelled` → `--status-cancelled` gris (`#94A3B8`)
  - Cada uno trae variante `-bg`/`-fg` para fondo/texto de badge.
  - **6º estado `approaching`** (ADR-093, radio de activación): NO tiene token
    `--status-*` propio — reutiliza el acento `--accent-violet` (el mismo con
    que `GeofenceMap` pinta el anillo de activación). Etiqueta "Cerca".
- **Semánticos:** `--success`, `--danger` (+ `-bg`/`-border`), `--warning`.
- **Acentos de rol/categoría** (avatares, tags — rotar, no fijar): `--accent-{blue,teal,violet,amber,pink,slate}` (+ `-bg`/`-fg`).

## Tokens — tipografía (`tokens/typography.css`)

- `--font-sans`: **Schibsted Grotesk** (pesos 400–900, vía Google Fonts CDN).
- `--font-mono`: **Fira Code** (self-hosted en `packages/ui/src/fonts/`).
- Escala: `--text-2xs` (11px) … `--text-2xl` (18px), y displays
  `--text-display-sm/display/display-lg` (28/30/32px) para números clave
  (ETA, reloj del tablero) con `font-variant-numeric: tabular-nums`.
- Pesos: `--weight-regular` (400) … `--weight-black` (900).

## Tokens — spacing/radios/sombras (`tokens/spacing.css`)

- Spacing: `--space-1` (3px) … `--space-10` (24px).
- Radios: `--radius-sm` (8px, chips) → `--radius-lg` (11px, botones/nav) →
  `--radius-2xl` (16px, paneles) → `--radius-pill` (badges/toggles). Nunca
  esquinas cuadradas en superficies interactivas.
- Sombras con tinte navy: `--shadow-xs` (tarjetas), `--shadow-md` (glow de
  marca en CTAs coral).
- Motion: `--motion-fast/base/slow` (120/150/200ms), transiciones cortas de
  color/posición únicamente.

## Contenido y voz (aplica a todo texto visible)

- **Idioma:** español (es-MX) en toda la UI — nunca inglés.
- **Pronombres:** tú, nunca usted.
- **Botones:** verbos imperativos cortos, sentence case — "Invitar usuario",
  "Reintentar", nunca Title Case.
- **Estados vacíos:** factuales, nunca "¡Ups!".
- **Errores:** mensaje real del backend + fallback "Error desconocido" +
  código técnico discreto en `--font-mono` + "Reintentar" siempre visible.
- **Eyebrows/etiquetas de sección:** MAYÚSCULAS, tracked (`--tracking-eyebrow`).
- **Números/horas:** `es-MX`, reloj 24h (`14:06`), `tabular-nums`.
- **Emoji:** no se usan, nunca.

## Qué NO hacer

- No inventar variantes de componente que no existan en `packages/ui/src/components/`.
- No recolorear el sistema de 5 estados de recogida.
- No usar el coral (`--brand`) en más de un elemento dominante por pantalla.
- Si una pantalla del diseño (`ui_kits/portal-admin` en el proyecto de Claude
  Design) trae un elemento visual sin respaldo de datos en el modelo actual
  (spec/entidad/endpoint), no inventar el campo — ver ADR-034 y ADR-035 como
  precedente de cómo se resuelve (visible pero deshabilitado / placeholder
  estático, con su propio ADR si es un caso nuevo).
