# API Contract — Bandeja de instituciones del super-admin (WebSocket)

Contrato del **puente WebSocket** que el `api` expone para
`InstitutionApproval.tsx` (`apps/portal`, ADR-087): la bandeja del
super-admin que aprueba, suspende y reactiva instituciones. No es REST y
no es MQTT: es el canal por el que el navegador recibe, en vivo, las
transiciones de `institutions.status` que ejecuta cualquier super-admin.

Existe por ADR-050/ADR-087: **el navegador nunca se conecta directamente
al broker MQTT**. El `api` mantiene la única suscripción al broker y
reenvía a cada cliente autorizado los mensajes de este topic. Desde la
perspectiva de Mosquitto no hay ninguna conexión nueva.

Este canal transporta **solo deltas**. El estado inicial se obtiene por
REST con `GET /admin/institutions?status=...`
(`specs/api-contracts/admin-institutions.md`) — dos mecanismos separados,
nunca uno híbrido (mismo criterio que ADR-050 punto 6).

## Endpoint

```
wss://{host}/ws/admin/institutions?accessToken={jwt}
```

Sin el prefijo `/api` del REST — mismo criterio que los demás canales.
**Sin ningún otro query param**: a diferencia de todo canal hermano, este
no tiene scope — no hay `institutionId` ni ningún otro identificador que
pasar, porque el super-admin ve las transiciones de todas las
instituciones a la vez.

### Por qué el token va en el query string

Misma razón que los demás canales: la API `WebSocket` nativa del
navegador no permite fijar headers en el handshake (ADR-050 punto 3).
`accessToken` viaja como query param, nunca el refresh token.

## Autorización de la conexión

Se valida al momento de conectar, no por mensaje — mismo criterio que los
demás canales.

1. `accessToken` presente y bien formado.
2. El JWT verifica firma y expiración.
3. El usuario del token es super-admin (`users.is_super_admin`, claim
   `isSuperAdmin` del access token) — misma regla que `SuperAdminGuard`
   aplica en REST (`specs/api-contracts/admin-institutions.md`), adaptada
   al contexto de conexión. **Sin verificación de recurso**: no hay una
   institución concreta que resolver, a diferencia de todo canal hermano.

No hay reevaluación posterior — mismo trade-off que los demás canales. Un
`accessToken` que expira no cierra la conexión abierta.

### Códigos de cierre

Mismo rango 4000–4999, espejo de los `code` REST equivalentes.

| Código | `reason` | Caso |
|---|---|---|
| `4400` | `INVALID_PAYLOAD` | falta `accessToken` |
| `4401` | `UNAUTHENTICATED` | el `accessToken` no verifica |
| `4403` | `SUPER_ADMIN_REQUIRED` | el usuario autenticado no es super-admin |

Sin `4404`: no hay recurso individual que pueda no existir en esta
conexión.

## Mensajes servidor → cliente

Un mensaje por cada publicación del broker en
`school-pickup/admin/institutions` — el único topic de origen, sin
comodín (es un topic literal, no hay segmento variable que capturar). El
cuerpo es exactamente `InstitutionAdminPayload` (`packages/shared`,
`buildInstitutionAdminPayload()`) — mismo campo a campo que
`AdminInstitutionListItem` (`GET /admin/institutions`), sin envoltura ni
campos añadidos.

`InstitutionsService` publica en `approve`/`suspend`/`reactivate` —
**no** en el alta de una institución nueva (esa pantalla de espera no
existe hoy del lado de la institución, ADR-087 punto 4): una institución
que se registra por primera vez no aparece en este canal hasta su primera
transición de estado. El snapshot REST inicial sigue siendo la única
forma de ver instituciones `pending` que nunca tuvieron una transición.

Cada cliente recibe todos los mensajes de este canal — no hay filtrado
por institución, a diferencia de todo canal hermano: el super-admin ve
todas las instituciones a la vez.

## Mensajes cliente → servidor

Ninguno. Canal unidireccional — mismo criterio que los demás. Las
transiciones van por REST
(`PATCH /institutions/:id/approve|suspend|reactivate`).

## Reconexión

Responsabilidad del frontend — al reconectar, vuelve a pedir el snapshot
REST (con el filtro de `status` activo en pantalla) antes de reanudar el
consumo de deltas.

## Referencias

- ADR-050 (patrón original del puente WebSocket).
- ADR-087 (decisión completa de este canal: scope global, publish solo en
  transiciones de estado, alcance confirmado).
- ADR-038/ADR-040 (`SuperAdminGuard`, namespace `/admin/`, las tres
  transiciones de `institutions.status`).
- `specs/api-contracts/admin-institutions.md` (snapshot REST que precede
  a este canal).
- `specs/api-contracts/enrollments-ws.md` (canal hermano, mismo patrón,
  con scope por institución/tutor en vez de global).
