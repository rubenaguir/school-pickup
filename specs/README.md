# Specs — Spec Driven Development (SDD)

> Documentación en español; identificadores en inglés, consistente con
> `CLAUDE.md`.

## Qué es y por qué

Spec Driven Development (SDD) significa escribir, antes de tocar código, una
especificación por pieza del dominio (entidad, funcionalidad, contrato de
API, pantalla) que documente decisiones de detalle que no caben ni en
`docs/modelo-datos.md` (que es un resumen a nivel de tabla) ni en un ADR (que
documenta el "por qué" de una decisión puntual, no el detalle completo de
implementación).

En este proyecto se adopta por dos razones concretas:
- **Rigor antes de implementar.** Fijar tipos concretos, constraints,
  índices e invariantes de negocio en texto revisable antes de escribir
  entidades de TypeORM y migraciones reduce el retrabajo y evita decisiones
  implícitas tomadas "sobre la marcha" al codificar.
- **Trazabilidad para la defensa del máster.** Cada spec enlaza a los ADRs
  de `docs/decisiones.md` que la sustentan, de modo que cualquier decisión de
  modelado pueda explicarse y defenderse con su razonamiento completo, no solo
  con el resultado final en el esquema.

## Tipos de spec

### `entities/`
Una spec por entidad del modelo de datos (`docs/modelo-datos.md`). Cubre
detalle de implementación que la tabla resumen de `modelo-datos.md` no
recoge: tipos concretos de PostgreSQL/TypeORM, constraints exactas, índices
recomendados según los patrones de consulta ya conocidos del dominio, y las
invariantes de negocio que no se expresan como un simple constraint de
columna (reglas que cruzan tablas, reglas condicionadas por el estado de
otra entidad, etc.).

**Template obligatorio (7 secciones).** Cada spec de `entities/` debe tener,
en este orden, las siguientes 7 secciones —incluso cuando una no aplique, en
cuyo caso se incluye igual con una nota explícita (ej. "Sin columnas enum"):

1. **Propósito** — qué modela la entidad y por qué existe.
2. **Campos** — tabla de columnas con tipo TypeORM/PostgreSQL, constraints y notas.
3. **Relaciones** — FKs entrantes/salientes y su comportamiento `ON DELETE`.
4. **Índices** — índices e índices únicos (incluidos los parciales).
5. **Invariantes de negocio** — cada regla con su mecanismo de aplicación:
   un constraint/índice de esquema, o una nota explícita de validación en capa
   de servicio (ADR-021: cada invariante → un test o un constraint de BD).
6. **Enums** — dominios de valores y transiciones; "Sin columnas enum" si no aplica.
7. **Referencias** — enlaces a los ADRs y specs que sustentan las decisiones.

Ver ADR-026 (formalización del template, antes patrón de facto).

### `features/`
Una spec por funcionalidad (ej. "aprobar enrollment", "iniciar pickup
request", "recalcular ETA"). Debe incluir: qué entidades involucra,
precondiciones y postcondiciones, casos de uso en formato Given/When/Then, y
referencias al contrato de API (`api-contracts/`) y a los topics MQTT
correspondientes cuando aplique.

**Nota de arquitectura (ADR-017):** las specs de `features/` que involucren
cálculo de ETA, envío de correo transaccional o publicación/consumo de MQTT
deben referenciar el port correspondiente (`MapsProvider`, `EmailProvider`,
`MqttClient` — ver `docs/arquitectura.md`) en vez de asumir una
implementación concreta. Cualquier feature que involucre transiciones de
`pickup_request.status` debe referenciar la máquina de estados compartida en
`packages/shared` (ver `specs/entities/pickup_request.md` y ADR-017), no
reimplementar la validación de transición dentro de la feature.

### `api-contracts/`
Un documento por recurso REST expuesto por `api`. Endpoints, shape exacto de
request/response, códigos de error y reglas de autorización (qué rol o
condición se necesita para cada operación).

### `ui-screens/`
Un documento por pantalla "hero" o compleja (ej. tablero de institución,
consola de puerta, "Camino A" del padre). Mapeo campo↔entidad, estados
posibles de la pantalla, y acciones disponibles en cada estado.

## Estado actual

- **`entities/`** — 14 archivos, completo (las 14 entidades del dominio).
- **`features/`** — 23 archivos, completo. Organizados en 4 vertical slices:
  auth/enrollment (001–007), configuración de institución (008–013),
  vehículos/tutores autorizados (014–017) y flujo de `pickup_request`
  (018–023).
- **`api-contracts/`** — 12 archivos, completo.
- **`ui-screens/`** — vacía (con `.gitkeep`): pendiente de los tokens del
  design system antes de poder especificarse. Ver `docs/plan-implementacion.md`.

## Orden de migración

Orden topológico para crear las tablas sin romper FKs. Verificado contra las
FKs documentadas en cada spec de `entities/`; ninguna entidad tuvo que
moverse de la posición propuesta originalmente porque cada una solo depende
de entidades que ya aparecen antes en la lista.

1. `users`
2. `institutions`
3. `institution_members` — depende de `users`, `institutions`
4. `delivery_points` — depende de `institutions`; `operator_user_id` depende de `users`
5. `students` — depende de `users` (`created_by_user_id`)
6. `student_guardians` — depende de `students`, `users`
7. `vehicles` — depende de `users`
8. `enrollments` — depende de `students`, `institutions`, `users`
9. `pickup_requests` — depende de `enrollments`, `users`, `delivery_points`, `vehicles`
10. `pickup_request_status_history` — depende de `pickup_requests`, `users`
11. `location_updates` — depende de `pickup_requests`
12. `dismissal_windows` — depende de `institutions`
13. `dismissal_exceptions` — depende de `institutions`
14. `audit_log` — depende de `users` (nullable)

## Referencias cruzadas

- `docs/modelo-datos.md` — modelo entidad-relación, fuente de verdad de campos y tipos a nivel resumen.
- `docs/decisiones.md` — ADRs referenciados desde cada spec.
- `docs/arquitectura.md` — arquitectura de capas, ports (`MapsProvider`, `EmailProvider`, `MqttClient`, `LocationProvider`) y ubicación de la máquina de estados compartida.
- ADR-017 — arquitectura de capas simple, sin Clean Architecture completa.
